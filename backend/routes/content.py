"""Content management routes - Hierarchical learning content system"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["content"])

# Database reference (initialized by server.py)
db = None

def init_db(database):
    global db
    db = database

def get_db():
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db

# ============== USER CONTENT ROUTES ==============

@router.get("/content/topics")
async def get_all_topics(request: Request, grade: Optional[int] = None):
    """Get all topics with hierarchy and unlock status"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    user_grade = user.get("grade") if user else None
    user_id = user.get("user_id") if user else None
    is_child = user.get("role") == "child" if user else False
    is_teacher = user.get("role") == "teacher" if user else False
    
    if is_teacher and grade is not None:
        user_grade = grade
    
    if user_grade is None or (user and user.get("role") == "admin"):
        query = {"parent_id": None}
    else:
        query = {"parent_id": None, "min_grade": {"$lte": user_grade}, "max_grade": {"$gte": user_grade}}
    
    parent_topics = await db.content_topics.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    completed_content_ids = set()
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
    
    previous_topic_completed = True
    
    for topic in parent_topics:
        if user_grade is None or (user and user.get("role") == "admin"):
            subtopic_query = {"parent_id": topic["topic_id"]}
        else:
            subtopic_query = {"parent_id": topic["topic_id"], "min_grade": {"$lte": user_grade}, "max_grade": {"$gte": user_grade}}
        
        subtopics = await db.content_topics.find(subtopic_query, {"_id": 0}).sort("order", 1).to_list(100)
        topic["subtopics"] = subtopics
        topic["content_count"] = await db.content_items.count_documents({"topic_id": topic["topic_id"], "is_published": True})
        
        if is_child:
            topic["is_unlocked"] = previous_topic_completed
            topic["completed_count"] = 0
            topic["total_content"] = topic["content_count"]
            all_subtopics_completed = True
            previous_subtopic_completed = previous_topic_completed
            
            for subtopic in subtopics:
                subtopic["content_count"] = await db.content_items.count_documents({"topic_id": subtopic["topic_id"], "is_published": True})
                topic["total_content"] += subtopic["content_count"]
                
                subtopic_content = await db.content_items.find(
                    {"topic_id": subtopic["topic_id"], "is_published": True}, {"content_id": 1}
                ).sort("order", 1).to_list(100)
                
                subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
                subtopic["completed_count"] = subtopic_completed_count
                subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
                subtopic["is_unlocked"] = previous_subtopic_completed
                topic["completed_count"] += subtopic_completed_count
                
                if not subtopic["is_completed"]:
                    all_subtopics_completed = False
                previous_subtopic_completed = subtopic["is_completed"]
            
            topic["is_completed"] = all_subtopics_completed and len(subtopics) > 0
            previous_topic_completed = topic["is_completed"]
        else:
            for subtopic in subtopics:
                subtopic["content_count"] = await db.content_items.count_documents({"topic_id": subtopic["topic_id"], "is_published": True})
    
    return parent_topics

@router.get("/content/topics/{topic_id}")
async def get_topic_detail(topic_id: str, request: Request):
    """Get topic details with content items"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    is_admin = user and user.get("role") == "admin"
    is_child = user and user.get("role") == "child"
    user_id = user.get("user_id") if user else None
    
    topic = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    subtopics = await db.content_topics.find({"parent_id": topic_id}, {"_id": 0}).sort("order", 1).to_list(100)
    
    content_query = {"topic_id": topic_id}
    if not is_admin:
        content_query["is_published"] = True
    content_items = await db.content_items.find(content_query, {"_id": 0}).sort("order", 1).to_list(100)
    
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        
        for content in content_items:
            content["is_completed"] = content["content_id"] in completed_content_ids
        
        for subtopic in subtopics:
            subtopic_content = await db.content_items.find(
                {"topic_id": subtopic["topic_id"], "is_published": True}, {"content_id": 1}
            ).to_list(100)
            subtopic["completed_count"] = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
            subtopic["content_count"] = len(subtopic_content)
    
    return {"topic": topic, "subtopics": subtopics, "content_items": content_items}

@router.get("/content/items/{content_id}")
async def get_content_item(content_id: str, request: Request):
    """Get a single content item"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    is_admin = user and user.get("role") == "admin"
    
    item = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if not is_admin and not item.get("is_published", False):
        raise HTTPException(status_code=404, detail="Content not found")
    
    return item

@router.post("/content/items/{content_id}/complete")
async def complete_content_item(content_id: str, request: Request):
    """Mark content item as completed and award coins"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    item = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    user_id = user["user_id"]
    
    existing = await db.user_content_progress.find_one({
        "user_id": user_id, "content_id": content_id
    })
    
    if existing and existing.get("completed"):
        return {"message": "Already completed", "coins_awarded": 0}
    
    reward_coins = item.get("reward_coins", 5)
    
    await db.user_content_progress.update_one(
        {"user_id": user_id, "content_id": content_id},
        {"$set": {
            "user_id": user_id,
            "content_id": content_id,
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    if user.get("role") == "child":
        await db.wallet_accounts.update_one(
            {"user_id": user_id, "account_type": "spending"},
            {"$inc": {"balance": reward_coins}}
        )
    
    return {"message": "Content completed!", "coins_awarded": reward_coins}

# ============== ADMIN CONTENT ROUTES ==============

@router.get("/admin/content/topics")
async def admin_get_topics(request: Request):
    """Get all topics for admin (includes unpublished)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    topics = await db.content_topics.find({"parent_id": None}, {"_id": 0}).sort("order", 1).to_list(100)
    
    for topic in topics:
        subtopics = await db.content_topics.find({"parent_id": topic["topic_id"]}, {"_id": 0}).sort("order", 1).to_list(100)
        topic["subtopics"] = subtopics
        topic["content_count"] = await db.content_items.count_documents({"topic_id": topic["topic_id"]})
        for subtopic in subtopics:
            subtopic["content_count"] = await db.content_items.count_documents({"topic_id": subtopic["topic_id"]})
    
    return topics

