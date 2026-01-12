from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[str] = None  # 'child', 'parent', 'teacher'
    grade: Optional[int] = None  # K=0, 1-5
    avatar: Optional[Dict[str, Any]] = None
    streak_count: int = 0
    last_login_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None

class UserUpdate(BaseModel):
    role: Optional[str] = None
    grade: Optional[int] = None
    avatar: Optional[Dict[str, Any]] = None

class WalletAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    account_id: str
    user_id: str
    account_type: str  # 'spending', 'savings', 'investing', 'giving'
    balance: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    user_id: str
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    amount: float
    transaction_type: str  # 'deposit', 'withdrawal', 'transfer', 'purchase', 'reward'
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    amount: float
    transaction_type: str
    description: str

class StoreItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    name: str
    description: str
    price: float
    category: str  # 'avatar', 'privilege', 'game_unlock'
    image_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5

class PurchaseCreate(BaseModel):
    item_id: str

class Achievement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    achievement_id: str
    name: str
    description: str
    icon: str
    category: str  # 'savings', 'investing', 'learning', 'streak'
    requirement_value: int
    points: int

class UserAchievement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    achievement_id: str
    earned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Quest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    quest_id: str
    title: str
    description: str
    reward_amount: float
    quest_type: str  # 'daily', 'weekly', 'challenge'
    min_grade: int = 0
    max_grade: int = 5
    requirements: Dict[str, Any] = {}

class UserQuest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    quest_id: str
    progress: float = 0.0
    completed: bool = False
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class Investment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    investment_id: str
    user_id: str
    investment_type: str  # 'garden' for K-2, 'stock' for 3-5
    name: str
    amount_invested: float
    current_value: float
    growth_rate: float = 0.05
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentCreate(BaseModel):
    investment_type: str
    name: str
    amount: float

class ChatMessage(BaseModel):
    message: str
    grade: Optional[int] = 3

class ChatResponse(BaseModel):
    response: str

class FinancialTipRequest(BaseModel):
    grade: int
    topic: Optional[str] = None

# ============== LEARNING CONTENT MODELS ==============

class LearningTopic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic_id: str
    title: str
    description: str
    category: str  # 'history', 'concepts', 'skills', 'activities'
    icon: str
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5

