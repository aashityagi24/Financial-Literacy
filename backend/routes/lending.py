"""Lending and Borrowing routes for Grade 4-5 children"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/lending", tags=["lending"])

# Constants
MAX_LOAN_PARENT = 2000
MAX_LOAN_CLASSMATE = 500
MAX_ONGOING_DEBTS = 5
MIN_GRADE = 4
MAX_GRADE = 5

def calculate_credit_score(loan_history):
    """Calculate credit score based on loan history (0-100)"""
    if not loan_history:
        return 70  # Default score for new borrowers
    
    total_loans = len(loan_history)
    on_time_payments = sum(1 for loan in loan_history if loan.get("status") == "paid" and not loan.get("was_late"))
    late_payments = sum(1 for loan in loan_history if loan.get("status") == "paid" and loan.get("was_late"))
    defaults = sum(1 for loan in loan_history if loan.get("status") == "bad_debt")
    
    # Base score starts at 50
    score = 50
    
    # Add points for on-time payments (up to 40 points)
    if total_loans > 0:
        on_time_ratio = on_time_payments / total_loans
        score += on_time_ratio * 40
    
    # Subtract points for late payments (up to -15 points)
    late_penalty = min(late_payments * 5, 15)
    score -= late_penalty
    
    # Heavy penalty for defaults (up to -25 points)
    default_penalty = min(defaults * 10, 25)
    score -= default_penalty
    
    # Bonus for loan history length (up to 10 points)
    history_bonus = min(total_loans * 2, 10)
    score += history_bonus
    
    return max(0, min(100, round(score)))


async def get_user_credit_score(db, user_id):
    """Get or calculate user's credit score"""
    # Get all completed loans where user was borrower
    loan_history = await db.loans.find({
        "borrower_id": user_id,
        "status": {"$in": ["paid", "bad_debt"]}
    }, {"_id": 0}).to_list(100)
    
    score = calculate_credit_score(loan_history)
    
    # Update stored credit score
    await db.credit_scores.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "score": score,
            "total_loans": len(loan_history),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return score


async def notify_parents_bad_debt(db, loan):
    """Notify parents when a loan becomes bad debt"""
    borrower = await db.users.find_one({"user_id": loan["borrower_id"]}, {"_id": 0})
    if not borrower:
        return
    
    parent_id = borrower.get("parent_id")
    if not parent_id:
        return
    
    # Create notification for parent
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": parent_id,
        "type": "bad_debt_alert",
        "title": "Loan Default Alert",
        "message": f"{borrower.get('name', 'Your child')} has defaulted on a loan of ₹{loan['amount']} from {loan.get('lender_name', 'a lender')}. This affects their credit score.",
        "data": {
            "loan_id": loan["loan_id"],
            "borrower_id": loan["borrower_id"],
            "amount": loan["amount"]
        },
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)


@router.get("/eligibility")
async def check_eligibility(request: Request):
    """Check if user is eligible for lending/borrowing feature"""
    from services.auth import get_current_user
    user = await get_current_user(request)
    
    grade = user.get("grade", 0) or 0
    is_eligible = MIN_GRADE <= grade <= MAX_GRADE
    
    return {
        "eligible": is_eligible,
        "grade": grade,
        "min_grade": MIN_GRADE,
        "max_grade": MAX_GRADE,
        "message": "Lending feature is available for grades 4-5" if is_eligible else "This feature is only available for grades 4-5"
    }


@router.get("/credit-score")
async def get_credit_score(request: Request, user_id: str = None):
    """Get credit score for a user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    target_user_id = user_id or user["user_id"]
    score = await get_user_credit_score(db, target_user_id)
    
    # Get additional stats
    total_borrowed = await db.loans.count_documents({"borrower_id": target_user_id, "status": "paid"})
    total_lent = await db.loans.count_documents({"lender_id": target_user_id, "status": "paid"})
    defaults = await db.loans.count_documents({"borrower_id": target_user_id, "status": "bad_debt"})
    
    return {
        "user_id": target_user_id,
        "score": score,
        "rating": "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Poor",
        "total_loans_repaid": total_borrowed,
        "total_loans_given": total_lent,
        "defaults": defaults
    }


@router.get("/limits")
async def get_lending_limits(request: Request):
    """Get lending limits and current usage"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Count ongoing debts (active loans where user is borrower)
    ongoing_debts = await db.loans.count_documents({
        "borrower_id": user["user_id"],
        "status": "active"
    })
    
    return {
        "max_loan_parent": MAX_LOAN_PARENT,
        "max_loan_classmate": MAX_LOAN_CLASSMATE,
        "max_ongoing_debts": MAX_ONGOING_DEBTS,
        "current_ongoing_debts": ongoing_debts,
        "can_borrow": ongoing_debts < MAX_ONGOING_DEBTS
    }


