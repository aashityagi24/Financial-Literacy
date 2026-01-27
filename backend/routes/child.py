"""Child routes - Chores, savings, classmates, gifts"""
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

router = APIRouter(prefix="/child", tags=["child"])

class SavingsGoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    deadline: Optional[str] = None

class GiftRequest(BaseModel):
    to_user_id: str
    amount: float
    message: Optional[str] = None

# Chores
@router.get("/chores")
async def get_child_chores(request: Request):
    """Get child's active chores"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access chores")
    
    chores = await db.new_quests.find({
        "child_id": user["user_id"],
        "creator_type": "parent",
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    return chores

@router.post("/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, request: Request):
    """Mark a chore as completed (pending approval)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can complete chores")
    
    chore = await db.new_quests.find_one({
        "chore_id": chore_id,
        "child_id": user["user_id"]
    })
    
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    await db.new_quests.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "pending_approval", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Chore marked as completed, waiting for parent approval"}

@router.post("/chores/{chore_id}/request-complete")
async def request_chore_completion(chore_id: str, request: Request):
    """Request completion approval for a chore"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can request completion")
    
    chore = await db.new_quests.find_one({
        "chore_id": chore_id,
        "child_id": user["user_id"]
    })
    
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    request_doc = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "chore_id": chore_id,
        "child_id": user["user_id"],
        "child_name": user.get("name", "Child"),
        "parent_id": chore["creator_id"],
        "title": chore["title"],
        "reward_amount": chore["reward_amount"],
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_completion_requests.insert_one(request_doc)
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": chore["creator_id"],
        "type": "chore_request",
        "message": f"{user.get('name', 'Your child')} completed: {chore['title']}",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Completion request sent to parent"}

# Savings Goals
@router.get("/savings-goals")
async def get_child_savings_goals(request: Request):
    """Get child's savings goals"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access savings goals")
    
    goals = await db.savings_goals.find(
        {"child_id": user["user_id"]},
        {"_id": 0}
    ).to_list(50)
    
    return goals

