"""Quest routes - Quests, Chores, and completions"""
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

router = APIRouter(tags=["quests"])

class QuestCreate(BaseModel):
    title: str
    description: str = ""
    image_url: Optional[str] = None
    pdf_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5
    due_date: str
    reward_amount: float = 0
    questions: List[Dict[str, Any]] = []

class ChoreCreate(BaseModel):
    child_id: str
    title: str
    description: Optional[str] = None
    reward_amount: float
    frequency: str = "one_time"
    weekly_days: Optional[List[int]] = None
    monthly_date: Optional[int] = None

# Upload quest assets
@router.post("/upload/quest-asset")
async def upload_quest_asset(file: UploadFile = File(...)):
    """Upload image or PDF for quests"""
    QUEST_ASSETS_DIR = UPLOADS_DIR / "quests"
    QUEST_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    filename = f"{uuid.uuid4().hex[:12]}.{ext}"
    file_path = QUEST_ASSETS_DIR / filename
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"url": f"/api/uploads/quests/{filename}"}

# Admin Quest Management
@router.post("/admin/quests")
async def create_admin_quest(quest_data: QuestCreate, request: Request):
    """Admin creates a new quest"""
    from services.auth import require_admin
    db = get_db()
    user = await require_admin(request)
    
    quest_id = f"quest_{uuid.uuid4().hex[:12]}"
    questions_points = sum(q.get("points", 0) or 0 for q in quest_data.questions)
    base_reward = quest_data.reward_amount or 0
    total_points = questions_points + base_reward if len(quest_data.questions) == 0 else questions_points
    
    processed_questions = []
    for q in quest_data.questions:
        processed_questions.append({
            "question_id": f"q_{uuid.uuid4().hex[:8]}",
            "question_text": q.get("question_text", ""),
            "question_type": q.get("question_type", "mcq"),
            "image_url": q.get("image_url"),
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "points": q.get("points", 0) or 0
        })
    
    quest_doc = {
        "quest_id": quest_id,
        "creator_type": "admin",
        "creator_id": user["user_id"],
        "title": quest_data.title,
        "description": quest_data.description,
        "image_url": quest_data.image_url,
        "pdf_url": quest_data.pdf_url,
        "min_grade": quest_data.min_grade,
        "max_grade": quest_data.max_grade,
        "due_date": quest_data.due_date,
        "due_time": "23:59:00",
        "reward_amount": base_reward,
        "questions": processed_questions,
        "total_points": total_points if total_points > 0 else base_reward,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.new_quests.insert_one(quest_doc)
    return {"quest_id": quest_id, "message": "Quest created successfully"}

@router.get("/admin/quests")
async def get_admin_quests(request: Request):
    """Get all admin-created quests"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    quests = await db.new_quests.find(
        {"creator_type": "admin"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return quests

@router.put("/admin/quests/{quest_id}")
async def update_admin_quest(quest_id: str, quest_data: QuestCreate, request: Request):
    """Update an admin quest"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    questions_points = sum(q.get("points", 0) or 0 for q in quest_data.questions)
    base_reward = quest_data.reward_amount or 0
    total_points = questions_points + base_reward if len(quest_data.questions) == 0 else questions_points
    
    processed_questions = []
    for q in quest_data.questions:
        processed_questions.append({
            "question_id": q.get("question_id") or f"q_{uuid.uuid4().hex[:8]}",
            "question_text": q.get("question_text", ""),
            "question_type": q.get("question_type", "mcq"),
            "image_url": q.get("image_url"),
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "points": q.get("points", 0) or 0
        })
    
    await db.new_quests.update_one(
        {"quest_id": quest_id, "creator_type": "admin"},
        {"$set": {
            "title": quest_data.title,
            "description": quest_data.description,
            "image_url": quest_data.image_url,
            "pdf_url": quest_data.pdf_url,
            "min_grade": quest_data.min_grade,
            "max_grade": quest_data.max_grade,
            "due_date": quest_data.due_date,
            "reward_amount": quest_data.reward_amount or 0,
            "questions": processed_questions,
            "total_points": total_points if total_points > 0 else (quest_data.reward_amount or 0)
        }}
    )
    return {"message": "Quest updated"}

@router.delete("/admin/quests/{quest_id}")
async def delete_admin_quest(quest_id: str, request: Request):
    """Delete an admin quest"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    await db.new_quests.delete_one({"quest_id": quest_id, "creator_type": "admin"})
    return {"message": "Quest deleted"}

# Child Quest Access
@router.get("/child/quests")
async def get_child_quests(request: Request):
    """Get quests available to a child"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access quests")
    
    grade = user.get("grade", 3) or 3
    
    # Get admin quests for child's grade
    admin_quests = await db.new_quests.find({
        "creator_type": "admin",
        "is_active": True,
        "min_grade": {"$lte": grade},
        "max_grade": {"$gte": grade}
    }, {"_id": 0}).to_list(100)
    
    # Get teacher quests for child's classrooms
    classroom_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"classroom_id": 1}
    ).to_list(10)
    classroom_ids = [c["classroom_id"] for c in classroom_links]
    
    teacher_quests = await db.new_quests.find({
        "creator_type": "teacher",
        "is_active": True,
        "classroom_ids": {"$in": classroom_ids}
    }, {"_id": 0}).to_list(100)
    
    # Get parent chores for this child
    parent_chores = await db.new_quests.find({
        "creator_type": "parent",
        "child_id": user["user_id"],
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    # Get completions
    completions = await db.quest_completions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(500)
    completed_ids = {c["quest_id"]: c for c in completions}
    
    all_quests = admin_quests + teacher_quests + parent_chores
    
    for quest in all_quests:
        quest_id = quest.get("quest_id") or quest.get("chore_id")
        if quest_id in completed_ids:
            quest["is_completed"] = completed_ids[quest_id].get("is_completed", False)
            quest["score"] = completed_ids[quest_id].get("score", 0)
            quest["completed_at"] = completed_ids[quest_id].get("completed_at")
        else:
            quest["is_completed"] = False
    
    return all_quests

@router.post("/child/quests/{quest_id}/submit")
async def submit_quest(quest_id: str, request: Request):
    """Child submits quest answers"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can submit quests")
    
    body = await request.json()
    answers = body.get("answers", {})
    
    quest = await db.new_quests.find_one({"quest_id": quest_id}, {"_id": 0})
    if not quest:
        quest = await db.new_quests.find_one({"chore_id": quest_id}, {"_id": 0})
    
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Check if this is a parent chore (requires approval)
    is_parent_chore = quest.get("creator_type") == "parent"
    has_questions = len(quest.get("questions", [])) > 0
    
    # Check for existing completion
    existing_completion = await db.quest_completions.find_one({
        "user_id": user["user_id"],
        "quest_id": quest_id
    })
    
    # For quests with questions: can only attempt once
    if has_questions and existing_completion and existing_completion.get("is_completed"):
        raise HTTPException(status_code=400, detail="Quest already completed. You can only attempt once.")
    
    # For parent chores: allow resubmission only if rejected
    if is_parent_chore and existing_completion:
        status = existing_completion.get("status")
        if status == "pending_approval":
            raise HTTPException(status_code=400, detail="Chore already submitted. Waiting for parent approval.")
        if status == "approved":
            raise HTTPException(status_code=400, detail="Chore already approved.")
    
    # Calculate score for quests with questions
    total_points = 0
    earned_points = 0
    correct_answers = {}
    
    for q in quest.get("questions", []):
        q_id = q.get("question_id")
        points = q.get("points", 0)
        total_points += points
        correct_answers[q_id] = q.get("correct_answer")
        
        if q_id in answers:
            if answers[q_id] == q.get("correct_answer"):
                earned_points += points
    
    # For chores/quests with no questions, use the reward amount
    if not has_questions:
        earned_points = quest.get("total_points", quest.get("reward_amount", 0))
        total_points = earned_points
    
    # For parent chores: set to pending approval, don't award coins yet
    if is_parent_chore:
        completion_doc = {
            "completion_id": f"comp_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "quest_id": quest_id,
            "chore_id": quest_id,
            "answers": answers,
            "score": earned_points,
            "total_points": total_points,
            "status": "pending_approval",  # Pending parent approval
            "is_completed": False,  # Not completed until approved
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.quest_completions.update_one(
            {"user_id": user["user_id"], "quest_id": quest_id},
            {"$set": completion_doc},
            upsert=True
        )
        
        # Notify parent
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": quest.get("creator_id"),  # Parent
            "message": f"{user.get('name', 'Your child')} completed chore: {quest.get('title')}. Please review.",
            "type": "chore_pending",
            "link": "/parent/chores",
            "related_id": quest_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Chore submitted for parent approval!",
            "status": "pending_approval",
            "score": earned_points,
            "total_points": total_points
        }
    
    # For admin/teacher quests: complete immediately
    completion_doc = {
        "completion_id": f"comp_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "quest_id": quest_id,
        "answers": answers,
        "score": earned_points,
        "total_points": total_points,
        "status": "completed",
        "is_completed": True,
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quest_completions.update_one(
        {"user_id": user["user_id"], "quest_id": quest_id},
        {"$set": completion_doc},
        upsert=True
    )
    
    # Award coins
    if earned_points > 0:
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "spending"},
            {"$inc": {"balance": earned_points}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "to_account": "spending",
            "amount": earned_points,
            "transaction_type": "quest_reward",
            "description": f"Completed: {quest.get('title', 'Quest')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # For quests with questions, include correct answers so child can see them
    response = {
        "message": "Quest submitted!",
        "score": earned_points,
        "total_points": total_points,
        "coins_earned": earned_points
    }
    
    if has_questions:
        response["correct_answers"] = correct_answers
        response["passed"] = earned_points >= (total_points * 0.6)  # 60% to pass
    
    return response

# Parent Chore Management
@router.post("/parent/chores-new")
async def create_parent_chore(chore_data: ChoreCreate, request: Request):
    """Parent creates a chore for their child"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": chore_data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    chore_id = f"chore_{uuid.uuid4().hex[:12]}"
    
    chore_doc = {
        "chore_id": chore_id,
        "quest_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"],
        "creator_name": user.get("name", "Parent"),
        "child_id": chore_data.child_id,
        "title": chore_data.title,
        "description": chore_data.description,
        "reward_amount": chore_data.reward_amount,
        "total_points": chore_data.reward_amount,
        "frequency": chore_data.frequency,
        "weekly_days": chore_data.weekly_days,
        "monthly_date": chore_data.monthly_date,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.new_quests.insert_one(chore_doc)
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": chore_data.child_id,
        "message": f"New chore from {user.get('name', 'Parent')}: {chore_data.title}",
        "type": "chore",
        "link": "/quests",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"chore_id": chore_id, "message": "Chore created successfully"}

@router.get("/parent/chores-new")
async def get_parent_chores(request: Request):
    """Get parent's created chores"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    chores = await db.new_quests.find(
        {"creator_type": "parent", "creator_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return chores

@router.delete("/parent/chores-new/{chore_id}")
async def delete_parent_chore(chore_id: str, request: Request):
    """Delete a parent chore"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    await db.new_quests.delete_one({
        "chore_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"]
    })
    return {"message": "Chore deleted"}

