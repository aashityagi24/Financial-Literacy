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
    """Get all users"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
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

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    await db.users.delete_one({"user_id": user_id})
    await db.wallet_accounts.delete_many({"user_id": user_id})
    await db.transactions.delete_many({"user_id": user_id})
    
    return {"message": "User deleted"}

# Stats
@router.get("/stats")
async def get_admin_stats(request: Request):
    """Get admin dashboard stats"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    total_users = await db.users.count_documents({})
    total_children = await db.users.count_documents({"role": "child"})
    total_teachers = await db.users.count_documents({"role": "teacher"})
    total_parents = await db.users.count_documents({"role": "parent"})
    total_quests = await db.new_quests.count_documents({"creator_type": "admin"})
    total_topics = await db.content_topics.count_documents({})
    total_content = await db.content_items.count_documents({})
    
    return {
        "total_users": total_users,
        "total_children": total_children,
        "total_teachers": total_teachers,
        "total_parents": total_parents,
        "total_quests": total_quests,
        "total_topics": total_topics,
        "total_content": total_content
    }

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
