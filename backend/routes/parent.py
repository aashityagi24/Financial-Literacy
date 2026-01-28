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
    
    grade = child.get("grade", 0) or 0
    
    # Get wallet data
    wallets = await db.wallet_accounts.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(10)
    
    total_balance = sum(w.get("balance", 0) for w in wallets)
    
    # Get savings goals
    savings_goals = await db.savings_goals.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(20)
    
    savings_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
    active_goals = [g for g in savings_goals if not g.get("completed")]
    
    # Get recent transactions and calculate totals
    transactions = await db.transactions.find(
        {"user_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_earned = sum(t.get("amount", 0) for t in transactions 
                      if t.get("transaction_type") in ["reward", "allowance", "gift_received", "chore_reward", "quest_reward", "initial_deposit"])
    total_spent = sum(t.get("amount", 0) for t in transactions 
                     if t.get("transaction_type") in ["purchase", "gift_sent"])
    
    # Get learning progress
    lessons_completed = await db.user_content_progress.count_documents({
        "user_id": child_id,
        "completed": True
    })
    
    # Get chore stats
    all_chores = await db.new_quests.find({
        "child_id": child_id,
        "creator_type": "parent"
    }).to_list(100)
    
    chore_completions = await db.quest_completions.find({
        "user_id": child_id
    }).to_list(200)
    chore_completion_map = {c.get("quest_id"): c for c in chore_completions}
    
    chores_completed = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("is_completed"))
    chores_pending = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("status") == "pending")
    chores_rejected = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("status") == "rejected")
    
    # Get quest stats (admin/teacher quests)
    quest_completions = await db.quest_completions.find({
        "user_id": child_id,
        "is_completed": True
    }).to_list(100)
    quests_completed = len(quest_completions)
    
    # Count all available quests for this child
    grade = child.get("grade", 3) or 3
    all_quests = await db.new_quests.count_documents({
        "creator_type": {"$in": ["admin", "teacher"]},
        "is_active": True,
        "min_grade": {"$lte": grade},
        "max_grade": {"$gte": grade}
    })
    
    # Get achievements
    achievements = await db.user_achievements.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get gift stats
    gifts_received = await db.transactions.count_documents({
        "user_id": child_id,
        "transaction_type": "gift_received"
    })
    gifts_sent = await db.transactions.count_documents({
        "user_id": child_id,
        "transaction_type": "gift_sent"
    })
    
    gifts_received_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "gift_received")
    gifts_sent_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "gift_sent")
    
    # Get garden/investment data (for grades 1-2)
    garden_plots = await db.user_garden_plots.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(50)
    
    garden_invested = sum(p.get("purchase_price", 0) for p in garden_plots)
    garden_earned = sum(p.get("total_harvested", 0) for p in garden_plots)
    
    # Get stock holdings (for grades 3-5)
    stock_holdings = await db.user_stock_holdings.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(50)
    
    # Calculate portfolio value and gains
    portfolio_value = 0
    total_cost_basis = 0
    for holding in stock_holdings:
        # Get current stock price
        stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
        current_price = stock.get("current_price", 0) if stock else 0
        shares = holding.get("shares", 0)
        portfolio_value += shares * current_price
        total_cost_basis += holding.get("total_cost", 0)
    
    # Get realized gains from stock sale transactions
    stock_sales = [t for t in transactions if t.get("transaction_type") == "stock_sale"]
    realized_gains = sum(t.get("profit", 0) for t in stock_sales)
    
    unrealized_gains = portfolio_value - total_cost_basis
    
    return {
        "child": child,
        "wallet": {
            "total_balance": total_balance,
            "accounts": wallets,
            "savings_in_goals": savings_in_goals,
            "savings_goals_count": len(active_goals)
        },
        "learning": {
            "lessons_completed": lessons_completed
        },
        "transactions": {
            "total_earned": total_earned,
            "total_spent": total_spent,
            "recent": transactions[:20]
        },
        "chores": {
            "total_assigned": len(all_chores),
            "completed": chores_completed,
            "pending": chores_pending,
            "rejected": chores_rejected
        },
        "quests": {
            "total_assigned": all_quests,
            "completed": quests_completed,
            "completion_rate": round((quests_completed / all_quests * 100) if all_quests > 0 else 0)
        },
        "achievements": {
            "badges_earned": len(achievements),
            "list": achievements
        },
        "gifts": {
            "received_count": gifts_received,
            "received_total": gifts_received_total,
            "sent_count": gifts_sent,
            "sent_total": gifts_sent_total
        },
        "garden": {
            "plots_owned": len(garden_plots),
            "total_invested": garden_invested,
            "total_earned": garden_earned,
            "profit_loss": garden_earned - garden_invested
        },
        "stocks": {
            "holdings_count": len(stock_holdings),
            "portfolio_value": portfolio_value,
            "realized_gains": realized_gains,
            "unrealized_gains": unrealized_gains
        },
        "savings_goals": savings_goals,
        # Investment type based on grade: K (0) = none, 1-2 = garden, 3-5 = stocks
        "investment_type": "garden" if 1 <= grade <= 2 else ("stocks" if 3 <= grade <= 5 else None)
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
    """Get all savings goals for parent's children (created by parent or child)"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    
    # Get parent's children
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0, "child_id": 1}
    ).to_list(20)
    child_ids = [l["child_id"] for l in links]
    
    # Get all goals for parent's children (both parent-created and child-created)
    goals = await db.savings_goals.find(
        {"$or": [
            {"parent_id": parent["user_id"]},
            {"user_id": {"$in": child_ids}}
        ]},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with child names and timeline info
    for goal in goals:
        child_id = goal.get("child_id") or goal.get("user_id")
        if child_id:
            child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "name": 1})
            goal["child_name"] = child.get("name") if child else "Unknown"
        
        # Add progress info
        target = goal.get("target_amount", 0)
        current = goal.get("current_amount", 0)
        goal["progress_percent"] = round((current / target * 100) if target > 0 else 0, 1)
        goal["amount_to_go"] = max(0, target - current)
        
        # Determine creator
        if goal.get("parent_id"):
            goal["created_by"] = "Parent"
        else:
            goal["created_by"] = "Child"
    
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
    
    # Get all chores created by this parent (from new_quests with creator_type: parent)
    parent_chores = await db.new_quests.find(
        {"creator_type": "parent", "creator_id": parent["user_id"]},
        {"_id": 0}
    ).to_list(200)
    
    pending_requests = []
    seen_chore_ids = set()
    
    for chore in parent_chores:
        chore_id = chore.get("chore_id") or chore.get("quest_id")
        
        # Skip if we've already processed this chore
        if chore_id in seen_chore_ids:
            continue
        seen_chore_ids.add(chore_id)
        
        # Get completion with pending_approval status
        completion = await db.quest_completions.find_one(
            {"quest_id": chore_id, "status": "pending_approval"},
            {"_id": 0}
        )
        if completion:
            child = await db.users.find_one(
                {"user_id": completion["user_id"]},
                {"_id": 0, "name": 1, "avatar": 1, "user_id": 1}
            )
            pending_requests.append({
                "request_id": completion.get("completion_id"),
                "chore_id": chore_id,
                "chore_title": chore.get("title"),
                "reward_amount": chore.get("reward_amount", chore.get("reward_coins", chore.get("total_points", 0))),
                "child_id": completion["user_id"],
                "child_name": child.get("name") if child else "Unknown",
                "child_avatar": child.get("avatar") if child else None,
                "status": "pending",
                "submitted_at": completion.get("submitted_at"),
                "created_at": completion.get("submitted_at")
            })
    
    return pending_requests

@router.post("/chore-requests/{request_id}/validate")
async def validate_chore_request(request_id: str, request: Request):
    """Validate (approve or reject) a chore completion request"""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)
    body = await request.json()
    
    action = body.get("action", "reject")
    reason = body.get("reason", "Please try again")
    
    # Find the completion by completion_id
    completion = await db.quest_completions.find_one({
        "completion_id": request_id,
        "status": "pending_approval"
    })
    
    if not completion:
        raise HTTPException(status_code=404, detail="Request not found")
    
    chore_id = completion.get("quest_id") or completion.get("chore_id")
    
    # Verify parent owns this chore
    chore = await db.new_quests.find_one({
        "$or": [{"chore_id": chore_id}, {"quest_id": chore_id}],
        "creator_type": "parent",
        "creator_id": parent["user_id"]
    })
    
    if not chore:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    child_id = completion["user_id"]
    reward = chore.get("reward_amount", chore.get("total_points", 0))
    
    if action == "approve":
        # Update completion status
        await db.quest_completions.update_one(
            {"completion_id": request_id},
            {"$set": {
                "status": "approved",
                "is_completed": True,
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "approved_by": parent["user_id"]
            }}
        )
        
        # Award coins to child
        await db.wallet_accounts.update_one(
            {"user_id": child_id, "account_type": "spending"},
            {"$inc": {"balance": reward}}
        )
        
        # Record transaction
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": child_id,
            "to_account": "spending",
            "amount": reward,
            "transaction_type": "chore_reward",
            "description": f"Approved: {chore.get('title', 'Chore')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Notify child
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": child_id,
            "message": f"🎉 Chore approved! You earned ₹{reward} for: {chore.get('title')}",
            "type": "chore_approved",
            "link": "/wallet",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Chore approved", "reward": reward}
    else:
        # Reject - allow resubmission
        await db.quest_completions.update_one(
            {"completion_id": request_id},
            {"$set": {
                "status": "rejected",
                "is_completed": False,
                "rejection_reason": reason,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejected_by": parent["user_id"]
            }}
        )
        
        # Notify child
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": child_id,
            "message": f"Chore needs more work: {chore.get('title')}. {reason}",
            "type": "chore_rejected",
            "link": "/quests",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Chore rejected", "reason": reason}

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
    title = body.get("title")
    reward = body.get("reward_coins", 10)
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "name": 1})
    
    # Store in new_quests collection for consistency with child quest view
    await db.new_quests.insert_one({
        "quest_id": chore_id,
        "chore_id": chore_id,
        "title": title,
        "description": body.get("description", ""),
        "reward_amount": reward,
        "reward_coins": reward,
        "total_points": reward,
        "creator_type": "parent",
        "creator_id": parent["user_id"],
        "creator_name": parent.get("name", "Parent"),
        "assigned_to": child_id,
        "child_id": child_id,
        "child_name": child.get("name") if child else "Unknown",
        "is_recurring": body.get("is_recurring", False),
        "frequency": body.get("frequency", "once"),
        "is_active": True,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Also keep in parent_chores for parent's chore list view
    await db.parent_chores.insert_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "title": title,
        "description": body.get("description", ""),
        "reward_coins": reward,
        "is_recurring": body.get("is_recurring", False),
        "frequency": body.get("frequency"),
        "is_completed": False,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send notification to child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "type": "chore_created",
        "message": f"📋 New chore from {parent.get('name', 'Parent')}: {title} (₹{reward})",
        "link": "/quests",
        "is_read": False,
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
    
    reward = chore.get("reward_coins", 0)
    
    # Award coins
    await db.wallet_accounts.update_one(
        {"user_id": chore["child_id"], "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    # Send notification to child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": chore["child_id"],
        "type": "chore_approved",
        "message": f"🎉 Chore approved! You earned ₹{reward} for: {chore.get('title')}",
        "link": "/wallet",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
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
        "transaction_type": "gift_received",
        "amount": amount,
        "description": f"Gift from {parent.get('name', 'Parent')}: {reason}",
        "from_user_id": parent["user_id"],
        "to_account": "spending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send notification to child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "type": "gift_received",
        "message": f"🎁 You received ₹{amount} from {parent.get('name', 'Parent')}! Reason: {reason}",
        "link": "/wallet",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Gave ₹{amount} to child"}