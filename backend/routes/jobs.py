"""My Jobs routes - Family jobs and Payday jobs for children"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["jobs"])

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return _db


# ─── Child Endpoints ───

@router.get("/child/jobs")
async def get_child_jobs(request: Request):
    """Get child's own jobs"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Child access required")
    
    jobs = await db.my_jobs.find(
        {"child_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(10)
    
    family_jobs = [j for j in jobs if j.get("job_type") == "family"]
    payday_jobs = [j for j in jobs if j.get("job_type") == "payday"]
    
    return {"family_jobs": family_jobs, "payday_jobs": payday_jobs}


@router.post("/child/jobs")
async def create_child_job(request: Request):
    """Child creates a new job"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Child access required")
    
    body = await request.json()
    job_type = body.get("job_type")
    activity = body.get("activity", "").strip()
    frequency = body.get("frequency", "").strip()
    
    if not activity or not frequency:
        raise HTTPException(status_code=400, detail="Activity and frequency are required")
    if job_type not in ("family", "payday"):
        raise HTTPException(status_code=400, detail="job_type must be 'family' or 'payday'")
    
    # Check limit: max 3 per type
    existing = await db.my_jobs.count_documents({
        "child_id": user["user_id"],
        "job_type": job_type
    })
    if existing >= 3:
        raise HTTPException(status_code=400, detail=f"Maximum 3 {job_type} jobs allowed")
    
    job_doc = {
        "job_id": f"job_{uuid.uuid4().hex[:12]}",
        "child_id": user["user_id"],
        "child_name": user.get("name", user.get("username", "Child")),
        "job_type": job_type,
        "activity": activity,
        "frequency": frequency,
        "status": "pending",  # pending → approved → active
        "payment_amount": 0,
        "payment_type": None,  # "digital" or "physical"
        "reminder_day": None,  # "monday", "tuesday", etc.
        "parent_id": None,
        "parent_name": None,
        "last_paid_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.my_jobs.insert_one(job_doc)
    del job_doc["_id"]
    return job_doc


@router.delete("/child/jobs/{job_id}")
async def delete_child_job(job_id: str, request: Request):
    """Child deletes their own job (only if pending)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Child access required")
    
    job = await db.my_jobs.find_one({"job_id": job_id, "child_id": user["user_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") not in ("pending", "rejected"):
        raise HTTPException(status_code=400, detail="Can only delete pending or rejected jobs")
    
    await db.my_jobs.delete_one({"job_id": job_id})
    return {"message": "Job deleted"}


# ─── Parent Endpoints ───

@router.get("/parent/child-jobs")
async def get_parent_child_jobs(request: Request):
    """Parent gets all their children's jobs"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    
    links = await db.parent_child_links.find(
        {"parent_id": user["user_id"], "status": "active"},
        {"_id": 0, "child_id": 1}
    ).to_list(20)
    child_ids = [lnk["child_id"] for lnk in links]
    
    jobs = await db.my_jobs.find(
        {"child_id": {"$in": child_ids}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"jobs": jobs}


@router.put("/parent/child-jobs/{job_id}/approve")
async def approve_child_job(job_id: str, request: Request):
    """Parent approves a child's payday job and sets payment details"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    
    body = await request.json()
    
    job = await db.my_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Verify parent-child link
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": job["child_id"],
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "approved",
        "parent_id": user["user_id"],
        "parent_name": user.get("name", "Parent"),
        "approved_at": datetime.now(timezone.utc).isoformat()
    }
    
    # For payday jobs, set payment details
    if job["job_type"] == "payday":
        payment_amount = body.get("payment_amount", 0)
        payment_type = body.get("payment_type", "digital")
        reminder_day = body.get("reminder_day", "sunday")
        
        if payment_amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be positive")
        if payment_type not in ("digital", "physical"):
            raise HTTPException(status_code=400, detail="Payment type must be 'digital' or 'physical'")
        
        update_data.update({
            "payment_amount": payment_amount,
            "payment_type": payment_type,
            "reminder_day": reminder_day
        })
    
    await db.my_jobs.update_one({"job_id": job_id}, {"$set": update_data})
    return {"message": "Job approved"}


@router.put("/parent/child-jobs/{job_id}/reject")
async def reject_child_job(job_id: str, request: Request):
    """Parent rejects a child's job proposal"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    
    job = await db.my_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only reject pending jobs")
    
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": job["child_id"],
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.my_jobs.update_one({"job_id": job_id}, {"$set": {
        "status": "rejected",
        "parent_id": user["user_id"],
        "rejected_at": datetime.now(timezone.utc).isoformat()
    }})
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": job["child_id"],
        "type": "job_rejected",
        "message": f"Your job '{job['activity']}' was not approved. Talk to your parent about it!",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Job rejected"}


@router.post("/parent/child-jobs/{job_id}/pay")
async def pay_child_job(job_id: str, request: Request):
    """Parent marks a payday job as paid for the week"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    
    job = await db.my_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("job_type") != "payday" or job.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Can only pay approved payday jobs")
    
    # Verify parent-child link
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": job["child_id"],
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment_type = job.get("payment_type", "digital")
    amount = job.get("payment_amount", 0)
    
    if payment_type == "digital" and amount > 0:
        # Transfer to child's spending wallet
        await db.wallet_accounts.update_one(
            {"user_id": job["child_id"], "account_type": "spending"},
            {"$inc": {"balance": amount}}
        )
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": job["child_id"],
            "to_account": "spending",
            "amount": amount,
            "transaction_type": "job_payment",
            "description": f"Weekly pay: {job['activity']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Record payment
    await db.my_jobs.update_one({"job_id": job_id}, {
        "$set": {"last_paid_at": datetime.now(timezone.utc).isoformat()},
        "$push": {"payment_history": {
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "amount": amount,
            "payment_type": payment_type,
            "paid_by": user["user_id"]
        }}
    })
    
    # Notify child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": job["child_id"],
        "type": "job_payment",
        "message": f"You received ₹{amount} for: {job['activity']}!" if payment_type == "digital" else f"Your parent paid you ₹{amount} (cash) for: {job['activity']}!",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Payment of ₹{amount} recorded", "payment_type": payment_type}


# ─── Teacher Endpoint ───

@router.get("/teacher/student-jobs/{student_id}")
async def get_student_jobs(student_id: str, request: Request):
    """Teacher views a student's jobs"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher/Admin access required")
    
    jobs = await db.my_jobs.find(
        {"child_id": student_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(10)
    
    family_jobs = [j for j in jobs if j.get("job_type") == "family"]
    payday_jobs = [j for j in jobs if j.get("job_type") == "payday"]
    
    return {"family_jobs": family_jobs, "payday_jobs": payday_jobs}


# ─── Admin Guidebook ───

@router.get("/jobs/guidebook")
async def get_job_guidebook(request: Request):
    """Get the My Jobs guidebook content"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    role = user.get("role")
    guidebook = await db.job_guidebook.find_one({"type": "guidebook"}, {"_id": 0})
    
    if not guidebook:
        # Default content
        return {
            "child_guide": "### My Jobs Guide\n\n**Family Jobs** are things you do because you're part of the family. No payment needed!\n\nExamples: Keeping your room clean, putting clothes in the laundry basket.\n\n**Payday Jobs** are extra tasks you do to earn money.\n\nExamples: Watering plants, feeding the pet, cleaning the table after dinner.\n\nAdd up to 3 of each type!",
            "parent_guide": "### Parent's Guide to My Jobs\n\n**Family Jobs**: These are responsibilities your child commits to as part of the family. They are unpaid and help teach accountability.\n\n**Payday Jobs**: These are extra tasks your child takes on to earn money. You set the weekly payment amount and choose between digital (CoinQuest wallet) or physical (cash) payment.\n\n**Best Practices**:\n- Review jobs weekly on your chosen reminder day\n- Be consistent with payments to build trust\n- Discuss what went well and what can improve\n- Start with small amounts and increase as responsibility grows"
        }
    
    if role == "child":
        return {"child_guide": guidebook.get("child_guide", "")}
    else:
        return {
            "child_guide": guidebook.get("child_guide", ""),
            "parent_guide": guidebook.get("parent_guide", "")
        }


@router.put("/admin/jobs/guidebook")
async def update_job_guidebook(request: Request):
    """Admin updates the guidebook content"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    body = await request.json()
    
    await db.job_guidebook.update_one(
        {"type": "guidebook"},
        {"$set": {
            "type": "guidebook",
            "child_guide": body.get("child_guide", ""),
            "parent_guide": body.get("parent_guide", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user["user_id"]
        }},
        upsert=True
    )
    
    return {"message": "Guidebook updated"}
