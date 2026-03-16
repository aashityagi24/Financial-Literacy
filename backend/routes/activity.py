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
    """Save a child's activity score"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    
    content_id = body.get("content_id")
    if not content_id:
        raise HTTPException(status_code=400, detail="content_id is required")
    
    # Get content details
    content = await db.content.find_one({"content_id": content_id}, {"_id": 0})
    
    score_record = {
        "score_id": f"score_{uuid.uuid4().hex[:12]}",
        "child_id": user.get("user_id"),
        "child_name": user.get("name", user.get("username", "Unknown")),
        "content_id": content_id,
        "content_title": content.get("title", "Activity") if content else "Activity",
        "topic_id": content.get("topic_id") if content else None,
        "score": body.get("score", 0),
        "max_score": body.get("max_score", 100),
        "percentage": body.get("percentage", body.get("score", 0)),
        "time_spent_seconds": body.get("timeSpent", 0),
        "correct_answers": body.get("correctAnswers", 0),
        "total_questions": body.get("totalQuestions", 0),
        "attempts": body.get("attempts", 1),
        "completed": body.get("completed", True),
        "extra_data": body.get("extraData", {}),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.activity_scores.insert_one(score_record)
    
    # Update child's activity completion count
    await db.users.update_one(
        {"user_id": user.get("user_id")},
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