class LearningLesson(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lesson_id: str
    topic_id: str
    title: str
    content: str  # HTML or Markdown content
    lesson_type: str  # 'story', 'video', 'interactive', 'quiz', 'activity'
    media_url: Optional[str] = None
    duration_minutes: int = 5
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class LessonCreate(BaseModel):
    topic_id: str
    title: str
    content: str
    lesson_type: str
    media_url: Optional[str] = None
    duration_minutes: int = 5
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5

class LessonUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    lesson_type: Optional[str] = None
    media_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    order: Optional[int] = None
    min_grade: Optional[int] = None
    max_grade: Optional[int] = None
    reward_coins: Optional[int] = None

class UserLessonProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    lesson_id: str
    completed: bool = False
    score: Optional[int] = None  # For quizzes
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: int  # Index of correct option
    explanation: str

class Quiz(BaseModel):
    model_config = ConfigDict(extra="ignore")
    quiz_id: str
    lesson_id: str
    title: str
    questions: List[Dict[str, Any]]
    passing_score: int = 70
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuizCreate(BaseModel):
    lesson_id: str
    title: str
    questions: List[Dict[str, Any]]
    passing_score: int = 70

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: List[int]  # List of selected option indices

class Book(BaseModel):
    model_config = ConfigDict(extra="ignore")
    book_id: str
    title: str
    author: str
    description: str
    cover_url: Optional[str] = None
    content_url: Optional[str] = None  # PDF or external link
    category: str  # 'story', 'workbook', 'guide'
    min_grade: int = 0
    max_grade: int = 5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class BookCreate(BaseModel):
    title: str
    author: str
    description: str
    cover_url: Optional[str] = None
    content_url: Optional[str] = None
    category: str
    min_grade: int = 0
    max_grade: int = 5

class Activity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    activity_id: str
    title: str
    description: str
    instructions: str
    activity_type: str  # 'printable', 'interactive', 'real_world', 'game'
    topic_id: Optional[str] = None
    resource_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 10
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class ActivityCreate(BaseModel):
    title: str
    description: str
    instructions: str
    activity_type: str
    topic_id: Optional[str] = None
    resource_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 10

# ============== AUTH HELPERS ==============

async def get_session_from_header(request: Request) -> Optional[str]:
    """Get session token from Authorization header"""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return None

async def get_session_from_cookie(request: Request) -> Optional[str]:
    """Get session token from cookie"""
    return request.cookies.get("session_token")

async def get_current_user(request: Request) -> dict:
    """Get current user from session token (cookie first, then header)"""
    session_token = await get_session_from_cookie(request)
    if not session_token:
        session_token = await get_session_from_header(request)
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def require_admin(request: Request) -> dict:
    """Require admin role"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Google OAuth for session data"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Fetch user data from Emergent Auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": None,
            "grade": None,
            "avatar": {"body": "default", "hair": "default", "clothes": "default", "accessories": []},
            "streak_count": 0,
            "last_login_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        
        # Create wallet accounts for new user
        for account_type in ['spending', 'savings', 'investing', 'giving']:
            wallet = {
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "account_type": account_type,
                "balance": 100.0 if account_type == 'spending' else 0.0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.wallet_accounts.insert_one(wallet)
    
    # Create session
    session_token = user_data.get("session_token", f"sess_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Get updated user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = await get_session_from_cookie(request)
    if not session_token:
        session_token = await get_session_from_header(request)
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.put("/auth/profile")
async def update_profile(update: UserUpdate, request: Request):
    """Update user profile (role, grade, avatar)"""
    user = await get_current_user(request)
    
    update_data = {}
    if update.role is not None:
        update_data["role"] = update.role
    if update.grade is not None:
        update_data["grade"] = update.grade
    if update.avatar is not None:
        update_data["avatar"] = update.avatar
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated_user

# ============== WALLET ROUTES ==============

@api_router.get("/wallet")
async def get_wallet(request: Request):
    """Get all wallet accounts for current user"""
    user = await get_current_user(request)
    accounts = await db.wallet_accounts.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    
    total_balance = sum(acc.get("balance", 0) for acc in accounts)
    
    return {
        "accounts": accounts,
        "total_balance": total_balance
    }

@api_router.post("/wallet/transfer")
async def transfer_money(transaction: TransactionCreate, request: Request):
    """Transfer money between accounts"""
    user = await get_current_user(request)
    
    if transaction.transaction_type == "transfer":
        if not transaction.from_account or not transaction.to_account:
            raise HTTPException(status_code=400, detail="Both from_account and to_account required for transfer")
        
        from_acc = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": transaction.from_account
        })
        
        if not from_acc or from_acc.get("balance", 0) < transaction.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        # Deduct from source
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.from_account},
            {"$inc": {"balance": -transaction.amount}}
        )
        
        # Add to destination
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.to_account},
            {"$inc": {"balance": transaction.amount}}
        )
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": transaction.from_account,
        "to_account": transaction.to_account,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Transfer successful", "transaction_id": trans_doc["transaction_id"]}

@api_router.get("/wallet/transactions")
async def get_transactions(request: Request, limit: int = 20):
    """Get recent transactions for current user"""
    user = await get_current_user(request)
    
    transactions = await db.transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return transactions

# ============== STORE ROUTES ==============

@api_router.get("/store/items")
async def get_store_items(request: Request):
    """Get available store items for current user's grade"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    items = await db.store_items.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    return items

@api_router.post("/store/purchase")
async def purchase_item(purchase: PurchaseCreate, request: Request):
    """Purchase an item from the store"""
    user = await get_current_user(request)
    
    item = await db.store_items.find_one({"item_id": purchase.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check spending balance
    spending_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "spending"
    })
    
    if not spending_acc or spending_acc.get("balance", 0) < item["price"]:
        raise HTTPException(status_code=400, detail="Insufficient balance in spending account")
    
    # Deduct balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -item["price"]}}
    )
    
    # Record purchase
    purchase_doc = {
        "purchase_id": f"purch_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "item_id": item["item_id"],
        "item_name": item["name"],
        "price": item["price"],
        "purchased_at": datetime.now(timezone.utc).isoformat()
    }
    await db.purchases.insert_one(purchase_doc)
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": item["price"],
        "transaction_type": "purchase",
        "description": f"Purchased {item['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Purchase successful", "item": item}

@api_router.get("/store/purchases")
async def get_purchases(request: Request):
    """Get user's purchase history"""
    user = await get_current_user(request)
    
    purchases = await db.purchases.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("purchased_at", -1).to_list(100)
    
    return purchases

# ============== INVESTMENT ROUTES ==============

@api_router.get("/investments")
async def get_investments(request: Request):
    """Get user's investments"""
    user = await get_current_user(request)
    
    investments = await db.investments.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Update current values based on time passed
    for inv in investments:
        created = datetime.fromisoformat(inv["created_at"]) if isinstance(inv["created_at"], str) else inv["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_passed = (datetime.now(timezone.utc) - created).days
        growth = 1 + (inv.get("growth_rate", 0.05) * days_passed / 365)
        inv["current_value"] = round(inv["amount_invested"] * growth, 2)
    
    return investments

@api_router.post("/investments")
async def create_investment(investment: InvestmentCreate, request: Request):
    """Create a new investment"""
    user = await get_current_user(request)
    
    # Check investing balance
    investing_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "investing"
    })
    
    if not investing_acc or investing_acc.get("balance", 0) < investment.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in investing account")
    
    # Deduct balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": -investment.amount}}
    )
    
    # Create investment
    inv_doc = {
        "investment_id": f"inv_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "investment_type": investment.investment_type,
        "name": investment.name,
        "amount_invested": investment.amount,
        "current_value": investment.amount,
        "growth_rate": 0.08 if investment.investment_type == "stock" else 0.05,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    await db.investments.insert_one(inv_doc)
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "investing",
        "to_account": None,
        "amount": investment.amount,
        "transaction_type": "investment",
        "description": f"Invested in {investment.name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Investment created", "investment_id": inv_doc["investment_id"]}