@router.post("/request")
async def create_loan_request(request: Request):
    """Create a new loan request to multiple recipients"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Check grade eligibility
    grade = user.get("grade", 0) or 0
    if not (MIN_GRADE <= grade <= MAX_GRADE):
        raise HTTPException(status_code=403, detail="Lending feature is only for grades 4-5")
    
    body = await request.json()
    amount = body.get("amount", 0)
    purpose = body.get("purpose", "")
    return_date = body.get("return_date")
    interest_amount = body.get("interest_amount", 0)
    recipient_ids = body.get("recipient_ids", [])  # List of user IDs
    
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid loan amount")
    
    if not purpose:
        raise HTTPException(status_code=400, detail="Please specify what you need the money for")
    
    if not return_date:
        raise HTTPException(status_code=400, detail="Please specify a return date")
    
    if not recipient_ids:
        raise HTTPException(status_code=400, detail="Please select at least one recipient")
    
    # Check ongoing debts limit
    ongoing_debts = await db.loans.count_documents({
        "borrower_id": user["user_id"],
        "status": "active"
    })
    if ongoing_debts >= MAX_ONGOING_DEBTS:
        raise HTTPException(status_code=400, detail=f"You already have {MAX_ONGOING_DEBTS} ongoing loans. Pay some off first!")
    
    # Create a request group ID to track related requests
    request_group_id = f"reqgrp_{uuid.uuid4().hex[:12]}"
    created_requests = []
    
    for recipient_id in recipient_ids:
        # Get recipient info
        recipient = await db.users.find_one({"user_id": recipient_id}, {"_id": 0})
        if not recipient:
            continue
        
        # Determine if recipient is parent or classmate
        is_parent = recipient.get("role") == "parent"
        max_amount = MAX_LOAN_PARENT if is_parent else MAX_LOAN_CLASSMATE
        
        if amount > max_amount:
            continue  # Skip if amount exceeds limit for this recipient type
        
        loan_request = {
            "request_id": f"loanreq_{uuid.uuid4().hex[:12]}",
            "request_group_id": request_group_id,
            "borrower_id": user["user_id"],
            "borrower_name": user.get("name", "Unknown"),
            "borrower_grade": grade,
            "lender_id": recipient_id,
            "lender_name": recipient.get("name", "Unknown"),
            "lender_type": "parent" if is_parent else "classmate",
            "amount": amount,
            "interest_amount": interest_amount,
            "total_repayment": amount + interest_amount,
            "purpose": purpose,
            "return_date": return_date,
            "status": "pending",  # pending, accepted, rejected, countered, withdrawn
            "counter_offers": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.loan_requests.insert_one(loan_request)
        created_requests.append(loan_request)
        
        # Create notification for recipient
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": recipient_id,
            "type": "loan_request",
            "title": "New Loan Request",
            "message": f"{user.get('name', 'Someone')} is requesting to borrow ₹{amount} from you",
            "data": {"request_id": loan_request["request_id"]},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    if not created_requests:
        raise HTTPException(status_code=400, detail="Could not create loan requests. Check amounts and recipients.")
    
    return {
        "message": f"Loan request sent to {len(created_requests)} recipient(s)",
        "request_group_id": request_group_id,
        "requests": [{k: v for k, v in req.items() if k != "_id"} for req in created_requests]
    }


@router.get("/requests/sent")
async def get_sent_requests(request: Request, status: str = None):
    """Get loan requests sent by current user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    query = {"borrower_id": user["user_id"]}
    if status:
        query["status"] = status
    
    requests = await db.loan_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Group by request_group_id for comparison view
    grouped = {}
    for req in requests:
        group_id = req.get("request_group_id", req["request_id"])
        if group_id not in grouped:
            grouped[group_id] = {
                "group_id": group_id,
                "amount": req["amount"],
                "purpose": req["purpose"],
                "return_date": req["return_date"],
                "created_at": req["created_at"],
                "offers": []
            }
        grouped[group_id]["offers"].append(req)
    
    return list(grouped.values())


