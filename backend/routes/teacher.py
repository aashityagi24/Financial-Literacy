"""Teacher routes - Classroom management, students, rewards"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import random
import string

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/teacher", tags=["teacher"])

def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

class ClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    grade_level: int

class ClassroomReward(BaseModel):
    student_ids: List[str]
    amount: float
    reason: str

class ChallengeCreate(BaseModel):
    title: str
    description: str
    reward_amount: float
    deadline: Optional[str] = None

@router.get("/dashboard")
async def teacher_dashboard(request: Request):
    """Get teacher dashboard data"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classrooms = await db.classrooms.find(
        {"teacher_id": teacher["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    for classroom in classrooms:
        students = await db.classroom_students.find(
            {"classroom_id": classroom["classroom_id"]},
            {"_id": 0}
        ).to_list(100)
        classroom["student_count"] = len(students)
        
        challenges = await db.classroom_challenges.find(
            {"classroom_id": classroom["classroom_id"]},
            {"_id": 0}
        ).to_list(100)
        classroom["active_challenges"] = len(challenges)
    
    return {
        "classrooms": classrooms,
        "total_students": sum(c.get("student_count", 0) for c in classrooms)
    }

@router.post("/classrooms")
async def create_classroom(classroom: ClassroomCreate, request: Request):
    """Create a new classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom_doc = {
        "classroom_id": f"class_{uuid.uuid4().hex[:12]}",
        "teacher_id": teacher["user_id"],
        "name": classroom.name,
        "description": classroom.description,
        "grade_level": classroom.grade_level,
        "invite_code": generate_invite_code(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.classrooms.insert_one(classroom_doc)
    classroom_doc.pop("_id", None)
    return {"message": "Classroom created", "classroom": classroom_doc}

@router.get("/classrooms")
async def get_classrooms(request: Request):
    """Get teacher's classrooms"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classrooms = await db.classrooms.find(
        {"teacher_id": teacher["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return classrooms

@router.get("/classrooms/{classroom_id}")
async def get_classroom_details(classroom_id: str, request: Request):
    """Get detailed classroom info with students"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    }, {"_id": 0})
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    student_links = await db.classroom_students.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    students = []
    for link in student_links:
        student = await db.users.find_one(
            {"user_id": link["student_id"]},
            {"_id": 0}
        )
        if student:
            wallet = await db.wallet_accounts.find(
                {"user_id": student["user_id"]},
                {"_id": 0}
            ).to_list(10)
            total_balance = sum(w.get("balance", 0) for w in wallet)
            
            lessons_completed = await db.user_lesson_progress.count_documents({
                "user_id": student["user_id"],
                "completed": True
            })
            
            quests_completed = await db.user_quests.count_documents({
                "user_id": student["user_id"],
                "completed": True
            })
            
            students.append({
                **student,
                "total_balance": total_balance,
                "lessons_completed": lessons_completed,
                "quests_completed": quests_completed,
                "joined_at": link.get("joined_at")
            })
    
    challenges = await db.classroom_challenges.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "classroom": classroom,
        "students": students,
        "challenges": challenges
    }

@router.delete("/classrooms/{classroom_id}")
async def delete_classroom(classroom_id: str, request: Request):
    """Delete a classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    result = await db.classrooms.delete_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    await db.classroom_students.delete_many({"classroom_id": classroom_id})
    await db.classroom_challenges.delete_many({"classroom_id": classroom_id})
    
    return {"message": "Classroom deleted"}

@router.post("/classrooms/{classroom_id}/reward")
async def reward_students(classroom_id: str, reward: ClassroomReward, request: Request):
    """Give rewards to students"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    rewarded = []
    for student_id in reward.student_ids:
        await db.wallet_accounts.update_one(
            {"user_id": student_id, "account_type": "spending"},
            {"$inc": {"balance": reward.amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": student_id,
            "to_account": "spending",
            "amount": reward.amount,
            "transaction_type": "teacher_reward",
            "description": f"Reward from {teacher.get('name', 'Teacher')}: {reward.reason}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": student_id,
            "type": "reward",
            "message": f"You received ₹{reward.amount} from {teacher.get('name', 'Teacher')}!",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        rewarded.append(student_id)
    
    return {"message": f"Rewarded {len(rewarded)} students", "students_rewarded": rewarded}

@router.post("/challenges")
async def create_challenge(challenge: ChallengeCreate, request: Request):
    """Create a classroom challenge"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    body = await request.json()
    classroom_id = body.get("classroom_id")
    
    if not classroom_id:
        raise HTTPException(status_code=400, detail="classroom_id required")
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    challenge_doc = {
        "challenge_id": f"chal_{uuid.uuid4().hex[:12]}",
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"],
        "title": challenge.title,
        "description": challenge.description,
        "reward_amount": challenge.reward_amount,
        "deadline": challenge.deadline,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.classroom_challenges.insert_one(challenge_doc)
    
    return {"message": "Challenge created", "challenge_id": challenge_doc["challenge_id"]}

@router.get("/challenges")
async def get_teacher_challenges(request: Request):
    """Get all challenges created by teacher"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    challenges = await db.classroom_challenges.find(
        {"teacher_id": teacher["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return challenges

@router.delete("/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, request: Request):
    """Delete a challenge"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    result = await db.classroom_challenges.delete_one({
        "challenge_id": challenge_id,
        "teacher_id": teacher["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    return {"message": "Challenge deleted"}

@router.get("/classrooms/{classroom_id}/student-insights/{student_id}")
async def get_student_insights(classroom_id: str, student_id: str, request: Request):
    """Get detailed insights for a specific student"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get wallet data
    wallets = await db.wallet_accounts.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(10)
    
    # Get savings goals
    savings_goals = await db.savings_goals.find(
        {"child_id": student_id},
        {"_id": 0}
    ).to_list(20)
    
    # Get recent transactions
    transactions = await db.transactions.find(
        {"user_id": student_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    # Get learning progress
    lessons_completed = await db.user_content_progress.count_documents({
        "user_id": student_id,
        "completed": True
    })
    
    # Get quest completions
    quests_completed = await db.quest_completions.count_documents({
        "user_id": student_id,
        "is_completed": True
    })
    
    # Get achievements
    achievements = await db.user_achievements.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "student": student,
        "wallets": wallets,
        "savings_goals": savings_goals,
        "recent_transactions": transactions,
        "lessons_completed": lessons_completed,
        "quests_completed": quests_completed,
        "achievements": achievements
    }

@router.get("/classrooms/{classroom_id}/comparison")
async def get_classroom_comparison(classroom_id: str, request: Request):
    """Get comparison data for all students in classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    student_links = await db.classroom_students.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    comparison_data = []
    for link in student_links:
        student = await db.users.find_one(
            {"user_id": link["student_id"]},
            {"_id": 0}
        )
        if not student:
            continue
        
        wallets = await db.wallet_accounts.find(
            {"user_id": student["user_id"]},
            {"_id": 0}
        ).to_list(10)
        
        total_balance = sum(w.get("balance", 0) for w in wallets)
        spent = sum(
            abs(t.get("amount", 0)) 
            for t in await db.transactions.find({
                "user_id": student["user_id"],
                "transaction_type": {"$in": ["purchase", "garden_buy"]}
            }, {"amount": 1}).to_list(1000)
        )
        
        lessons = await db.user_content_progress.count_documents({
            "user_id": student["user_id"],
            "completed": True
        })
        
        quests = await db.quest_completions.count_documents({
            "user_id": student["user_id"],
            "is_completed": True
        })
        
        comparison_data.append({
            "student_id": student["user_id"],
            "name": student.get("name", "Unknown"),
            "email": student.get("email"),
            "grade": student.get("grade"),
            "streak": student.get("streak_count", 0),
            "total_balance": round(total_balance, 2),
            "total_spent": round(spent, 2),
            "lessons_completed": lessons,
            "quests_completed": quests
        })
    
    comparison_data.sort(key=lambda x: x["lessons_completed"], reverse=True)
    
    return {
        "classroom": classroom,
        "students": comparison_data,
        "count": len(comparison_data)
    }
