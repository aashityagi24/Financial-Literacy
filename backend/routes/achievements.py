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

async def get_all_badges_with_user_status(db, user_id: str):
    """Helper to get all badges with user's earned status"""
    # First, try to get badges from database
    db_badges = await db.achievements.find({}, {"_id": 0}).to_list(100)
    
    # If no badges in DB, use the default ones and seed them
    if not db_badges:
        for badge in FIRST_TIME_BADGES:
            await db.achievements.update_one(
                {"achievement_id": badge["achievement_id"]},
                {"$set": badge},
                upsert=True
            )
        db_badges = FIRST_TIME_BADGES.copy()
    
    # Get user's earned badges
    earned = await db.user_achievements.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    earned_ids = {e["achievement_id"] for e in earned}
    earned_map = {e["achievement_id"]: e for e in earned}
    
    # Merge data
    badges_with_status = []
    for badge in db_badges:
        badge_data = {
            **badge,
            "earned": badge["achievement_id"] in earned_ids,
            "earned_at": earned_map.get(badge["achievement_id"], {}).get("earned_at")
        }
        badges_with_status.append(badge_data)
    
    # Sort: earned badges first
    badges_with_status.sort(key=lambda x: (not x["earned"], x.get("name", "")))
    
    return badges_with_status

@router.get("/achievements")
async def get_achievements(request: Request):
    """Get all achievements and user's earned ones"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    badges = await get_all_badges_with_user_status(db, user["user_id"])
    return badges

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

# Badge definitions with cute icons and proper categories
FIRST_TIME_BADGES = [
    {
        "achievement_id": "badge_first_purchase",
        "name": "First Shopper",
        "description": "Made your first purchase from the store!",
        "icon": "🛒",
        "category": "savings",
        "trigger": "store_purchase",
        "points": 5
    },
    {
        "achievement_id": "badge_first_transfer",
        "name": "Money Mover",
        "description": "Made your first transfer between jars!",
        "icon": "🔄",
        "category": "savings",
        "trigger": "jar_transfer",
        "points": 5
    },
    {
        "achievement_id": "badge_first_quest",
        "name": "Quest Champion",
        "description": "Completed your first quest!",
        "icon": "⭐",
        "category": "learning",
        "trigger": "quest_complete",
        "points": 10
    },
    {
        "achievement_id": "badge_first_gift_given",
        "name": "Generous Heart",
        "description": "Gave your first gift to a friend!",
        "icon": "💝",
        "category": "gifting",
        "trigger": "gift_given",
        "points": 10
    },
    {
        "achievement_id": "badge_first_gift_received",
        "name": "Gift Getter",
        "description": "Received your first gift from a friend!",
        "icon": "🎁",
        "category": "gifting",
        "trigger": "gift_received",
        "points": 5
    },
    {
        "achievement_id": "badge_first_stock",
        "name": "Stock Star",
        "description": "Made your first stock investment!",
        "icon": "📈",
        "category": "investing",
        "trigger": "stock_buy",
        "points": 10
    },
    {
        "achievement_id": "badge_first_plant",
        "name": "Green Thumb",
        "description": "Planted your first seed in the money garden!",
        "icon": "🌱",
        "category": "investing",
        "trigger": "garden_plant",
        "points": 10
    },
    {
        "achievement_id": "badge_first_stock_profit",
        "name": "Profit Pro",
        "description": "Made your first profit from selling stocks!",
        "icon": "💰",
        "category": "investing",
        "trigger": "stock_profit",
        "points": 15
    },
    {
        "achievement_id": "badge_first_garden_profit",
        "name": "Harvest Hero",
        "description": "Made your first profit from selling plants!",
        "icon": "🌻",
        "category": "investing",
        "trigger": "garden_profit",
        "points": 15
    },
    {
        "achievement_id": "badge_first_activity",
        "name": "Learning Starter",
        "description": "Completed your first learning activity!",
        "icon": "📚",
        "category": "learning",
        "trigger": "activity_complete",
        "points": 5
    },
    {
        "achievement_id": "badge_first_goal_created",
        "name": "Goal Setter",
        "description": "Created your first savings goal!",
        "icon": "🎯",
        "category": "savings",
        "trigger": "goal_created",
        "points": 5
    },
    {
        "achievement_id": "badge_first_saving",
        "name": "Saver Starter",
        "description": "Made your first contribution to a savings goal!",
        "icon": "🐷",
        "category": "savings",
        "trigger": "saving_made",
        "points": 10
    },
    {
        "achievement_id": "badge_first_goal_achieved",
        "name": "Dream Achiever",
        "description": "Achieved your first savings goal!",
        "icon": "🏆",
        "category": "savings",
        "trigger": "goal_achieved",
        "points": 20
    }
]

async def award_badge(db, user_id: str, trigger: str):
    """Award a badge to a user if they haven't earned it yet"""
    # First try to find the badge in database
    badge = await db.achievements.find_one({"trigger": trigger}, {"_id": 0})
    
    # If not in DB, try to find in defaults
    if not badge:
        for b in FIRST_TIME_BADGES:
            if b["trigger"] == trigger:
                badge = b
                # Also save to DB for consistency
                await db.achievements.update_one(
                    {"achievement_id": b["achievement_id"]},
                    {"$set": b},
                    upsert=True
                )
                break
    
    if not badge:
        return None
    
    # Check if badge is active
    if not badge.get("is_active", True):
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
    
    # Clear existing badges and insert new ones
    await db.achievements.delete_many({})
    
    # Insert new badges
    for badge in FIRST_TIME_BADGES:
        await db.achievements.update_one(
            {"achievement_id": badge["achievement_id"]},
            {"$set": badge},
            upsert=True
        )
    
    return {"message": f"Seeded {len(FIRST_TIME_BADGES)} badges", "badges": [b["name"] for b in FIRST_TIME_BADGES]}

