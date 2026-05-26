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


async def find_with_grade_order(collection, query, filter_grade, parent_field=None, parent_target=None, limit=500):
    """Fetch documents sorted by grade-specific order if filter_grade is set,
    falling back to the global `order` field.

    If parent_field + parent_target are given, the parent match is computed as
    the effective parent: `grade_parents.<grade>` when set, falling back to
    the document's own `<parent_field>` value. This allows the same item to
    appear under a different topic/subtopic per grade. When filter_grade is
    None, the parent match is performed directly on `<parent_field>`.

    Always strips internal MongoDB _id and the computed helper fields.
    """
    use_parent_remap = parent_field is not None and parent_target is not None

    if filter_grade is None:
        full_query = dict(query)
        if use_parent_remap:
            full_query[parent_field] = parent_target
        cursor = collection.find(full_query, {"_id": 0}).sort("order", 1)
        return await cursor.to_list(limit)

    pipeline = []
    if query:
        pipeline.append({"$match": query})
    add_fields = {
        "effective_order": {"$ifNull": [f"$grade_orders.{filter_grade}", "$order"]}
    }
    if use_parent_remap:
        add_fields["effective_parent"] = {
            "$ifNull": [f"$grade_parents.{filter_grade}", f"${parent_field}"]
        }
    pipeline.append({"$addFields": add_fields})
    if use_parent_remap:
        pipeline.append({"$match": {"effective_parent": parent_target}})
    pipeline.append({"$sort": {"effective_order": 1}})
    pipeline.append({"$project": {"_id": 0, "effective_order": 0, "effective_parent": 0}})
    cursor = collection.aggregate(pipeline)
    return await cursor.to_list(limit)


async def count_with_grade_parent(collection, parent_field, parent_target, filter_grade, extra_query=None):
    """Count documents whose effective parent (grade_parents.<grade> ?? parent_field)
    equals parent_target. Uses simple count_documents when no grade filter."""
    extra_query = extra_query or {}
    if filter_grade is None:
        full_query = dict(extra_query)
        full_query[parent_field] = parent_target
        return await collection.count_documents(full_query)
    pipeline = []
    if extra_query:
        pipeline.append({"$match": extra_query})
    pipeline.append({"$addFields": {
        "effective_parent": {"$ifNull": [f"$grade_parents.{filter_grade}", f"${parent_field}"]}
    }})
    pipeline.append({"$match": {"effective_parent": parent_target}})
    pipeline.append({"$count": "n"})
    docs = await collection.aggregate(pipeline).to_list(1)
    return docs[0]["n"] if docs else 0


def apply_grade_overrides(doc, filter_grade, fields=("title", "description", "thumbnail")):
    """Merge per-grade text overrides (title/description/thumbnail) from
    `grade_overrides.<grade>` onto the document for the given filter_grade.
    Returns the same doc with the merged fields. Idempotent; safe when no
    grade filter or no overrides exist."""
    if not doc or filter_grade is None:
        return doc
    overrides = (doc.get("grade_overrides") or {}).get(str(filter_grade))
    if not overrides:
        return doc
    for field in fields:
        if field in overrides and overrides[field] not in (None, ""):
            doc[field] = overrides[field]
    return doc


async def is_user_in_test_mode(user, db):
    """A user is in 'test mode' (everything unlocked, no progressive gating) when:
    1. An admin has explicitly set `is_test_user: True` on the user, OR
    2. The user (or any subscription containing their user_id / email) has an
       active 1-day subscription. Longer plans keep the normal progressive
       unlock behaviour.

    Returns False for non-existent users."""
    if not user:
        return False
    if user.get("is_test_user"):
        return True
    return await is_user_on_one_day_trial(user, db)


