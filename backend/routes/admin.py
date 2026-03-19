"""Admin routes - User management, stats, content administration"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import hashlib

_db = None
UPLOADS_DIR = Path("/app/backend/uploads")

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/admin", tags=["admin"])

class UserCreateAdmin(BaseModel):
    name: str
    email: str
    password: str
    role: str
    grade: Optional[int] = None

class TopicCreate(BaseModel):
    title: str
    description: str
    parent_id: Optional[str] = None
    thumbnail: Optional[str] = None
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5

class LessonCreate(BaseModel):
    topic_id: str
    title: str
    content: str
    lesson_type: str
    media_url: Optional[str] = None
    duration_minutes: int = 5
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5

# User Management
@router.get("/users")
async def get_users(request: Request):
    """Get all users with school info and subscription status"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Get all schools for lookup
    schools = await db.schools.find({}, {"_id": 0, "school_id": 1, "name": 1}).to_list(100)
    school_map = {s["school_id"]: s["name"] for s in schools}
    
    # Get all completed subscriptions for lookup
    now = datetime.now(timezone.utc).isoformat()
    all_subs = await db.subscriptions.find({
        "payment_status": "completed",
        "is_active": True,
    }, {"_id": 0, "parent_emails": 1, "end_date": 1, "plan_type": 1, "duration": 1, "granted_by_admin": 1}).to_list(1000)
    
    # Build email -> subscription lookup (active vs expired)
    sub_map = {}
    for sub in all_subs:
        for email in sub.get("parent_emails", []):
            is_active = sub["end_date"] > now
            # Prefer active over expired
            existing = sub_map.get(email)
            if not existing or (is_active and existing["subscription_status"] != "active"):
                sub_map[email] = {
                    "subscription_status": "active" if is_active else "expired",
                    "end_date": sub["end_date"],
                    "plan_type": sub.get("plan_type", ""),
                    "duration": sub.get("duration", ""),
                    "granted_by_admin": sub.get("granted_by_admin", False)
                }
    
    # Add school_name and subscription_status to each user
    for user in users:
        school_id = user.get("school_id")
        user["school_name"] = school_map.get(school_id) if school_id else None
        email = user.get("email", "").lower()
        if email in sub_map:
            user["subscription_status"] = sub_map[email]["subscription_status"]
            user["subscription_end_date"] = sub_map[email]["end_date"]
            user["subscription_granted_by_admin"] = sub_map[email].get("granted_by_admin", False)
        else:
            user["subscription_status"] = "inactive"
    
    return users

@router.post("/users")
async def create_user(data: UserCreateAdmin, request: Request):
    """Create a new user with password"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    # Check for existing user by email only (name, role, grade can be duplicated)
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    try:
        # Hash the password
        password_hash = hashlib.sha256(data.password.encode()).hexdigest()
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "name": data.name.strip(),
            "username": data.email.split('@')[0].lower(),  # Create username from email
            "email": data.email.lower().strip(),
            "password_hash": password_hash,
            "role": data.role,
            "grade": data.grade if data.role == "child" else None,
            "balance": 100.0 if data.role == "child" else 0,
            "streak_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        
        # Create wallet accounts for children
        if data.role == "child":
            for account_type in ["spending", "savings", "investing", "gifting"]:
                await db.wallet_accounts.insert_one({
                    "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                    "user_id": user_id,
                    "account_type": account_type,
                    "balance": 100.0 if account_type == "spending" else 0.0,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        
        return {"message": f"User {data.name} created successfully", "user_id": user_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request):
    """Update user role"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_role = body.get("role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated"}

