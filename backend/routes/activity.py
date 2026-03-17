"""Activity score tracking routes"""
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/activity", tags=["activity"])

def get_db():
    from server import db
    return db

@router.post("/score")
async def save_activity_score(request: Request):
    """Save a child's activity score. Deduplicates within a 5-minute session window."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    
    content_id = body.get("content_id")
    if not content_id:
        raise HTTPException(status_code=400, detail="content_id is required")
    
    child_id = user.get("user_id")
    
    # Get content details
    content = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    
    new_percentage = body.get("percentage", body.get("score", 0))
    new_correct = body.get("correctAnswers", 0)
    new_total = body.get("totalQuestions", 0)
    
    # Check for an existing score from the same child+content within last 5 minutes (same session)
    from datetime import timedelta
    session_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    existing = await db.activity_scores.find_one(
        {"child_id": child_id, "content_id": content_id, "created_at": {"$gte": session_cutoff}},
        {"_id": 1, "percentage": 1, "correct_answers": 1}
    )
    
    if existing:
        # Update the existing record if the new score is better
        if new_percentage >= (existing.get("percentage") or 0):
            await db.activity_scores.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "score": body.get("score", 0),
                    "percentage": new_percentage,
                    "correct_answers": new_correct,
                    "total_questions": new_total,
                    "time_spent_seconds": body.get("timeSpent", 0),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        return {"message": "Score updated", "score_id": "updated"}
    
    # New session — insert fresh record
    score_record = {
        "score_id": f"score_{uuid.uuid4().hex[:12]}",
        "child_id": child_id,
        "child_name": user.get("name", user.get("username", "Unknown")),
        "content_id": content_id,
        "content_title": content.get("title", "Activity") if content else "Activity",
        "topic_id": content.get("topic_id") if content else None,
        "score": body.get("score", 0),
        "max_score": body.get("max_score", 100),
        "percentage": new_percentage,
        "time_spent_seconds": body.get("timeSpent", 0),
        "correct_answers": new_correct,
        "total_questions": new_total,
        "attempts": body.get("attempts", 1),
        "completed": body.get("completed", True),
        "extra_data": body.get("extraData", {}),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.activity_scores.insert_one(score_record)
    
    # Update child's activity completion count
    await db.users.update_one(
        {"user_id": child_id},
        {"$inc": {"activities_completed": 1}}
    )
    
    return {"message": "Score saved", "score_id": score_record["score_id"]}

@router.get("/scores/me")
async def get_my_activity_scores(request: Request, limit: int = 50):
    """Get current child's activity scores"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    scores = await db.activity_scores.find(
        {"child_id": user.get("user_id")},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"scores": scores}