async def is_user_on_one_day_trial(user, db):
    """True iff the user has an active completed 1-day subscription (their own,
    their parent's, or one that lists their user_id). Distinct from
    is_test_user so download throttles can target paying trial users without
    penalising internal QA accounts."""
    if not user:
        return False
    now_iso = datetime.now(timezone.utc).isoformat()
    user_id = user.get("user_id")
    email = (user.get("email") or "").lower()
    candidates = []
    if user_id:
        candidates.append({"child_user_ids": user_id})
    if email:
        candidates.append({"parent_emails": email})
    if not candidates:
        return False
    sub = await db.subscriptions.find_one({
        "$or": candidates,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now_iso},
        "duration": "1_day",
    }, {"_id": 0, "subscription_id": 1})
    return sub is not None

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
    
    parent_topics = await find_with_grade_order(db.content_topics, query, filter_grade, limit=100)
    
    completed_content_ids = set()
    test_mode = False
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        test_mode = await is_user_in_test_mode(user, db)
    
    previous_topic_completed = True
    
    # Apply grade-specific text overrides on top-level topics (admin views the
    # global names, everyone else sees the per-grade override when set).
    if filter_grade is not None and not is_admin:
        for t in parent_topics:
            apply_grade_overrides(t, filter_grade)
    
    for topic in parent_topics:
        topic_id = topic["topic_id"]
        # Grade filter for subtopics
        if filter_grade is None or is_admin:
            subtopic_extra_query = {}
            content_extra_query = {"is_published": True}
        else:
            subtopic_extra_query = {"min_grade": {"$lte": filter_grade}, "max_grade": {"$gte": filter_grade}}
            # Build content query (without topic_id, which is handled by parent_target)
            content_extra_query = {
                "is_published": True,
                "min_grade": {"$lte": filter_grade},
                "max_grade": {"$gte": filter_grade}
            }
        
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
                content_extra_query = {"$and": [content_extra_query, visibility_condition]}
        
        subtopics = await find_with_grade_order(
            db.content_topics, subtopic_extra_query, filter_grade,
            parent_field='parent_id', parent_target=topic_id, limit=100
        )
        # Apply per-grade text overrides on subtopics (non-admin only).
        if filter_grade is not None and not is_admin:
            for st in subtopics:
                apply_grade_overrides(st, filter_grade)
        topic["subtopics"] = subtopics
        topic["content_count"] = await count_with_grade_parent(
            db.content_items, 'topic_id', topic_id, filter_grade, content_extra_query
        )
        
        if is_child:
            topic["is_unlocked"] = True if test_mode else previous_topic_completed
            topic["completed_count"] = 0
            topic["total_content"] = topic["content_count"]
            all_subtopics_completed = True
            previous_subtopic_completed = True if test_mode else previous_topic_completed
            
            for subtopic in subtopics:
                subtopic_id = subtopic["topic_id"]
                # Grade filter for subtopic content - only show content visible to children
                subtopic_content_extra = {
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
                subtopic["content_count"] = await count_with_grade_parent(
                    db.content_items, 'topic_id', subtopic_id, filter_grade, subtopic_content_extra
                )
                topic["total_content"] += subtopic["content_count"]
                
                subtopic_content = await find_with_grade_order(
                    db.content_items, subtopic_content_extra, filter_grade,
                    parent_field='topic_id', parent_target=subtopic_id, limit=100
                )
                
                subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
                subtopic["completed_count"] = subtopic_completed_count
                subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
                subtopic["is_unlocked"] = True if test_mode else previous_subtopic_completed
                topic["completed_count"] += subtopic_completed_count
                
                if not subtopic["is_completed"] and subtopic["content_count"] > 0:
                    all_subtopics_completed = False
                previous_subtopic_completed = True if test_mode else subtopic["is_completed"]
            
            has_any_content = topic["total_content"] > 0
            topic["is_completed"] = all_subtopics_completed and has_any_content
            previous_topic_completed = True if test_mode else topic["is_completed"]
        else:
            for subtopic in subtopics:
                subtopic_id = subtopic["topic_id"]
                # Grade and visibility filter for teachers/parents viewing content
                if filter_grade is not None and not is_admin:
                    subtopic_content_extra = {
                        "is_published": True,
                        "min_grade": {"$lte": filter_grade},
                        "max_grade": {"$gte": filter_grade}
                    }
                    # Add visibility filter - teachers/parents see child content + their own
                    if is_teacher:
                        subtopic_content_extra["$or"] = [
                            {"visible_to": {"$in": ["child", "teacher"]}},
                            {"visible_to": {"$exists": False}},
                            {"visible_to": []},
                            {"visible_to": None}
                        ]
                    elif is_parent:
                        subtopic_content_extra["$or"] = [
                            {"visible_to": {"$in": ["child", "parent"]}},
                            {"visible_to": {"$exists": False}},
                            {"visible_to": []},
                            {"visible_to": None}
                        ]
                else:
                    subtopic_content_extra = {"is_published": True}
                subtopic["content_count"] = await count_with_grade_parent(
                    db.content_items, 'topic_id', subtopic_id, filter_grade, subtopic_content_extra
                )
    
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
    
    # Apply per-grade text overrides for non-admins.
    if filter_grade is not None and not is_admin:
        apply_grade_overrides(topic, filter_grade)
    
    # Grade filter for subtopics - apply if grade param is passed
    if filter_grade is not None:
        subtopic_extra_query = {"min_grade": {"$lte": filter_grade}, "max_grade": {"$gte": filter_grade}}
    else:
        subtopic_extra_query = {}
    subtopics = await find_with_grade_order(
        db.content_topics, subtopic_extra_query, filter_grade,
        parent_field='parent_id', parent_target=topic_id, limit=100
    )
    if filter_grade is not None and not is_admin:
        for st in subtopics:
            apply_grade_overrides(st, filter_grade)
    
    # Grade filter for content items (parent_id handled via parent_target)
    content_query = {}
    
    # Only require is_published for non-admin
    if not is_admin:
        content_query["is_published"] = True
    
    # Build the complete query with grade AND visibility filters
    # Apply grade filter if filter_grade is set (for any user including admin preview)
    if filter_grade is not None:
        # Start with base conditions
        conditions = [content_query] if content_query else []
        
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
        content_query = {"$and": conditions} if conditions else {}
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
    content_items = await find_with_grade_order(
        db.content_items, content_query, filter_grade,
        parent_field='topic_id', parent_target=topic_id, limit=100
    )
    logging.info(f"TopicDetail: Found {len(content_items)} content items")
    
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True}, {"content_id": 1, "coins_earned": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        coins_earned_map = {doc["content_id"]: doc.get("coins_earned") for doc in completed_docs}
        test_mode = await is_user_in_test_mode(user, db)
        
        # Progressive unlock for subtopics
        previous_subtopic_completed = True  # First subtopic always unlocked
        for subtopic in subtopics:
            subtopic_id = subtopic["topic_id"]
            subtopic["is_unlocked"] = True if test_mode else previous_subtopic_completed
            subtopic_content_extra = {
                "is_published": True,
                "$or": [
                    {"visible_to": {"$in": ["child"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            }
            if filter_grade is not None:
                subtopic_content_extra["min_grade"] = {"$lte": filter_grade}
                subtopic_content_extra["max_grade"] = {"$gte": filter_grade}
            subtopic_content = await find_with_grade_order(
                db.content_items, subtopic_content_extra, filter_grade,
                parent_field='topic_id', parent_target=subtopic_id, limit=100
            )
            subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
            subtopic["completed_count"] = subtopic_completed_count
            subtopic["content_count"] = len(subtopic_content)
            subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
            previous_subtopic_completed = True if test_mode else subtopic["is_completed"]
        
        # Progressive unlock for content items
        previous_content_completed = True  # First item always unlocked
        for content in content_items:
            content["is_completed"] = content["content_id"] in completed_content_ids
            content["is_unlocked"] = True if test_mode else previous_content_completed
            content["coins_earned"] = coins_earned_map.get(content["content_id"])
            previous_content_completed = True if test_mode else content["is_completed"]
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
            subtopic_id = subtopic["topic_id"]
            # Grade filter for subtopic content - only show content visible to children
            subtopic_content_extra = {
                "is_published": True,
                "$or": [
                    {"visible_to": {"$in": ["child"]}},
                    {"visible_to": {"$exists": False}},
                    {"visible_to": []},
                    {"visible_to": None}
                ]
            }
            if filter_grade is not None:
                subtopic_content_extra["min_grade"] = {"$lte": filter_grade}
                subtopic_content_extra["max_grade"] = {"$gte": filter_grade}
            
            subtopic_content = await find_with_grade_order(
                db.content_items, subtopic_content_extra, filter_grade,
                parent_field='topic_id', parent_target=subtopic_id, limit=100
            )
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
            "wallet_source": "coinquest",
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
    """Update a topic. When `grade` is supplied in the body, the editable
    text fields (title, description, thumbnail) are saved as per-grade
    overrides under `grade_overrides.<grade>` and the global title/description/
    thumbnail are left untouched. Without `grade`, the global fields are
    updated as before."""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    grade = body.get("grade")
    grade_key = str(grade) if grade is not None and grade != "all" else None

    update_fields = {}
    if grade_key is None:
        # Global update
        for field in ["title", "description", "thumbnail", "icon", "min_grade", "max_grade", "order"]:
            if field in body:
                update_fields[field] = body[field]
    else:
        # Per-grade override for the human-facing fields only.
        for field in ["title", "description", "thumbnail"]:
            if field in body:
                update_fields[f"grade_overrides.{grade_key}.{field}"] = body[field]
        # Allow clearing all overrides for this grade by sending grade_overrides_clear: true
        if body.get("grade_overrides_clear"):
            await db.content_topics.update_one(
                {"topic_id": topic_id},
                {"$unset": {f"grade_overrides.{grade_key}": ""}}
            )

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
    """Reorder topics. If `grade` is supplied in the body, the order is saved
    per-grade (under `grade_orders.<grade>`) so the same topic can have a
    different position for different grades. Without `grade`, the global
    `order` field is updated."""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    grade = body.get("grade")
    grade_key = str(grade) if grade is not None and grade != "all" else None
    
    # Frontend sends 'items' with 'id' field, map to topic_id
    items = body.get("items") or body.get("topics", [])
    for item in items:
        topic_id = item.get("id") or item.get("topic_id")
        if not topic_id:
            continue
        order_value = item.get("order", 0)
        if grade_key is not None:
            update_op = {"$set": {f"grade_orders.{grade_key}": order_value}}
        else:
            update_op = {"$set": {"order": order_value}}
        await db.content_topics.update_one({"topic_id": topic_id}, update_op)
    
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
    """Reorder content items. Supports per-grade ordering when `grade` is
    supplied in the body — same content item can have different positions for
    different grades."""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    body = await request.json()
    
    grade = body.get("grade")
    grade_key = str(grade) if grade is not None and grade != "all" else None
    
    for item in body.get("items", []):
        # Frontend sends 'id' field, map it to content_id
        content_id = item.get("id") or item.get("content_id")
        if not content_id:
            continue
        order_value = item.get("order", 0)
        if grade_key is not None:
            update_op = {"$set": {f"grade_orders.{grade_key}": order_value}}
        else:
            update_op = {"$set": {"order": order_value}}
        await db.content_items.update_one({"content_id": content_id}, update_op)
    
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
    """Move a content item to a different topic/subtopic. When `grade` is
    supplied in the body, the move is grade-specific — the item is recorded
    under the new parent only for that grade (`grade_parents.<grade>`),
    leaving its position in other grades unchanged. Without `grade`, the
    global `topic_id` is updated as before."""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_topic_id = body.get("new_topic_id")
    grade = body.get("grade")
    grade_key = str(grade) if grade is not None and grade != "all" else None
    
    if not new_topic_id:
        raise HTTPException(status_code=400, detail="new_topic_id is required")
    
    content = await db.content_items.find_one({"content_id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    new_topic = await db.content_topics.find_one({"topic_id": new_topic_id})
    if not new_topic:
        raise HTTPException(status_code=404, detail="Target topic/subtopic not found")
    
    if grade_key is None:
        # Global move: existing behaviour.
        max_order_doc = await db.content_items.find_one(
            {"topic_id": new_topic_id},
            sort=[("order", -1)]
        )
        new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
        await db.content_items.update_one(
            {"content_id": content_id},
            {"$set": {"topic_id": new_topic_id, "order": new_order}}
        )
    else:
        # Grade-specific move: write to grade_parents/grade_orders so the item
        # retains its original placement for other grades.
        # Find the next per-grade order at the destination.
        existing = await db.content_items.find(
            {"$or": [
                {"topic_id": new_topic_id},
                {f"grade_parents.{grade_key}": new_topic_id},
            ]},
            {"_id": 0, "content_id": 1, "topic_id": 1,
             "order": 1, "grade_orders": 1, "grade_parents": 1}
        ).to_list(1000)
        max_eff_order = -1
        for doc in existing:
            grade_parents = doc.get("grade_parents") or {}
            effective_parent = grade_parents.get(grade_key) or doc.get("topic_id")
            if effective_parent != new_topic_id:
                continue
            grade_orders = doc.get("grade_orders") or {}
            eff_order = grade_orders.get(grade_key)
            if eff_order is None:
                eff_order = doc.get("order", 0)
            if eff_order > max_eff_order:
                max_eff_order = eff_order
        new_order = max_eff_order + 1
        await db.content_items.update_one(
            {"content_id": content_id},
            {"$set": {
                f"grade_parents.{grade_key}": new_topic_id,
                f"grade_orders.{grade_key}": new_order,
            }}
        )
    
    return {"message": f"Content moved to {new_topic['title']}", "new_topic_id": new_topic_id}

@router.post("/admin/content/subtopics/{subtopic_id}/move")
async def admin_move_subtopic(subtopic_id: str, request: Request):
    """Move a subtopic to a different parent topic. Supports grade-specific
    placement when `grade` is supplied in the body (the subtopic appears under
    the new parent only for that grade)."""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    new_parent_id = body.get("new_parent_id")
    grade = body.get("grade")
    grade_key = str(grade) if grade is not None and grade != "all" else None
    
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
    
    if grade_key is None:
        max_order_doc = await db.content_topics.find_one(
            {"parent_id": new_parent_id},
            sort=[("order", -1)]
        )
        new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
        await db.content_topics.update_one(
            {"topic_id": subtopic_id},
            {"$set": {"parent_id": new_parent_id, "order": new_order}}
        )
    else:
        # Grade-specific move
        existing = await db.content_topics.find(
            {"$or": [
                {"parent_id": new_parent_id},
                {f"grade_parents.{grade_key}": new_parent_id},
            ]},
            {"_id": 0, "topic_id": 1, "parent_id": 1,
             "order": 1, "grade_orders": 1, "grade_parents": 1}
        ).to_list(1000)
        max_eff_order = -1
        for doc in existing:
            grade_parents = doc.get("grade_parents") or {}
            effective_parent = grade_parents.get(grade_key) or doc.get("parent_id")
            if effective_parent != new_parent_id:
                continue
            grade_orders = doc.get("grade_orders") or {}
            eff_order = grade_orders.get(grade_key)
            if eff_order is None:
                eff_order = doc.get("order", 0)
            if eff_order > max_eff_order:
                max_eff_order = eff_order
        new_order = max_eff_order + 1
        await db.content_topics.update_one(
            {"topic_id": subtopic_id},
            {"$set": {
                f"grade_parents.{grade_key}": new_parent_id,
                f"grade_orders.{grade_key}": new_order,
            }}
        )
    
    return {"message": f"Subtopic moved to {new_parent['title']}", "new_parent_id": new_parent_id}


TRIAL_DOWNLOAD_LIMIT = 5


@router.get("/me/trial-status")
async def get_my_trial_status(request: Request):
    """Returns the caller's 1-day-trial status and current download usage.
    Used by global UI (persistent upgrade banner, limit-reached dialog).
    Safe for unauthenticated callers — returns is_trial=false."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user:
        return {"is_trial": False, "downloads_used": 0, "downloads_limit": TRIAL_DOWNLOAD_LIMIT, "downloads_remaining": TRIAL_DOWNLOAD_LIMIT}
    is_trial = await is_user_on_one_day_trial(user, db)
    if not is_trial:
        return {"is_trial": False, "downloads_used": 0, "downloads_limit": TRIAL_DOWNLOAD_LIMIT, "downloads_remaining": TRIAL_DOWNLOAD_LIMIT}
    used = await db.user_downloads.count_documents({"user_id": user.get("user_id")})
    return {
        "is_trial": True,
        "downloads_used": used,
        "downloads_limit": TRIAL_DOWNLOAD_LIMIT,
        "downloads_remaining": max(0, TRIAL_DOWNLOAD_LIMIT - used),
    }


@router.get("/content/{content_id}/download-status")
async def get_download_status(content_id: str, request: Request):
    """Returns the current download usage and limit for the caller. Used by
    the UI to render the remaining allowance and disable the button when the
    quota is exhausted. content_id is accepted for routing consistency but is
    not used by the count — the limit is per-user, not per-item."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    
    is_trial = await is_user_on_one_day_trial(user, db)
    if not is_trial:
        return {"is_limited": False, "limit": None, "used": 0, "remaining": None}
    
    used = await db.user_downloads.count_documents({"user_id": user.get("user_id")})
    return {
        "is_limited": True,
        "limit": TRIAL_DOWNLOAD_LIMIT,
        "used": used,
        "remaining": max(0, TRIAL_DOWNLOAD_LIMIT - used),
    }


@router.post("/content/{content_id}/download")
async def request_content_download(content_id: str, request: Request):
    """Authorises a download for the caller. Returns the asset URL on success.
    1-day trial subscribers are capped at TRIAL_DOWNLOAD_LIMIT downloads —
    further attempts return 403 with a clear upgrade message. Admin-flagged
    test users (`is_test_user: True`) are NOT throttled, only paid 1-day trial
    subscribers are."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required to download")
    
    content = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Resolve the asset URL based on content type. Worksheets/workbooks use
    # pdf_url; other types may expose html_url / audio_url / video_url.
    data = content.get("content_data") or {}
    url = (
        data.get("pdf_url")
        or data.get("html_url")
        or data.get("audio_url")
        or data.get("video_url")
        or data.get("file_url")
    )
    if not url:
        raise HTTPException(status_code=400, detail="This content has no downloadable file")
    
    user_id = user.get("user_id")
    is_trial = await is_user_on_one_day_trial(user, db)
    
    if is_trial:
        # Count any prior downloads — duplicate downloads of the same item
        # still count, so a curious downloader can't loop a single allowed
        # file repeatedly.
        used = await db.user_downloads.count_documents({"user_id": user_id})
        if used >= TRIAL_DOWNLOAD_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"You have reached the {TRIAL_DOWNLOAD_LIMIT}-download limit for the 1-day trial. "
                    f"Upgrade to a longer plan for unlimited downloads."
                ),
            )
    
    # Record the download. We always record (even for non-trial users) so we
    # have a history; the limit check only fires for trial accounts.
    await db.user_downloads.insert_one({
        "download_id": f"dl_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "content_id": content_id,
        "content_type": content.get("content_type"),
        "url": url,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "is_trial_download": is_trial,
    })
    
    if is_trial:
        used_after = await db.user_downloads.count_documents({"user_id": user_id})
        return {
            "url": url,
            "is_limited": True,
            "limit": TRIAL_DOWNLOAD_LIMIT,
            "used": used_after,
            "remaining": max(0, TRIAL_DOWNLOAD_LIMIT - used_after),
        }
    return {"url": url, "is_limited": False}

