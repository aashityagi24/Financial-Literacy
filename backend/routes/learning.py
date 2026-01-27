"""Learning content routes - Topics, lessons, quizzes, activities"""
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

router = APIRouter(prefix="/learn", tags=["learning"])

@router.get("/topics")
async def get_learning_topics(request: Request):
    """Get all learning topics for user's grade"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    topics = await db.learning_topics.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    if not topics:
        topics = await db.content_topics.find(
            {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}, "parent_id": None},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
    
    # Add progress tracking for each topic
    for topic in topics:
        topic_id = topic.get("topic_id")
        if topic_id:
            lessons = await db.learning_lessons.find(
                {"topic_id": topic_id},
                {"_id": 0, "lesson_id": 1}
            ).to_list(100)
            
            lesson_ids = [l["lesson_id"] for l in lessons]
            completed = await db.user_lesson_progress.count_documents({
                "user_id": user["user_id"],
                "lesson_id": {"$in": lesson_ids},
                "completed": True
            })
            
            topic["total_lessons"] = len(lessons)
            topic["completed_lessons"] = completed
    
    return topics

@router.get("/topics/{topic_id}")
async def get_topic_details(topic_id: str, request: Request):
    """Get topic with lessons and progress"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    topic = await db.learning_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        topic = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    lessons = await db.learning_lessons.find(
        {"topic_id": topic_id, "min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    if not lessons:
        lessons = await db.content_items.find(
            {"topic_id": topic_id, "min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
    
    # Add progress info for each lesson
    for lesson in lessons:
        lesson_id = lesson.get("lesson_id") or lesson.get("content_id")
        progress = await db.user_lesson_progress.find_one({
            "user_id": user["user_id"],
            "lesson_id": lesson_id
        }, {"_id": 0})
        lesson["completed"] = progress["completed"] if progress else False
        lesson["score"] = progress.get("score") if progress else None
    
    return {"topic": topic, "lessons": lessons}

@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, request: Request):
    """Get single lesson and mark as started"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    lesson = await db.learning_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        lesson = await db.content_items.find_one({"content_id": lesson_id}, {"_id": 0})
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Mark as started if not already
    existing = await db.user_lesson_progress.find_one({
        "user_id": user["user_id"],
        "lesson_id": lesson_id
    })
    
    if not existing:
        await db.user_lesson_progress.insert_one({
            "id": f"ulp_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "lesson_id": lesson_id,
            "completed": False,
            "score": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None
        })
        lesson["user_progress"] = None
    else:
        lesson["user_progress"] = {k: v for k, v in existing.items() if k != "_id"}
    
    quiz = await db.quizzes.find_one({"lesson_id": lesson_id}, {"_id": 0})
    lesson["has_quiz"] = quiz is not None
    if quiz:
        lesson["quiz"] = quiz
    
    return lesson

@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, request: Request):
    """Mark lesson as completed"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    lesson = await db.learning_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        lesson = await db.content_items.find_one({"content_id": lesson_id}, {"_id": 0})
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    existing = await db.user_lesson_progress.find_one({
        "user_id": user["user_id"],
        "lesson_id": lesson_id
    })
    
    if existing and existing.get("completed"):
        return {"message": "Already completed", "coins_earned": 0}
    
    reward_coins = lesson.get("reward_coins", 5)
    
    await db.user_lesson_progress.update_one(
        {"user_id": user["user_id"], "lesson_id": lesson_id},
        {"$set": {
            "lesson_id": lesson_id,
            "user_id": user["user_id"],
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward_coins}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "to_account": "spending",
        "amount": reward_coins,
        "transaction_type": "lesson_reward",
        "description": f"Completed: {lesson.get('title', 'Lesson')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Lesson completed!", "coins_earned": reward_coins}

@router.post("/quiz/submit")
async def submit_quiz(request: Request):
    """Submit quiz answers"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    body = await request.json()
    quiz_id = body.get("quiz_id")
    answers = body.get("answers", [])
    
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    correct = 0
    total = len(quiz.get("questions", []))
    
    for i, q in enumerate(quiz.get("questions", [])):
        if i < len(answers) and answers[i] == q.get("correct_answer"):
            correct += 1
    
    score = (correct / total * 100) if total > 0 else 0
    passed = score >= quiz.get("passing_score", 70)
    
    await db.quiz_attempts.insert_one({
        "attempt_id": f"att_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "quiz_id": quiz_id,
        "answers": answers,
        "score": score,
        "passed": passed,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    
    coins = 10 if passed else 2
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": coins}}
    )
    
    return {
        "score": score,
        "correct": correct,
        "total": total,
        "passed": passed,
        "coins_earned": coins
    }

@router.get("/books")
async def get_books(request: Request):
    """Get available books"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    books = await db.books.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    return books

@router.get("/activities")
async def get_activities(request: Request):
    """Get available activities"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    activities = await db.activities.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    return activities

@router.post("/activities/{activity_id}/complete")
async def complete_activity(activity_id: str, request: Request):
    """Complete an activity"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    activity = await db.activities.find_one({"activity_id": activity_id}, {"_id": 0})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    existing = await db.activity_completions.find_one({
        "user_id": user["user_id"],
        "activity_id": activity_id
    })
    
    if existing:
        return {"message": "Already completed", "coins_earned": 0}
    
    reward_coins = activity.get("reward_coins", 10)
    
    await db.activity_completions.insert_one({
        "completion_id": f"comp_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "activity_id": activity_id,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward_coins}}
    )
    
    return {"message": "Activity completed!", "coins_earned": reward_coins}

@router.get("/progress")
async def get_learning_progress(request: Request):
    """Get user's learning progress"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    lessons_completed = await db.user_lesson_progress.count_documents({
        "user_id": user["user_id"],
        "completed": True
    })
    
    quizzes_passed = await db.quiz_attempts.count_documents({
        "user_id": user["user_id"],
        "passed": True
    })
    
    activities_completed = await db.activity_completions.count_documents({
        "user_id": user["user_id"]
    })
    
    return {
        "lessons_completed": lessons_completed,
        "quizzes_passed": quizzes_passed,
        "activities_completed": activities_completed,
        "total_progress": lessons_completed + quizzes_passed + activities_completed
    }