@router.get("/parent/chores-pending")
async def get_pending_chores(request: Request):
    """Get chores pending parent approval"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    
    # Get all chores created by this parent
    chores = await db.new_quests.find(
        {"creator_type": "parent", "creator_id": user["user_id"]},
        {"_id": 0}
    ).to_list(200)
    
    pending = []
    for chore in chores:
        chore_id = chore.get("chore_id") or chore.get("quest_id")
        # Get completion status
        completion = await db.quest_completions.find_one(
            {"quest_id": chore_id, "status": "pending_approval"},
            {"_id": 0}
        )
        if completion:
            chore["completion"] = completion
            chore["child"] = await db.users.find_one(
                {"user_id": completion["user_id"]},
                {"_id": 0, "name": 1, "avatar": 1}
            )
            pending.append(chore)
    
    return pending

@router.post("/parent/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request):
    """Parent approves a completed chore"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    
    # Verify parent owns this chore
    chore = await db.new_quests.find_one({
        "chore_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"]
    })
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Get the pending completion
    completion = await db.quest_completions.find_one({
        "quest_id": chore_id,
        "status": "pending_approval"
    })
    if not completion:
        raise HTTPException(status_code=400, detail="No pending completion found")
    
    child_id = completion["user_id"]
    reward = chore.get("reward_amount", chore.get("total_points", 0))
    
    # Update completion status
    await db.quest_completions.update_one(
        {"quest_id": chore_id, "user_id": child_id},
        {"$set": {
            "status": "approved",
            "is_completed": True,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user["user_id"]
        }}
    )
    
    # Award coins to child
    await db.wallet_accounts.update_one(
        {"user_id": child_id, "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "to_account": "spending",
        "amount": reward,
        "transaction_type": "chore_reward",
        "description": f"Approved: {chore.get('title', 'Chore')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "message": f"🎉 Chore approved! You earned ₹{reward} for: {chore.get('title')}",
        "type": "chore_approved",
        "link": "/wallet",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Chore approved", "reward": reward}

@router.post("/parent/chores/{chore_id}/reject")
async def reject_chore(chore_id: str, request: Request):
    """Parent rejects a completed chore"""
    from services.auth import require_parent
    db = get_db()
    user = await require_parent(request)
    
    body = await request.json()
    reason = body.get("reason", "Please try again")
    
    # Verify parent owns this chore
    chore = await db.new_quests.find_one({
        "chore_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"]
    })
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Get the pending completion
    completion = await db.quest_completions.find_one({
        "quest_id": chore_id,
        "status": "pending_approval"
    })
    if not completion:
        raise HTTPException(status_code=400, detail="No pending completion found")
    
    child_id = completion["user_id"]
    
    # Update completion status - allow re-submission
    await db.quest_completions.update_one(
        {"quest_id": chore_id, "user_id": child_id},
        {"$set": {
            "status": "rejected",
            "is_completed": False,
            "rejection_reason": reason,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": user["user_id"]
        }}
    )
    
    # Notify child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "message": f"Chore needs more work: {chore.get('title')}. Reason: {reason}",
        "type": "chore_rejected",
        "link": "/quests",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Chore rejected", "reason": reason}