@router.put("/users/{user_id}/grade")
async def update_user_grade(user_id: str, request: Request):
    """Update user grade (K=0, 1-5)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_grade = body.get("grade")
    
    if new_grade is not None and (not isinstance(new_grade, int) or new_grade < 0 or new_grade > 5):
        raise HTTPException(status_code=400, detail="Grade must be 0 (K) through 5")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"grade": new_grade}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"Grade updated to {new_grade if new_grade else 'none'}"}


ADMIN_SUB_DURATION_MAP = {
    "1_day": {"days": 1, "label": "1 Day"},
    "1_week": {"days": 7, "label": "1 Week"},
    "1_month": {"days": 30, "label": "1 Month"},
}

@router.put("/users/{user_id}/subscription")
async def update_user_subscription(user_id: str, request: Request):
    """Admin grants or revokes subscription access for a user"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    status = body.get("status")  # "active" or "inactive"
    duration = body.get("duration")  # "1_day", "1_week", "1_month"
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="User has no email")
    
    if status == "active":
        if not duration or duration not in ADMIN_SUB_DURATION_MAP:
            raise HTTPException(status_code=400, detail="Valid duration required: 1_day, 1_week, 1_month")
        
        dur = ADMIN_SUB_DURATION_MAP[duration]
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=dur["days"])
        
        # Check if user already has an active admin-granted subscription
        existing = await db.subscriptions.find_one({
            "parent_emails": email,
            "granted_by_admin": True,
            "is_active": True
        })
        
        if existing:
            # Update existing
            await db.subscriptions.update_one(
                {"subscription_id": existing["subscription_id"]},
                {"$set": {
                    "start_date": now.isoformat(),
                    "end_date": end_date.isoformat(),
                    "duration": duration,
                    "duration_label": dur["label"],
                    "is_active": True,
                    "payment_status": "completed",
                }}
            )
        else:
            # Create new admin-granted subscription
            sub_id = f"sub_{uuid.uuid4().hex[:12]}"
            await db.subscriptions.insert_one({
                "subscription_id": sub_id,
                "plan_type": "admin_granted",
                "duration": duration,
                "duration_label": dur["label"],
                "num_parents": 1,
                "num_children": 5,
                "amount": 0,
                "razorpay_order_id": None,
                "razorpay_payment_id": None,
                "payment_status": "completed",
                "subscriber_name": user.get("name", ""),
                "subscriber_email": email,
                "subscriber_phone": "",
                "parent_emails": [email],
                "child_user_ids": [],
                "start_date": now.isoformat(),
                "end_date": end_date.isoformat(),
                "is_active": True,
                "granted_by_admin": True,
                "created_at": now.isoformat(),
            })
        
        return {"message": f"Subscription activated for {dur['label']}", "end_date": end_date.isoformat()}
    
    elif status == "inactive":
        # Deactivate all admin-granted subscriptions for this user
        result = await db.subscriptions.update_many(
            {"parent_emails": email, "granted_by_admin": True},
            {"$set": {"is_active": False}}
        )
        return {"message": "Subscription deactivated", "modified": result.modified_count}
    
    raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")


