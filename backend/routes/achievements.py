"""Achievement routes"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta, date
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


@router.post("/streak/checkin")
async def streak_checkin(request: Request):
    """Daily streak check-in - Awards ₹5 daily, ₹10 on every 5th day (5, 10, 15, 20...), max ₹20"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    today = date.today().isoformat()
    
    last_checkin = user.get("last_checkin_date")
    current_streak = user.get("streak_count", 0)
    
    if last_checkin == today:
        return {"message": "Already checked in today", "streak": current_streak, "reward": 0}
    
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    
    if last_checkin == yesterday:
        current_streak += 1
    else:
        current_streak = 1
    
    # Calculate reward: ₹5 daily, ₹10 on every 5th day (5, 10, 15, 20...), max ₹20
    if current_streak % 5 == 0:
        reward_coins = 10
    else:
        reward_coins = 5
    
    # Cap max reward at ₹20
    reward_coins = min(reward_coins, 20)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "streak_count": current_streak,
            "last_checkin_date": today
        }}
    )
    
    # Add reward to spending wallet
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward_coins}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "to_account": "spending",
        "amount": reward_coins,
        "transaction_type": "streak_reward",
        "description": f"Day {current_streak} streak reward!" + (" (5-day bonus!)" if current_streak % 5 == 0 else ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Check-in successful! {current_streak} day streak!",
        "streak": current_streak,
        "reward": reward_coins
    }

# ============== BADGE SYSTEM ==============

# Badge definitions with cute icons
FIRST_TIME_BADGES = [
    {
        "achievement_id": "badge_first_purchase",
        "name": "First Shopper",
        "description": "Made your first purchase from the store!",
        "icon": "🛒",
        "category": "first_time",
        "trigger": "store_purchase",
        "points": 5
    },
    {
        "achievement_id": "badge_first_transfer",
        "name": "Money Mover",
        "description": "Made your first transfer between jars!",
        "icon": "🔄",
        "category": "first_time",
        "trigger": "jar_transfer",
        "points": 5
    },
    {
        "achievement_id": "badge_first_quest",
        "name": "Quest Champion",
        "description": "Completed your first quest!",
        "icon": "⭐",
        "category": "first_time",
        "trigger": "quest_complete",
        "points": 10
    },
    {
        "achievement_id": "badge_first_gift_given",
        "name": "Generous Heart",
        "description": "Gave your first gift to a friend!",
        "icon": "💝",
        "category": "first_time",
        "trigger": "gift_given",
        "points": 10
    },
    {
        "achievement_id": "badge_first_gift_received",
        "name": "Gift Getter",
        "description": "Received your first gift from a friend!",
        "icon": "🎁",
        "category": "first_time",
        "trigger": "gift_received",
        "points": 5
    },
    {
        "achievement_id": "badge_first_stock",
        "name": "Stock Star",
        "description": "Made your first stock investment!",
        "icon": "📈",
        "category": "first_time",
        "trigger": "stock_buy",
        "points": 10
    },
    {
        "achievement_id": "badge_first_plant",
        "name": "Green Thumb",
        "description": "Planted your first seed in the money garden!",
        "icon": "🌱",
        "category": "first_time",
        "trigger": "garden_plant",
        "points": 10
    },
    {
        "achievement_id": "badge_first_stock_profit",
        "name": "Profit Pro",
        "description": "Made your first profit from selling stocks!",
        "icon": "💰",
        "category": "first_time",
        "trigger": "stock_profit",
        "points": 15
    },
    {
        "achievement_id": "badge_first_garden_profit",
        "name": "Harvest Hero",
        "description": "Made your first profit from selling plants!",
        "icon": "🌻",
        "category": "first_time",
        "trigger": "garden_profit",
        "points": 15
    },
    {
        "achievement_id": "badge_first_activity",
        "name": "Learning Starter",
        "description": "Completed your first learning activity!",
        "icon": "📚",
        "category": "first_time",
        "trigger": "activity_complete",
        "points": 5
    },
    {
        "achievement_id": "badge_first_goal_created",
        "name": "Goal Setter",
        "description": "Created your first savings goal!",
        "icon": "🎯",
        "category": "first_time",
        "trigger": "goal_created",
        "points": 5
    },
    {
        "achievement_id": "badge_first_saving",
        "name": "Saver Starter",
        "description": "Made your first contribution to a savings goal!",
        "icon": "🐷",
        "category": "first_time",
        "trigger": "saving_made",
        "points": 10
    },
    {
        "achievement_id": "badge_first_goal_achieved",
        "name": "Dream Achiever",
        "description": "Achieved your first savings goal!",
        "icon": "🏆",
        "category": "first_time",
        "trigger": "goal_achieved",
        "points": 20
    }
]

async def award_badge(db, user_id: str, trigger: str):
    """Award a badge to a user if they haven't earned it yet"""
    # Find the badge for this trigger
    badge = None
    for b in FIRST_TIME_BADGES:
        if b["trigger"] == trigger:
            badge = b
            break
    
    if not badge:
        return None
    
    # Check if user already has this badge
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": badge["achievement_id"]
    })
    
    if existing:
        return None  # Already has badge
    
    # Award the badge
    ua_doc = {
        "id": f"ua_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "achievement_id": badge["achievement_id"],
        "earned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_achievements.insert_one(ua_doc)
    
    # Award bonus points
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "spending"},
        {"$inc": {"balance": badge["points"]}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "to_account": "spending",
        "amount": badge["points"],
        "transaction_type": "badge_reward",
        "description": f"Badge earned: {badge['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "badge_earned",
        "title": f"🎖️ New Badge: {badge['name']}!",
        "message": f"{badge['description']} You earned ₹{badge['points']}!",
        "icon": badge["icon"],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return badge

@router.post("/seed-badges")
async def seed_badges(request: Request):
    """Seed the default badges into the database (admin only)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    # Clear existing badges
    await db.achievements.delete_many({"category": "first_time"})
    
    # Insert new badges
    for badge in FIRST_TIME_BADGES:
        await db.achievements.update_one(
            {"achievement_id": badge["achievement_id"]},
            {"$set": badge},
            upsert=True
        )
    
    return {"message": f"Seeded {len(FIRST_TIME_BADGES)} badges", "badges": [b["name"] for b in FIRST_TIME_BADGES]}