@router.get("/badges")
async def get_user_badges(request: Request):
    """Get all badges with user's earned status"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    badges = await get_all_badges_with_user_status(db, user["user_id"])
    
    earned_count = len([b for b in badges if b.get("earned")])
    
    return {
        "badges": badges,
        "total_badges": len(badges),
        "earned_count": earned_count
    }

# ============== ADMIN BADGE MANAGEMENT ==============

@router.get("/admin/badges")
async def admin_get_all_badges(request: Request):
    """Admin: Get all badges for management"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    badges = await db.achievements.find({}, {"_id": 0}).to_list(100)
    
    # If no badges, seed the defaults
    if not badges:
        for badge in FIRST_TIME_BADGES:
            await db.achievements.update_one(
                {"achievement_id": badge["achievement_id"]},
                {"$set": badge},
                upsert=True
            )
        badges = FIRST_TIME_BADGES.copy()
    
    return {"badges": badges, "total": len(badges)}

@router.post("/admin/badges")
async def admin_create_badge(request: Request):
    """Admin: Create a new badge"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    
    # Validate required fields
    required = ["name", "description", "icon", "category", "points"]
    for field in required:
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Generate ID if not provided
    badge_id = body.get("achievement_id") or f"badge_{uuid.uuid4().hex[:12]}"
    
    badge_doc = {
        "achievement_id": badge_id,
        "name": body["name"],
        "description": body["description"],
        "icon": body["icon"],
        "category": body["category"],
        "points": int(body["points"]),
        "trigger": body.get("trigger", "manual"),
        "image_url": body.get("image_url", ""),
        "is_active": body.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.achievements.insert_one(badge_doc)
    
    return {"message": "Badge created", "badge": badge_doc}

@router.put("/admin/badges/{badge_id}")
async def admin_update_badge(badge_id: str, request: Request):
    """Admin: Update an existing badge"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    print(f"[BADGE UPDATE] Received body: {body}")
    
    existing = await db.achievements.find_one({"achievement_id": badge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Badge not found")
    
    update_fields = {}
    allowed_fields = ["name", "description", "icon", "image_url", "category", "points", "trigger", "is_active"]
    
    for field in allowed_fields:
        if field in body:
            update_fields[field] = body[field]
    
    print(f"[BADGE UPDATE] Fields to update: {update_fields}")
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = await db.achievements.update_one(
            {"achievement_id": badge_id},
            {"$set": update_fields}
        )
        print(f"[BADGE UPDATE] Update result: matched={result.matched_count}, modified={result.modified_count}")
    
    updated = await db.achievements.find_one({"achievement_id": badge_id}, {"_id": 0})
    return {"message": "Badge updated", "badge": updated}

@router.delete("/admin/badges/{badge_id}")
async def admin_delete_badge(badge_id: str, request: Request):
    """Admin: Delete a badge"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    result = await db.achievements.delete_one({"achievement_id": badge_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Badge not found")
    
    # Also delete user achievements for this badge
    await db.user_achievements.delete_many({"achievement_id": badge_id})
    
    return {"message": "Badge deleted"}

@router.get("/admin/badge-categories")
async def get_badge_categories(request: Request):
    """Get available badge categories"""
    from services.auth import require_admin
    await require_admin(request)
    
    return {
        "categories": [
            {"id": "savings", "name": "Savings", "color": "#06D6A0"},
            {"id": "investing", "name": "Investing", "color": "#3D5A80"},
            {"id": "learning", "name": "Learning", "color": "#FFD23F"},
            {"id": "streak", "name": "Streak", "color": "#EE6C4D"},
            {"id": "gifting", "name": "Gifting", "color": "#9B5DE5"}
        ]
    }