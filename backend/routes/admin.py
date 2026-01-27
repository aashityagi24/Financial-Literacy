"""Admin routes - User management, stats, content administration"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
import uuid

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
    """Get all users with school info"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Get all schools for lookup
    schools = await db.schools.find({}, {"_id": 0, "school_id": 1, "name": 1}).to_list(100)
    school_map = {s["school_id"]: s["name"] for s in schools}
    
    # Add school_name to each user
    for user in users:
        school_id = user.get("school_id")
        user["school_name"] = school_map.get(school_id) if school_id else None
    
    return users

@router.post("/users")
async def create_user(data: UserCreateAdmin, request: Request):
    """Create a new user"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "name": data.name,
        "email": data.email.lower(),
        "role": data.role,
        "grade": data.grade,
        "streak_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
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
    
    update = {k: v for k, v in body.items() if k in ["name", "icon", "order"]}
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
    items = await db.store_items.find({}, {"_id": 0}).to_list(500)
    return items

@router.post("/store/items")
async def admin_create_store_item(request: Request):
    """Create a store item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    await db.store_items.insert_one({
        "item_id": item_id,
        "name": body.get("name", "New Item"),
        "description": body.get("description", ""),
        "price": body.get("price", 10),
        "category_id": body.get("category_id"),
        "image_url": body.get("image_url"),
        "stock": body.get("stock", -1),
        "is_available": body.get("is_available", True),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
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
    
    fields = ["name", "description", "price", "category_id", "image_url", "stock", "is_available", "min_grade", "max_grade"]
    update = {k: v for k, v in body.items() if k in fields}
    await db.store_items.update_one({"item_id": item_id}, {"$set": update})
    return {"message": "Item updated"}

@router.delete("/store/items/{item_id}")
async def admin_delete_store_item(item_id: str, request: Request):
    """Delete a store item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.store_items.delete_one({"item_id": item_id})
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
        "description": body.get("description", ""),
        "seed_cost": body.get("seed_cost", 10),
        "growth_days": body.get("growth_days", 7),
        "harvest_value": body.get("harvest_value", 20),
        "image_url": body.get("image_url"),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 2)
    })
    return {"message": "Plant created", "plant_id": plant_id}

@router.put("/garden/plants/{plant_id}")
async def admin_update_garden_plant(plant_id: str, request: Request):
    """Update a garden plant type"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    fields = ["name", "description", "seed_cost", "growth_days", "harvest_value", "image_url", "min_grade", "max_grade"]
    update = {k: v for k, v in body.items() if k in fields}
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
    db = get_db()
    await require_admin(request)
    
    import random
    stocks = await db.investment_stocks.find({"is_active": True}).to_list(100)
    
    for stock in stocks:
        volatility = stock.get("volatility", 0.1)
        trend = stock.get("trend", 0)
        change_pct = random.gauss(trend, volatility)
        new_price = stock["current_price"] * (1 + change_pct)
        new_price = max(stock.get("min_price", 1), min(new_price, stock.get("max_price", 1000)))
        
        await db.investment_stocks.update_one(
            {"stock_id": stock["stock_id"]},
            {"$set": {"current_price": round(new_price, 2)}}
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
