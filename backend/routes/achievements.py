"""Achievement routes"""
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

router = APIRouter(tags=["achievements"])

@router.get("/achievements")
async def get_achievements(request: Request):
    """Get all achievements and user's earned ones"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    all_achievements = await db.achievements.find({}, {"_id": 0}).to_list(100)
    user_achievements = await db.user_achievements.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    earned_ids = {ua["achievement_id"] for ua in user_achievements}
    
    result = []
    for ach in all_achievements:
        result.append({
            **ach,
            "earned": ach["achievement_id"] in earned_ids
        })
    
    return result

@router.post("/achievements/{achievement_id}/claim")
async def claim_achievement(achievement_id: str, request: Request):
    """Claim an earned achievement"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    existing = await db.user_achievements.find_one({
        "user_id": user["user_id"],
        "achievement_id": achievement_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Achievement already claimed")
    
    achievement = await db.achievements.find_one({"achievement_id": achievement_id}, {"_id": 0})
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    
    ua_doc = {
        "id": f"ua_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "achievement_id": achievement_id,
        "earned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_achievements.insert_one(ua_doc)
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": achievement["points"]}}
    )
    
    return {"message": "Achievement claimed", "points_earned": achievement["points"]}

@router.get("/streak")
async def get_streak(request: Request):
    """Get user's current streak info"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    return {
        "streak_count": user.get("streak_count", 0),
        "last_login_date": user.get("last_login_date")
    }

@router.post("/streak/claim-bonus")
async def claim_streak_bonus(request: Request):
    """Claim streak milestone bonus"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    streak = user.get("streak_count", 0)
    
    bonuses = {7: 10, 14: 25, 30: 50, 60: 100, 90: 200}
    
    claimed = user.get("claimed_streak_bonuses", [])
    
    for milestone, bonus in bonuses.items():
        if streak >= milestone and milestone not in claimed:
            await db.wallet_accounts.update_one(
                {"user_id": user["user_id"], "account_type": "spending"},
                {"$inc": {"balance": bonus}}
            )
            
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$push": {"claimed_streak_bonuses": milestone}}
            )
            
            await db.transactions.insert_one({
                "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "to_account": "spending",
                "amount": bonus,
                "transaction_type": "streak_bonus",
                "description": f"{milestone}-day streak bonus!",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            return {"message": f"Claimed {milestone}-day streak bonus!", "bonus": bonus}
    
    return {"message": "No unclaimed streak bonuses"}


@router.post("/checkin")
async def streak_checkin(request: Request):
    """Daily streak check-in"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    from datetime import date
    today = date.today().isoformat()
    
    last_checkin = user.get("last_checkin_date")
    current_streak = user.get("streak_count", 0)
    
    if last_checkin == today:
        return {"message": "Already checked in today", "streak": current_streak, "bonus": 0}
    
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    
    if last_checkin == yesterday:
        current_streak += 1
    else:
        current_streak = 1
    
    # Calculate bonus
    bonus_coins = min(5 + current_streak, 20)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "streak_count": current_streak,
            "last_checkin_date": today
        }}
    )
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": bonus_coins}}
    )
    
    return {
        "message": f"Check-in successful! {current_streak} day streak!",
        "streak": current_streak,
        "bonus": bonus_coins
    }