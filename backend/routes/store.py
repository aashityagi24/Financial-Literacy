"""Store routes - Shopping and purchases"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

# Database injection
_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["store"])

class PurchaseCreate(BaseModel):
    item_id: str

@router.get("/store/items")
async def get_store_items(request: Request):
    """Get available store items for current user's grade"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    items = await db.store_items.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    return items

@router.post("/store/purchase")
async def purchase_item(purchase: PurchaseCreate, request: Request):
    """Purchase an item from the store"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Parents cannot purchase
    if user.get("role") == "parent":
        raise HTTPException(status_code=403, detail="Parents cannot purchase items directly. Please add items to your shopping list instead.")
    
    # Check in admin_store_items
    item = await db.admin_store_items.find_one({"item_id": purchase.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if not item.get("is_active", True):
        raise HTTPException(status_code=400, detail="Item is not available")
    
    # Check spending balance
    spending_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "spending"
    })
    
    if not spending_acc or spending_acc.get("balance", 0) < item["price"]:
        raise HTTPException(status_code=400, detail="Insufficient balance in spending account")
    
    # Deduct balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -item["price"]}}
    )
    
    # Record purchase
    purchase_doc = {
        "purchase_id": f"purch_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "item_id": item["item_id"],
        "item_name": item["name"],
        "price": item["price"],
        "purchased_at": datetime.now(timezone.utc).isoformat()
    }
    await db.purchases.insert_one(purchase_doc)
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": -item["price"],
        "transaction_type": "purchase",
        "description": f"Purchased {item['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    # Auto-mark shopping list item as purchased if applicable
    if user.get("role") == "child":
        await db.new_quests.update_one(
            {
                "child_id": user["user_id"],
                "is_shopping_chore": True,
                "is_active": True,
                "shopping_item_details.item_id": purchase.item_id
            },
            {"$set": {"shopping_item_details.$.purchased": True}}
        )
    
    return {"message": "Purchase successful", "item": item}

@router.get("/store/purchases")
async def get_purchases(request: Request):
    """Get user's purchase history"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    purchases = await db.purchases.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("purchased_at", -1).to_list(100)
    
    return purchases

@router.get("/child/shopping-list")
async def get_child_shopping_list(request: Request):
    """Get child's shopping list from parent-assigned chores"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    shopping_chores = await db.new_quests.find({
        "child_id": user["user_id"],
        "is_shopping_chore": True,
        "is_active": True
    }, {"_id": 0}).to_list(50)
    
    items = []
    for chore in shopping_chores:
        for item in chore.get("shopping_item_details", []):
            items.append({
                "chore_id": chore["chore_id"],
                "chore_title": chore["title"],
                "list_id": item["list_id"],
                "item_id": item["item_id"],
                "item_name": item["item_name"],
                "quantity": item["quantity"],
                "purchased": item.get("purchased", False)
            })
    
    return items

@router.post("/child/shopping-list/{item_id}/mark-purchased")
async def mark_shopping_item_purchased(item_id: str, request: Request):
    """Mark a shopping list item as purchased"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    chore = await db.new_quests.find_one({
        "child_id": user["user_id"],
        "is_shopping_chore": True,
        "is_active": True,
        "shopping_item_details.item_id": item_id
    })
    
    if not chore:
        return {"message": "Item not in shopping list"}
    
    await db.new_quests.update_one(
        {"chore_id": chore["chore_id"], "shopping_item_details.item_id": item_id},
        {"$set": {"shopping_item_details.$.purchased": True}}
    )
    
    return {"message": "Item marked as purchased"}


@router.get("/store/categories")
async def get_store_categories(request: Request):
    """Get store categories for users"""
    from services.auth import get_current_user
    db = get_db()
    await get_current_user(request)
    
    # Only return active categories
    categories = await db.admin_store_categories.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    return categories

@router.get("/store/items-by-category")
async def get_items_by_category(request: Request, category_id: str = None):
    """Get store items grouped by category"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    # Get active categories first
    active_categories = await db.admin_store_categories.find(
        {"is_active": True},
        {"category_id": 1}
    ).to_list(100)
    active_category_ids = [c["category_id"] for c in active_categories]
    
    # Filter items by grade, availability, and active categories
    query = {
        "min_grade": {"$lte": grade}, 
        "max_grade": {"$gte": grade},
        "category_id": {"$in": active_category_ids},
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }
    if category_id:
        query["category_id"] = category_id
    
    # Use admin_store_items collection which has the actual items
    items = await db.admin_store_items.find(query, {"_id": 0}).to_list(500)
    
    # Group by category
    by_category = {}
    for item in items:
        cat_id = item.get("category_id", "uncategorized")
        if cat_id not in by_category:
            by_category[cat_id] = []
        by_category[cat_id].append(item)
    
    return by_category