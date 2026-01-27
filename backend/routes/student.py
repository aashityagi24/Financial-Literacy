"""Student routes - Classroom, challenges for students"""
from fastapi import APIRouter, HTTPException, Request
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

router = APIRouter(prefix="/student", tags=["student"])

@router.post("/join-classroom")
async def join_classroom(request: Request):
    """Student joins a classroom with code"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    body = await request.json()
    
    classroom_code = body.get("code", "").upper()
    
    classroom = await db.classrooms.find_one({"join_code": classroom_code}, {"_id": 0})
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid classroom code")
    
    # Get teacher info
    teacher = await db.users.find_one(
        {"user_id": classroom.get("teacher_id")},
        {"_id": 0, "name": 1, "email": 1, "picture": 1}
    )
    classroom["teacher"] = teacher
    
    # Check if already enrolled
    existing = await db.classroom_students.find_one({
        "student_id": user["user_id"],
        "classroom_id": classroom["classroom_id"]
    })
    if existing:
        return {"message": "Already enrolled in this classroom", "classroom": classroom}
    
    await db.classroom_students.insert_one({
        "enrollment_id": f"enroll_{uuid.uuid4().hex[:12]}",
        "classroom_id": classroom["classroom_id"],
        "student_id": user["user_id"],
        "status": "active",
        "enrolled_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update user's grade if classroom has one
    if classroom.get("grade") is not None:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"grade": classroom["grade"]}}
        )
    
    return {"message": "Joined classroom successfully", "classroom": classroom}

@router.get("/classrooms")
async def get_student_classrooms(request: Request):
    """Get classrooms student is enrolled in"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    enrollments = await db.classroom_students.find(
        {"student_id": user["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(20)
    
    classrooms = []
    for enrollment in enrollments:
        classroom = await db.classrooms.find_one(
            {"classroom_id": enrollment["classroom_id"]},
            {"_id": 0}
        )
        if classroom:
            teacher = await db.users.find_one(
                {"user_id": classroom.get("teacher_id")},
                {"_id": 0, "name": 1, "picture": 1}
            )
            classroom["teacher"] = teacher
            classrooms.append(classroom)
    
    return classrooms

@router.get("/challenges")
async def get_student_challenges(request: Request):
    """Get challenges for student's classrooms"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    enrollments = await db.classroom_students.find(
        {"student_id": user["user_id"], "status": "active"},
        {"classroom_id": 1}
    ).to_list(20)
    
    classroom_ids = [e["classroom_id"] for e in enrollments]
    
    challenges = await db.classroom_challenges.find(
        {"classroom_id": {"$in": classroom_ids}, "is_active": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Check which ones are completed
    completions = await db.challenge_completions.find(
        {"student_id": user["user_id"]},
        {"challenge_id": 1}
    ).to_list(200)
    completed_ids = {c["challenge_id"] for c in completions}
    
    for challenge in challenges:
        challenge["is_completed"] = challenge["challenge_id"] in completed_ids
    
    return challenges
