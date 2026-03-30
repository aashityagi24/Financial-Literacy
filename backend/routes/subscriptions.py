"""Subscription and Razorpay payment routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import razorpay
import hmac
import hashlib

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Razorpay client
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# ============== MODELS ==============

class CreateOrderRequest(BaseModel):
    plan_type: str  # "single_parent" or "two_parents"
    duration: str   # "1_day", "1_month", "6_months", "1_year"
    num_children: int  # 1-5
    subscriber_name: str
    subscriber_email: str
    subscriber_phone: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class PlanConfigUpdate(BaseModel):
    plan_type: str
    duration: str
    base_price: int
    child_prices: list  # [2nd_child, 3rd_child, 4th_child, 5th_child]
    extra_child_per_day: float = 0


# ============== HELPER FUNCTIONS ==============

DURATION_MAP = {
    "1_day": {"days": 1, "label": "1 Day"},
    "1_month": {"days": 30, "label": "1 Month"},
    "6_months": {"days": 180, "label": "6 Months"},
    "1_year": {"days": 365, "label": "1 Year"},
}

DEFAULT_PLANS = {
    "single_parent": {
        "1_day": {"base_price": 49, "child_prices": [29, 25, 20, 15], "extra_child_per_day": 29},
        "1_month": {"base_price": 499, "child_prices": [179, 149, 119, 99], "extra_child_per_day": 6.0},
        "6_months": {"base_price": 2299, "child_prices": [799, 649, 519, 399], "extra_child_per_day": 4.4},
        "1_year": {"base_price": 3999, "child_prices": [1299, 1049, 849, 649], "extra_child_per_day": 3.6},
    },
    "two_parents": {
        "1_day": {"base_price": 69, "child_prices": [39, 35, 29, 22], "extra_child_per_day": 39},
        "1_month": {"base_price": 649, "child_prices": [219, 179, 149, 119], "extra_child_per_day": 7.3},
        "6_months": {"base_price": 2999, "child_prices": [999, 799, 649, 499], "extra_child_per_day": 5.5},
        "1_year": {"base_price": 5199, "child_prices": [1599, 1299, 1049, 799], "extra_child_per_day": 4.4},
    }
}


async def get_plan_pricing(plan_type: str, duration: str):
    """Get pricing from DB or fall back to defaults"""
    db = get_db()
    config = await db.subscription_plan_config.find_one(
        {"plan_type": plan_type, "duration": duration}, {"_id": 0}
    )
    if config and "child_prices" in config:
        return {
            "base_price": config["base_price"],
            "child_prices": config["child_prices"],
            "extra_child_per_day": config.get("extra_child_per_day", 0),
        }
    # Legacy fallback: convert old per_child_price to child_prices array
    if config and "per_child_price" in config:
        p = config["per_child_price"]
        return {
            "base_price": config["base_price"],
            "child_prices": [p, p, p, p],
            "extra_child_per_day": 0,
        }
    default = DEFAULT_PLANS.get(plan_type, {}).get(duration, {"base_price": 500, "child_prices": [200, 200, 200, 200], "extra_child_per_day": 0})
    return default


def calculate_total(pricing: dict, num_children: int) -> int:
    """Calculate total: base includes 1 child, additional children have tiered pricing"""
    total = pricing["base_price"]
    child_prices = pricing.get("child_prices", [])
    for i in range(1, num_children):
        if i - 1 < len(child_prices):
            total += child_prices[i - 1]
        # Beyond defined tiers, no extra charge (shouldn't happen with max 5)
    return total


# ============== PUBLIC ROUTES (No auth needed) ==============

@router.get("/plans")
async def get_plans():
    """Get all plan pricing for display on homepage"""
    plans = {}
    
    for plan_type in ["single_parent", "two_parents"]:
        plans[plan_type] = {}
        for duration in DURATION_MAP:
            pricing = await get_plan_pricing(plan_type, duration)
            plans[plan_type][duration] = {
                "base_price": pricing["base_price"],
                "child_prices": pricing["child_prices"],
                "extra_child_per_day": pricing.get("extra_child_per_day", 0),
                "duration_label": DURATION_MAP[duration]["label"],
                "duration_days": DURATION_MAP[duration]["days"],
            }
    
    return {
        "plans": plans,
        "max_children": 5,
        "plan_types": {
            "single_parent": {"label": "Single Parent Plan", "max_parents": 1, "base_children": 1},
            "two_parents": {"label": "Two Parents Plan", "max_parents": 2, "base_children": 1},
        }
    }


@router.post("/capture-lead")
async def capture_checkout_lead(request: Request):
    """Capture lead when user fills checkout form, even if they don't complete payment"""
    db = get_db()
    body = await request.json()
    
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    plan_type = body.get("plan_type", "")
    duration = body.get("duration", "")
    num_children = body.get("num_children", 1)
    lead_status = body.get("lead_status", "form_closed")
    
    if not email:
        return {"message": "skipped"}
    
    # Upsert — update if same email already exists, so we don't create duplicates
    # Only upgrade status (form_closed -> form_submitted), never downgrade
    existing = await db.checkout_leads.find_one({"email": email})
    
    status_priority = {"form_closed": 0, "form_submitted": 1, "converted": 2}
    if existing:
        current_priority = status_priority.get(existing.get("lead_status", "form_closed"), 0)
        new_priority = status_priority.get(lead_status, 0)
        final_status = lead_status if new_priority >= current_priority else existing.get("lead_status", "form_closed")
        
        await db.checkout_leads.update_one(
            {"email": email},
            {"$set": {
                "name": name or existing.get("name", ""),
                "phone": phone or existing.get("phone", ""),
                "plan_type": plan_type,
                "duration": duration,
                "num_children": num_children,
                "lead_status": final_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
    else:
        await db.checkout_leads.insert_one({
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
            "name": name,
            "email": email,
            "phone": phone,
            "plan_type": plan_type,
            "duration": duration,
            "num_children": num_children,
            "lead_status": lead_status,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "converted": False,
        })
        # Notify admins of new checkout lead
        try:
            from routes.notifications import notify_admins
            await notify_admins(
                "new_checkout_lead",
                "New Checkout Lead",
                f"{name or email} started checkout ({plan_type}, {num_children} child{'ren' if num_children > 1 else ''})",
                related_id=email
            )
        except Exception:
            pass
    return {"message": "lead captured"}


@router.post("/create-order")
async def create_order(order: CreateOrderRequest):
    """Create a Razorpay order for subscription purchase"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    db = get_db()
    
    # Validate inputs
    if order.plan_type not in ["single_parent", "two_parents"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    if order.duration not in DURATION_MAP:
        raise HTTPException(status_code=400, detail="Invalid duration")
    if order.num_children < 1 or order.num_children > 5:
        raise HTTPException(status_code=400, detail="Children count must be 1-5")
    
    # Get pricing
    pricing = await get_plan_pricing(order.plan_type, order.duration)
    total_amount = calculate_total(pricing, order.num_children)
    amount_paise = total_amount * 100  # Razorpay expects paise
    
    # Create Razorpay order
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    receipt = subscription_id[:40]  # Receipt max 40 chars
    
    try:
        razor_order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
            "notes": {
                "subscription_id": subscription_id,
                "plan_type": order.plan_type,
                "duration": order.duration,
                "num_children": str(order.num_children),
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Payment order creation failed: {str(e)}")
    
    # Calculate dates
    duration_info = DURATION_MAP[order.duration]
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=duration_info["days"])
    
    # Store pending subscription
    subscription = {
        "subscription_id": subscription_id,
        "plan_type": order.plan_type,
        "duration": order.duration,
        "duration_label": duration_info["label"],
        "num_parents": 2 if order.plan_type == "two_parents" else 1,
        "num_children": order.num_children,
        "amount": total_amount,
        "razorpay_order_id": razor_order["id"],
        "razorpay_payment_id": None,
        "payment_status": "pending",
        "subscriber_name": order.subscriber_name.strip(),
        "subscriber_email": order.subscriber_email.strip().lower(),
        "subscriber_phone": order.subscriber_phone.strip(),
        "parent_emails": [order.subscriber_email.strip().lower()],
        "child_user_ids": [],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "is_active": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.subscriptions.insert_one(subscription)
    
    return {
        "order_id": razor_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "subscription_id": subscription_id,
        "key_id": RAZORPAY_KEY_ID,
    }


@router.post("/verify-payment")
async def verify_payment(payment: VerifyPaymentRequest):
    """Verify Razorpay payment and activate subscription"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    db = get_db()
    
    # Verify signature
    try:
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            f"{payment.razorpay_order_id}|{payment.razorpay_payment_id}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != payment.razorpay_signature:
            raise HTTPException(status_code=400, detail="Payment verification failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification error: {str(e)}")
    
    # Find and update subscription
    subscription = await db.subscriptions.find_one(
        {"razorpay_order_id": payment.razorpay_order_id}, {"_id": 0}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if subscription["payment_status"] == "completed":
        return {"message": "Payment already verified", "subscription_id": subscription["subscription_id"]}
    
    # Activate subscription
    now = datetime.now(timezone.utc)
    duration_info = DURATION_MAP[subscription["duration"]]
    end_date = now + timedelta(days=duration_info["days"])
    
    await db.subscriptions.update_one(
        {"razorpay_order_id": payment.razorpay_order_id},
        {"$set": {
            "razorpay_payment_id": payment.razorpay_payment_id,
            "payment_status": "completed",
            "is_active": True,
            "start_date": now.isoformat(),
            "end_date": end_date.isoformat(),
            "activated_at": now.isoformat(),
        }}
    )
    
    # Mark lead as converted
    await db.checkout_leads.update_one(
        {"email": subscription.get("subscriber_email", "").lower()},
        {"$set": {"converted": True, "lead_status": "converted", "converted_at": now.isoformat()}}
    )
    
    # Notify admins of new subscription
    try:
        from routes.notifications import notify_admins
        plan_label = "Two Parents" if subscription.get("plan_type") == "two_parents" else "Single Parent"
        dur_label = DURATION_MAP.get(subscription.get("duration", ""), {}).get("label", subscription.get("duration", ""))
        await notify_admins(
            "new_subscription",
            "New Subscription",
            f"{subscription.get('subscriber_name', subscription.get('subscriber_email', 'Someone'))} subscribed to {plan_label} ({dur_label}, {subscription.get('num_children', 1)} child{'ren' if subscription.get('num_children', 1) > 1 else ''}) - Rs.{subscription.get('amount', 0)}",
            related_id=subscription.get("subscription_id")
        )
    except Exception:
        pass
    
    return {
        "message": "Payment verified successfully",
        "subscription_id": subscription["subscription_id"],
        "subscriber_email": subscription["subscriber_email"],
    }


@router.get("/check-access/{email}")
async def check_subscription_access(email: str):
    """Check if an email has an active subscription (used during login)"""
    db = get_db()
    email = email.strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    
    subscription = await db.subscriptions.find_one({
        "parent_emails": email,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now}
    }, {"_id": 0})
    
    if subscription:
        return {
            "has_access": True,
            "subscription_id": subscription["subscription_id"],
            "plan_type": subscription["plan_type"],
            "end_date": subscription["end_date"],
            "num_children": subscription["num_children"],
            "num_parents": subscription["num_parents"],
        }
    
    return {"has_access": False}


# ============== PARENT ROUTES ==============

class AddParentRequest(BaseModel):
    email: str

@router.get("/my-subscription")
async def get_my_subscription(request: Request):
    """Get the current parent's subscription details"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    email = user.get("email", "").strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    
    sub = await db.subscriptions.find_one({
        "parent_emails": email,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now}
    }, {"_id": 0})
    
    if not sub:
        return {"subscription": None}
    
    return {"subscription": sub}


@router.post("/add-parent")
async def add_second_parent(request: Request, body: AddParentRequest):
    """Add a second parent email to a two_parents subscription"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    email = user.get("email", "").strip().lower()
    second_email = body.email.strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    
    if not second_email or "@" not in second_email:
        raise HTTPException(status_code=400, detail="Please enter a valid email")
    
    if second_email == email:
        raise HTTPException(status_code=400, detail="Cannot add your own email")
    
    # Find the parent's active subscription
    sub = await db.subscriptions.find_one({
        "parent_emails": email,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now}
    })
    
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    if sub.get("plan_type") != "two_parents":
        raise HTTPException(status_code=400, detail="Your plan only supports a single parent login")
    
    if len(sub.get("parent_emails", [])) >= 2:
        raise HTTPException(status_code=400, detail="Second parent already added")
    
    # Add the second parent email
    await db.subscriptions.update_one(
        {"subscription_id": sub["subscription_id"]},
        {"$addToSet": {"parent_emails": second_email}}
    )
    
    return {"message": f"Second parent ({second_email}) added successfully"}


@router.delete("/remove-parent")
async def remove_second_parent(request: Request, email: str):
    """Remove the second parent from the subscription"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    owner_email = user.get("email", "").strip().lower()
    target_email = email.strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    
    sub = await db.subscriptions.find_one({
        "parent_emails": owner_email,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now}
    })
    
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    if target_email == sub.get("subscriber_email", ""):
        raise HTTPException(status_code=400, detail="Cannot remove the primary subscriber")
    
    await db.subscriptions.update_one(
        {"subscription_id": sub["subscription_id"]},
        {"$pull": {"parent_emails": target_email}}
    )
    
    return {"message": "Second parent removed"}


# ============== ADMIN ROUTES ==============

@router.get("/admin/list")
async def admin_list_subscriptions(request: Request):
    """Admin: List all subscriptions with linked users and renewal info"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    subscriptions = await db.subscriptions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Count subscriptions per email to detect renewals
    email_sub_count = {}
    for sub in subscriptions:
        if sub.get("payment_status") == "completed":
            email = sub.get("subscriber_email", "").lower()
            if email:
                email_sub_count[email] = email_sub_count.get(email, 0) + 1
    
    # Fetch all users and parent-child links for lookups
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}).to_list(2000)
    email_to_user = {u.get("email", "").lower(): u for u in all_users if u.get("email")}
    userid_to_user = {u["user_id"]: u for u in all_users}
    
    all_links = await db.parent_child_links.find({"status": "active"}, {"_id": 0}).to_list(2000)
    parent_to_children = {}
    for link in all_links:
        pid = link.get("parent_id")
        cid = link.get("child_id")
        if pid not in parent_to_children:
            parent_to_children[pid] = []
        parent_to_children[pid].append(cid)
    
    # Enrich each subscription
    for sub in subscriptions:
        email = sub.get("subscriber_email", "").lower()
        sub["is_renewal"] = email_sub_count.get(email, 0) > 1
        
        # Build linked users list
        linked = []
        for pe in sub.get("parent_emails", []):
            pe_lower = pe.lower()
            u = email_to_user.get(pe_lower)
            if u:
                entry = {"name": u.get("name", pe), "email": pe, "role": "parent"}
                # Find children linked to this parent
                children = []
                for child_id in parent_to_children.get(u["user_id"], []):
                    child = userid_to_user.get(child_id)
                    if child:
                        children.append({"name": child.get("name", ""), "email": child.get("email", ""), "role": "child"})
                entry["children"] = children
                linked.append(entry)
            else:
                linked.append({"name": pe, "email": pe, "role": "parent", "children": []})
        
        # Also include child_user_ids directly on the subscription
        for cid in sub.get("child_user_ids", []):
            child = userid_to_user.get(cid)
            if child:
                # Only add if not already listed under a parent
                already = any(c["email"] == child.get("email", "") for p in linked for c in p.get("children", []))
                if not already:
                    linked.append({"name": child.get("name", ""), "email": child.get("email", ""), "role": "child", "children": []})
        
        sub["linked_users"] = linked
    
    return subscriptions


