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
    user_role = user.get("role") if user else None
    user_grade = user.get("grade") if user else None
    user_id = user.get("user_id") if user else None
    is_child = user_role == "child"
    is_teacher = user_role == "teacher"
    is_parent = user_role == "parent"
    is_admin = user_role == "admin"
    
    # Determine grade filter based on role
    filter_grade = None
    if is_child:
        filter_grade = user_grade
    elif is_teacher and grade is not None:
        filter_grade = grade
    elif is_parent and grade is not None:
        filter_grade = grade
    
    # Build topic query
    if filter_grade is None or is_admin:
        query = {"parent_id": None}
    else:
        query = {"parent_id": None, "min_grade": {"$lte": filter_grade}, "max_grade": {"$gte": filter_grade}}
    
    parent_topics = await db.content_topics.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    completed_content_ids = set()
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
    
    previous_topic_completed = True
    
    for topic in parent_topics:
        # Grade filter for subtopics
        if filter_grade is None or is_admin:
            subtopic_query = {"parent_id": topic["topic_id"]}
            content_grade_query = {"topic_id": topic["topic_id"], "is_published": True}
        else:
            subtopic_query = {"parent_id": topic["topic_id"], "min_grade": {"$lte": filter_grade}, "max_grade": {"$gte": filter_grade}}
            # Build content query with $and for grade AND visibility
            base_query = {
                "topic_id": topic["topic_id"], 
                "is_published": True,
                "min_grade": {"$lte": filter_grade}, 
                "max_grade": {"$gte": filter_grade}
            }
            content_grade_query = base_query
        
        # Add visibility filter for non-admin users using $and
        if not is_admin and filter_grade is not None:
            if is_child:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
            elif is_teacher:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child", "teacher"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
            elif is_parent:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child", "parent"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
            else:
                visibility_condition = None
            
            if visibility_condition:
                content_grade_query = {"$and": [base_query, visibility_condition]}
        elif not is_admin:
            # No grade filter but still need visibility filter
            if is_child:
                content_grade_query["$or"] = [
                    {"visible_to": {"$in": ["child"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            elif is_teacher:
                content_grade_query["$or"] = [
                    {"visible_to": {"$in": ["child", "teacher"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            elif is_parent:
                content_grade_query["$or"] = [
                    {"visible_to": {"$in": ["child", "parent"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
        
        subtopics = await db.content_topics.find(subtopic_query, {"_id": 0}).sort("order", 1).to_list(100)
        topic["subtopics"] = subtopics
        topic["content_count"] = await db.content_items.count_documents(content_grade_query)
        
        if is_child:
            topic["is_unlocked"] = previous_topic_completed
            topic["completed_count"] = 0
            topic["total_content"] = topic["content_count"]
            all_subtopics_completed = True
            previous_subtopic_completed = previous_topic_completed
            
            for subtopic in subtopics:
                # Grade filter for subtopic content - only show content visible to children
                subtopic_content_query = {
                    "topic_id": subtopic["topic_id"], 
                    "is_published": True,
                    "min_grade": {"$lte": filter_grade}, 
                    "max_grade": {"$gte": filter_grade},
                    "$or": [
                        {"visible_to": {"$in": ["child"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
                subtopic["content_count"] = await db.content_items.count_documents(subtopic_content_query)
                topic["total_content"] += subtopic["content_count"]
                
                subtopic_content = await db.content_items.find(
                    subtopic_content_query, {"content_id": 1}
                ).sort("order", 1).to_list(100)
                
                subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
                subtopic["completed_count"] = subtopic_completed_count
                subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
                subtopic["is_unlocked"] = previous_subtopic_completed
                topic["completed_count"] += subtopic_completed_count
                
                if not subtopic["is_completed"] and subtopic["content_count"] > 0:
                    all_subtopics_completed = False
                previous_subtopic_completed = subtopic["is_completed"]
            
            has_any_content = topic["total_content"] > 0
            topic["is_completed"] = all_subtopics_completed and has_any_content
            previous_topic_completed = topic["is_completed"]
        else:
            for subtopic in subtopics:
                # Grade and visibility filter for teachers/parents viewing content
                if filter_grade is not None and not is_admin:
                    subtopic_content_query = {
                        "topic_id": subtopic["topic_id"], 
                        "is_published": True,
                        "min_grade": {"$lte": filter_grade}, 
                        "max_grade": {"$gte": filter_grade}
                    }
                    # Add visibility filter - teachers/parents see child content + their own
                    if is_teacher:
                        subtopic_content_query["$or"] = [
                            {"visible_to": {"$in": ["child", "teacher"]}},
                            {"visible_to": {"$exists": False}},
                            {"visible_to": []},
                            {"visible_to": None}
                        ]
                    elif is_parent:
                        subtopic_content_query["$or"] = [
                            {"visible_to": {"$in": ["child", "parent"]}},
                            {"visible_to": {"$exists": False}},
                            {"visible_to": []},
                            {"visible_to": None}
                        ]
                else:
                    subtopic_content_query = {"topic_id": subtopic["topic_id"], "is_published": True}
                subtopic["content_count"] = await db.content_items.count_documents(subtopic_content_query)
    
    # Filter out empty topics/subtopics for non-admin users
    if not is_admin:
        for topic in parent_topics:
            topic["subtopics"] = [st for st in topic.get("subtopics", []) if st.get("content_count", 0) > 0]
        parent_topics = [t for t in parent_topics if t.get("content_count", 0) > 0 or len(t.get("subtopics", [])) > 0]
    
    return parent_topics

@router.get("/content/topics/{topic_id}")
async def get_topic_detail(topic_id: str, request: Request, grade: Optional[int] = None):
    """Get topic details with content items"""
    from services.auth import get_current_user
    import logging
    db = get_db()
    user = await get_current_user(request)
    user_role = user.get("role") if user else None
    is_admin = user_role == "admin"
    is_child = user_role == "child"
    is_teacher = user_role == "teacher"
    is_parent = user_role == "parent"
    user_id = user.get("user_id") if user else None
    user_grade = user.get("grade") if user else None
    
    # Determine grade filter based on role
    # If grade param is passed, always use it (allows admin preview and teacher/parent filtering)
    filter_grade = None
    if grade is not None:
        filter_grade = int(grade)
    elif is_child:
        filter_grade = user_grade
    
    logging.info(f"TopicDetail: role={user_role}, grade_param={grade}, filter_grade={filter_grade}, topic={topic_id}")
    
    topic = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Grade filter for subtopics - apply if grade param is passed
    if filter_grade is not None:
        subtopic_query = {"parent_id": topic_id, "min_grade": {"$lte": filter_grade}, "max_grade": {"$gte": filter_grade}}
    else:
        subtopic_query = {"parent_id": topic_id}
    subtopics = await db.content_topics.find(subtopic_query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Grade filter for content items
    content_query = {"topic_id": topic_id}
    
    # Only require is_published for non-admin
    if not is_admin:
        content_query["is_published"] = True
    
    # Build the complete query with grade AND visibility filters
    # Apply grade filter if filter_grade is set (for any user including admin preview)
    if filter_grade is not None:
        # Start with base conditions
        conditions = [content_query]
        
        # Add grade filter
        grade_condition = {
            "min_grade": {"$lte": filter_grade},
            "max_grade": {"$gte": filter_grade}
        }
        conditions.append(grade_condition)
        
        # Add visibility filter for non-admin users
        if not is_admin:
            if is_child:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
                conditions.append(visibility_condition)
            elif is_teacher:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child", "teacher"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
                conditions.append(visibility_condition)
            elif is_parent:
                visibility_condition = {
                    "$or": [
                        {"visible_to": {"$in": ["child", "parent"]}},
                        {"visible_to": {"$exists": False}},
                        {"visible_to": []},
                        {"visible_to": None}
                    ]
                }
                conditions.append(visibility_condition)
        
        # Combine all conditions with $and
        content_query = {"$and": conditions}
    elif not is_admin:
        # No grade filter but still need visibility filter for non-admin
        if is_child:
            content_query["$or"] = [
                {"visible_to": {"$in": ["child"]}},
                {"visible_to": {"$exists": False}},
                {"visible_to": []},
                {"visible_to": None}
            ]
        elif is_teacher:
            content_query["$or"] = [
                {"visible_to": {"$in": ["child", "teacher"]}},
                {"visible_to": {"$exists": False}},
                {"visible_to": []},
                {"visible_to": None}
            ]
        elif is_parent:
            content_query["$or"] = [
                {"visible_to": {"$in": ["child", "parent"]}},
                {"visible_to": {"$exists": False}},
                {"visible_to": []},
                {"visible_to": None}
            ]
    
    logging.info(f"TopicDetail: Final content_query={content_query}")
    content_items = await db.content_items.find(content_query, {"_id": 0}).sort("order", 1).to_list(100)
    logging.info(f"TopicDetail: Found {len(content_items)} content items")
    
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1, "coins_earned": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        coins_earned_map = {doc["content_id"]: doc.get("coins_earned") for doc in completed_docs}
        
        # Progressive unlock for subtopics
        previous_subtopic_completed = True  # First subtopic always unlocked
        for subtopic in subtopics:
            subtopic["is_unlocked"] = previous_subtopic_completed
            subtopic_content_query = {
                "topic_id": subtopic["topic_id"],
                "is_published": True,
                "$or": [
                    {"visible_to": {"$in": ["child"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            }
            if filter_grade is not None:
                subtopic_content_query["min_grade"] = {"$lte": filter_grade}
                subtopic_content_query["max_grade"] = {"$gte": filter_grade}
            subtopic_content = await db.content_items.find(
                subtopic_content_query, {"content_id": 1}
            ).sort("order", 1).to_list(100)
            subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
            subtopic["completed_count"] = subtopic_completed_count
            subtopic["content_count"] = len(subtopic_content)
            subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
            previous_subtopic_completed = subtopic["is_completed"]
        
        # Progressive unlock for content items
        previous_content_completed = True  # First item always unlocked
        for content in content_items:
            content["is_completed"] = content["content_id"] in completed_content_ids
            content["is_unlocked"] = previous_content_completed
            content["coins_earned"] = coins_earned_map.get(content["content_id"])
            previous_content_completed = content["is_completed"]
    elif is_parent and user_id:
        # For parents: show completion status based on their children's progress
        links = await db.parent_child_links.find(
            {"parent_id": user_id, "status": "active"}, {"child_id": 1}
        ).to_list(20)
        child_ids = [lnk["child_id"] for lnk in links]
        completed_content_ids = set()
        if child_ids:
            completed_docs = await db.user_content_progress.find(
                {"user_id": {"$in": child_ids}, "completed": True}, {"content_id": 1}
            ).to_list(1000)
            completed_content_ids = {doc["content_id"] for doc in completed_docs}
            for content in content_items:
                content["is_completed"] = content["content_id"] in completed_content_ids
        
        for subtopic in subtopics:
            # Grade filter for subtopic content - only show content visible to children
            subtopic_content_query = {
                "topic_id": subtopic["topic_id"], 
                "is_published": True,
                "$or": [
                    {"visible_to": {"$in": ["child"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            }
            if filter_grade is not None:
                subtopic_content_query["min_grade"] = {"$lte": filter_grade}
                subtopic_content_query["max_grade"] = {"$gte": filter_grade}
            
            subtopic_content = await db.content_items.find(
                subtopic_content_query, {"content_id": 1}
            ).to_list(100)
            subtopic["completed_count"] = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
            subtopic["content_count"] = len(subtopic_content)
    
    # Filter out empty subtopics for non-admin users
    if not is_admin:
        subtopics = [st for st in subtopics if st.get("content_count", 0) > 0]
    
    return {"topic": topic, "subtopics": subtopics, "content_items": content_items}

@router.get("/content/items/{content_id}")
async def get_content_item(content_id: str, request: Request):
    """Get a single content item"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    is_admin = user and user.get("role") == "admin"
    is_child = user and user.get("role") == "child"
    
    item = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if not is_admin and not item.get("is_published", False):
        raise HTTPException(status_code=404, detail="Content not found")
    
    # For children, check if content is visible to them
    if is_child:
        visible_to = item.get("visible_to", [])
        # If visible_to is set and doesn't include 'child', deny access
        if visible_to and "child" not in visible_to:
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
    
    # For children, check if content is visible to them
    is_child = user.get("role") == "child"
    if is_child:
        visible_to = item.get("visible_to", [])
        if visible_to and "child" not in visible_to:
            raise HTTPException(status_code=404, detail="Content not found")
    
    user_id = user["user_id"]
    
    existing = await db.user_content_progress.find_one({
        "user_id": user_id, "content_id": content_id
    })
    
    if existing and existing.get("completed"):
        return {"message": "Already completed", "coins_awarded": 0}
    
    reward_coins = item.get("reward_coins", 5)
    
    # Performance-based reward tiering for activities with scores
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    percentage = body.get("percentage")
    if percentage is not None:
        try:
            pct = float(percentage)
            if pct < 50:
                reward_coins = 1  # Poor performance
            elif pct < 80:
                reward_coins = 3  # Okay performance
            # else: full reward_coins (great performance)
        except (ValueError, TypeError):
            pass
    
    await db.user_content_progress.update_one(
        {"user_id": user_id, "content_id": content_id},
        {"$set": {
            "user_id": user_id,
            "content_id": content_id,
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "coins_earned": reward_coins
        }},
        upsert=True
    )
    
    if user.get("role") == "child":
        await db.wallet_accounts.update_one(
            {"user_id": user_id, "account_type": "spending"},
            {"$inc": {"balance": reward_coins}}
        )
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "to_account": "spending",
            "amount": reward_coins,
            "transaction_type": "lesson_reward",
            "description": f"Completed: {item.get('title', 'Lesson')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
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
        "thumbnail": body.get("thumbnail"),
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
    for field in ["title", "description", "thumbnail", "icon", "min_grade", "max_grade", "order"]:
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
    
    # Frontend sends 'items' with 'id' field, map to topic_id
    items = body.get("items") or body.get("topics", [])
    for item in items:
        topic_id = item.get("id") or item.get("topic_id")
        if topic_id:
            await db.content_topics.update_one(
                {"topic_id": topic_id},
                {"$set": {"order": item.get("order", 0)}}
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
        "visible_to": body.get("visible_to", ["child"]),
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
                  "visible_to", "order", "min_grade", "max_grade", "reward_coins", "is_published"]:
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
        # Frontend sends 'id' field, map it to content_id
        content_id = item.get("id") or item.get("content_id")
        if content_id:
            await db.content_items.update_one(
                {"content_id": content_id},
                {"$set": {"order": item.get("order", 0)}}
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


@router.post("/admin/content/items/{content_id}/move")
async def admin_move_content(content_id: str, request: Request):
    """Move a content item to a different topic/subtopic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_topic_id = body.get("new_topic_id")
    
    if not new_topic_id:
        raise HTTPException(status_code=400, detail="new_topic_id is required")
    
    content = await db.content_items.find_one({"content_id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    new_topic = await db.content_topics.find_one({"topic_id": new_topic_id})
    if not new_topic:
        raise HTTPException(status_code=404, detail="Target topic/subtopic not found")
    
    max_order_doc = await db.content_items.find_one(
        {"topic_id": new_topic_id},
        sort=[("order", -1)]
    )
    new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
    
    await db.content_items.update_one(
        {"content_id": content_id},
        {"$set": {"topic_id": new_topic_id, "order": new_order}}
    )
    
    return {"message": f"Content moved to {new_topic['title']}", "new_topic_id": new_topic_id}

@router.post("/admin/content/subtopics/{subtopic_id}/move")
async def admin_move_subtopic(subtopic_id: str, request: Request):
    """Move a subtopic to a different parent topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_parent_id = body.get("new_parent_id")
    
    if not new_parent_id:
        raise HTTPException(status_code=400, detail="new_parent_id is required")
    
    subtopic = await db.content_topics.find_one({"topic_id": subtopic_id})
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")
    
    if not subtopic.get("parent_id"):
        raise HTTPException(status_code=400, detail="Cannot move a parent topic. This is only for subtopics.")
    
    new_parent = await db.content_topics.find_one({"topic_id": new_parent_id})
    if not new_parent:
        raise HTTPException(status_code=404, detail="Target topic not found")
    
    if new_parent.get("parent_id"):
        raise HTTPException(status_code=400, detail="Cannot move subtopic to another subtopic. Target must be a parent topic.")
    
    max_order_doc = await db.content_topics.find_one(
        {"parent_id": new_parent_id},
        sort=[("order", -1)]
    )
    new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
    
    await db.content_topics.update_one(
        {"topic_id": subtopic_id},
        {"$set": {"parent_id": new_parent_id, "order": new_order}}
    )
    
    return {"message": f"Subtopic moved to {new_parent['title']}", "new_parent_id": new_parent_id}

