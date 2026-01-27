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
    
    total_balance = sum(w.get("balance", 0) for w in wallets)
    
    # Get savings goals
    savings_goals = await db.savings_goals.find(
        {"child_id": student_id},
        {"_id": 0}
    ).to_list(20)
    
    savings_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
    active_goals = [g for g in savings_goals if not g.get("completed")]
    
    # Get recent transactions and calculate totals
    transactions = await db.transactions.find(
        {"user_id": student_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_earned = sum(t.get("amount", 0) for t in transactions 
                      if t.get("transaction_type") in ["reward", "allowance", "gift_received", "chore_reward", "quest_reward", "initial_deposit"])
    total_spent = sum(t.get("amount", 0) for t in transactions 
                     if t.get("transaction_type") in ["purchase", "gift_sent"])
    
    # Get learning progress
    lessons_completed = await db.user_content_progress.count_documents({
        "user_id": student_id,
        "completed": True
    })
    
    # Get chore stats
    all_chores = await db.new_quests.find({
        "child_id": student_id,
        "creator_type": "parent"
    }).to_list(100)
    
    chore_completions = await db.quest_completions.find({
        "user_id": student_id
    }).to_list(200)
    chore_completion_map = {c.get("quest_id"): c for c in chore_completions}
    
    chores_completed = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("is_completed"))
    chores_pending = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("status") == "pending")
    chores_rejected = sum(1 for c in all_chores if chore_completion_map.get(c.get("quest_id") or c.get("chore_id"), {}).get("status") == "rejected")
    
    # Get quest stats (admin/teacher quests)
    quest_completions = await db.quest_completions.find({
        "user_id": student_id,
        "is_completed": True
    }).to_list(100)
    quests_completed = len(quest_completions)
    
    # Count all available quests for this student
    grade = student.get("grade", 3) or 3
    all_quests = await db.new_quests.count_documents({
        "creator_type": {"$in": ["admin", "teacher"]},
        "is_active": True,
        "min_grade": {"$lte": grade},
        "max_grade": {"$gte": grade}
    })
    
    # Get achievements
    achievements = await db.user_achievements.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get gift stats
    gifts_received = await db.transactions.count_documents({
        "user_id": student_id,
        "transaction_type": "gift_received"
    })
    gifts_sent = await db.transactions.count_documents({
        "user_id": student_id,
        "transaction_type": "gift_sent"
    })
    
    gifts_received_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "gift_received")
    gifts_sent_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "gift_sent")
    
    # Get garden/investment data (for grades 1-2)
    garden_plots = await db.user_garden_plots.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(50)
    
    garden_invested = sum(p.get("purchase_price", 0) for p in garden_plots)
    garden_earned = sum(p.get("total_harvested", 0) for p in garden_plots)
    
    # Get stock holdings (for grades 3-5)
    stock_holdings = await db.user_stock_holdings.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(50)
    
    # Calculate portfolio value and gains
    portfolio_value = 0
    total_cost_basis = 0
    for holding in stock_holdings:
        # Get current stock price
        stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
        current_price = stock.get("current_price", 0) if stock else 0
        shares = holding.get("shares", 0)
        portfolio_value += shares * current_price
        total_cost_basis += holding.get("total_cost", 0)
    
    # Get realized gains from stock sale transactions
    stock_sales = [t for t in transactions if t.get("transaction_type") == "stock_sale"]
    realized_gains = sum(t.get("profit", 0) for t in stock_sales)
    
    unrealized_gains = portfolio_value - total_cost_basis
    
    return {
        "student": student,
        "wallet": {
            "total_balance": total_balance,
            "accounts": wallets,
            "savings_in_goals": savings_in_goals,
            "savings_goals_count": len(active_goals)
        },
        "learning": {
            "lessons_completed": lessons_completed
        },
        "transactions": {
            "total_earned": total_earned,
            "total_spent": total_spent,
            "recent": transactions[:20]
        },
        "chores": {
            "total_assigned": len(all_chores),
            "completed": chores_completed,
            "pending": chores_pending,
            "rejected": chores_rejected
        },
        "quests": {
            "total_assigned": all_quests,
            "completed": quests_completed,
            "completion_rate": round((quests_completed / all_quests * 100) if all_quests > 0 else 0)
        },
        "achievements": {
            "badges_earned": len(achievements),
            "list": achievements
        },
        "gifts": {
            "received_count": gifts_received,
            "received_total": gifts_received_total,
            "sent_count": gifts_sent,
            "sent_total": gifts_sent_total
        },
        "garden": {
            "plots_owned": len(garden_plots),
            "total_invested": garden_invested,
            "total_earned": garden_earned,
            "profit_loss": garden_earned - garden_invested
        },
        "stocks": {
            "holdings_count": len(stock_holdings),
            "portfolio_value": portfolio_value,
            "realized_gains": realized_gains,
            "unrealized_gains": unrealized_gains
        }
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
        
        student_id = student["user_id"]
        
        # Get all wallet accounts
        wallets = await db.wallet_accounts.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(10)
        
        wallet_by_type = {w.get("account_type"): w.get("balance", 0) for w in wallets}
        total_balance = sum(wallet_by_type.values())
        
        # Get all transactions for spending analysis
        transactions = await db.transactions.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(1000)
        
        spending_spent = sum(abs(t.get("amount", 0)) for t in transactions 
                           if t.get("transaction_type") in ["purchase"])
        gifting_spent = sum(abs(t.get("amount", 0)) for t in transactions 
                          if t.get("transaction_type") == "gift_sent")
        investing_spent = sum(abs(t.get("amount", 0)) for t in transactions 
                            if t.get("transaction_type") in ["garden_buy", "stock_buy"])
        
        # Get savings in goals
        savings_goals = await db.savings_goals.find(
            {"child_id": student_id},
            {"_id": 0, "current_amount": 1}
        ).to_list(50)
        savings_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
        
        # Get completed lessons
        lessons = await db.user_content_progress.count_documents({
            "user_id": student_id,
            "completed": True
        })
        
        # Get completed quests (admin/teacher)
        quests = await db.quest_completions.count_documents({
            "user_id": student_id,
            "is_completed": True
        })
        
        # Get completed chores
        chores = await db.quest_completions.count_documents({
            "user_id": student_id,
            "is_completed": True,
            "status": "approved"
        })
        
        # Get garden data
        garden_plots = await db.user_garden_plots.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(50)
        garden_invested = sum(p.get("purchase_price", 0) for p in garden_plots)
        garden_earned = sum(p.get("total_harvested", 0) for p in garden_plots)
        garden_pl = garden_earned - garden_invested
        
        # Get stock data
        stock_holdings = await db.user_stock_holdings.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(50)
        
        portfolio_value = 0
        total_cost_basis = 0
        for holding in stock_holdings:
            stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
            current_price = stock.get("current_price", 0) if stock else 0
            shares = holding.get("shares", 0)
            portfolio_value += shares * current_price
            total_cost_basis += holding.get("total_cost", 0)
        stock_pl = portfolio_value - total_cost_basis
        
        # Get gift stats
        gifts_received = sum(1 for t in transactions if t.get("transaction_type") == "gift_received")
        gifts_sent = sum(1 for t in transactions if t.get("transaction_type") == "gift_sent")
        
        # Get badges
        badges = await db.user_achievements.count_documents({"user_id": student_id})
        
        comparison_data.append({
            "student_id": student_id,
            "name": student.get("name", "Unknown"),
            "avatar": student.get("avatar"),
            "email": student.get("email"),
            "grade": student.get("grade"),
            "streak": student.get("streak_count", 0),
            "total_balance": round(total_balance, 2),
            "spending_balance": round(wallet_by_type.get("spending", 0), 2),
            "spending_spent": round(spending_spent, 2),
            "savings_balance": round(wallet_by_type.get("savings", 0), 2),
            "savings_in_goals": round(savings_in_goals, 2),
            "gifting_balance": round(wallet_by_type.get("gifting", 0), 2),
            "gifting_spent": round(gifting_spent, 2),
            "investing_balance": round(wallet_by_type.get("investing", 0), 2),
            "investing_spent": round(investing_spent, 2),
            "lessons_completed": lessons,
            "quests_completed": quests,
            "chores_completed": chores,
            "garden_pl": round(garden_pl, 2),
            "stock_pl": round(stock_pl, 2),
            "gifts_received": gifts_received,
            "gifts_sent": gifts_sent,
            "badges": badges
        })
    
    comparison_data.sort(key=lambda x: x["lessons_completed"], reverse=True)
    
    return {
        "classroom": classroom,
        "students": comparison_data,
        "count": len(comparison_data)
    }


# ============== TEACHER QUEST ROUTES ==============

@router.post("/quests")
async def create_teacher_quest(request: Request):
    """Create a quest for students"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    body = await request.json()
    
    quest_id = f"quest_{uuid.uuid4().hex[:12]}"
    await db.new_quests.insert_one({
        "quest_id": quest_id,
        "title": body.get("title"),
        "description": body.get("description", ""),
        "reward_coins": body.get("reward_coins", 10),
        "creator_type": "teacher",
        "creator_id": teacher["user_id"],
        "classroom_id": body.get("classroom_id"),
        "quest_type": body.get("quest_type", "task"),
        "deadline": body.get("deadline"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Quest created", "quest_id": quest_id}

@router.get("/quests")
async def get_teacher_quests(request: Request):
    """Get quests created by teacher"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    quests = await db.new_quests.find(
        {"creator_id": teacher["user_id"], "creator_type": "teacher"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return quests

@router.get("/quests/{quest_id}")
async def get_teacher_quest(quest_id: str, request: Request):
    """Get a specific teacher quest"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    quest = await db.new_quests.find_one({
        "quest_id": quest_id,
        "creator_id": teacher["user_id"]
    }, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    return quest

@router.put("/quests/{quest_id}")
async def update_teacher_quest(quest_id: str, request: Request):
    """Update a teacher quest"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    body = await request.json()
    
    fields = ["title", "description", "reward_coins", "deadline", "is_active"]
    update = {k: v for k, v in body.items() if k in fields}
    
    await db.new_quests.update_one(
        {"quest_id": quest_id, "creator_id": teacher["user_id"]},
        {"$set": update}
    )
    return {"message": "Quest updated"}

@router.delete("/quests/{quest_id}")
async def delete_teacher_quest(quest_id: str, request: Request):
    """Delete a teacher quest"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    await db.new_quests.delete_one({
        "quest_id": quest_id,
        "creator_id": teacher["user_id"]
    })
    return {"message": "Quest deleted"}

# ============== ADDITIONAL TEACHER ROUTES ==============

@router.get("/classrooms/{classroom_id}/student/{student_id}/insights")
async def get_student_insights_alt(classroom_id: str, student_id: str, request: Request):
    """Alternate path for student insights"""
    return await get_student_insights(classroom_id, student_id, request)

@router.post("/classrooms/{classroom_id}/challenges")
async def create_classroom_challenge(classroom_id: str, request: Request):
    """Create a challenge for a classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    body = await request.json()
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    challenge_id = f"chal_{uuid.uuid4().hex[:12]}"
    await db.classroom_challenges.insert_one({
        "challenge_id": challenge_id,
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"],
        "title": body.get("title"),
        "description": body.get("description", ""),
        "reward_coins": body.get("reward_coins", 10),
        "deadline": body.get("deadline"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Challenge created", "challenge_id": challenge_id}

@router.post("/challenges/{challenge_id}/complete/{student_id}")
async def complete_challenge_for_student(challenge_id: str, student_id: str, request: Request):
    """Mark a challenge as complete for a student"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    challenge = await db.classroom_challenges.find_one({
        "challenge_id": challenge_id,
        "teacher_id": teacher["user_id"]
    })
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Award coins
    reward = challenge.get("reward_coins", 10)
    await db.wallet_accounts.update_one(
        {"user_id": student_id, "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    # Record completion
    await db.challenge_completions.insert_one({
        "completion_id": f"cc_{uuid.uuid4().hex[:12]}",
        "challenge_id": challenge_id,
        "student_id": student_id,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Challenge completed, awarded {reward} coins"}

@router.post("/classrooms/{classroom_id}/announcements")
async def create_announcement(classroom_id: str, request: Request):
    """Create an announcement for a classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    body = await request.json()
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    announcement_id = f"ann_{uuid.uuid4().hex[:12]}"
    await db.announcements.insert_one({
        "announcement_id": announcement_id,
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"],
        "title": body.get("title"),
        "content": body.get("content", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Announcement created", "announcement_id": announcement_id}

@router.get("/classrooms/{classroom_id}/announcements")
async def get_announcements(classroom_id: str, request: Request):
    """Get announcements for a classroom"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    announcements = await db.announcements.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return announcements

@router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, request: Request):
    """Delete an announcement"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    await db.announcements.delete_one({
        "announcement_id": announcement_id,
        "teacher_id": teacher["user_id"]
    })
    return {"message": "Announcement deleted"}

@router.get("/students/{student_id}/progress")
async def get_student_progress(student_id: str, request: Request):
    """Get a student's progress (must be in teacher's classroom)"""
    from services.auth import require_teacher
    db = get_db()
    teacher = await require_teacher(request)
    
    # Verify student is in teacher's classroom
    classrooms = await db.classrooms.find(
        {"teacher_id": teacher["user_id"]},
        {"classroom_id": 1}
    ).to_list(50)
    classroom_ids = [c["classroom_id"] for c in classrooms]
    
    enrollment = await db.classroom_students.find_one({
        "student_id": student_id,
        "classroom_id": {"$in": classroom_ids},
        "status": "active"
    })
    if not enrollment:
        raise HTTPException(status_code=403, detail="Student not in your classroom")
    
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
    wallets = await db.wallet_accounts.find({"user_id": student_id}, {"_id": 0}).to_list(5)
    
    lessons = await db.user_content_progress.count_documents({
        "user_id": student_id, "completed": True
    })
    quests = await db.quest_completions.count_documents({
        "user_id": student_id, "is_completed": True
    })
    
    return {
        "student": student,
        "wallets": wallets,
        "lessons_completed": lessons,
        "quests_completed": quests
    }