@router.get("/admin/checkout-leads")
async def admin_get_checkout_leads(request: Request):
    """Admin: List checkout leads - excludes converted (they show in subscriptions)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    leads = await db.checkout_leads.find(
        {"converted": {"$ne": True}}, {"_id": 0}
    ).sort("updated_at", -1).to_list(500)
    return leads


@router.delete("/admin/checkout-leads/{lead_id}")
async def delete_checkout_lead(lead_id: str, request: Request):
    """Admin: Permanently delete a checkout lead"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.checkout_leads.delete_one({"lead_id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

@router.delete("/admin/checkout-leads-bulk")
async def bulk_delete_checkout_leads(request: Request):
    """Admin: Permanently delete multiple checkout leads"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    ids = body.get("lead_ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.checkout_leads.delete_many({"lead_id": {"$in": ids}})
    return {"message": f"Deleted {result.deleted_count} leads"}


@router.get("/admin/plan-config")
async def admin_get_plan_config(request: Request):
    """Admin: Get all plan pricing config"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    configs = await db.subscription_plan_config.find({}, {"_id": 0}).to_list(100)
    
    # Build full config with defaults
    all_plans = {}
    for plan_type in ["single_parent", "two_parents"]:
        all_plans[plan_type] = {}
        for duration in DURATION_MAP:
            db_config = next(
                (c for c in configs if c["plan_type"] == plan_type and c["duration"] == duration),
                None
            )
            if db_config and "child_prices" in db_config:
                all_plans[plan_type][duration] = {
                    "base_price": db_config["base_price"],
                    "child_prices": db_config["child_prices"],
                    "extra_child_per_day": db_config.get("extra_child_per_day", 0),
                }
            elif db_config and "per_child_price" in db_config:
                # Legacy migration
                p = db_config["per_child_price"]
                all_plans[plan_type][duration] = {
                    "base_price": db_config["base_price"],
                    "child_prices": [p, p, p, p],
                    "extra_child_per_day": 0,
                }
            else:
                all_plans[plan_type][duration] = DEFAULT_PLANS[plan_type][duration]
    
    return all_plans


@router.post("/admin/plan-config")
async def admin_update_plan_config(request: Request, config: PlanConfigUpdate):
    """Admin: Update pricing for a specific plan"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if config.plan_type not in ["single_parent", "two_parents"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    if config.duration not in DURATION_MAP:
        raise HTTPException(status_code=400, detail="Invalid duration")
    
    await db.subscription_plan_config.update_one(
        {"plan_type": config.plan_type, "duration": config.duration},
        {"$set": {
            "plan_type": config.plan_type,
            "duration": config.duration,
            "base_price": config.base_price,
            "child_prices": config.child_prices,
            "extra_child_per_day": config.extra_child_per_day,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    return {"message": "Plan pricing updated"}


@router.put("/admin/{subscription_id}/toggle")
async def admin_toggle_subscription(request: Request, subscription_id: str):
    """Admin: Activate or deactivate a subscription"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    sub = await db.subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    new_status = not sub.get("is_active", False)
    await db.subscriptions.update_one(
        {"subscription_id": subscription_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Subscription {'activated' if new_status else 'deactivated'}", "is_active": new_status}
