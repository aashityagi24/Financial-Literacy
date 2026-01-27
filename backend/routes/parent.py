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