@api_router.post("/investments/{investment_id}/sell")
async def sell_investment(investment_id: str, request: Request):
    """Sell an investment and get returns"""
    user = await get_current_user(request)
    
    inv = await db.investments.find_one({
        "investment_id": investment_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Calculate current value
    created = datetime.fromisoformat(inv["created_at"]) if isinstance(inv["created_at"], str) else inv["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    days_passed = (datetime.now(timezone.utc) - created).days
    growth = 1 + (inv.get("growth_rate", 0.05) * days_passed / 365)
    current_value = round(inv["amount_invested"] * growth, 2)
    
    # Add to investing account
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": current_value}}
    )
    
    # Delete investment
    await db.investments.delete_one({"investment_id": investment_id})
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "investing",
        "amount": current_value,
        "transaction_type": "investment_return",
        "description": f"Sold {inv['name']} for ${current_value}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Investment sold", "amount_received": current_value}

# ============== ACHIEVEMENTS ROUTES ==============

@api_router.get("/achievements")
async def get_achievements(request: Request):
    """Get all achievements and user's earned ones"""
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

@api_router.post("/achievements/{achievement_id}/claim")
async def claim_achievement(achievement_id: str, request: Request):
    """Claim an earned achievement"""
    user = await get_current_user(request)
    
    # Check if already earned
    existing = await db.user_achievements.find_one({
        "user_id": user["user_id"],
        "achievement_id": achievement_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Achievement already claimed")
    
    achievement = await db.achievements.find_one({"achievement_id": achievement_id}, {"_id": 0})
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    
    # Award achievement
    ua_doc = {
        "id": f"ua_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "achievement_id": achievement_id,
        "earned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_achievements.insert_one(ua_doc)
    
    # Award points to spending account
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": achievement["points"]}}
    )
    
    return {"message": "Achievement claimed", "points_earned": achievement["points"]}

# ============== QUESTS ROUTES ==============

@api_router.get("/quests")
async def get_quests(request: Request):
    """Get available and assigned quests"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    available_quests = await db.quests.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    user_quests = await db.user_quests.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    assigned_ids = {uq["quest_id"] for uq in user_quests}
    
    result = []
    for quest in available_quests:
        user_quest = next((uq for uq in user_quests if uq["quest_id"] == quest["quest_id"]), None)
        result.append({
            **quest,
            "assigned": quest["quest_id"] in assigned_ids,
            "progress": user_quest["progress"] if user_quest else 0,
            "completed": user_quest["completed"] if user_quest else False
        })
    
    return result

@api_router.post("/quests/{quest_id}/accept")
async def accept_quest(quest_id: str, request: Request):
    """Accept a quest"""
    user = await get_current_user(request)
    
    # Check if already accepted
    existing = await db.user_quests.find_one({
        "user_id": user["user_id"],
        "quest_id": quest_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Quest already accepted")
    
    quest = await db.quests.find_one({"quest_id": quest_id}, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    uq_doc = {
        "id": f"uq_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "quest_id": quest_id,
        "progress": 0,
        "completed": False,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.user_quests.insert_one(uq_doc)
    
    return {"message": "Quest accepted"}

@api_router.post("/quests/{quest_id}/complete")
async def complete_quest(quest_id: str, request: Request):
    """Complete a quest and receive reward"""
    user = await get_current_user(request)
    
    user_quest = await db.user_quests.find_one({
        "user_id": user["user_id"],
        "quest_id": quest_id
    })
    
    if not user_quest:
        raise HTTPException(status_code=404, detail="Quest not accepted")
    
    if user_quest.get("completed"):
        raise HTTPException(status_code=400, detail="Quest already completed")
    
    quest = await db.quests.find_one({"quest_id": quest_id}, {"_id": 0})
    
    # Mark as complete
    await db.user_quests.update_one(
        {"user_id": user["user_id"], "quest_id": quest_id},
        {"$set": {"completed": True, "progress": 100, "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Award reward
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": quest["reward_amount"]}}
    )
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": quest["reward_amount"],
        "transaction_type": "reward",
        "description": f"Quest completed: {quest['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Quest completed", "reward": quest["reward_amount"]}

# ============== STREAK ROUTES ==============

@api_router.post("/streak/checkin")
async def daily_checkin(request: Request):
    """Record daily login and update streak"""
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    last_login = user.get("last_login_date")
    current_streak = user.get("streak_count", 0)
    
    if last_login == today:
        return {"message": "Already checked in today", "streak": current_streak, "reward": 0}
    
    # Check if streak continues
    if last_login:
        last_date = datetime.strptime(last_login, "%Y-%m-%d")
        today_date = datetime.strptime(today, "%Y-%m-%d")
        diff = (today_date - last_date).days
        
        if diff == 1:
            current_streak += 1
        elif diff > 1:
            current_streak = 1
    else:
        current_streak = 1
    
    # Update user
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login_date": today, "streak_count": current_streak}}
    )
    
    # Award streak bonus
    bonus = min(current_streak * 2, 20)  # Max 20 coins per day
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": bonus}}
    )
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": bonus,
        "transaction_type": "reward",
        "description": f"Daily login bonus (Day {current_streak})",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Check-in successful", "streak": current_streak, "reward": bonus}

# ============== AI ROUTES ==============

@api_router.post("/ai/chat", response_model=ChatResponse)
async def ai_chat(message: ChatMessage, request: Request):
    """Chat with AI financial buddy"""
    user = await get_current_user(request)
    grade = message.grade or user.get("grade", 3) or 3
    
    # Grade-appropriate system message
    grade_contexts = {
        0: "You are a friendly financial buddy for kindergarten kids (5-6 years). Use very simple words, lots of examples with toys and candy, and be super encouraging. Keep responses under 3 sentences.",
        1: "You are a friendly financial buddy for 1st graders (6-7 years). Use simple words, examples with coins and small purchases, and be encouraging. Keep responses under 4 sentences.",
        2: "You are a friendly financial buddy for 2nd graders (7-8 years). Use simple language, examples with money math and small purchases, and be encouraging. Keep responses under 4 sentences.",
        3: "You are a friendly financial buddy for 3rd graders (8-9 years). You can use slightly more complex concepts like percentages and goals. Use relatable examples. Keep responses under 5 sentences.",
        4: "You are a friendly financial buddy for 4th graders (9-10 years). You can discuss interest, savings accounts, and basic investing concepts. Use real-world examples. Keep responses under 5 sentences.",
        5: "You are a friendly financial buddy for 5th graders (10-11 years). You can discuss credit, compound interest, diversification, and entrepreneurship basics. Use engaging examples. Keep responses under 6 sentences."
    }
    
    system_message = grade_contexts.get(grade, grade_contexts[3])
    system_message += " Always be positive, encouraging, and make learning about money fun! Never give actual financial advice - this is educational only."
    
    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"chat_{user['user_id']}",
            system_message=system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        user_msg = UserMessage(text=message.message)
        response = await chat.send_message(user_msg)
        
        return ChatResponse(response=response)
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return ChatResponse(response="I'm having trouble thinking right now. Let's try again in a moment!")

@api_router.post("/ai/tip")
async def get_financial_tip(tip_request: FinancialTipRequest, request: Request):
    """Get an AI-generated financial tip based on grade level"""
    user = await get_current_user(request)
    grade = tip_request.grade
    topic = tip_request.topic or "general money management"
    
    grade_topics = {
        0: ["saving coins", "wants vs needs", "piggy banks"],
        1: ["counting money", "making change", "earning money"],
        2: ["adding money", "planning purchases", "saving goals"],
        3: ["percentages", "short vs long term goals", "investing basics"],
        4: ["interest", "savings accounts", "budgeting"],
        5: ["credit", "compound interest", "diversification"]
    }
    
    suggested_topics = grade_topics.get(grade, grade_topics[3])
    
    system_message = f"""You are a financial education expert for grade {grade} students. 
    Generate a single, engaging financial tip about {topic}. 
    The tip should be age-appropriate, fun, and educational.
    Include a simple emoji at the start.
    Keep it under 2-3 sentences for younger kids (K-2) and 3-4 sentences for older kids (3-5)."""
    
    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"tip_{uuid.uuid4().hex[:8]}",
            system_message=system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        user_msg = UserMessage(text=f"Give me a tip about {topic} for a grade {grade} student.")
        response = await chat.send_message(user_msg)
        
        return {"tip": response, "suggested_topics": suggested_topics}
    except Exception as e:
        logger.error(f"AI tip error: {e}")
        return {"tip": "Save a little bit every day and watch your money grow! 🌱", "suggested_topics": suggested_topics}

# ============== LEARNING CONTENT ROUTES ==============

@api_router.get("/learn/topics")
async def get_learning_topics(request: Request):
    """Get all learning topics for user's grade"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    topics = await db.learning_topics.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get user's progress for each topic
    for topic in topics:
        lessons = await db.learning_lessons.find(
            {"topic_id": topic["topic_id"]},
            {"_id": 0}
        ).to_list(100)
        
        completed = await db.user_lesson_progress.count_documents({
            "user_id": user["user_id"],
            "lesson_id": {"$in": [l["lesson_id"] for l in lessons]},
            "completed": True
        })
        
        topic["total_lessons"] = len(lessons)
        topic["completed_lessons"] = completed
    
    return topics

@api_router.get("/learn/topics/{topic_id}")
async def get_topic_details(topic_id: str, request: Request):
    """Get a specific topic with its lessons"""
    user = await get_current_user(request)
    
    topic = await db.learning_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    grade = user.get("grade", 3) or 3
    lessons = await db.learning_lessons.find(
        {
            "topic_id": topic_id,
            "min_grade": {"$lte": grade},
            "max_grade": {"$gte": grade}
        },
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Add progress info
    for lesson in lessons:
        progress = await db.user_lesson_progress.find_one({
            "user_id": user["user_id"],
            "lesson_id": lesson["lesson_id"]
        }, {"_id": 0})
        lesson["completed"] = progress["completed"] if progress else False
        lesson["score"] = progress.get("score") if progress else None
    
    return {"topic": topic, "lessons": lessons}

@api_router.get("/learn/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, request: Request):
    """Get a specific lesson"""
    user = await get_current_user(request)
    
    lesson = await db.learning_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
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
    
    # Get quiz if exists
    quiz = await db.quizzes.find_one({"lesson_id": lesson_id}, {"_id": 0})
    
    return {"lesson": lesson, "quiz": quiz}

@api_router.post("/learn/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, request: Request):
    """Mark a lesson as completed and earn reward"""
    user = await get_current_user(request)
    
    lesson = await db.learning_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Check if already completed
    progress = await db.user_lesson_progress.find_one({
        "user_id": user["user_id"],
        "lesson_id": lesson_id
    })
    
    if progress and progress.get("completed"):
        return {"message": "Lesson already completed", "reward": 0}
    
    # Update or create progress
    if progress:
        await db.user_lesson_progress.update_one(
            {"user_id": user["user_id"], "lesson_id": lesson_id},
            {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.user_lesson_progress.insert_one({
            "id": f"ulp_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "lesson_id": lesson_id,
            "completed": True,
            "score": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Award coins
    reward = lesson.get("reward_coins", 5)
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": reward,
        "transaction_type": "reward",
        "description": f"Completed lesson: {lesson['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Lesson completed!", "reward": reward}

@api_router.post("/learn/quiz/submit")
async def submit_quiz(submission: QuizSubmission, request: Request):
    """Submit quiz answers and get results"""
    user = await get_current_user(request)
    
    quiz = await db.quizzes.find_one({"quiz_id": submission.quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Calculate score
    questions = quiz["questions"]
    correct = 0
    results = []
    
    for i, answer in enumerate(submission.answers):
        if i < len(questions):
            is_correct = answer == questions[i]["correct_answer"]
            if is_correct:
                correct += 1
            results.append({
                "question": questions[i]["question"],
                "your_answer": answer,
                "correct_answer": questions[i]["correct_answer"],
                "is_correct": is_correct,
                "explanation": questions[i].get("explanation", "")
            })
    
    score = int((correct / len(questions)) * 100) if questions else 0
    passed = score >= quiz.get("passing_score", 70)
    
    # Update lesson progress with score
    await db.user_lesson_progress.update_one(
        {"user_id": user["user_id"], "lesson_id": quiz["lesson_id"]},
        {"$set": {"score": score, "completed": passed, "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Award bonus if passed
    bonus = 10 if passed else 0
    if bonus:
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "spending"},
            {"$inc": {"balance": bonus}}
        )
    
    return {
        "score": score,
        "passed": passed,
        "correct": correct,
        "total": len(questions),
        "results": results,
        "bonus_coins": bonus
    }

@api_router.get("/learn/books")
async def get_books(request: Request):
    """Get books for user's grade"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    books = await db.books.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    return books

@api_router.get("/learn/activities")
async def get_activities(request: Request):
    """Get activities for user's grade"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    activities = await db.activities.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    
    # Get completed activities
    completed = await db.user_activity_progress.find(
        {"user_id": user["user_id"], "completed": True},
        {"_id": 0}
    ).to_list(100)
    completed_ids = {c["activity_id"] for c in completed}
    
    for activity in activities:
        activity["completed"] = activity["activity_id"] in completed_ids
    
    return activities

@api_router.post("/learn/activities/{activity_id}/complete")
async def complete_activity(activity_id: str, request: Request):
    """Mark an activity as completed"""
    user = await get_current_user(request)
    
    activity = await db.activities.find_one({"activity_id": activity_id}, {"_id": 0})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Check if already completed
    existing = await db.user_activity_progress.find_one({
        "user_id": user["user_id"],
        "activity_id": activity_id
    })
    
    if existing and existing.get("completed"):
        return {"message": "Activity already completed", "reward": 0}
    
    # Mark complete
    if existing:
        await db.user_activity_progress.update_one(
            {"user_id": user["user_id"], "activity_id": activity_id},
            {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.user_activity_progress.insert_one({
            "id": f"uap_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "activity_id": activity_id,
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Award coins
    reward = activity.get("reward_coins", 10)
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    return {"message": "Activity completed!", "reward": reward}

@api_router.get("/learn/progress")
async def get_learning_progress(request: Request):
    """Get overall learning progress for user"""
    user = await get_current_user(request)
    
    # Get total and completed lessons
    total_lessons = await db.learning_lessons.count_documents({})
    completed_lessons = await db.user_lesson_progress.count_documents({
        "user_id": user["user_id"],
        "completed": True
    })
    
    # Get completed activities
    total_activities = await db.activities.count_documents({})
    completed_activities = await db.user_activity_progress.count_documents({
        "user_id": user["user_id"],
        "completed": True
    })
    
    # Get topic progress
    topics = await db.learning_topics.find({}, {"_id": 0}).to_list(100)
    topic_progress = []
    
    for topic in topics:
        lessons = await db.learning_lessons.find({"topic_id": topic["topic_id"]}).to_list(100)
        lesson_ids = [l["lesson_id"] for l in lessons]
        completed = await db.user_lesson_progress.count_documents({
            "user_id": user["user_id"],
            "lesson_id": {"$in": lesson_ids},
            "completed": True
        })
        topic_progress.append({
            "topic_id": topic["topic_id"],
            "title": topic["title"],
            "total": len(lessons),
            "completed": completed
        })
    
    return {
        "lessons": {"total": total_lessons, "completed": completed_lessons},
        "activities": {"total": total_activities, "completed": completed_activities},
        "topics": topic_progress
    }

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/users")
async def admin_get_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, request: Request):
    """Update user role (admin only)"""
    await require_admin(request)
    
    body = await request.json()
    new_role = body.get("role")
    
    if new_role not in ["child", "parent", "teacher", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": new_role}}
    )
    
    return {"message": "Role updated"}

@api_router.post("/admin/topics")
async def admin_create_topic(request: Request):
    """Create a learning topic (admin only)"""
    admin = await require_admin(request)
    body = await request.json()
    
    topic = {
        "topic_id": f"topic_{uuid.uuid4().hex[:12]}",
        "title": body["title"],
        "description": body["description"],
        "category": body["category"],
        "icon": body.get("icon", "📚"),
        "order": body.get("order", 0),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.learning_topics.insert_one(topic)
    return {"message": "Topic created", "topic_id": topic["topic_id"]}

@api_router.put("/admin/topics/{topic_id}")
async def admin_update_topic(topic_id: str, request: Request):
    """Update a learning topic (admin only)"""
    await require_admin(request)
    body = await request.json()
    
    update_data = {k: v for k, v in body.items() if v is not None}
    
    await db.learning_topics.update_one(
        {"topic_id": topic_id},
        {"$set": update_data}
    )
    
    return {"message": "Topic updated"}

@api_router.delete("/admin/topics/{topic_id}")
async def admin_delete_topic(topic_id: str, request: Request):
    """Delete a learning topic (admin only)"""
    await require_admin(request)
    
    await db.learning_topics.delete_one({"topic_id": topic_id})
    await db.learning_lessons.delete_many({"topic_id": topic_id})
    
    return {"message": "Topic and associated lessons deleted"}

@api_router.post("/admin/lessons")
async def admin_create_lesson(lesson: LessonCreate, request: Request):
    """Create a lesson (admin only)"""
    admin = await require_admin(request)
    
    lesson_doc = {
        "lesson_id": f"lesson_{uuid.uuid4().hex[:12]}",
        "topic_id": lesson.topic_id,
        "title": lesson.title,
        "content": lesson.content,
        "lesson_type": lesson.lesson_type,
        "media_url": lesson.media_url,
        "duration_minutes": lesson.duration_minutes,
        "order": lesson.order,
        "min_grade": lesson.min_grade,
        "max_grade": lesson.max_grade,
        "reward_coins": lesson.reward_coins,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.learning_lessons.insert_one(lesson_doc)
    return {"message": "Lesson created", "lesson_id": lesson_doc["lesson_id"]}

@api_router.put("/admin/lessons/{lesson_id}")
async def admin_update_lesson(lesson_id: str, lesson: LessonUpdate, request: Request):
    """Update a lesson (admin only)"""
    await require_admin(request)
    
    update_data = {k: v for k, v in lesson.model_dump().items() if v is not None}
    
    await db.learning_lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": update_data}
    )
    
    return {"message": "Lesson updated"}

@api_router.delete("/admin/lessons/{lesson_id}")
async def admin_delete_lesson(lesson_id: str, request: Request):
    """Delete a lesson (admin only)"""
    await require_admin(request)
    
    await db.learning_lessons.delete_one({"lesson_id": lesson_id})
    await db.quizzes.delete_many({"lesson_id": lesson_id})
    
    return {"message": "Lesson deleted"}

@api_router.post("/admin/quizzes")
async def admin_create_quiz(quiz: QuizCreate, request: Request):
    """Create a quiz for a lesson (admin only)"""
    admin = await require_admin(request)
    
    quiz_doc = {
        "quiz_id": f"quiz_{uuid.uuid4().hex[:12]}",
        "lesson_id": quiz.lesson_id,
        "title": quiz.title,
        "questions": quiz.questions,
        "passing_score": quiz.passing_score,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.quizzes.insert_one(quiz_doc)
    return {"message": "Quiz created", "quiz_id": quiz_doc["quiz_id"]}

@api_router.post("/admin/books")
async def admin_create_book(book: BookCreate, request: Request):
    """Create a book (admin only)"""
    admin = await require_admin(request)
    
    book_doc = {
        "book_id": f"book_{uuid.uuid4().hex[:12]}",
        "title": book.title,
        "author": book.author,
        "description": book.description,
        "cover_url": book.cover_url,
        "content_url": book.content_url,
        "category": book.category,
        "min_grade": book.min_grade,
        "max_grade": book.max_grade,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.books.insert_one(book_doc)
    return {"message": "Book created", "book_id": book_doc["book_id"]}

@api_router.delete("/admin/books/{book_id}")
async def admin_delete_book(book_id: str, request: Request):
    """Delete a book (admin only)"""
    await require_admin(request)
    
    await db.books.delete_one({"book_id": book_id})
    return {"message": "Book deleted"}

@api_router.post("/admin/activities")
async def admin_create_activity(activity: ActivityCreate, request: Request):
    """Create an activity (admin only)"""
    admin = await require_admin(request)
    
    activity_doc = {
        "activity_id": f"activity_{uuid.uuid4().hex[:12]}",
        "title": activity.title,
        "description": activity.description,
        "instructions": activity.instructions,
        "activity_type": activity.activity_type,
        "topic_id": activity.topic_id,
        "resource_url": activity.resource_url,
        "min_grade": activity.min_grade,
        "max_grade": activity.max_grade,
        "reward_coins": activity.reward_coins,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.activities.insert_one(activity_doc)
    return {"message": "Activity created", "activity_id": activity_doc["activity_id"]}

@api_router.delete("/admin/activities/{activity_id}")
async def admin_delete_activity(activity_id: str, request: Request):
    """Delete an activity (admin only)"""
    await require_admin(request)
    
    await db.activities.delete_one({"activity_id": activity_id})
    return {"message": "Activity deleted"}

@api_router.get("/admin/stats")
async def admin_get_stats(request: Request):
    """Get platform statistics (admin only)"""
    await require_admin(request)
    
    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "children": await db.users.count_documents({"role": "child"}),
            "parents": await db.users.count_documents({"role": "parent"}),
            "teachers": await db.users.count_documents({"role": "teacher"}),
            "admins": await db.users.count_documents({"role": "admin"})
        },
        "content": {
            "topics": await db.learning_topics.count_documents({}),
            "lessons": await db.learning_lessons.count_documents({}),
            "books": await db.books.count_documents({}),
            "activities": await db.activities.count_documents({}),
            "quizzes": await db.quizzes.count_documents({})
        },
        "engagement": {
            "lessons_completed": await db.user_lesson_progress.count_documents({"completed": True}),
            "activities_completed": await db.user_activity_progress.count_documents({"completed": True}),
            "quests_completed": await db.user_quests.count_documents({"completed": True})
        }
    }
    
    return stats

# ============== SEED DATA ROUTE ==============

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for store, achievements, and quests"""
    
    # Store Items
    store_items = [
        {"item_id": "item_001", "name": "Cool Sunglasses", "description": "Stylish shades for your avatar", "price": 25, "category": "avatar", "image_url": "🕶️", "min_grade": 0, "max_grade": 5},
        {"item_id": "item_002", "name": "Super Cape", "description": "A heroic cape for your avatar", "price": 50, "category": "avatar", "image_url": "🦸", "min_grade": 0, "max_grade": 5},
        {"item_id": "item_003", "name": "Extra Game Time", "description": "5 more minutes of games!", "price": 30, "category": "privilege", "image_url": "🎮", "min_grade": 0, "max_grade": 5},
        {"item_id": "item_004", "name": "Golden Crown", "description": "A royal crown for top savers", "price": 100, "category": "avatar", "image_url": "👑", "min_grade": 0, "max_grade": 5},
        {"item_id": "item_005", "name": "Pet Dragon", "description": "A cute dragon companion", "price": 150, "category": "avatar", "image_url": "🐉", "min_grade": 2, "max_grade": 5},
        {"item_id": "item_006", "name": "Math Wizard Wand", "description": "A magical learning wand", "price": 75, "category": "avatar", "image_url": "🪄", "min_grade": 1, "max_grade": 5},
        {"item_id": "item_007", "name": "Space Helmet", "description": "Explore the money galaxy", "price": 80, "category": "avatar", "image_url": "🚀", "min_grade": 3, "max_grade": 5},
        {"item_id": "item_008", "name": "Rainbow Wings", "description": "Colorful wings to fly high", "price": 120, "category": "avatar", "image_url": "🌈", "min_grade": 0, "max_grade": 5},
    ]
    
    # Achievements
    achievements = [
        {"achievement_id": "ach_001", "name": "First Saver", "description": "Save your first coin!", "icon": "🐷", "category": "savings", "requirement_value": 1, "points": 10},
        {"achievement_id": "ach_002", "name": "Super Saver", "description": "Save 100 coins in your savings", "icon": "💰", "category": "savings", "requirement_value": 100, "points": 25},
        {"achievement_id": "ach_003", "name": "Investor Newbie", "description": "Make your first investment", "icon": "🌱", "category": "investing", "requirement_value": 1, "points": 15},
        {"achievement_id": "ach_004", "name": "Week Warrior", "description": "Login 7 days in a row", "icon": "🔥", "category": "streak", "requirement_value": 7, "points": 30},
        {"achievement_id": "ach_005", "name": "Month Master", "description": "Login 30 days in a row", "icon": "⭐", "category": "streak", "requirement_value": 30, "points": 100},
        {"achievement_id": "ach_006", "name": "Quest Champion", "description": "Complete 5 quests", "icon": "🏆", "category": "learning", "requirement_value": 5, "points": 40},
        {"achievement_id": "ach_007", "name": "Generous Heart", "description": "Give 50 coins to charity", "icon": "❤️", "category": "giving", "requirement_value": 50, "points": 35},
        {"achievement_id": "ach_008", "name": "Money Master", "description": "Reach a total balance of 500", "icon": "🎓", "category": "savings", "requirement_value": 500, "points": 75},
    ]
    
    # Quests
    quests = [
        {"quest_id": "quest_001", "title": "Piggy Bank Starter", "description": "Move 10 coins to your savings account", "reward_amount": 5, "quest_type": "daily", "min_grade": 0, "max_grade": 5, "requirements": {"action": "save", "amount": 10}},
        {"quest_id": "quest_002", "title": "Smart Shopper", "description": "Compare prices and find the better deal", "reward_amount": 10, "quest_type": "daily", "min_grade": 1, "max_grade": 5, "requirements": {"action": "compare", "count": 1}},
        {"quest_id": "quest_003", "title": "Garden Grower", "description": "Plant your first money garden", "reward_amount": 15, "quest_type": "challenge", "min_grade": 0, "max_grade": 2, "requirements": {"action": "invest", "type": "garden"}},
        {"quest_id": "quest_004", "title": "Stock Star", "description": "Buy your first stock", "reward_amount": 20, "quest_type": "challenge", "min_grade": 3, "max_grade": 5, "requirements": {"action": "invest", "type": "stock"}},
        {"quest_id": "quest_005", "title": "Giving is Caring", "description": "Donate 5 coins to the giving jar", "reward_amount": 8, "quest_type": "daily", "min_grade": 0, "max_grade": 5, "requirements": {"action": "give", "amount": 5}},
        {"quest_id": "quest_006", "title": "Budget Boss", "description": "Split your earnings into all 4 accounts", "reward_amount": 15, "quest_type": "weekly", "min_grade": 2, "max_grade": 5, "requirements": {"action": "distribute", "accounts": 4}},
        {"quest_id": "quest_007", "title": "Chat Champion", "description": "Ask your AI buddy a money question", "reward_amount": 5, "quest_type": "daily", "min_grade": 0, "max_grade": 5, "requirements": {"action": "chat", "count": 1}},
        {"quest_id": "quest_008", "title": "Savings Goal Setter", "description": "Set and reach a savings goal of 50 coins", "reward_amount": 25, "quest_type": "weekly", "min_grade": 1, "max_grade": 5, "requirements": {"action": "save_goal", "amount": 50}},
    ]
    
    # Clear and insert
    await db.store_items.delete_many({})
    await db.achievements.delete_many({})
    await db.quests.delete_many({})
    
    if store_items:
        await db.store_items.insert_many(store_items)
    if achievements:
        await db.achievements.insert_many(achievements)
    if quests:
        await db.quests.insert_many(quests)
    
    return {"message": "Seed data created successfully"}

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "PocketQuest API - Financial Literacy for Kids"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