@router.post("/school-enquiry")
async def submit_school_enquiry(request: Request):
    """Submit a school subscription enquiry - public endpoint"""
    db = get_db()
    body = await request.json()
    
    school_name = (body.get("school_name") or "").strip()
    person_name = (body.get("person_name") or "").strip()
    contact_number = (body.get("contact_number") or "").strip()
    email = (body.get("email") or "").strip().lower()
    city = (body.get("city") or "").strip()
    designation = (body.get("designation") or "").strip()
    grades = body.get("grades", [])
    
    if not school_name:
        raise HTTPException(status_code=400, detail="School name is required")
    if not person_name:
        raise HTTPException(status_code=400, detail="Contact person name is required")
    if not contact_number or len(contact_number.replace(" ", "").replace("+", "")) < 10:
        raise HTTPException(status_code=400, detail="Valid contact number is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    
    enquiry = {
        "enquiry_id": f"enq_{uuid.uuid4().hex[:12]}",
        "school_name": school_name,
        "person_name": person_name,
        "contact_number": contact_number,
        "email": email,
        "city": city,
        "designation": designation,
        "grades": grades,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.school_enquiries.insert_one(enquiry)
    return {"message": "Enquiry submitted successfully", "enquiry_id": enquiry["enquiry_id"]}


@router.get("/school-enquiries")
async def get_school_enquiries(request: Request):
    """Get all school enquiries - admin only"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    enquiries = await db.school_enquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return enquiries


@router.put("/school-enquiries/{enquiry_id}/status")
async def update_enquiry_status(enquiry_id: str, request: Request):
    """Update enquiry status - admin only"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    status = body.get("status", "").strip()
    if status not in ["new", "contacted", "converted", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.school_enquiries.update_one(
        {"enquiry_id": enquiry_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"message": "Status updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user and all related data completely"""
    from services.auth import require_admin
    db = get_db()
    admin = await require_admin(request)
    
    # Don't allow deleting yourself
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    # Cascading delete - remove ALL user data
    await db.users.delete_one({"user_id": user_id})
    await db.wallet_accounts.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"from_user_id": user_id})
    await db.transactions.delete_many({"to_user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.quest_completions.delete_many({"user_id": user_id})
    await db.user_content_progress.delete_many({"user_id": user_id})
    await db.user_achievements.delete_many({"user_id": user_id})
    await db.farms.delete_many({"user_id": user_id})
    await db.stock_portfolios.delete_many({"user_id": user_id})
    await db.savings_goals.delete_many({"child_id": user_id})
    await db.parent_child_links.delete_many({"$or": [{"parent_id": user_id}, {"child_id": user_id}]})
    await db.classroom_students.delete_many({"student_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.gift_requests.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.charitable_donations.delete_many({"user_id": user_id})
    await db.daily_rewards.delete_many({"user_id": user_id})
    await db.avatars.delete_many({"user_id": user_id})
    await db.store_purchases.delete_many({"user_id": user_id})
    
    # If teacher, delete their classrooms and related data
    if user.get("role") == "teacher":
        classrooms = await db.classrooms.find({"teacher_id": user_id}).to_list(100)
        for classroom in classrooms:
            await db.classroom_students.delete_many({"classroom_id": classroom["classroom_id"]})
            await db.announcements.delete_many({"classroom_id": classroom["classroom_id"]})
        await db.classrooms.delete_many({"teacher_id": user_id})
        await db.new_quests.delete_many({"creator_id": user_id, "creator_type": "teacher"})
    
    # If parent, delete their chores/allowances
    if user.get("role") == "parent":
        await db.parent_chores.delete_many({"parent_id": user_id})
        await db.new_quests.delete_many({"creator_id": user_id, "creator_type": "parent"})
        await db.allowances.delete_many({"parent_id": user_id})
        await db.reward_penalties.delete_many({"parent_id": user_id})
        await db.chore_submissions.delete_many({"parent_id": user_id})
    
    # Delete lending/borrowing data
    await db.loans.delete_many({"$or": [{"borrower_id": user_id}, {"lender_id": user_id}]})
    await db.loan_requests.delete_many({"$or": [{"borrower_id": user_id}, {"lender_id": user_id}]})
    await db.credit_scores.delete_many({"user_id": user_id})
    
    # Delete stock holdings
    await db.stock_holdings.delete_many({"user_id": user_id})
    
    # If child, also remove from parent's children array and update parent_id references
    if user.get("role") == "child":
        parent_id = user.get("parent_id")
        if parent_id:
            await db.users.update_one(
                {"user_id": parent_id},
                {"$pull": {"children": {"user_id": user_id}}}
            )
    
    return {"message": f"User {user.get('name', user_id)} and all related data deleted successfully"}

# Stats
@router.get("/stats")
async def get_admin_stats(request: Request):
    """Get platform statistics (admin only)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "children": await db.users.count_documents({"role": "child"}),
            "parents": await db.users.count_documents({"role": "parent"}),
            "teachers": await db.users.count_documents({"role": "teacher"}),
            "admins": await db.users.count_documents({"role": "admin"}),
            "schools": await db.users.count_documents({"role": "school"})
        },
        "content": {
            "topics": await db.content_topics.count_documents({"parent_id": None}),
            "subtopics": await db.content_topics.count_documents({"parent_id": {"$ne": None}}),
            "total_content": await db.content_items.count_documents({})
        },
        "legacy_content": {
            "topics": await db.learning_topics.count_documents({}),
            "lessons": await db.learning_lessons.count_documents({}),
            "books": await db.books.count_documents({}),
            "activities": await db.activities.count_documents({}),
            "quizzes": await db.quizzes.count_documents({})
        },
        "store": {
            "items": await db.store_items.count_documents({}),
            "purchases": await db.purchases.count_documents({})
        },
        "investments": {
            "plants": await db.investment_plants.count_documents({}),
            "stocks": await db.investment_stocks.count_documents({}),
            "farms": await db.farms.count_documents({})
        },
        "quests": await db.new_quests.count_documents({"creator_type": "admin"}),
        "classrooms": await db.classrooms.count_documents({})
    }
    
    return stats

# Topics Management
@router.post("/topics")
async def create_topic(data: TopicCreate, request: Request):
    """Create a learning topic"""
    from services.auth import require_admin
    db = get_db()
    user = await require_admin(request)
    
    topic_doc = {
        "topic_id": f"topic_{uuid.uuid4().hex[:12]}",
        "title": data.title,
        "description": data.description,
        "parent_id": data.parent_id,
        "thumbnail": data.thumbnail,
        "order": data.order,
        "min_grade": data.min_grade,
        "max_grade": data.max_grade,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.content_topics.insert_one(topic_doc)
    return {"topic_id": topic_doc["topic_id"], "message": "Topic created"}

@router.put("/topics/{topic_id}")
async def update_topic(topic_id: str, data: TopicCreate, request: Request):
    """Update a topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    await db.content_topics.update_one(
        {"topic_id": topic_id},
        {"$set": {
            "title": data.title,
            "description": data.description,
            "thumbnail": data.thumbnail,
            "min_grade": data.min_grade,
            "max_grade": data.max_grade
        }}
    )
    return {"message": "Topic updated"}

@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str, request: Request):
    """Delete a topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.content_topics.delete_one({"topic_id": topic_id})
    return {"message": "Topic deleted"}

# Lessons Management
@router.post("/lessons")
async def create_lesson(data: LessonCreate, request: Request):
    """Create a lesson"""
    from services.auth import require_admin
    db = get_db()
    user = await require_admin(request)
    
    lesson_doc = {
        "lesson_id": f"lesson_{uuid.uuid4().hex[:12]}",
        "topic_id": data.topic_id,
        "title": data.title,
        "content": data.content,
        "lesson_type": data.lesson_type,
        "media_url": data.media_url,
        "duration_minutes": data.duration_minutes,
        "order": data.order,
        "min_grade": data.min_grade,
        "max_grade": data.max_grade,
        "reward_coins": data.reward_coins,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.learning_lessons.insert_one(lesson_doc)
    return {"lesson_id": lesson_doc["lesson_id"], "message": "Lesson created"}

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, data: LessonCreate, request: Request):
    """Update a lesson"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    await db.learning_lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": {
            "title": data.title,
            "content": data.content,
            "lesson_type": data.lesson_type,
            "media_url": data.media_url,
            "duration_minutes": data.duration_minutes,
            "min_grade": data.min_grade,
            "max_grade": data.max_grade,
            "reward_coins": data.reward_coins
        }}
    )
    return {"message": "Lesson updated"}

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, request: Request):
    """Delete a lesson"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.learning_lessons.delete_one({"lesson_id": lesson_id})
    return {"message": "Lesson deleted"}

# Trigger allowances manually
@router.post("/trigger-allowances")
async def trigger_allowances(request: Request):
    """Manually trigger allowance processing"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    allowances = await db.allowances.find({"active": True}).to_list(1000)
    
    processed = 0
    for allowance in allowances:
        last_paid = allowance.get("last_paid_on")
        if last_paid == today:
            continue
        
        await db.wallet_accounts.update_one(
            {"user_id": allowance["child_id"], "account_type": "spending"},
            {"$inc": {"balance": allowance["amount"]}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": allowance["child_id"],
            "to_account": "spending",
            "amount": allowance["amount"],
            "transaction_type": "allowance",
            "description": "Recurring allowance",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        await db.allowances.update_one(
            {"allowance_id": allowance["allowance_id"]},
            {"$set": {"last_paid_on": today}}
        )
        processed += 1
    
    return {"message": f"Processed {processed} allowances"}


# ============== ADMIN STORE MANAGEMENT ==============

@router.get("/store/categories")
async def admin_get_store_categories(request: Request):
    """Get all store categories"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.admin_store_categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@router.post("/store/categories")
async def admin_create_store_category(request: Request):
    """Create a store category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    category_id = f"cat_{uuid.uuid4().hex[:12]}"
    max_order = await db.admin_store_categories.find_one(sort=[("order", -1)])
    new_order = (max_order["order"] + 1) if max_order else 0
    
    await db.admin_store_categories.insert_one({
        "category_id": category_id,
        "name": body.get("name", "New Category"),
        "icon": body.get("icon", "🏷️"),
        "order": new_order
    })
    return {"message": "Category created", "category_id": category_id}

@router.put("/store/categories/{category_id}")
async def admin_update_store_category(category_id: str, request: Request):
    """Update a store category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    update = {k: v for k, v in body.items() if k in ["name", "icon", "order", "is_active", "image_url", "color"]}
    await db.admin_store_categories.update_one({"category_id": category_id}, {"$set": update})
    return {"message": "Category updated"}

@router.delete("/store/categories/{category_id}")
async def admin_delete_store_category(category_id: str, request: Request):
    """Delete a store category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.admin_store_categories.delete_one({"category_id": category_id})
    return {"message": "Category deleted"}

@router.get("/store/items")
async def admin_get_store_items(request: Request):
    """Get all store items"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    items = await db.admin_store_items.find({}, {"_id": 0}).to_list(500)
    return items

@router.post("/store/items")
async def admin_create_store_item(request: Request):
    """Create a store item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    await db.admin_store_items.insert_one({
        "item_id": item_id,
        "name": body.get("name", "New Item"),
        "description": body.get("description", ""),
        "price": body.get("price", 10),
        "category_id": body.get("category_id"),
        "image_url": body.get("image_url"),
        "stock": body.get("stock", -1),
        "is_active": body.get("is_active", True),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "unit": body.get("unit", "piece"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Item created", "item_id": item_id}

@router.put("/store/items/{item_id}")
async def admin_update_store_item(item_id: str, request: Request):
    """Update a store item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    fields = ["name", "description", "price", "category_id", "image_url", "stock", "is_active", "min_grade", "max_grade", "unit"]
    update = {k: v for k, v in body.items() if k in fields}
    await db.admin_store_items.update_one({"item_id": item_id}, {"$set": update})
    return {"message": "Item updated"}

@router.delete("/store/items/{item_id}")
async def admin_delete_store_item(item_id: str, request: Request):
    """Delete a store item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.admin_store_items.delete_one({"item_id": item_id})
    return {"message": "Item deleted"}

# ============== ADMIN GARDEN MANAGEMENT ==============

@router.get("/garden/plants")
async def admin_get_garden_plants(request: Request):
    """Get all garden plants"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.investment_plants.find({}, {"_id": 0}).to_list(100)

@router.post("/garden/plants")
async def admin_create_garden_plant(request: Request):
    """Create a garden plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    plant_id = f"plant_{uuid.uuid4().hex[:12]}"
    await db.investment_plants.insert_one({
        "plant_id": plant_id,
        "name": body.get("name", "New Plant"),
        "emoji": body.get("emoji", "🌱"),
        "description": body.get("description", ""),
        "seed_cost": int(body.get("seed_cost", 10)),
        "growth_days": int(body.get("growth_days", 7)),
        "harvest_yield": int(body.get("harvest_yield", 10)),
        "yield_unit": body.get("yield_unit", "pieces"),
        "base_sell_price": int(body.get("base_sell_price", 5)),
        "price_fluctuation_percent": int(body.get("price_fluctuation_percent", 10)),
        "water_frequency_hours": int(body.get("water_frequency_hours", 24)),
        "min_grade": int(body.get("min_grade", 1)),
        "max_grade": int(body.get("max_grade", 2)),
        "is_active": body.get("is_active", True)
    })
    return {"message": "Plant created", "plant_id": plant_id}

@router.put("/garden/plants/{plant_id}")
async def admin_update_garden_plant(plant_id: str, request: Request):
    """Update a garden plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    fields = ["name", "emoji", "description", "seed_cost", "growth_days", "harvest_yield", 
              "yield_unit", "base_sell_price", "price_fluctuation_percent", "water_frequency_hours",
              "min_grade", "max_grade", "is_active"]
    update = {}
    for k, v in body.items():
        if k in fields:
            # Ensure numeric fields are integers
            if k in ["seed_cost", "growth_days", "harvest_yield", "base_sell_price", 
                     "price_fluctuation_percent", "water_frequency_hours", "min_grade", "max_grade"]:
                update[k] = int(v) if v is not None else v
            else:
                update[k] = v
    await db.investment_plants.update_one({"plant_id": plant_id}, {"$set": update})
    return {"message": "Plant updated"}

@router.delete("/garden/plants/{plant_id}")
async def admin_delete_garden_plant(plant_id: str, request: Request):
    """Delete a garden plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.investment_plants.delete_one({"plant_id": plant_id})
    return {"message": "Plant deleted"}

# ============== ADMIN INVESTMENT MANAGEMENT ==============

@router.get("/investments/plants")
async def admin_get_investment_plants(request: Request):
    """Get all investment plant types"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.investment_plants.find({}, {"_id": 0}).to_list(100)

@router.post("/investments/plants")
async def admin_create_investment_plant(request: Request):
    """Create an investment plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    plant_id = f"plant_{uuid.uuid4().hex[:12]}"
    await db.investment_plants.insert_one({
        "plant_id": plant_id,
        "name": body.get("name"),
        "description": body.get("description", ""),
        "seed_cost": body.get("seed_cost", 10),
        "growth_days": body.get("growth_days", 7),
        "harvest_min": body.get("harvest_min", 15),
        "harvest_max": body.get("harvest_max", 25),
        "image_url": body.get("image_url"),
        "growth_stages": body.get("growth_stages", 4),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 2)
    })
    return {"message": "Plant type created", "plant_id": plant_id}

@router.put("/investments/plants/{plant_id}")
async def admin_update_investment_plant(plant_id: str, request: Request):
    """Update an investment plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    fields = ["name", "description", "seed_cost", "growth_days", "harvest_min", "harvest_max", "image_url", "growth_stages", "min_grade", "max_grade"]
    update = {k: v for k, v in body.items() if k in fields}
    await db.investment_plants.update_one({"plant_id": plant_id}, {"$set": update})
    return {"message": "Plant type updated"}

@router.delete("/investments/plants/{plant_id}")
async def admin_delete_investment_plant(plant_id: str, request: Request):
    """Delete an investment plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.investment_plants.delete_one({"plant_id": plant_id})
    return {"message": "Plant type deleted"}

@router.get("/investments/stocks")
async def admin_get_investment_stocks(request: Request):
    """Get all investment stocks"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.investment_stocks.find({}, {"_id": 0}).to_list(100)

@router.post("/investments/stocks")
async def admin_create_investment_stock(request: Request):
    """Create an investment stock"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    stock_id = f"stock_{uuid.uuid4().hex[:12]}"
    await db.investment_stocks.insert_one({
        "stock_id": stock_id,
        "name": body.get("name"),
        "symbol": body.get("symbol"),
        "description": body.get("description", ""),
        "category_id": body.get("category_id"),
        "current_price": body.get("current_price", 100),
        "min_price": body.get("min_price", 50),
        "max_price": body.get("max_price", 200),
        "volatility": body.get("volatility", 0.1),
        "trend": body.get("trend", 0),
        "logo_url": body.get("logo_url"),
        "min_grade": body.get("min_grade", 3),
        "max_grade": body.get("max_grade", 5),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Stock created", "stock_id": stock_id}

@router.put("/investments/stocks/{stock_id}")
async def admin_update_investment_stock(stock_id: str, request: Request):
    """Update an investment stock"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    fields = ["name", "symbol", "description", "category_id", "current_price", "min_price", "max_price", 
              "volatility", "trend", "logo_url", "min_grade", "max_grade", "is_active"]
    update = {k: v for k, v in body.items() if k in fields}
    await db.investment_stocks.update_one({"stock_id": stock_id}, {"$set": update})
    return {"message": "Stock updated"}

@router.delete("/investments/stocks/{stock_id}")
async def admin_delete_investment_stock(stock_id: str, request: Request):
    """Delete an investment stock"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.investment_stocks.delete_one({"stock_id": stock_id})
    return {"message": "Stock deleted"}

# ============== ADMIN STOCK CATEGORIES & NEWS ==============

@router.get("/stock-categories")
async def admin_get_stock_categories(request: Request):
    """Get all stock categories"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.stock_categories.find({}, {"_id": 0}).to_list(100)

@router.post("/stock-categories")
async def admin_create_stock_category(request: Request):
    """Create a stock category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    category_id = f"scat_{uuid.uuid4().hex[:12]}"
    await db.stock_categories.insert_one({
        "category_id": category_id,
        "name": body.get("name"),
        "description": body.get("description", ""),
        "icon": body.get("icon", "📈"),
        "color": body.get("color", "#3B82F6")
    })
    return {"message": "Stock category created", "category_id": category_id}

@router.put("/stock-categories/{category_id}")
async def admin_update_stock_category(category_id: str, request: Request):
    """Update a stock category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    update = {k: v for k, v in body.items() if k in ["name", "description", "icon", "color"]}
    await db.stock_categories.update_one({"category_id": category_id}, {"$set": update})
    return {"message": "Stock category updated"}

@router.delete("/stock-categories/{category_id}")
async def admin_delete_stock_category(category_id: str, request: Request):
    """Delete a stock category"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.stock_categories.delete_one({"category_id": category_id})
    return {"message": "Stock category deleted"}

@router.get("/stock-news")
async def admin_get_stock_news(request: Request):
    """Get all stock news"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    return await db.stock_news.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@router.post("/stock-news")
async def admin_create_stock_news(request: Request):
    """Create stock news"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    news_id = f"news_{uuid.uuid4().hex[:12]}"
    await db.stock_news.insert_one({
        "news_id": news_id,
        "title": body.get("title"),
        "content": body.get("content", ""),
        "stock_id": body.get("stock_id"),
        "category_id": body.get("category_id"),
        "impact": body.get("impact", 0),
        "is_active": body.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "News created", "news_id": news_id}

@router.put("/stock-news/{news_id}")
async def admin_update_stock_news(news_id: str, request: Request):
    """Update stock news"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    update = {k: v for k, v in body.items() if k in ["title", "content", "stock_id", "category_id", "impact", "is_active"]}
    await db.stock_news.update_one({"news_id": news_id}, {"$set": update})
    return {"message": "News updated"}

@router.delete("/stock-news/{news_id}")
async def admin_delete_stock_news(news_id: str, request: Request):
    """Delete stock news"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.stock_news.delete_one({"news_id": news_id})
    return {"message": "News deleted"}


@router.post("/stock-news/{news_id}/apply")
async def admin_apply_stock_news(news_id: str, request: Request):
    """Apply news impact to stock price"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    news = await db.stock_news.find_one({"news_id": news_id})
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    
    impact = news.get("impact", 0)
    stock_id = news.get("stock_id")
    
    if stock_id:
        stock = await db.investment_stocks.find_one({"stock_id": stock_id})
        if stock:
            new_price = max(1, stock["current_price"] * (1 + impact / 100))
            await db.investment_stocks.update_one(
                {"stock_id": stock_id},
                {"$set": {"current_price": round(new_price, 2)}}
            )
    
    await db.stock_news.update_one(
        {"news_id": news_id},
        {"$set": {"applied": True, "applied_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "News impact applied"}

# ============== ADMIN QUIZ, BOOK, ACTIVITY MANAGEMENT ==============

@router.post("/quizzes")
async def admin_create_quiz(request: Request):
    """Create a quiz for a lesson"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"
    await db.quizzes.insert_one({
        "quiz_id": quiz_id,
        "lesson_id": body.get("lesson_id"),
        "title": body.get("title", "Quiz"),
        "questions": body.get("questions", []),
        "passing_score": body.get("passing_score", 70),
        "reward_coins": body.get("reward_coins", 10),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Quiz created", "quiz_id": quiz_id}

@router.post("/books")
async def admin_create_book(request: Request):
    """Create a learning book"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    book_id = f"book_{uuid.uuid4().hex[:12]}"
    await db.books.insert_one({
        "book_id": book_id,
        "title": body.get("title"),
        "description": body.get("description", ""),
        "cover_image": body.get("cover_image"),
        "content_url": body.get("content_url"),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "reward_coins": body.get("reward_coins", 5),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Book created", "book_id": book_id}

@router.delete("/books/{book_id}")
async def admin_delete_book(book_id: str, request: Request):
    """Delete a book"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.books.delete_one({"book_id": book_id})
    return {"message": "Book deleted"}

@router.post("/activities")
async def admin_create_activity(request: Request):
    """Create a learning activity"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    activity_id = f"act_{uuid.uuid4().hex[:12]}"
    await db.activities.insert_one({
        "activity_id": activity_id,
        "title": body.get("title"),
        "description": body.get("description", ""),
        "activity_type": body.get("activity_type", "interactive"),
        "activity_url": body.get("activity_url"),
        "thumbnail": body.get("thumbnail"),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "reward_coins": body.get("reward_coins", 10),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Activity created", "activity_id": activity_id}

@router.delete("/activities/{activity_id}")
async def admin_delete_activity(activity_id: str, request: Request):
    """Delete an activity"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.activities.delete_one({"activity_id": activity_id})
    return {"message": "Activity deleted"}

# ============== ADMIN INVESTMENT SIMULATION ==============

@router.get("/investments/stocks/{stock_id}/history")
async def admin_get_stock_history(stock_id: str, request: Request, days: int = 30):
    """Get stock price history"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    history = await db.stock_price_history.find(
        {"stock_id": stock_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    return list(reversed(history))

@router.post("/investments/simulate-fluctuation")
async def admin_simulate_fluctuation(request: Request):
    """Manually trigger stock price fluctuation"""
    from services.auth import require_admin
    from datetime import datetime, timezone
    db = get_db()
    await require_admin(request)
    
    import random
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    stocks = await db.investment_stocks.find({"is_active": True}).to_list(100)
    if not stocks:
        stocks = await db.admin_stocks.find({"is_active": True}).to_list(100)
    
    for stock in stocks:
        volatility = stock.get("volatility", 0.1)
        trend = stock.get("trend", 0)
        change_pct = random.gauss(trend, volatility)
        current_price = stock.get("current_price", 10)
        new_price = current_price * (1 + change_pct)
        new_price = max(stock.get("min_price", 1), min(new_price, stock.get("max_price", 1000)))
        new_price = round(new_price, 2)
        
        # Create price history entry
        price_entry = {
            "date": today,
            "price": new_price,
            "close_price": new_price,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Update investment_stocks
        await db.investment_stocks.update_one(
            {"stock_id": stock["stock_id"]},
            {
                "$set": {
                    "current_price": new_price,
                    "last_price_update": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "price_history": {
                        "$each": [price_entry],
                        "$slice": -30
                    }
                }
            }
        )
        
        # Also update admin_stocks
        await db.admin_stocks.update_one(
            {"stock_id": stock["stock_id"]},
            {
                "$set": {
                    "current_price": new_price,
                    "last_price_update": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "price_history": {
                        "$each": [price_entry],
                        "$slice": -30
                    }
                }
            }
        )
    
    return {"message": f"Simulated fluctuation for {len(stocks)} stocks"}

@router.post("/investments/simulate-day")
async def admin_simulate_day(request: Request):
    """Simulate a full trading day"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    import random
    from datetime import date
    
    stocks = await db.investment_stocks.find({"is_active": True}).to_list(100)
    today = date.today().isoformat()
    
    for stock in stocks:
        # Record today's price in history
        await db.stock_price_history.update_one(
            {"stock_id": stock["stock_id"], "date": today},
            {"$set": {
                "stock_id": stock["stock_id"],
                "date": today,
                "open": stock["current_price"],
                "close": stock["current_price"],
                "high": stock["current_price"],
                "low": stock["current_price"]
            }},
            upsert=True
        )
    
    return {"message": f"Simulated day for {len(stocks)} stocks"}

@router.get("/investments/scheduler-logs")
async def admin_get_scheduler_logs(request: Request):
    """Get scheduler logs"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    logs = await db.scheduler_logs.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    return logs

@router.get("/investments/scheduler-status")
async def admin_get_scheduler_status(request: Request):
    """Get scheduler status"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    last_run = await db.scheduler_logs.find_one(
        {},
        sort=[("timestamp", -1)]
    )
    
    return {
        "status": "active",
        "last_run": last_run.get("timestamp") if last_run else None,
        "last_job": last_run.get("job_name") if last_run else None
    }

# ============== SITE SETTINGS (Walkthrough Video, etc.) ==============

@router.get("/settings/walkthrough-video")
async def get_walkthrough_video(request: Request):
    """Get all walkthrough videos (public endpoint)"""
    db = get_db()
    # Get all walkthrough videos for different user types
    videos = {}
    for user_type in ['child', 'parent', 'teacher']:
        setting = await db.site_settings.find_one({"key": f"walkthrough_video_{user_type}"}, {"_id": 0})
        if setting:
            videos[user_type] = {
                "url": setting.get("value"),
                "title": setting.get("title", ""),
                "description": setting.get("description", "")
            }
        else:
            videos[user_type] = {"url": None, "title": "", "description": ""}
    
    # Also return global title/description for the section
    global_setting = await db.site_settings.find_one({"key": "walkthrough_video_global"}, {"_id": 0})
    videos["global"] = {
        "title": global_setting.get("title", "See CoinQuest in Action") if global_setting else "See CoinQuest in Action",
        "description": global_setting.get("description", "Watch how kids learn financial literacy through fun games and activities") if global_setting else "Watch how kids learn financial literacy through fun games and activities"
    }
    
    return videos

@router.put("/settings/walkthrough-video")
async def update_walkthrough_video(request: Request):
    """Update a walkthrough video for a specific user type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    user_type = body.get("user_type", "child")  # child, parent, teacher, or global
    
    if user_type == "global":
        # Update global settings (title/description for the section)
        await db.site_settings.update_one(
            {"key": "walkthrough_video_global"},
            {"$set": {
                "key": "walkthrough_video_global",
                "title": body.get("title", "See CoinQuest in Action"),
                "description": body.get("description", "Watch how kids learn financial literacy through fun games and activities"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    else:
        # Update video for specific user type
        await db.site_settings.update_one(
            {"key": f"walkthrough_video_{user_type}"},
            {"$set": {
                "key": f"walkthrough_video_{user_type}",
                "value": body.get("url"),
                "title": body.get("title", ""),
                "description": body.get("description", ""),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    return {"message": f"Walkthrough video for {user_type} updated"}

@router.delete("/settings/walkthrough-video")
async def delete_walkthrough_video(request: Request):
    """Delete a walkthrough video for a specific user type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    # Get user_type from query params
    from urllib.parse import parse_qs
    query_string = str(request.url.query)
    params = parse_qs(query_string)
    user_type = params.get("user_type", ["child"])[0]
    
    # Get current video URL to delete the file
    setting = await db.site_settings.find_one({"key": f"walkthrough_video_{user_type}"})
    if setting and setting.get("value"):
        video_path = UPLOADS_DIR / "videos" / setting["value"].split("/")[-1]
        if video_path.exists():
            video_path.unlink()
    
    await db.site_settings.delete_one({"key": f"walkthrough_video_{user_type}"})
    return {"message": f"Walkthrough video for {user_type} deleted"}