@router.get("/requests/received")
async def get_received_requests(request: Request, status: str = None):
    """Get loan requests received by current user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    query = {"lender_id": user["user_id"]}
    if status:
        query["status"] = status
    
    requests = await db.loan_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add credit score for each borrower
    for req in requests:
        score = await get_user_credit_score(db, req["borrower_id"])
        req["borrower_credit_score"] = score
    
    return requests


@router.post("/requests/{request_id}/respond")
async def respond_to_request(request_id: str, request: Request):
    """Respond to a loan request (accept/reject/counter)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    body = await request.json()
    action = body.get("action")  # accept, reject, counter
    
    loan_request = await db.loan_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not loan_request:
        raise HTTPException(status_code=404, detail="Loan request not found")
    
    if loan_request["lender_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only respond to requests sent to you")
    
    if loan_request["status"] not in ["pending", "countered"]:
        raise HTTPException(status_code=400, detail="This request has already been processed")
    
    if action == "accept":
        # Check if lender has sufficient balance
        lender_wallet = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": "spending"
        })
        
        amount = loan_request.get("counter_amount", loan_request["amount"])
        if not lender_wallet or lender_wallet.get("balance", 0) < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance to fund this loan")
        
        # Create the loan
        loan = {
            "loan_id": f"loan_{uuid.uuid4().hex[:12]}",
            "request_id": request_id,
            "borrower_id": loan_request["borrower_id"],
            "borrower_name": loan_request["borrower_name"],
            "lender_id": user["user_id"],
            "lender_name": user.get("name", "Unknown"),
            "lender_type": loan_request["lender_type"],
            "amount": amount,
            "interest_amount": loan_request.get("counter_interest", loan_request["interest_amount"]),
            "total_repayment": amount + loan_request.get("counter_interest", loan_request["interest_amount"]),
            "purpose": loan_request["purpose"],
            "return_date": loan_request.get("counter_return_date", loan_request["return_date"]),
            "status": "active",
            "funded_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Transfer money from lender to borrower
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "spending"},
            {"$inc": {"balance": -amount}}
        )
        await db.wallet_accounts.update_one(
            {"user_id": loan_request["borrower_id"], "account_type": "spending"},
            {"$inc": {"balance": amount}}
        )
        
        await db.loans.insert_one(loan)
        
        # Update request status
        await db.loan_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Withdraw other pending requests in same group
        await db.loan_requests.update_many(
            {
                "request_group_id": loan_request.get("request_group_id"),
                "request_id": {"$ne": request_id},
                "status": "pending"
            },
            {"$set": {"status": "withdrawn", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Notify borrower
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": loan_request["borrower_id"],
            "type": "loan_funded",
            "title": "Loan Approved!",
            "message": f"{user.get('name', 'Someone')} has funded your loan of ₹{amount}!",
            "data": {"loan_id": loan["loan_id"]},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Loan funded successfully!", "loan": {k: v for k, v in loan.items() if k != "_id"}}
    
    elif action == "reject":
        await db.loan_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Notify borrower
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": loan_request["borrower_id"],
            "type": "loan_rejected",
            "title": "Loan Request Declined",
            "message": f"{user.get('name', 'Someone')} has declined your loan request",
            "data": {"request_id": request_id},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Loan request rejected"}
    
    elif action == "counter":
        counter_amount = body.get("counter_amount", loan_request["amount"])
        counter_interest = body.get("counter_interest", loan_request["interest_amount"])
        counter_return_date = body.get("counter_return_date", loan_request["return_date"])
        counter_message = body.get("message", "")
        
        counter_offer = {
            "offer_id": f"counter_{uuid.uuid4().hex[:12]}",
            "amount": counter_amount,
            "interest_amount": counter_interest,
            "total_repayment": counter_amount + counter_interest,
            "return_date": counter_return_date,
            "message": counter_message,
            "offered_by": user["user_id"],
            "offered_by_name": user.get("name", "Unknown"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.loan_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "countered",
                    "counter_amount": counter_amount,
                    "counter_interest": counter_interest,
                    "counter_return_date": counter_return_date,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"counter_offers": counter_offer}
            }
        )
        
        # Notify borrower
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": loan_request["borrower_id"],
            "type": "loan_counter",
            "title": "Counter Offer Received",
            "message": f"{user.get('name', 'Someone')} has made a counter offer on your loan request",
            "data": {"request_id": request_id},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Counter offer sent", "counter_offer": counter_offer}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept', 'reject', or 'counter'")


@router.post("/requests/{request_id}/accept-counter")
async def accept_counter_offer(request_id: str, request: Request):
    """Borrower accepts a counter offer"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    loan_request = await db.loan_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not loan_request:
        raise HTTPException(status_code=404, detail="Loan request not found")
    
    if loan_request["borrower_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the borrower can accept counter offers")
    
    if loan_request["status"] != "countered":
        raise HTTPException(status_code=400, detail="No counter offer to accept")
    
    # Update status to pending for lender to finalize
    await db.loan_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "pending",
            "amount": loan_request["counter_amount"],
            "interest_amount": loan_request["counter_interest"],
            "return_date": loan_request["counter_return_date"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify lender to finalize
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": loan_request["lender_id"],
        "type": "counter_accepted",
        "title": "Counter Offer Accepted",
        "message": f"{user.get('name', 'The borrower')} has accepted your counter offer. Finalize to send funds.",
        "data": {"request_id": request_id},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Counter offer accepted! Waiting for lender to send funds."}


@router.post("/requests/{request_id}/withdraw")
async def withdraw_request(request_id: str, request: Request):
    """Borrower withdraws a loan request"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    loan_request = await db.loan_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not loan_request:
        raise HTTPException(status_code=404, detail="Loan request not found")
    
    if loan_request["borrower_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the borrower can withdraw requests")
    
    if loan_request["status"] not in ["pending", "countered"]:
        raise HTTPException(status_code=400, detail="Cannot withdraw this request")
    
    await db.loan_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "withdrawn", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Loan request withdrawn"}


@router.get("/loans/borrowing")
async def get_borrowing_loans(request: Request, status: str = None):
    """Get loans where current user is borrower"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    query = {"borrower_id": user["user_id"]}
    if status:
        query["status"] = status
    
    loans = await db.loans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate days until due for active loans
    for loan in loans:
        if loan["status"] == "active":
            return_date = datetime.fromisoformat(loan["return_date"].replace("Z", "+00:00"))
            days_left = (return_date - datetime.now(timezone.utc)).days
            loan["days_until_due"] = days_left
            loan["is_overdue"] = days_left < 0
    
    return loans


@router.get("/loans/lending")
async def get_lending_loans(request: Request, status: str = None):
    """Get loans where current user is lender"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    query = {"lender_id": user["user_id"]}
    if status:
        query["status"] = status
    
    loans = await db.loans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add borrower credit score and days info
    for loan in loans:
        score = await get_user_credit_score(db, loan["borrower_id"])
        loan["borrower_credit_score"] = score
        
        if loan["status"] == "active":
            return_date = datetime.fromisoformat(loan["return_date"].replace("Z", "+00:00"))
            days_left = (return_date - datetime.now(timezone.utc)).days
            loan["days_until_due"] = days_left
            loan["is_overdue"] = days_left < 0
    
    return loans


@router.post("/loans/{loan_id}/repay")
async def repay_loan(loan_id: str, request: Request):
    """Repay a loan"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    loan = await db.loans.find_one({"loan_id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    if loan["borrower_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the borrower can repay")
    
    if loan["status"] != "active":
        raise HTTPException(status_code=400, detail="This loan is not active")
    
    total_repayment = loan["total_repayment"]
    
    # Check borrower balance
    borrower_wallet = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "spending"
    })
    
    if not borrower_wallet or borrower_wallet.get("balance", 0) < total_repayment:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. You need ₹{total_repayment}")
    
    # Check if late
    return_date = datetime.fromisoformat(loan["return_date"].replace("Z", "+00:00"))
    was_late = datetime.now(timezone.utc) > return_date
    
    # Transfer money
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -total_repayment}}
    )
    await db.wallet_accounts.update_one(
        {"user_id": loan["lender_id"], "account_type": "spending"},
        {"$inc": {"balance": total_repayment}}
    )
    
    # Update loan status
    await db.loans.update_one(
        {"loan_id": loan_id},
        {"$set": {
            "status": "paid",
            "was_late": was_late,
            "paid_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update credit score
    await get_user_credit_score(db, user["user_id"])
    
    # Notify lender
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": loan["lender_id"],
        "type": "loan_repaid",
        "title": "Loan Repaid!",
        "message": f"{user.get('name', 'The borrower')} has repaid ₹{total_repayment}",
        "data": {"loan_id": loan_id},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Loan repaid successfully!", "was_late": was_late}


@router.get("/classmates")
async def get_classmates_for_lending(request: Request):
    """Get eligible classmates who can be loan recipients"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Get user's class
    class_id = user.get("class_id")
    if not class_id:
        return []
    
    # Get classmates in same class with grades 4-5
    classmates = await db.users.find({
        "class_id": class_id,
        "user_id": {"$ne": user["user_id"]},
        "role": "child",
        "grade": {"$gte": MIN_GRADE, "$lte": MAX_GRADE}
    }, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Add credit scores
    for classmate in classmates:
        score = await get_user_credit_score(db, classmate["user_id"])
        classmate["credit_score"] = score
    
    return classmates


@router.get("/parents")
async def get_parents_for_lending(request: Request):
    """Get user's parents who can be loan recipients"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    parent_id = user.get("parent_id")
    if not parent_id:
        return []
    
    parent = await db.users.find_one(
        {"user_id": parent_id},
        {"_id": 0, "password_hash": 0}
    )
    
    return [parent] if parent else []


@router.get("/summary")
async def get_lending_summary(request: Request):
    """Get summary of user's lending/borrowing activity"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Borrowing stats
    active_borrowed = await db.loans.count_documents({"borrower_id": user["user_id"], "status": "active"})
    total_borrowed_amount = 0
    borrowed_loans = await db.loans.find({"borrower_id": user["user_id"], "status": "active"}, {"_id": 0}).to_list(100)
    for loan in borrowed_loans:
        total_borrowed_amount += loan["total_repayment"]
    
    pending_requests_sent = await db.loan_requests.count_documents({
        "borrower_id": user["user_id"],
        "status": {"$in": ["pending", "countered"]}
    })
    
    # Lending stats
    active_lent = await db.loans.count_documents({"lender_id": user["user_id"], "status": "active"})
    total_lent_amount = 0
    lent_loans = await db.loans.find({"lender_id": user["user_id"], "status": "active"}, {"_id": 0}).to_list(100)
    for loan in lent_loans:
        total_lent_amount += loan["total_repayment"]
    
    pending_requests_received = await db.loan_requests.count_documents({
        "lender_id": user["user_id"],
        "status": {"$in": ["pending", "countered"]}
    })
    
    bad_debts = await db.loans.count_documents({"lender_id": user["user_id"], "status": "bad_debt"})
    
    # Credit score
    credit_score = await get_user_credit_score(db, user["user_id"])
    
    return {
        "credit_score": credit_score,
        "borrowing": {
            "active_loans": active_borrowed,
            "total_amount_owed": total_borrowed_amount,
            "pending_requests": pending_requests_sent,
            "can_borrow_more": active_borrowed < MAX_ONGOING_DEBTS
        },
        "lending": {
            "active_loans": active_lent,
            "total_amount_lent": total_lent_amount,
            "pending_requests": pending_requests_received,
            "bad_debts": bad_debts
        }
    }


# Parent view endpoints
@router.get("/parent/child-loans/{child_id}")
async def get_child_loans_for_parent(child_id: str, request: Request):
    """Parent views their child's loan activity"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this")
    
    # Verify this is parent's child
    child = await db.users.find_one({"user_id": child_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=403, detail="This is not your child")
    
    # Get all loan data
    borrowed_loans = await db.loans.find({"borrower_id": child_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    lent_loans = await db.loans.find({"lender_id": child_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    credit_score = await get_user_credit_score(db, child_id)
    
    return {
        "child_name": child.get("name"),
        "credit_score": credit_score,
        "borrowed_loans": borrowed_loans,
        "lent_loans": lent_loans,
        "summary": {
            "total_borrowed": len([l for l in borrowed_loans if l["status"] == "paid"]),
            "active_borrowed": len([l for l in borrowed_loans if l["status"] == "active"]),
            "total_lent": len([l for l in lent_loans if l["status"] == "paid"]),
            "active_lent": len([l for l in lent_loans if l["status"] == "active"]),
            "bad_debts": len([l for l in borrowed_loans if l["status"] == "bad_debt"])
        }
    }


# Check and mark overdue loans as bad debt (to be called by scheduler)
async def check_overdue_loans():
    """Mark overdue loans as bad debt and notify parents"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    
    # Find active loans past due date
    overdue_loans = await db.loans.find({
        "status": "active",
        "return_date": {"$lt": now.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    for loan in overdue_loans:
        # Check if more than 7 days overdue
        return_date = datetime.fromisoformat(loan["return_date"].replace("Z", "+00:00"))
        days_overdue = (now - return_date).days
        
        if days_overdue > 7:
            # Mark as bad debt
            await db.loans.update_one(
                {"loan_id": loan["loan_id"]},
                {"$set": {
                    "status": "bad_debt",
                    "marked_bad_debt_at": now.isoformat()
                }}
            )
            
            # Update credit score
            await get_user_credit_score(db, loan["borrower_id"])
            
            # Notify parents
            await notify_parents_bad_debt(db, loan)