@router.post("/savings-goals")
async def create_child_savings_goal(data: SavingsGoalCreate, request: Request):
    """Create a savings goal"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can create savings goals")
    
    goal_doc = {
        "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
        "child_id": user["user_id"],
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
    
    return {"goal_id": goal_doc["goal_id"], "message": "Savings goal created"}

@router.post("/savings-goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, request: Request):
    """Contribute to a savings goal"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can contribute")
    
    body = await request.json()
    amount = body.get("amount", 0)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    goal = await db.savings_goals.find_one({
        "goal_id": goal_id,
        "child_id": user["user_id"]
    })
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    spending_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "spending"
    })
    
    if not spending_acc or spending_acc.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -amount}}
    )
    
    new_amount = goal.get("current_amount", 0) + amount
    completed = new_amount >= goal["target_amount"]
    
    await db.savings_goals.update_one(
        {"goal_id": goal_id},
        {"$set": {"current_amount": new_amount, "completed": completed}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "amount": amount,
        "transaction_type": "savings_contribution",
        "description": f"Contribution to: {goal['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Contribution added", "new_amount": new_amount, "completed": completed}

# Parents
@router.post("/add-parent")
async def add_parent(request: Request):
    """Child adds a parent by email (max 2 parents)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only children can add parents")
    
    body = await request.json()
    parent_email = body.get("parent_email", "").lower()
    
    # Check if child already has 2 parents
    existing_links = await db.parent_child_links.find(
        {"child_id": user["user_id"], "status": "active"}
    ).to_list(10)
    
    if len(existing_links) >= 2:
        raise HTTPException(status_code=400, detail="You can only have up to 2 parents linked")
    
    # Find parent by email
    parent = await db.users.find_one(
        {"email": parent_email, "role": "parent"},
        {"_id": 0}
    )
    
    if not parent:
        raise HTTPException(status_code=404, detail="Parent account not found. Make sure they signed up as a parent.")
    
    # Check if link already exists
    existing = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": user["user_id"]
    })
    
    if existing:
        return {"message": "Already connected to this parent", "parent_name": parent.get("name")}
    
    # Create link
    await db.parent_child_links.insert_one({
        "link_id": f"link_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": user["user_id"],
        "status": "active",
        "initiated_by": "child",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Parent added successfully!", "parent_name": parent.get("name")}

@router.get("/parents")
async def get_child_parents(request: Request):
    """Get child's linked parents"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    links = await db.parent_child_links.find(
        {"child_id": user["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(10)
    
    parents = []
    for link in links:
        parent = await db.users.find_one(
            {"user_id": link["parent_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1}
        )
        if parent:
            parents.append(parent)
    
    return parents

# Announcements
@router.get("/announcements")
async def get_child_announcements(request: Request):
    """Get announcements from teacher"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    classroom_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"classroom_id": 1}
    ).to_list(10)
    classroom_ids = [c["classroom_id"] for c in classroom_links]
    
    announcements = await db.announcements.find(
        {"classroom_id": {"$in": classroom_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return announcements

# Classmates & Gifting
@router.get("/classmates")
async def get_classmates(request: Request):
    """Get classmates list"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    classroom_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"classroom_id": 1}
    ).to_list(10)
    classroom_ids = [c["classroom_id"] for c in classroom_links]
    
    classmate_links = await db.classroom_students.find(
        {"classroom_id": {"$in": classroom_ids}, "student_id": {"$ne": user["user_id"]}},
        {"_id": 0}
    ).to_list(100)
    
    classmates = []
    for link in classmate_links:
        student = await db.users.find_one(
            {"user_id": link["student_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "avatar": 1}
        )
        if student and student["user_id"] not in [c["user_id"] for c in classmates]:
            classmates.append(student)
    
    return classmates

@router.post("/gift-money")
async def gift_money(data: GiftRequest, request: Request):
    """Send money to a classmate"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can gift")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    gifting_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "gifting"
    })
    
    if not gifting_acc or gifting_acc.get("balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in gifting account")
    
    recipient = await db.users.find_one({"user_id": data.to_user_id})
    if not recipient or recipient.get("role") != "child":
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "gifting"},
        {"$inc": {"balance": -data.amount}}
    )
    
    await db.wallet_accounts.update_one(
        {"user_id": data.to_user_id, "account_type": "gifting"},
        {"$inc": {"balance": data.amount}}
    )
    
    trans_id = f"trans_{uuid.uuid4().hex[:12]}"
    await db.transactions.insert_one({
        "transaction_id": trans_id,
        "user_id": user["user_id"],
        "from_account": "gifting",
        "amount": -data.amount,
        "transaction_type": "gift_sent",
        "description": f"Gift to {recipient.get('name', 'Friend')}: {data.message or ''}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": data.to_user_id,
        "to_account": "gifting",
        "amount": data.amount,
        "transaction_type": "gift_received",
        "description": f"Gift from {user.get('name', 'Friend')}: {data.message or ''}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": data.to_user_id,
        "type": "gift",
        "message": f"You received ₹{data.amount} from {user.get('name', 'a friend')}!",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Gift sent successfully"}

@router.post("/request-gift")
async def request_gift(request: Request):
    """Request gift from classmate"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can request gifts")
    
    body = await request.json()
    to_user_id = body.get("to_user_id")
    amount = body.get("amount", 0)
    message = body.get("message", "")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    request_doc = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "from_user_id": user["user_id"],
        "from_user_name": user.get("name", "Friend"),
        "to_user_id": to_user_id,
        "amount": amount,
        "message": message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gift_requests.insert_one(request_doc)
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": to_user_id,
        "type": "gift_request",
        "message": f"{user.get('name', 'Someone')} requested ₹{amount} gift",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Gift request sent"}

@router.get("/gift-requests")
async def get_gift_requests(request: Request):
    """Get pending gift requests"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    requests = await db.gift_requests.find(
        {"to_user_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    return requests

@router.post("/gift-requests/{request_id}/respond")
async def respond_to_gift_request(request_id: str, request: Request):
    """Accept or decline gift request"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can respond")
    
    body = await request.json()
    accept = body.get("accept", False)
    
    gift_req = await db.gift_requests.find_one({
        "request_id": request_id,
        "to_user_id": user["user_id"],
        "status": "pending"
    })
    
    if not gift_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if accept:
        gifting_acc = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": "gifting"
        })
        
        if not gifting_acc or gifting_acc.get("balance", 0) < gift_req["amount"]:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "gifting"},
            {"$inc": {"balance": -gift_req["amount"]}}
        )
        
        await db.wallet_accounts.update_one(
            {"user_id": gift_req["from_user_id"], "account_type": "gifting"},
            {"$inc": {"balance": gift_req["amount"]}}
        )
        
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": gift_req["from_user_id"],
            "type": "gift_accepted",
            "message": f"{user.get('name', 'Friend')} accepted your gift request!",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.gift_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted" if accept else "declined"}}
    )
    
    return {"message": "Request " + ("accepted" if accept else "declined")}