@router.get("/scores/child/{child_id}")
async def get_child_activity_scores(request: Request, child_id: str, limit: int = 50):
    """Get a specific child's activity scores (for parents/teachers)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify permission (parent, teacher, or admin)
    if user.get("role") not in ["parent", "teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # For parents, verify this is their child
    if user.get("role") == "parent":
        child = await db.users.find_one({"user_id": child_id})
        if not child or user.get("user_id") not in child.get("parent_ids", []):
            raise HTTPException(status_code=403, detail="Not authorized to view this child's scores")
    
    # For teachers, verify child is in their classroom
    if user.get("role") == "teacher":
        child = await db.users.find_one({"user_id": child_id})
        if not child:
            raise HTTPException(status_code=404, detail="Child not found")
        
        classroom = await db.classrooms.find_one({
            "teacher_id": user.get("user_id"),
            "student_ids": child_id
        })
        if not classroom:
            raise HTTPException(status_code=403, detail="Not authorized to view this child's scores")
    
    scores = await db.activity_scores.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get child info
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "password_hash": 0})
    
    return {
        "child": child,
        "scores": scores,
        "total_activities": len(scores),
        "average_score": sum(s.get("percentage", 0) for s in scores) / len(scores) if scores else 0
    }

@router.get("/scores/content/{content_id}")
async def get_content_scores(request: Request, content_id: str):
    """Get all scores for a specific activity/content (for teachers)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    scores = await db.activity_scores.find(
        {"content_id": content_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get content info
    content = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    
    # Calculate stats
    if scores:
        avg_score = sum(s.get("percentage", 0) for s in scores) / len(scores)
        avg_time = sum(s.get("time_spent_seconds", 0) for s in scores) / len(scores)
        completion_rate = sum(1 for s in scores if s.get("completed", False)) / len(scores) * 100
    else:
        avg_score = 0
        avg_time = 0
        completion_rate = 0
    
    return {
        "content": content,
        "scores": scores,
        "stats": {
            "total_attempts": len(scores),
            "average_score": round(avg_score, 1),
            "average_time_seconds": round(avg_time, 1),
            "completion_rate": round(completion_rate, 1)
        }
    }

@router.get("/analytics/classroom/{classroom_id}")
async def get_classroom_activity_analytics(request: Request, classroom_id: str):
    """Get activity analytics for a classroom (for teachers)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get classroom
    classroom = await db.classrooms.find_one({"classroom_id": classroom_id}, {"_id": 0})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    # Verify teacher owns classroom
    if user.get("role") == "teacher" and classroom.get("teacher_id") != user.get("user_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    student_ids = classroom.get("student_ids", [])
    
    # Get all scores for students in this classroom
    scores = await db.activity_scores.find(
        {"child_id": {"$in": student_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group by student
    student_stats = {}
    for score in scores:
        child_id = score.get("child_id")
        if child_id not in student_stats:
            student_stats[child_id] = {
                "child_id": child_id,
                "child_name": score.get("child_name", "Unknown"),
                "total_activities": 0,
                "total_score": 0,
                "total_time": 0
            }
        student_stats[child_id]["total_activities"] += 1
        student_stats[child_id]["total_score"] += score.get("percentage", 0)
        student_stats[child_id]["total_time"] += score.get("time_spent_seconds", 0)
    
    # Calculate averages
    for child_id, stats in student_stats.items():
        if stats["total_activities"] > 0:
            stats["average_score"] = round(stats["total_score"] / stats["total_activities"], 1)
            stats["average_time"] = round(stats["total_time"] / stats["total_activities"], 1)
        else:
            stats["average_score"] = 0
            stats["average_time"] = 0
    
    return {
        "classroom": classroom,
        "student_stats": list(student_stats.values()),
        "recent_scores": scores[:20]
    }



@router.get("/teacher/content-overview/{content_id}")
async def get_teacher_content_overview(request: Request, content_id: str):
    """Get detailed activity scores for a specific content - for teachers"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get content info
    content = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Get teacher's classrooms
    classrooms = await db.classrooms.find(
        {"teacher_id": user.get("user_id")},
        {"_id": 0}
    ).to_list(50)
    
    all_student_ids = []
    for classroom in classrooms:
        all_student_ids.extend(classroom.get("student_ids", []))
    all_student_ids = list(set(all_student_ids))
    
    # Get all students info
    students = await db.users.find(
        {"user_id": {"$in": all_student_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "grade": 1, "picture": 1}
    ).to_list(200)
    student_map = {s["user_id"]: s for s in students}
    
    # Get all scores for this content from these students
    scores = await db.activity_scores.find(
        {"content_id": content_id, "child_id": {"$in": all_student_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group scores by student, keep last 2
    student_scores = {}
    for score in scores:
        child_id = score.get("child_id")
        if child_id not in student_scores:
            student_scores[child_id] = []
        if len(student_scores[child_id]) < 2:
            student_scores[child_id].append(score)
    
    # Build response with attempted and not attempted
    attempted = []
    not_attempted = []
    
    for student_id in all_student_ids:
        student = student_map.get(student_id, {})
        student_data = {
            "student_id": student_id,
            "name": student.get("name") or student.get("username", "Unknown"),
            "grade": student.get("grade"),
            "picture": student.get("picture"),
            "scores": student_scores.get(student_id, [])
        }
        
        if student_id in student_scores:
            # Calculate best and latest score
            scores_list = student_scores[student_id]
            student_data["latest_score"] = scores_list[0].get("percentage", 0) if scores_list else 0
            student_data["best_score"] = max(s.get("percentage", 0) for s in scores_list) if scores_list else 0
            student_data["attempts"] = len(scores_list)
            attempted.append(student_data)
        else:
            not_attempted.append(student_data)
    
    # Sort attempted by latest score descending
    attempted.sort(key=lambda x: x.get("latest_score", 0), reverse=True)
    
    return {
        "content": content,
        "attempted": attempted,
        "not_attempted": not_attempted,
        "stats": {
            "total_students": len(all_student_ids),
            "attempted_count": len(attempted),
            "not_attempted_count": len(not_attempted),
            "average_score": sum(s.get("latest_score", 0) for s in attempted) / len(attempted) if attempted else 0
        }
    }

@router.get("/parent/children-scores")
async def get_parent_children_scores(request: Request, topic_id: str = None):
    """Get activity scores for all children of a parent, optionally filtered by topic"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get parent's children
    children = await db.users.find(
        {"parent_ids": user.get("user_id"), "role": "child"},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "grade": 1, "picture": 1}
    ).to_list(20)
    
    child_ids = [c["user_id"] for c in children]
    
    # Build query for scores
    score_query = {"child_id": {"$in": child_ids}}
    if topic_id:
        score_query["topic_id"] = topic_id
    
    # Get all scores
    scores = await db.activity_scores.find(
        score_query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group scores by content and child, keep last 2 per child per content
    content_scores = {}
    for score in scores:
        content_id = score.get("content_id")
        child_id = score.get("child_id")
        key = f"{content_id}_{child_id}"
        
        if content_id not in content_scores:
            content_scores[content_id] = {
                "content_id": content_id,
                "content_title": score.get("content_title", "Activity"),
                "topic_id": score.get("topic_id"),
                "children": {}
            }
        
        if child_id not in content_scores[content_id]["children"]:
            content_scores[content_id]["children"][child_id] = []
        
        if len(content_scores[content_id]["children"][child_id]) < 2:
            content_scores[content_id]["children"][child_id].append(score)
    
    # Build response
    activities = []
    for content_id, data in content_scores.items():
        activity_data = {
            "content_id": data["content_id"],
            "content_title": data["content_title"],
            "topic_id": data["topic_id"],
            "children_scores": []
        }
        
        for child in children:
            child_id = child["user_id"]
            child_scores = data["children"].get(child_id, [])
            
            if child_scores:
                activity_data["children_scores"].append({
                    "child_id": child_id,
                    "child_name": child.get("name") or child.get("username", "Unknown"),
                    "grade": child.get("grade"),
                    "picture": child.get("picture"),
                    "scores": child_scores,
                    "latest_score": child_scores[0].get("percentage", 0) if child_scores else 0,
                    "best_score": max(s.get("percentage", 0) for s in child_scores) if child_scores else 0
                })
        
        if activity_data["children_scores"]:
            activities.append(activity_data)
    
    return {
        "children": children,
        "activities": activities
    }

@router.get("/scores/by-content/{content_id}")
async def get_scores_by_content(request: Request, content_id: str):
    """Get scores for a specific content for the current user's children (parent) or students (teacher)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    role = user.get("role")
    
    if role == "parent":
        # Get children
        children = await db.users.find(
            {"parent_ids": user.get("user_id"), "role": "child"},
            {"_id": 0, "user_id": 1, "name": 1, "username": 1, "grade": 1}
        ).to_list(20)
        child_ids = [c["user_id"] for c in children]
    elif role == "teacher":
        # Get students from classrooms
        classrooms = await db.classrooms.find(
            {"teacher_id": user.get("user_id")},
            {"_id": 0, "student_ids": 1}
        ).to_list(50)
        child_ids = []
        for c in classrooms:
            child_ids.extend(c.get("student_ids", []))
        child_ids = list(set(child_ids))
        
        children = await db.users.find(
            {"user_id": {"$in": child_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "username": 1, "grade": 1}
        ).to_list(200)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get scores for this content
    scores = await db.activity_scores.find(
        {"content_id": content_id, "child_id": {"$in": child_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group by child, keep last 2
    child_scores = {}
    for score in scores:
        child_id = score.get("child_id")
        if child_id not in child_scores:
            child_scores[child_id] = []
        if len(child_scores[child_id]) < 2:
            child_scores[child_id].append(score)
    
    # Build response
    result = []
    for child in children:
        child_id = child["user_id"]
        scores_list = child_scores.get(child_id, [])
        result.append({
            "child_id": child_id,
            "child_name": child.get("name") or child.get("username", "Unknown"),
            "grade": child.get("grade"),
            "scores": scores_list,
            "attempted": len(scores_list) > 0,
            "latest_score": scores_list[0].get("percentage", 0) if scores_list else None,
            "best_score": max(s.get("percentage", 0) for s in scores_list) if scores_list else None
        })
    
    return {"children": result}
