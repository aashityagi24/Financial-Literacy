"""Parent routes - Child management, allowances, rewards"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/parent", tags=["parent"])

class LinkChildRequest(BaseModel):
    child_email: str

class AllowanceCreate(BaseModel):
    child_id: str
    amount: float
    frequency: str

class RewardPenaltyCreate(BaseModel):
    child_id: str
    title: str
    description: Optional[str] = None
    amount: float
    category: str  # 'reward' or 'penalty'

class SavingsGoalCreate(BaseModel):
    child_id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    deadline: Optional[str] = None

@router.get("/dashboard")
async def parent_dashboard(request: Request):
    """Get parent dashboard data"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(20)
    
    children = []
    for link in links:
        child = await db.users.find_one(
            {"user_id": link["child_id"]},
            {"_id": 0}
        )
        if child:
            wallets = await db.wallet_accounts.find(
                {"user_id": child["user_id"]},
                {"_id": 0}
            ).to_list(10)
            total_balance = sum(w.get("balance", 0) for w in wallets)
            
            chores = await db.new_quests.count_documents({
                "creator_type": "parent",
                "creator_id": parent["user_id"],
                "child_id": child["user_id"],
                "is_active": True
            })
            
            children.append({
                **child,
                "total_balance": total_balance,
                "active_chores": chores
            })
    
    return {"children": children}

@router.post("/link-child")
async def link_child(data: LinkChildRequest, request: Request):
    """Link a child to parent"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    child = await db.users.find_one({"email": data.child_email.lower()})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    if child.get("role") != "child":
        raise HTTPException(status_code=400, detail="User is not a child account")
    
    existing = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Child already linked")
    
    link_doc = {
        "link_id": f"link_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": child["user_id"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.parent_child_links.insert_one(link_doc)
    
    return {"message": "Child linked successfully", "child": {"name": child["name"], "email": child["email"]}}

@router.delete("/unlink-child/{child_id}")
async def unlink_child(child_id: str, request: Request):
    """Unlink a child from parent"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    result = await db.parent_child_links.delete_one({
        "parent_id": parent["user_id"],
        "child_id": child_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"message": "Child unlinked"}

@router.post("/reward-penalty")
async def create_reward_penalty(data: RewardPenaltyCreate, request: Request):
    """Give instant reward or penalty to child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    amount = data.amount if data.category == "reward" else -data.amount
    
    await db.wallet_accounts.update_one(
        {"user_id": data.child_id, "account_type": "spending"},
        {"$inc": {"balance": amount}}
    )
    
    trans_type = "parent_reward" if data.category == "reward" else "parent_penalty"
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": data.child_id,
        "to_account": "spending",
        "amount": amount,
        "transaction_type": trans_type,
        "description": f"{data.title}: {data.description or ''}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": data.child_id,
        "type": data.category,
        "message": f"{'Reward' if data.category == 'reward' else 'Penalty'} from {parent.get('name', 'Parent')}: {data.title} (₹{abs(amount)})",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"{data.category.capitalize()} applied", "amount": amount}

@router.get("/allowances")
async def get_allowances(request: Request):
    """Get parent's configured allowances"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    allowances = await db.allowances.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).to_list(50)
    
    return allowances

@router.post("/allowances")
async def create_allowance(data: AllowanceCreate, request: Request):
    """Create a recurring allowance for a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    allowance_doc = {
        "allowance_id": f"allow_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": data.child_id,
        "amount": data.amount,
        "frequency": data.frequency,
        "active": True,
        "last_paid_on": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.allowances.insert_one(allowance_doc)
    
    return {"message": "Allowance created", "allowance_id": allowance_doc["allowance_id"]}

@router.delete("/allowances/{allowance_id}")
async def delete_allowance(allowance_id: str, request: Request):
    """Delete an allowance"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    result = await db.allowances.delete_one({
        "allowance_id": allowance_id,
        "parent_id": parent["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Allowance not found")
    
    return {"message": "Allowance deleted"}