@router.post("/admin/content/topics")
async def admin_create_topic(request: Request):
    """Create a new topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    topic_id = f"topic_{uuid.uuid4().hex[:12]}"
    max_order = await db.content_topics.find_one(
        {"parent_id": body.get("parent_id")},
        sort=[("order", -1)]
    )
    new_order = (max_order["order"] + 1) if max_order else 0
    
    topic_doc = {
        "topic_id": topic_id,
        "title": body.get("title", "Untitled"),
        "description": body.get("description", ""),
        "icon": body.get("icon", "📚"),
        "parent_id": body.get("parent_id"),
        "order": new_order,
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_topics.insert_one(topic_doc)
    
    return {"message": "Topic created", "topic_id": topic_id}

@router.put("/admin/content/topics/{topic_id}")
async def admin_update_topic(topic_id: str, request: Request):
    """Update a topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    update_fields = {}
    for field in ["title", "description", "icon", "min_grade", "max_grade", "order"]:
        if field in body:
            update_fields[field] = body[field]
    
    if update_fields:
        await db.content_topics.update_one({"topic_id": topic_id}, {"$set": update_fields})
    
    return {"message": "Topic updated"}

@router.delete("/admin/content/topics/{topic_id}")
async def admin_delete_topic(topic_id: str, request: Request):
    """Delete a topic and its content"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    subtopics = await db.content_topics.find({"parent_id": topic_id}).to_list(100)
    for subtopic in subtopics:
        await db.content_items.delete_many({"topic_id": subtopic["topic_id"]})
        await db.content_topics.delete_one({"topic_id": subtopic["topic_id"]})
    
    await db.content_items.delete_many({"topic_id": topic_id})
    await db.content_topics.delete_one({"topic_id": topic_id})
    
    return {"message": "Topic and all content deleted"}

@router.post("/admin/content/topics/reorder")
async def admin_reorder_topics(request: Request):
    """Reorder topics"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    for item in body.get("topics", []):
        await db.content_topics.update_one(
            {"topic_id": item["topic_id"]},
            {"$set": {"order": item["order"]}}
        )
    
    return {"message": "Topics reordered"}

@router.get("/admin/content/items")
async def admin_get_items(request: Request, topic_id: Optional[str] = None):
    """Get content items for admin"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    query = {"topic_id": topic_id} if topic_id else {}
    items = await db.content_items.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    return items

@router.post("/admin/content/items")
async def admin_create_item(request: Request):
    """Create a content item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    content_id = f"content_{uuid.uuid4().hex[:12]}"
    max_order = await db.content_items.find_one(
        {"topic_id": body.get("topic_id")},
        sort=[("order", -1)]
    )
    new_order = (max_order["order"] + 1) if max_order else 0
    
    content_doc = {
        "content_id": content_id,
        "topic_id": body.get("topic_id"),
        "title": body.get("title", "Untitled"),
        "description": body.get("description", ""),
        "content_type": body.get("content_type", "lesson"),
        "content_data": body.get("content_data", {}),
        "thumbnail": body.get("thumbnail"),
        "order": new_order,
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "reward_coins": body.get("reward_coins", 5),
        "is_published": body.get("is_published", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_items.insert_one(content_doc)
    
    return {"message": "Content created", "content_id": content_id}

@router.put("/admin/content/items/{content_id}")
async def admin_update_item(content_id: str, request: Request):
    """Update a content item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    update_fields = {}
    for field in ["title", "description", "content_type", "content_data", "thumbnail", 
                  "order", "min_grade", "max_grade", "reward_coins", "is_published"]:
        if field in body:
            update_fields[field] = body[field]
    
    if update_fields:
        await db.content_items.update_one({"content_id": content_id}, {"$set": update_fields})
    
    return {"message": "Content updated"}

@router.delete("/admin/content/items/{content_id}")
async def admin_delete_item(content_id: str, request: Request):
    """Delete a content item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    await db.content_items.delete_one({"content_id": content_id})
    await db.user_content_progress.delete_many({"content_id": content_id})
    
    return {"message": "Content deleted"}

@router.post("/admin/content/items/reorder")
async def admin_reorder_items(request: Request):
    """Reorder content items"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    for item in body.get("items", []):
        await db.content_items.update_one(
            {"content_id": item["content_id"]},
            {"$set": {"order": item["order"]}}
        )
    
    return {"message": "Content reordered"}

@router.post("/admin/content/items/{content_id}/toggle-publish")
async def admin_toggle_publish(content_id: str, request: Request):
    """Toggle content publish status"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    item = await db.content_items.find_one({"content_id": content_id})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    new_status = not item.get("is_published", False)
    await db.content_items.update_one({"content_id": content_id}, {"$set": {"is_published": new_status}})
    
    return {"message": f"Content {'published' if new_status else 'unpublished'}", "is_published": new_status}