@router.get("/children/{child_id}/insights")
async def get_child_insights(child_id: str, request: Request):
    """Get detailed insights for a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    wallets = await db.wallet_accounts.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(10)
    
    savings_goals = await db.savings_goals.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(20)
    
    transactions = await db.transactions.find(
        {"user_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    lessons_completed = await db.user_content_progress.count_documents({
        "user_id": child_id,
        "completed": True
    })
    
    quests_completed = await db.quest_completions.count_documents({
        "user_id": child_id,
        "is_completed": True
    })
    
    achievements = await db.user_achievements.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "child": child,
        "wallets": wallets,
        "savings_goals": savings_goals,
        "recent_transactions": transactions,
        "lessons_completed": lessons_completed,
        "quests_completed": quests_completed,
        "achievements": achievements
    }

@router.post("/savings-goals")
async def create_savings_goal(data: SavingsGoalCreate, request: Request):
    """Create a savings goal for a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    goal_doc = {
        "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
        "child_id": data.child_id,
        "parent_id": parent["user_id"],
        "title": data.title,
        "description": data.description,
        "image_url": data.image_url,
        "target_amount": data.target_amount,
        "current_amount": 0,
        "deadline": data.deadline,
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.savings_goals.insert_one(goal_doc)
    
    return {"message": "Savings goal created", "goal_id": goal_doc["goal_id"]}

@router.get("/savings-goals")
async def get_parent_savings_goals(request: Request):
    """Get all savings goals created by parent"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    goals = await db.savings_goals.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return goals


# ============== REWARD/PENALTY ROUTES ==============

@router.get("/reward-penalty")
async def get_reward_penalties(request: Request):
    """Get reward/penalty history"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    records = await db.reward_penalties.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return records

@router.delete("/reward-penalty/{record_id}")
async def delete_reward_penalty(record_id: str, request: Request):
    """Delete a reward/penalty record"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    await db.reward_penalties.delete_one({
        "record_id": record_id,
        "parent_id": parent["user_id"]
    })
    return {"message": "Record deleted"}

# ============== SHOPPING LIST ROUTES ==============

@router.post("/shopping-list")
async def create_shopping_list(request: Request):
    """Create a shopping list item"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    list_id = f"shop_{uuid.uuid4().hex[:12]}"
    await db.shopping_lists.insert_one({
        "list_id": list_id,
        "parent_id": parent["user_id"],
        "child_id": body.get("child_id"),
        "title": body.get("title"),
        "description": body.get("description", ""),
        "estimated_cost": body.get("estimated_cost", 0),
        "purchased": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Shopping list item created", "list_id": list_id}

@router.get("/shopping-list")
async def get_shopping_list(request: Request):
    """Get parent's shopping lists"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    items = await db.shopping_lists.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return items

@router.delete("/shopping-list/{list_id}")
async def delete_shopping_list(list_id: str, request: Request):
    """Delete a shopping list item"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    await db.shopping_lists.delete_one({
        "list_id": list_id,
        "parent_id": parent["user_id"]
    })
    return {"message": "Shopping list item deleted"}

@router.post("/shopping-list/create-chore")
async def create_chore_from_shopping(request: Request):
    """Create a chore from a shopping list item"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    chore_id = f"chore_{uuid.uuid4().hex[:12]}"
    await db.parent_chores.insert_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"],
        "child_id": body.get("child_id"),
        "title": body.get("title"),
        "description": body.get("description", ""),
        "reward_coins": body.get("reward_coins", 0),
        "from_shopping_list": body.get("list_id"),
        "is_completed": False,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Chore created from shopping list", "chore_id": chore_id}

# ============== CHORE MANAGEMENT ROUTES ==============

@router.get("/chore-requests")
async def get_chore_requests(request: Request):
    """Get pending chore completion requests"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    requests_list = await db.chore_requests.find(
        {"parent_id": parent["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return requests_list

@router.post("/chore-requests/{request_id}/validate")
async def validate_chore_request(request_id: str, request: Request):
    """Validate (approve or reject) a chore completion request"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    approved = body.get("approved", False)
    
    chore_req = await db.chore_requests.find_one({
        "request_id": request_id,
        "parent_id": parent["user_id"]
    })
    if not chore_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.chore_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved" if approved else "rejected"}}
    )
    
    if approved:
        chore = await db.parent_chores.find_one({"chore_id": chore_req["chore_id"]})
        if chore:
            reward_coins = chore.get("reward_coins", 0)
            await db.parent_chores.update_one(
                {"chore_id": chore_req["chore_id"]},
                {"$set": {"is_completed": True, "is_verified": True}}
            )
            await db.wallet_accounts.update_one(
                {"user_id": chore_req["child_id"], "account_type": "spending"},
                {"$inc": {"balance": reward_coins}}
            )
    
    return {"message": f"Chore {'approved' if approved else 'rejected'}"}

@router.get("/children")
async def get_linked_children(request: Request):
    """Get all linked children"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(10)
    
    children = []
    for link in links:
        child = await db.users.find_one(
            {"user_id": link["child_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1, "grade": 1}
        )
        if child:
            children.append(child)
    
    return children

@router.get("/children/{child_id}/progress")
async def get_child_progress(child_id: str, request: Request):
    """Get child's progress summary"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    wallets = await db.wallet_accounts.find({"user_id": child_id}, {"_id": 0}).to_list(5)
    
    lessons_completed = await db.user_lesson_progress.count_documents({
        "user_id": child_id, "completed": True
    })
    quests_completed = await db.quest_completions.count_documents({
        "user_id": child_id, "status": "completed"
    })
    
    return {
        "child": child,
        "wallets": wallets,
        "lessons_completed": lessons_completed,
        "quests_completed": quests_completed
    }

@router.get("/children/{child_id}/classroom")
async def get_child_classroom(child_id: str, request: Request):
    """Get child's classroom info"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    enrollment = await db.classroom_students.find_one(
        {"student_id": child_id, "status": "active"},
        {"_id": 0}
    )
    if not enrollment:
        return {"classroom": None}
    
    classroom = await db.classrooms.find_one(
        {"classroom_id": enrollment["classroom_id"]},
        {"_id": 0}
    )
    return {"classroom": classroom}

@router.post("/chores")
async def create_chore(request: Request):
    """Create a chore for a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    child_id = body.get("child_id")
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    chore_id = f"chore_{uuid.uuid4().hex[:12]}"
    await db.parent_chores.insert_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "title": body.get("title"),
        "description": body.get("description", ""),
        "reward_coins": body.get("reward_coins", 10),
        "is_recurring": body.get("is_recurring", False),
        "frequency": body.get("frequency"),
        "is_completed": False,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Chore created", "chore_id": chore_id}

@router.get("/chores")
async def get_chores(request: Request):
    """Get all chores created by parent"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    chores = await db.parent_chores.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return chores

@router.post("/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request):
    """Approve a completed chore"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    chore = await db.parent_chores.find_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"]
    })
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    await db.parent_chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"is_verified": True}}
    )
    
    # Award coins
    await db.wallet_accounts.update_one(
        {"user_id": chore["child_id"], "account_type": "spending"},
        {"$inc": {"balance": chore.get("reward_coins", 0)}}
    )
    
    return {"message": "Chore approved, coins awarded"}

@router.delete("/chores/{chore_id}")
async def delete_chore(chore_id: str, request: Request):
    """Delete a chore"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    await db.parent_chores.delete_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"]
    })
    return {"message": "Chore deleted"}

@router.post("/allowance")
async def create_single_allowance(request: Request):
    """Give one-time allowance to a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    child_id = body.get("child_id")
    amount = body.get("amount", 0)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.wallet_accounts.update_one(
        {"user_id": child_id, "account_type": "spending"},
        {"$inc": {"balance": amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "type": "allowance",
        "amount": amount,
        "description": body.get("reason", "Allowance from parent"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Gave ₹{amount} allowance"}

@router.post("/give-money")
async def give_money_to_child(request: Request):
    """Give money to a child"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    child_id = body.get("child_id")
    amount = body.get("amount", 0)
    reason = body.get("reason", "Gift from parent")
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.wallet_accounts.update_one(
        {"user_id": child_id, "account_type": "spending"},
        {"$inc": {"balance": amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "type": "gift",
        "amount": amount,
        "description": reason,
        "from_user_id": parent["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Gave ₹{amount} to child"}