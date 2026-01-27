from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import shutil
import zipfile
import random
import pytz
from contextlib import asynccontextmanager
from emergentintegrations.llm.chat import LlmChat, UserMessage
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directories
UPLOADS_DIR = ROOT_DIR / "uploads"
THUMBNAILS_DIR = UPLOADS_DIR / "thumbnails"
PDFS_DIR = UPLOADS_DIR / "pdfs"
ACTIVITIES_DIR = UPLOADS_DIR / "activities"
VIDEOS_DIR = UPLOADS_DIR / "videos"
STORE_IMAGES_DIR = UPLOADS_DIR / "store"
INVESTMENT_IMAGES_DIR = UPLOADS_DIR / "investments"
QUEST_ASSETS_DIR = UPLOADS_DIR / "quests"

for dir_path in [UPLOADS_DIR, THUMBNAILS_DIR, PDFS_DIR, ACTIVITIES_DIR, VIDEOS_DIR, STORE_IMAGES_DIR, INVESTMENT_IMAGES_DIR, QUEST_ASSETS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mount static files for uploads under /api/uploads so it's accessible through the proxy
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

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
    account_type: str  # 'spending', 'savings', 'investing', 'gifting'
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

# New Quest System Models
class QuestQuestion(BaseModel):
    """A single question in a quest"""
    question_id: str
    question_text: str
    question_type: str  # 'mcq', 'multi_select', 'true_false', 'value'
    image_url: Optional[str] = None
    options: Optional[List[str]] = None  # For MCQ/multi-select
    correct_answer: Any  # String for MCQ/TF, List for multi-select, number for value
    points: float  # Rupees for this question

class QuestCreate(BaseModel):
    """Create a new quest (admin/teacher)"""
    title: str
    description: str = ""
    image_url: Optional[str] = None
    pdf_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5
    due_date: str  # ISO date string (YYYY-MM-DD)
    reward_amount: float = 0  # Base reward for quests without questions
    questions: List[Dict[str, Any]] = []  # List of questions (optional)

class ChoreCreate(BaseModel):
    """Create a new chore (parent)"""
    child_id: str
    title: str
    description: Optional[str] = None
    reward_amount: float
    frequency: str  # 'one_time', 'daily', 'weekly', 'monthly_date'
    weekly_days: Optional[List[int]] = None  # 0=Mon, 6=Sun for weekly
    monthly_date: Optional[int] = None  # Day of month for monthly_date

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

# ============== LEARNING CONTENT MODELS (NEW HIERARCHICAL STRUCTURE) ==============

class ContentTopic(BaseModel):
    """Topic or Subtopic - supports hierarchy via parent_id"""
    model_config = ConfigDict(extra="ignore")
    topic_id: str
    title: str
    description: str
    parent_id: Optional[str] = None  # null = parent topic, string = subtopic
    thumbnail: Optional[str] = None  # URL to thumbnail image
    order: int = 0  # For sorting
    min_grade: int = 0
    max_grade: int = 5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class TopicCreate(BaseModel):
    title: str
    description: str
    parent_id: Optional[str] = None
    thumbnail: Optional[str] = None
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5

class TopicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    thumbnail: Optional[str] = None
    order: Optional[int] = None
    min_grade: Optional[int] = None
    max_grade: Optional[int] = None

class ContentItem(BaseModel):
    """Generic content item - can be worksheet, activity, book, workbook, or video"""
    model_config = ConfigDict(extra="ignore")
    content_id: str
    topic_id: str  # Links to topic or subtopic
    title: str
    description: str
    content_type: str  # 'worksheet', 'activity', 'book', 'workbook', 'video'
    thumbnail: Optional[str] = None  # URL to thumbnail image
    order: int = 0  # For sorting within topic
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5
    is_published: bool = False  # Toggle for live/draft status
    # Type-specific fields
    content_data: Dict[str, Any] = {}  # Stores type-specific data
    # For worksheets: { "pdf_url": "", "instructions": "" }
    # For activities: { "html_url": "", "html_folder": "", "instructions": "" }
    # For books: { "author": "", "cover_url": "", "content_url": "" }
    # For workbooks: { "pdf_url": "", "page_count": 0 }
    # For videos: { "video_url": "", "duration_minutes": 0 }
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class ContentItemCreate(BaseModel):
    topic_id: str
    title: str
    description: str
    content_type: str
    thumbnail: Optional[str] = None
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5
    is_published: bool = False
    content_data: Dict[str, Any] = {}
    visible_to: List[str] = ["child"]  # ['child', 'parent', 'teacher']

class ContentItemUpdate(BaseModel):
    topic_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    thumbnail: Optional[str] = None
    order: Optional[int] = None
    min_grade: Optional[int] = None
    max_grade: Optional[int] = None
    reward_coins: Optional[int] = None
    is_published: Optional[bool] = None
    content_data: Optional[Dict[str, Any]] = None
    visible_to: Optional[List[str]] = None

class UserContentProgress(BaseModel):
    """Track user progress on any content item"""
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    content_id: str
    completed: bool = False
    score: Optional[int] = None  # For quizzes
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ReorderRequest(BaseModel):
    """Request to reorder items"""
    items: List[Dict[str, Any]]  # [{"id": "xxx", "order": 1}, ...]

# Legacy models kept for backward compatibility
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

# ============== TEACHER/CLASSROOM MODELS ==============

class Classroom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    classroom_id: str
    teacher_id: str
    name: str
    description: Optional[str] = None
    grade_level: int
    invite_code: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    grade_level: int

class ClassroomStudent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    classroom_id: str
    student_id: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClassroomReward(BaseModel):
    student_ids: List[str]
    amount: float
    reason: str

class ClassroomChallenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    challenge_id: str
    classroom_id: str
    title: str
    description: str
    reward_amount: float
    deadline: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeCreate(BaseModel):
    title: str
    description: str
    reward_amount: float
    deadline: Optional[str] = None

# ============== PARENT MODELS ==============

class ParentChildLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    link_id: str
    parent_id: str
    child_id: str
    status: str = "pending"  # pending, active
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LinkChildRequest(BaseModel):
    child_email: str

class Chore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chore_id: str
    parent_id: str
    child_id: str
    title: str
    description: Optional[str] = None
    reward_amount: float
    frequency: str = "once"  # once, daily, weekly
    status: str = "pending"  # pending, completed, approved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

# ChoreCreate model is defined earlier in the file (line ~169) with weekly_days and monthly_date fields

class Allowance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    allowance_id: str
    parent_id: str
    child_id: str
    amount: float
    frequency: str  # weekly, biweekly, monthly
    next_date: str
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AllowanceCreate(BaseModel):
    child_id: str
    amount: float
    frequency: str

# ============== SHOPPING LIST MODELS ==============

class ShoppingListItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    list_id: str
    parent_id: str
    child_id: str
    item_id: str
    item_name: str
    item_price: float
    quantity: int = 1
    image_url: Optional[str] = None
    status: str = "pending"  # pending, assigned, purchased
    chore_id: Optional[str] = None  # linked chore if assigned
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListItemCreate(BaseModel):
    child_id: str
    item_id: str
    quantity: int = 1

class ShoppingListChoreCreate(BaseModel):
    child_id: str
    list_item_ids: List[str]  # IDs of shopping list items to include
    title: str
    description: Optional[str] = None
    reward_amount: float  # Custom reward amount set by parent

class SavingsGoal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    goal_id: str
    child_id: str
    parent_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    current_amount: float = 0
    deadline: Optional[str] = None
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SavingsGoalCreate(BaseModel):
    child_id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    deadline: Optional[str] = None

class ChildSavingsGoalCreate(BaseModel):
    """For children to create their own savings goals"""
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    deadline: Optional[str] = None

# ============== ADMIN STORE MANAGEMENT MODELS ==============

class StoreCategory(BaseModel):
    """Store category like Vegetable Market, Toy Store, etc."""
    model_config = ConfigDict(extra="ignore")
    category_id: str
    name: str
    description: str
    icon: str  # Emoji icon for display
    color: str  # Hex color for styling
    image_url: Optional[str] = None
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StoreCategoryCreate(BaseModel):
    name: str
    description: str
    icon: str = "🛒"
    color: str = "#3D5A80"
    image_url: Optional[str] = None
    order: int = 0
    is_active: bool = True

class StoreCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    image_url: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

class StoreItem(BaseModel):
    """Store item that users can purchase"""
    model_config = ConfigDict(extra="ignore")
    item_id: str
    category_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None
    min_grade: int = 0  # Minimum grade to see this item
    max_grade: int = 5  # Maximum grade to see this item
    stock: int = -1  # -1 means unlimited
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StoreItemCreate(BaseModel):
    category_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None
    unit: str = "piece"  # piece, kg, gram, litre, ml, pack, dozen
    min_grade: int = 0
    max_grade: int = 5
    stock: int = -1
    is_active: bool = True

class StoreItemUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    unit: Optional[str] = None
    min_grade: Optional[int] = None
    max_grade: Optional[int] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None

# ============== ADMIN INVESTMENT MANAGEMENT MODELS ==============

class InvestmentPlant(BaseModel):
    """Plants for Grade 1-2 (Money Garden) - Admin configured seeds"""
    model_config = ConfigDict(extra="ignore")
    plant_id: str
    name: str
    emoji: str  # e.g., 🍅, 🌻, 🥕
    description: str
    image_url: Optional[str] = None
    seed_cost: float  # Cost to buy one seed
    growth_days: int  # Days to fully mature
    harvest_yield: int  # How many items produced
    yield_unit: str  # 'pieces', 'kg', 'bunch', 'dozen', 'flowers'
    base_sell_price: float  # Base price per unit at market
    price_fluctuation_percent: float = 10.0  # Market price can fluctuate ±10%
    water_frequency_hours: int = 24  # How often needs watering (in hours)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentPlantCreate(BaseModel):
    name: str
    emoji: str = "🌱"
    description: str
    image_url: Optional[str] = None
    seed_cost: float
    growth_days: int = 5
    harvest_yield: int = 10
    yield_unit: str = "pieces"
    base_sell_price: float
    price_fluctuation_percent: float = 10.0
    water_frequency_hours: int = 24
    is_active: bool = True

class InvestmentPlantUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    seed_cost: Optional[float] = None
    growth_days: Optional[int] = None
    harvest_yield: Optional[int] = None
    yield_unit: Optional[str] = None
    base_sell_price: Optional[float] = None
    price_fluctuation_percent: Optional[float] = None
    water_frequency_hours: Optional[int] = None
    is_active: Optional[bool] = None

# ============== MONEY GARDEN MODELS (Grade 1-2) ==============

class FarmPlot(BaseModel):
    """A single plot in child's farm grid"""
    model_config = ConfigDict(extra="ignore")
    plot_id: str
    user_id: str
    position: int  # 0-based position in grid
    plant_id: Optional[str] = None  # Currently planted seed
    plant_name: Optional[str] = None
    plant_emoji: Optional[str] = None
    planted_at: Optional[str] = None
    last_watered: Optional[str] = None
    growth_days_total: int = 0
    growth_progress: float = 0  # 0-100%
    status: str = "empty"  # empty, growing, water_needed, wilting, ready, dead
    is_active: bool = True

class PlantSeedRequest(BaseModel):
    plot_id: str
    plant_id: str

class HarvestInventory(BaseModel):
    """Child's harvested produce inventory"""
    model_config = ConfigDict(extra="ignore")
    inventory_id: str
    user_id: str
    plant_id: str
    plant_name: str
    plant_emoji: str
    quantity: int
    yield_unit: str
    harvested_at: str

class MarketPrices(BaseModel):
    """Daily market prices for produce"""
    model_config = ConfigDict(extra="ignore")
    price_id: str
    plant_id: str
    current_price: float
    base_price: float
    fluctuation_percent: float
    date: str  # YYYY-MM-DD
    is_market_open: bool = True

class InvestmentStock(BaseModel):
    """Stocks for grades 3-5 (Stock Market)"""
    model_config = ConfigDict(extra="ignore")
    stock_id: str
    name: str  # Company name
    ticker: str  # Stock ticker symbol (e.g., "TCO" for TechCo)
    description: str
    logo_url: Optional[str] = None
    category_id: Optional[str] = None  # Industry category (optional)
    current_price: float  # Current price per share
    base_price: float  # Original/base price for reference
    volatility: float = 0.05  # Daily volatility (5% means ±5% daily change)
    min_lot_size: int = 1  # Minimum shares to buy (1, 3, 5, or 10)
    # Educational fields
    what_they_do: str = ""  # Simple explanation of what the company does
    why_price_changes: str = ""  # Educational note about price factors
    risk_level: str = "medium"  # low, medium, high
    dividend_yield: float = 0.0  # Annual dividend percentage
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_price_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentStockCreate(BaseModel):
    name: str
    ticker: str
    description: str
    category_id: Optional[str] = None  # Made optional
    logo_url: Optional[str] = None
    base_price: float
    volatility: float = 0.05
    min_lot_size: int = 1
    what_they_do: str = ""
    why_price_changes: str = ""
    risk_level: str = "medium"
    dividend_yield: float = 0.0
    is_active: bool = True

class InvestmentStockUpdate(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    logo_url: Optional[str] = None
    base_price: Optional[float] = None
    current_price: Optional[float] = None
    volatility: Optional[float] = None
    min_lot_size: Optional[int] = None
    what_they_do: Optional[str] = None
    why_price_changes: Optional[str] = None
    risk_level: Optional[str] = None
    dividend_yield: Optional[float] = None
    is_active: Optional[bool] = None

# ============== STOCK MARKET MODELS (Grade 3-5) ==============

class StockCategory(BaseModel):
    """Industry categories for stocks"""
    model_config = ConfigDict(extra="ignore")
    category_id: str
    name: str  # e.g., "Technology", "Healthcare", "Food & Beverages"
    emoji: str  # e.g., "💻", "🏥", "🍔"
    description: str  # Educational description of the industry
    color: str = "#3B82F6"  # Display color
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockCategoryCreate(BaseModel):
    name: str
    emoji: str = "📈"
    description: str
    color: str = "#3B82F6"

class StockNews(BaseModel):
    """News events that affect stock prices"""
    model_config = ConfigDict(extra="ignore")
    news_id: str
    title: str  # News headline
    description: str  # Full news story
    category_id: Optional[str] = None  # Affects specific industry (None = affects all)
    stock_id: Optional[str] = None  # Affects specific stock (overrides category)
    impact_type: str  # 'positive', 'negative', 'neutral'
    impact_percent: float  # How much it affects price (e.g., 5.0 = +5% or -5%)
    is_prediction: bool = False  # If True, this is a prediction (may not come true)
    prediction_accuracy: float = 0.7  # 70% chance of coming true
    prediction_target_price: Optional[float] = None  # Target price for prediction
    prediction_target_date: Optional[str] = None  # YYYY-MM-DD
    effective_date: str  # YYYY-MM-DD - when news takes effect
    expires_date: Optional[str] = None  # When the effect ends
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockNewsCreate(BaseModel):
    title: str
    description: str
    category_id: Optional[str] = None
    stock_id: Optional[str] = None
    impact_type: str = "neutral"
    impact_percent: float = 5.0
    is_prediction: bool = False
    prediction_accuracy: float = 0.7
    prediction_target_price: Optional[float] = None
    prediction_target_date: Optional[str] = None
    effective_date: str
    expires_date: Optional[str] = None

class StockPriceHistory(BaseModel):
    """Detailed price history for charts"""
    model_config = ConfigDict(extra="ignore")
    history_id: str
    stock_id: str
    open_price: float
    close_price: float
    high_price: float
    low_price: float
    volume: int = 0  # Trading volume
    date: str  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserStockHolding(BaseModel):
    """User's stock holdings"""
    model_config = ConfigDict(extra="ignore")
    holding_id: str
    user_id: str
    stock_id: str
    quantity: int
    average_buy_price: float  # Weighted average purchase price
    total_invested: float  # Total amount invested
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockTransaction(BaseModel):
    """Stock buy/sell transactions"""
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    user_id: str
    stock_id: str
    transaction_type: str  # 'buy' or 'sell'
    quantity: int
    price_per_share: float
    total_amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PortfolioSnapshot(BaseModel):
    """Daily portfolio value snapshot for charts"""
    model_config = ConfigDict(extra="ignore")
    snapshot_id: str
    user_id: str
    total_value: float  # Total portfolio value
    total_invested: float  # Total amount invested
    profit_loss: float  # Current P/L
    profit_loss_percent: float
    date: str  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BuyStockRequest(BaseModel):
    stock_id: str
    quantity: int

class SellStockRequest(BaseModel):
    stock_id: str
    quantity: int

class PriceHistory(BaseModel):
    """Track daily price history for stocks"""
    model_config = ConfigDict(extra="ignore")
    history_id: str
    stock_id: str
    price: float
    date: str  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInvestmentHolding(BaseModel):
    """User's investment holdings (plants or stocks)"""
    model_config = ConfigDict(extra="ignore")
    holding_id: str
    user_id: str
    investment_type: str  # 'plant' or 'stock'
    asset_id: str  # plant_id or stock_id
    quantity: float  # Number of seeds/shares
    purchase_price: float  # Price at time of purchase
    purchase_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BuyInvestmentRequest(BaseModel):
    investment_type: str  # 'plant' or 'stock'
    asset_id: str
    quantity: int

class SellInvestmentRequest(BaseModel):
    holding_id: str
    quantity: Optional[int] = None  # If None, sell all

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

async def require_teacher(request: Request) -> dict:
    """Require teacher role"""
    user = await get_current_user(request)
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user

async def require_parent(request: Request) -> dict:
    """Require parent role"""
    user = await get_current_user(request)
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    return user

import random
import string

def generate_invite_code():
    """Generate a 6-character invite code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ============== AUTH ROUTES ==============

class AdminLoginRequest(BaseModel):
    email: str
    password: str

@api_router.post("/auth/admin-login")
async def admin_login(login_data: AdminLoginRequest, response: Response):
    """Admin login with email and password"""
    # Fixed admin credentials
    ADMIN_EMAIL = "admin@learnersplanet.com"
    ADMIN_PASSWORD = "finlit@2026"
    
    if login_data.email != ADMIN_EMAIL:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if login_data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if admin user exists
    admin_user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    
    if not admin_user:
        # Create admin user
        user_id = f"admin_{uuid.uuid4().hex[:12]}"
        admin_user = {
            "user_id": user_id,
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "picture": None,
            "role": "admin",
            "grade": None,
            "avatar": None,
            "streak_count": 0,
            "last_login_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        admin_user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    else:
        # Ensure user has admin role
        if admin_user.get("role") != "admin":
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"role": "admin"}}
            )
            admin_user["role"] = "admin"
    
    # Create session
    session_token = f"admin_sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": admin_user["user_id"],
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
    
    return {"user": admin_user, "session_token": session_token}

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
        for account_type in ['spending', 'savings', 'investing', 'gifting']:
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
    
    # Parents cannot purchase - they can only add to shopping list
    if user.get("role") == "parent":
        raise HTTPException(status_code=403, detail="Parents cannot purchase items directly. Please add items to your shopping list instead.")
    
    # Check in admin_store_items (the new admin-created items)
    item = await db.admin_store_items.find_one({"item_id": purchase.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check if item is active
    if not item.get("is_active", True):
        raise HTTPException(status_code=400, detail="Item is not available")
    
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
    
    # Record transaction (negative amount for spending)
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": -item["price"],  # Negative for spending
        "transaction_type": "purchase",
        "description": f"Purchased {item['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    # Auto-mark shopping list item as purchased if applicable
    if user.get("role") == "child":
        await db.new_quests.update_one(
            {
                "child_id": user["user_id"],
                "is_shopping_chore": True,
                "is_active": True,
                "shopping_item_details.item_id": purchase.item_id
            },
            {"$set": {"shopping_item_details.$.purchased": True}}
        )
    
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

@api_router.get("/child/shopping-list")
async def get_child_shopping_list(request: Request):
    """Get child's shopping list from parent-assigned chores"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    # Find active shopping chores for this child
    shopping_chores = await db.new_quests.find({
        "child_id": user["user_id"],
        "is_shopping_chore": True,
        "is_active": True
    }, {"_id": 0}).to_list(50)
    
    # Extract all shopping items
    items = []
    for chore in shopping_chores:
        for item in chore.get("shopping_item_details", []):
            items.append({
                "chore_id": chore["chore_id"],
                "chore_title": chore["title"],
                "list_id": item["list_id"],
                "item_id": item["item_id"],
                "item_name": item["item_name"],
                "quantity": item["quantity"],
                "purchased": item.get("purchased", False)
            })
    
    return items

@api_router.post("/child/shopping-list/{item_id}/mark-purchased")
async def mark_shopping_item_purchased(item_id: str, request: Request):
    """Mark a shopping list item as purchased after buying from store"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access this")
    
    # Find the chore containing this item
    chore = await db.new_quests.find_one({
        "child_id": user["user_id"],
        "is_shopping_chore": True,
        "is_active": True,
        "shopping_item_details.item_id": item_id
    })
    
    if not chore:
        return {"message": "Item not in shopping list"}
    
    # Update the item as purchased
    await db.new_quests.update_one(
        {"chore_id": chore["chore_id"], "shopping_item_details.item_id": item_id},
        {"$set": {"shopping_item_details.$.purchased": True}}
    )
    
    return {"message": "Item marked as purchased"}

# ============== MONEY GARDEN ROUTES (Grade 1-2) ==============

PLOT_COST = 20  # Cost to buy additional plots

@api_router.get("/garden/farm")
async def get_farm(request: Request):
    """Get child's farm with all plots and their status"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    # Block Kindergarten and redirect Grade 3+ to stocks
    if grade == 0:
        raise HTTPException(status_code=403, detail="Investments not available for Kindergarten")
    if grade >= 3:
        raise HTTPException(status_code=400, detail="Use /investments for Grade 3+")
    
    # Get or create initial farm plots (2x2 = 4 plots)
    plots = await db.farm_plots.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    
    if not plots:
        # Create initial 4 plots
        initial_plots = []
        for i in range(4):
            plot = {
                "plot_id": f"plot_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "position": i,
                "plant_id": None,
                "plant_name": None,
                "plant_emoji": None,
                "planted_at": None,
                "last_watered": None,
                "growth_days_total": 0,
                "growth_progress": 0,
                "status": "empty",
                "is_active": True
            }
            initial_plots.append(plot)
        await db.farm_plots.insert_many(initial_plots)
        plots = initial_plots
    
    # Update growth status for each plot
    now = datetime.now(timezone.utc)
    for plot in plots:
        if plot.get("plant_id") and plot.get("status") not in ["empty", "dead", "ready"]:
            # Get plant info
            plant = await db.investment_plants.find_one({"plant_id": plot["plant_id"]}, {"_id": 0})
            if plant:
                # Check watering status
                last_watered = plot.get("last_watered")
                if last_watered:
                    last_water_time = datetime.fromisoformat(last_watered.replace('Z', '+00:00'))
                    hours_since_water = (now - last_water_time).total_seconds() / 3600
                    water_freq = plant.get("water_frequency_hours", 24)
                    
                    if hours_since_water > water_freq * 2:
                        # Plant dies after 2x water frequency without water
                        plot["status"] = "dead"
                        await db.farm_plots.update_one({"plot_id": plot["plot_id"]}, {"$set": {"status": "dead"}})
                    elif hours_since_water > water_freq * 1.5:
                        plot["status"] = "wilting"
                    elif hours_since_water > water_freq:
                        plot["status"] = "water_needed"
                    else:
                        # Calculate growth if watered - use hours for granular progress
                        planted_at = datetime.fromisoformat(plot["planted_at"].replace('Z', '+00:00'))
                        hours_growing = (now - planted_at).total_seconds() / 3600
                        total_growth_hours = plant["growth_days"] * 24
                        growth_progress = min(100, (hours_growing / total_growth_hours) * 100)
                        plot["growth_progress"] = round(growth_progress, 1)
                        
                        if growth_progress >= 100:
                            plot["status"] = "ready"
                            await db.farm_plots.update_one({"plot_id": plot["plot_id"]}, {"$set": {"status": "ready", "growth_progress": 100}})
                        else:
                            plot["status"] = "growing"
    
    # Get available seeds
    seeds = await db.investment_plants.find({"is_active": True}, {"_id": 0}).to_list(50)
    
    # Get inventory
    inventory = await db.harvest_inventory.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    
    # Get today's market prices
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    market_prices = await db.market_prices.find({"date": today}, {"_id": 0}).to_list(50)
    
    # Check if market is open (7 AM - 5 PM IST)
    ist = pytz.timezone('Asia/Kolkata')
    ist_now = datetime.now(ist)
    current_hour_ist = ist_now.hour
    is_market_open = 7 <= current_hour_ist < 17
    
    return {
        "plots": plots,
        "seeds": seeds,
        "inventory": inventory,
        "market_prices": market_prices,
        "is_market_open": is_market_open,
        "plot_cost": PLOT_COST
    }

@api_router.post("/garden/buy-plot")
async def buy_farm_plot(request: Request):
    """Buy an additional plot for the farm"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    if grade == 0 or grade >= 3:
        raise HTTPException(status_code=403, detail="Money Garden is for Grade 1-2 only")
    
    # Check spending balance
    spending_acc = await db.wallet_accounts.find_one({"user_id": user["user_id"], "account_type": "spending"})
    if not spending_acc or spending_acc.get("balance", 0) < PLOT_COST:
        raise HTTPException(status_code=400, detail=f"Need ₹{PLOT_COST} in spending account to buy a plot")
    
    # Get current plot count
    plot_count = await db.farm_plots.count_documents({"user_id": user["user_id"]})
    
    # Deduct balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -PLOT_COST}}
    )
    
    # Record wallet transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": PLOT_COST,
        "transaction_type": "garden_buy",
        "description": f"Purchased new garden plot 🌾",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create new plot
    new_plot = {
        "plot_id": f"plot_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "position": plot_count,
        "plant_id": None,
        "plant_name": None,
        "plant_emoji": None,
        "planted_at": None,
        "last_watered": None,
        "growth_days_total": 0,
        "growth_progress": 0,
        "status": "empty",
        "is_active": True
    }
    await db.farm_plots.insert_one(new_plot)
    
    return {"message": "New plot purchased!", "plot": {k: v for k, v in new_plot.items() if k != "_id"}}

@api_router.post("/garden/plant")
async def plant_seed(data: PlantSeedRequest, request: Request):
    """Plant a seed in a plot"""
    user = await get_current_user(request)
    
    # Get the plot
    plot = await db.farm_plots.find_one({"plot_id": data.plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") != "empty":
        raise HTTPException(status_code=400, detail="Plot is not empty")
    
    # Get seed info
    seed = await db.investment_plants.find_one({"plant_id": data.plant_id, "is_active": True})
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")
    
    # Check spending balance
    spending_acc = await db.wallet_accounts.find_one({"user_id": user["user_id"], "account_type": "spending"})
    if not spending_acc or spending_acc.get("balance", 0) < seed["seed_cost"]:
        raise HTTPException(status_code=400, detail=f"Need ₹{seed['seed_cost']} to buy this seed")
    
    # Deduct balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -seed["seed_cost"]}}
    )
    
    # Record wallet transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": seed["seed_cost"],
        "transaction_type": "garden_buy",
        "description": f"Planted {seed['name']} seed 🌱",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Plant the seed
    now = datetime.now(timezone.utc).isoformat()
    await db.farm_plots.update_one(
        {"plot_id": data.plot_id},
        {"$set": {
            "plant_id": seed["plant_id"],
            "plant_name": seed["name"],
            "plant_emoji": seed["emoji"],
            "planted_at": now,
            "last_watered": now,
            "growth_days_total": seed["growth_days"],
            "growth_progress": 0,
            "status": "growing"
        }}
    )
    
    return {"message": f"{seed['name']} planted!", "seed_cost": seed["seed_cost"]}

@api_router.post("/garden/water/{plot_id}")
async def water_plant(plot_id: str, request: Request):
    """Water a plant"""
    user = await get_current_user(request)
    
    plot = await db.farm_plots.find_one({"plot_id": plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") in ["empty", "dead", "ready"]:
        raise HTTPException(status_code=400, detail="Cannot water this plot")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.farm_plots.update_one(
        {"plot_id": plot_id},
        {"$set": {"last_watered": now, "status": "growing"}}
    )
    
    return {"message": "Plant watered! 💧"}

@api_router.post("/garden/water-all")
async def water_all_plants(request: Request):
    """Water all plants that need watering"""
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc).isoformat()
    result = await db.farm_plots.update_many(
        {"user_id": user["user_id"], "status": {"$in": ["growing", "water_needed", "wilting"]}},
        {"$set": {"last_watered": now, "status": "growing"}}
    )
    
    return {"message": f"Watered {result.modified_count} plants! 💧"}

@api_router.post("/garden/harvest/{plot_id}")
async def harvest_plant(plot_id: str, request: Request):
    """Harvest a ready plant"""
    user = await get_current_user(request)
    
    plot = await db.farm_plots.find_one({"plot_id": plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") != "ready":
        raise HTTPException(status_code=400, detail="Plant is not ready for harvest")
    
    # Get plant info for harvest yield
    plant = await db.investment_plants.find_one({"plant_id": plot["plant_id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant info not found")
    
    # Add to inventory
    inventory_item = {
        "inventory_id": f"inv_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "plant_id": plant["plant_id"],
        "plant_name": plant["name"],
        "plant_emoji": plant["emoji"],
        "quantity": plant["harvest_yield"],
        "yield_unit": plant["yield_unit"],
        "harvested_at": datetime.now(timezone.utc).isoformat()
    }
    await db.harvest_inventory.insert_one(inventory_item)
    
    # Clear the plot
    await db.farm_plots.update_one(
        {"plot_id": plot_id},
        {"$set": {
            "plant_id": None,
            "plant_name": None,
            "plant_emoji": None,
            "planted_at": None,
            "last_watered": None,
            "growth_days_total": 0,
            "growth_progress": 0,
            "status": "empty"
        }}
    )
    
    return {
        "message": f"Harvested {plant['harvest_yield']} {plant['yield_unit']} of {plant['name']}! 🎉",
        "harvest": {"quantity": plant["harvest_yield"], "unit": plant["yield_unit"], "name": plant["name"]}
    }

@api_router.post("/garden/sell")
async def sell_produce(request: Request, plant_id: str, quantity: int):
    """Sell produce at market"""
    user = await get_current_user(request)
    
    # Check if market is open (7 AM - 5 PM IST)
    ist = pytz.timezone('Asia/Kolkata')
    ist_now = datetime.now(ist)
    current_hour_ist = ist_now.hour
    if not (7 <= current_hour_ist < 17):
        raise HTTPException(status_code=400, detail="Market is closed! Open 7 AM - 5 PM IST")
    
    # Check inventory
    inventory = await db.harvest_inventory.find_one({
        "user_id": user["user_id"],
        "plant_id": plant_id,
        "quantity": {"$gte": quantity}
    })
    if not inventory:
        raise HTTPException(status_code=400, detail="Not enough produce in inventory")
    
    # Get today's market price
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    market_price = await db.market_prices.find_one({"plant_id": plant_id, "date": today})
    
    if not market_price:
        # Generate today's price
        plant = await db.investment_plants.find_one({"plant_id": plant_id})
        if plant:
            fluctuation = plant.get("price_fluctuation_percent", 10) / 100
            price_change = random.uniform(-fluctuation, fluctuation)
            current_price = round(plant["base_sell_price"] * (1 + price_change), 2)
            market_price = {
                "price_id": f"price_{uuid.uuid4().hex[:8]}",
                "plant_id": plant_id,
                "current_price": current_price,
                "base_price": plant["base_sell_price"],
                "fluctuation_percent": plant["price_fluctuation_percent"],
                "date": today
            }
            await db.market_prices.insert_one(market_price)
    
    # Calculate earnings
    total_earnings = round(market_price["current_price"] * quantity, 2)
    
    # Update inventory
    new_quantity = inventory["quantity"] - quantity
    if new_quantity <= 0:
        await db.harvest_inventory.delete_one({"inventory_id": inventory["inventory_id"]})
    else:
        await db.harvest_inventory.update_one(
            {"inventory_id": inventory["inventory_id"]},
            {"$set": {"quantity": new_quantity}}
        )
    
    # Add to spending balance
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": total_earnings}}
    )
    
    # Get plant name for description
    plant = await db.investment_plants.find_one({"plant_id": plant_id})
    plant_name = plant["name"] if plant else "produce"
    
    # Record wallet transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": total_earnings,
        "transaction_type": "garden_sell",
        "description": f"Sold {quantity} {plant_name} at market",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Sold {quantity} for ₹{total_earnings}! 💰",
        "earnings": total_earnings,
        "price_per_unit": market_price["current_price"]
    }

# ============== ADMIN PLANT MANAGEMENT ==============

@api_router.get("/admin/garden/plants")
async def admin_get_plants(request: Request):
    """Get all plant types for admin"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    plants = await db.investment_plants.find({}, {"_id": 0}).to_list(100)
    return plants

@api_router.post("/admin/garden/plants")
async def admin_create_plant(plant: InvestmentPlantCreate, request: Request):
    """Create a new plant type"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    plant_doc = {
        "plant_id": f"plant_{uuid.uuid4().hex[:8]}",
        **plant.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.investment_plants.insert_one(plant_doc)
    
    return {"message": "Plant created!", "plant_id": plant_doc["plant_id"]}

@api_router.put("/admin/garden/plants/{plant_id}")
async def admin_update_plant(plant_id: str, plant: InvestmentPlantUpdate, request: Request):
    """Update a plant type"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    update_data = {k: v for k, v in plant.model_dump().items() if v is not None}
    if update_data:
        await db.investment_plants.update_one({"plant_id": plant_id}, {"$set": update_data})
    
    return {"message": "Plant updated!"}

@api_router.delete("/admin/garden/plants/{plant_id}")
async def admin_delete_plant(plant_id: str, request: Request):
    """Delete a plant type"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.investment_plants.delete_one({"plant_id": plant_id})
    return {"message": "Plant deleted!"}

# ============== STOCK INVESTMENT ROUTES (Grade 3-5) ==============

@api_router.get("/investments")
async def get_investments(request: Request):
    """Get user's investments - redirects to appropriate system based on grade"""
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    # Block Kindergarten
    if grade == 0:
        raise HTTPException(status_code=403, detail="Investments not available for Kindergarten")
    
    # Grade 1-2: Redirect to Money Garden
    if grade <= 2:
        raise HTTPException(status_code=400, detail="Use /garden/farm for Grade 1-2")
    
    # Grade 3+: Stock market
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

# ============== NEW QUEST SYSTEM ==============

# Upload quest image/pdf
@api_router.post("/upload/quest-asset")
async def upload_quest_asset(file: UploadFile = File(...)):
    """Upload image or PDF for quests"""
    QUEST_ASSETS_DIR = UPLOADS_DIR / "quests"
    QUEST_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, jpeg, png, gif, webp, pdf")
    
    filename = f"{uuid.uuid4().hex[:12]}.{ext}"
    file_path = QUEST_ASSETS_DIR / filename
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"url": f"/api/uploads/quests/{filename}"}

# Admin Quest Management
@api_router.post("/admin/quests")
async def create_admin_quest(quest_data: QuestCreate, request: Request):
    """Admin creates a new quest with Q&A"""
    user = await require_admin(request)
    
    quest_id = f"quest_{uuid.uuid4().hex[:12]}"
    questions_points = sum(q.get("points", 0) or 0 for q in quest_data.questions)
    base_reward = quest_data.reward_amount or 0
    total_points = questions_points + base_reward if len(quest_data.questions) == 0 else questions_points
    
    # Process questions
    processed_questions = []
    for i, q in enumerate(quest_data.questions):
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
        "due_time": "23:59:00",  # 11:59 PM
        "reward_amount": base_reward,
        "questions": processed_questions,
        "total_points": total_points if total_points > 0 else base_reward,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.new_quests.insert_one(quest_doc)
    return {"quest_id": quest_id, "message": "Quest created successfully"}

@api_router.get("/admin/quests")
async def get_admin_quests(request: Request):
    """Get all admin-created quests"""
    await require_admin(request)
    quests = await db.new_quests.find(
        {"creator_type": "admin"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return quests

@api_router.put("/admin/quests/{quest_id}")
async def update_admin_quest(quest_id: str, quest_data: QuestCreate, request: Request):
    """Update an admin quest"""
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

@api_router.delete("/admin/quests/{quest_id}")
async def delete_admin_quest(quest_id: str, request: Request):
    """Delete an admin quest"""
    await require_admin(request)
    await db.new_quests.delete_one({"quest_id": quest_id, "creator_type": "admin"})
    return {"message": "Quest deleted"}

# Teacher Quest Management
@api_router.post("/teacher/quests")
async def create_teacher_quest(quest_data: QuestCreate, request: Request):
    """Teacher creates a quest for their classrooms"""
    user = await require_teacher(request)
    
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
    
    # Get teacher's classrooms
    classrooms = await db.classrooms.find(
        {"teacher_id": user["user_id"]},
        {"classroom_id": 1}
    ).to_list(50)
    classroom_ids = [c["classroom_id"] for c in classrooms]
    
    quest_doc = {
        "quest_id": quest_id,
        "creator_type": "teacher",
        "creator_id": user["user_id"],
        "creator_name": user.get("name", "Teacher"),
        "classroom_ids": classroom_ids,
        "title": quest_data.title,
        "description": quest_data.description,
        "image_url": quest_data.image_url,
        "pdf_url": quest_data.pdf_url,
        "reward_amount": base_reward,
        "due_date": quest_data.due_date,
        "due_time": "23:59:00",
        "questions": processed_questions,
        "total_points": total_points if total_points > 0 else base_reward,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.new_quests.insert_one(quest_doc)
    
    # Create notifications for students
    for classroom in classrooms:
        students = await db.users.find(
            {"classroom_id": classroom["classroom_id"], "role": "child"},
            {"user_id": 1}
        ).to_list(100)
        for student in students:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": student["user_id"],
                "message": f"New quest from {user.get('name', 'Teacher')}: {quest_data.title}",
                "type": "quest",
                "link": "/quests",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"quest_id": quest_id, "message": "Quest created successfully"}

@api_router.get("/teacher/quests")
async def get_teacher_quests(request: Request):
    """Get teacher's created quests"""
    user = await require_teacher(request)
    quests = await db.new_quests.find(
        {"creator_type": "teacher", "creator_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return quests

@api_router.get("/teacher/quests/{quest_id}")
async def get_teacher_quest(quest_id: str, request: Request):
    """Get a specific teacher quest for viewing/editing"""
    user = await require_teacher(request)
    quest = await db.new_quests.find_one({
        "quest_id": quest_id,
        "creator_type": "teacher",
        "creator_id": user["user_id"]
    }, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    return quest

@api_router.put("/teacher/quests/{quest_id}")
async def update_teacher_quest(quest_id: str, quest_data: QuestCreate, request: Request):
    """Update a teacher quest"""
    user = await require_teacher(request)
    
    # Verify quest belongs to this teacher
    existing = await db.new_quests.find_one({
        "quest_id": quest_id,
        "creator_type": "teacher",
        "creator_id": user["user_id"]
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Quest not found")
    
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
        {"quest_id": quest_id, "creator_type": "teacher", "creator_id": user["user_id"]},
        {"$set": {
            "title": quest_data.title,
            "description": quest_data.description,
            "image_url": quest_data.image_url,
            "pdf_url": quest_data.pdf_url,
            "due_date": quest_data.due_date,
            "reward_amount": quest_data.reward_amount or 0,
            "questions": processed_questions,
            "total_points": total_points if total_points > 0 else (quest_data.reward_amount or 0)
        }}
    )
    return {"message": "Quest updated"}

@api_router.delete("/teacher/quests/{quest_id}")
async def delete_teacher_quest(quest_id: str, request: Request):
    """Delete a teacher quest"""
    user = await require_teacher(request)
    await db.new_quests.delete_one({
        "quest_id": quest_id,
        "creator_type": "teacher",
        "creator_id": user["user_id"]
    })
    return {"message": "Quest deleted"}

# Parent Chore Management (shown as quests to children)
@api_router.post("/parent/chores-new")
async def create_parent_chore(chore_data: ChoreCreate, request: Request):
    """Parent creates a chore for their child"""
    user = await require_parent(request)
    
    # Verify child belongs to parent via parent_child_links collection
    child = await db.users.find_one({"user_id": chore_data.child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    # Check parent_child_links for the relationship
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
        "quest_id": chore_id,  # For unified quest display
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
    
    # Create notification for child
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

@api_router.get("/parent/chores-new")
async def get_parent_chores(request: Request):
    """Get parent's created chores"""
    user = await require_parent(request)
    chores = await db.new_quests.find(
        {"creator_type": "parent", "creator_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return chores

@api_router.delete("/parent/chores-new/{chore_id}")
async def delete_parent_chore(chore_id: str, request: Request):
    """Delete a parent chore"""
    user = await require_parent(request)
    await db.new_quests.delete_one({
        "chore_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"]
    })
    return {"message": "Chore deleted"}

# ============== PARENT SHOPPING LIST ==============

@api_router.post("/parent/shopping-list")
async def add_to_shopping_list(item_data: ShoppingListItemCreate, request: Request):
    """Parent adds item to shopping list for a child"""
    user = await require_parent(request)
    
    # Verify parent-child relationship
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": item_data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    # Get item details
    item = await db.admin_store_items.find_one({"item_id": item_data.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    list_id = f"shoplist_{uuid.uuid4().hex[:12]}"
    
    list_doc = {
        "list_id": list_id,
        "parent_id": user["user_id"],
        "child_id": item_data.child_id,
        "item_id": item["item_id"],
        "item_name": item["name"],
        "item_price": item["price"],
        "quantity": item_data.quantity,
        "image_url": item.get("image_url"),
        "category": item.get("category"),
        "status": "pending",
        "chore_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.shopping_lists.insert_one(list_doc)
    return {"list_id": list_id, "message": "Item added to shopping list"}

@api_router.get("/parent/shopping-list")
async def get_shopping_list(request: Request, child_id: str = None):
    """Get parent's shopping list, optionally filtered by child"""
    user = await require_parent(request)
    
    query = {"parent_id": user["user_id"]}
    if child_id:
        query["child_id"] = child_id
    
    items = await db.shopping_lists.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Group by child
    by_child = {}
    for item in items:
        cid = item["child_id"]
        if cid not in by_child:
            child = await db.users.find_one({"user_id": cid}, {"_id": 0, "name": 1, "picture": 1})
            by_child[cid] = {
                "child_id": cid,
                "child_name": child.get("name", "Unknown") if child else "Unknown",
                "child_picture": child.get("picture") if child else None,
                "items": []
            }
        by_child[cid]["items"].append(item)
    
    return list(by_child.values())

@api_router.delete("/parent/shopping-list/{list_id}")
async def remove_from_shopping_list(list_id: str, request: Request):
    """Remove item from shopping list"""
    user = await require_parent(request)
    
    result = await db.shopping_lists.delete_one({
        "list_id": list_id,
        "parent_id": user["user_id"],
        "status": "pending"  # Can only delete pending items
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found or already assigned to a chore")
    
    return {"message": "Item removed from shopping list"}

@api_router.post("/parent/shopping-list/create-chore")
async def create_chore_from_shopping_list(chore_data: ShoppingListChoreCreate, request: Request):
    """Create a chore from shopping list items - child completes chore to earn items"""
    user = await require_parent(request)
    
    # Verify parent-child relationship
    link = await db.parent_child_links.find_one({
        "parent_id": user["user_id"],
        "child_id": chore_data.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")
    
    # Get selected shopping list items
    items = await db.shopping_lists.find({
        "list_id": {"$in": chore_data.list_item_ids},
        "parent_id": user["user_id"],
        "child_id": chore_data.child_id,
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    if not items:
        raise HTTPException(status_code=400, detail="No valid pending items found")
    
    # Use custom reward amount set by parent
    reward_amount = chore_data.reward_amount
    if reward_amount <= 0:
        raise HTTPException(status_code=400, detail="Reward amount must be greater than 0")
    
    # Store shopping items as structured list for display
    shopping_item_details = [{
        "list_id": item["list_id"],
        "item_id": item["item_id"],
        "item_name": item["item_name"],
        "quantity": item["quantity"],
        "purchased": False
    } for item in items]
    
    # Create the chore
    chore_id = f"chore_{uuid.uuid4().hex[:12]}"
    
    chore_doc = {
        "chore_id": chore_id,
        "quest_id": chore_id,
        "creator_type": "parent",
        "creator_id": user["user_id"],
        "creator_name": user.get("name", "Parent"),
        "child_id": chore_data.child_id,
        "title": chore_data.title,
        "description": chore_data.description or "",
        "reward_amount": reward_amount,
        "total_points": reward_amount,
        "frequency": "once",
        "is_shopping_chore": True,
        "shopping_items": [item["list_id"] for item in items],
        "shopping_item_details": shopping_item_details,
        "is_active": True,
        "requires_validation": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.new_quests.insert_one(chore_doc)
    
    # Update shopping list items to assigned status
    await db.shopping_lists.update_many(
        {"list_id": {"$in": chore_data.list_item_ids}},
        {"$set": {"status": "assigned", "chore_id": chore_id}}
    )
    
    # Notify child
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": chore_data.child_id,
        "message": f"New shopping chore from {user.get('name', 'Parent')}: {chore_data.title}",
        "type": "chore",
        "link": "/quests",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "chore_id": chore_id,
        "message": "Shopping chore created",
        "total_reward": reward_amount,
        "items_count": len(items)
    }

# Child Quest/Chore completion tracking
@api_router.get("/child/quests-new")
async def get_child_quests(request: Request, source: str = None, sort: str = "due_date"):
    """Get all quests for a child (admin, teacher, parent chores)"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can access quests")
    
    grade = user.get("grade", 3) or 3
    parent_ids = user.get("parent_ids", [])
    
    # Get child's classroom IDs from classroom_students collection
    student_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"classroom_id": 1}
    ).to_list(20)
    child_classroom_ids = [link["classroom_id"] for link in student_links]
    
    # Build query for different quest sources
    quests = []
    
    # Admin quests (grade-appropriate and not expired)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not source or source == "admin":
        admin_quests = await db.new_quests.find({
            "creator_type": "admin",
            "is_active": True,
            "min_grade": {"$lte": grade},
            "max_grade": {"$gte": grade},
            "due_date": {"$gte": today}
        }, {"_id": 0}).to_list(100)
        quests.extend(admin_quests)
    
    # Teacher quests (from child's classrooms)
    if (not source or source == "teacher") and child_classroom_ids:
        teacher_quests = await db.new_quests.find({
            "creator_type": "teacher",
            "is_active": True,
            "classroom_ids": {"$in": child_classroom_ids},
            "due_date": {"$gte": today}
        }, {"_id": 0}).to_list(100)
        quests.extend(teacher_quests)
    
    # Parent chores
    if not source or source == "parent":
        parent_chores = await db.new_quests.find({
            "creator_type": "parent",
            "child_id": user["user_id"],
            "is_active": True
        }, {"_id": 0}).to_list(100)
        quests.extend(parent_chores)
    
    # Get user's completion status for each quest
    completions = await db.quest_completions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(500)
    completion_map = {c["quest_id"]: c for c in completions}
    
    # Add completion status and calculate if can earn
    for quest in quests:
        quest_id = quest.get("quest_id") or quest.get("chore_id")
        completion = completion_map.get(quest_id)
        quest["completion_status"] = completion
        quest["has_earned"] = completion.get("has_earned", False) if completion else False
        quest["earned_amount"] = completion.get("earned_amount", 0) if completion else 0
        # Mark as completed if quest was attempted (regardless of points earned)
        quest["is_completed"] = completion.get("is_completed", False) if completion else False
    
    # Sort
    if sort == "due_date":
        quests.sort(key=lambda x: x.get("due_date", "9999-99-99"))
    elif sort == "reward":
        quests.sort(key=lambda x: x.get("total_points", 0), reverse=True)
    
    return quests

@api_router.post("/child/quests-new/{quest_id}/submit")
async def submit_quest_answers(quest_id: str, request: Request):
    """Child submits answers for a quest (Q&A type) or marks quest as complete"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can submit quests")
    
    body = await request.json()
    answers = body.get("answers", {})  # {question_id: answer}
    
    quest = await db.new_quests.find_one({"quest_id": quest_id}, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    # Check if already earned (can retake but no more money)
    existing = await db.quest_completions.find_one({
        "user_id": user["user_id"],
        "quest_id": quest_id
    })
    has_already_earned = existing.get("has_earned", False) if existing else False
    
    questions = quest.get("questions", [])
    earned = 0
    results = []
    
    # If no questions, award the base reward_amount
    if len(questions) == 0:
        base_reward = quest.get("reward_amount", 0) or quest.get("total_points", 0)
        if not has_already_earned and base_reward > 0:
            earned = base_reward
    else:
        # Grade answers
        for question in questions:
            q_id = question["question_id"]
            user_answer = answers.get(q_id)
            correct_answer = question["correct_answer"]
            points = question.get("points", 0) or 0
            options = question.get("options", [])
            
            is_correct = False
            if question["question_type"] == "multi_select":
                # Compare lists - convert letter answers (A,B,C,D) to option text for comparison
                if isinstance(user_answer, list) and isinstance(correct_answer, list):
                    # Convert correct_answer letters to option indices, then get user selections
                    correct_options = set()
                    for letter in correct_answer:
                        idx = ord(letter.upper()) - ord('A')
                        if 0 <= idx < len(options):
                            correct_options.add(options[idx])
                    is_correct = set(user_answer) == correct_options
            elif question["question_type"] == "value":
                # Numeric comparison
                try:
                    is_correct = float(user_answer) == float(correct_answer)
                except:
                    is_correct = False
            elif question["question_type"] == "mcq":
                # MCQ - correct_answer is letter (A,B,C,D), user_answer is option text
                if correct_answer and options:
                    idx = ord(str(correct_answer).upper()) - ord('A')
                    if 0 <= idx < len(options):
                        correct_option_text = options[idx]
                        is_correct = str(user_answer) == str(correct_option_text)
            else:
                # True/False - direct string comparison
                is_correct = str(user_answer).lower() == str(correct_answer).lower()
            
            if is_correct and not has_already_earned:
                earned += points
            
            results.append({
                "question_id": q_id,
                "is_correct": is_correct,
                "points_earned": points if is_correct else 0
            })
    
    # Update or create completion record
    completion_doc = {
        "user_id": user["user_id"],
        "quest_id": quest_id,
        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
        "last_results": results,
        "last_earned": earned if not has_already_earned else 0
    }
    
    if not existing:
        completion_doc["completion_id"] = f"comp_{uuid.uuid4().hex[:12]}"
        completion_doc["has_earned"] = earned > 0
        completion_doc["earned_amount"] = earned
        completion_doc["is_completed"] = True  # Mark as completed regardless of points earned
        completion_doc["first_attempt_at"] = datetime.now(timezone.utc).isoformat()
        await db.quest_completions.insert_one(completion_doc)
    else:
        update_data = {
            "last_attempt_at": completion_doc["last_attempt_at"],
            "last_results": results,
            "last_earned": earned if not has_already_earned else 0,
            "is_completed": True  # Mark as completed regardless of points earned
        }
        if not has_already_earned and earned > 0:
            update_data["has_earned"] = True
            update_data["earned_amount"] = earned
        await db.quest_completions.update_one(
            {"user_id": user["user_id"], "quest_id": quest_id},
            {"$set": update_data}
        )
    
    # Award money if first time earning
    if earned > 0 and not has_already_earned:
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "spending"},
            {"$inc": {"balance": earned}}
        )
        
        # Record transaction
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "from_account": None,
            "to_account": "spending",
            "amount": earned,
            "transaction_type": "reward",
            "description": f"Quest completed: {quest['title']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "results": results,
        "earned": earned if not has_already_earned else 0,
        "already_earned": has_already_earned,
        "message": "Quest submitted successfully"
    }

# Parent validates chore completion
@api_router.post("/child/chores/{chore_id}/request-complete")
async def request_chore_completion(chore_id: str, request: Request):
    """Child requests chore completion validation from parent"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can request completion")
    
    chore = await db.new_quests.find_one({
        "chore_id": chore_id,
        "child_id": user["user_id"]
    })
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Create pending completion request
    request_id = f"creq_{uuid.uuid4().hex[:12]}"
    await db.chore_requests.insert_one({
        "request_id": request_id,
        "chore_id": chore_id,
        "child_id": user["user_id"],
        "parent_id": chore["creator_id"],
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify parent
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": chore["creator_id"],
        "message": f"{user.get('name', 'Your child')} says they completed: {chore['title']}",
        "type": "chore_validation",
        "link": "/parent-dashboard",
        "is_read": False,
        "data": {"request_id": request_id, "chore_id": chore_id},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Completion request sent to parent"}

@api_router.get("/parent/chore-requests")
async def get_chore_requests(request: Request):
    """Get pending chore completion requests for parent"""
    user = await require_parent(request)
    requests = await db.chore_requests.find(
        {"parent_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with chore and child info
    enriched = []
    for req in requests:
        chore = await db.new_quests.find_one({"chore_id": req["chore_id"]}, {"_id": 0, "title": 1, "reward_amount": 1})
        child = await db.users.find_one({"user_id": req["child_id"]}, {"_id": 0, "name": 1, "picture": 1})
        enriched.append({
            "request_id": req["request_id"],
            "chore_id": req["chore_id"],
            "child_id": req["child_id"],
            "child_name": child.get("name", "Unknown") if child else "Unknown",
            "child_picture": child.get("picture") if child else None,
            "chore_title": chore.get("title") if chore else "Unknown Chore",
            "reward_amount": chore.get("reward_amount", 0) if chore else 0,
            "status": req.get("status", "pending"),
            "completed_at": req.get("created_at"),
            "validated_at": req.get("validated_at")
        })
    
    return enriched

@api_router.post("/parent/chore-requests/{request_id}/validate")
async def validate_chore_completion(request_id: str, request: Request):
    """Parent validates (approves/rejects) chore completion"""
    user = await require_parent(request)
    body = await request.json()
    action = body.get("action")  # 'approve' or 'reject'
    
    chore_req = await db.chore_requests.find_one({
        "request_id": request_id,
        "parent_id": user["user_id"]
    })
    if not chore_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if action == "approve":
        chore = await db.new_quests.find_one({"chore_id": chore_req["chore_id"]})
        reward = chore.get("reward_amount", 0)
        
        # Award money to child
        await db.wallet_accounts.update_one(
            {"user_id": chore_req["child_id"], "account_type": "spending"},
            {"$inc": {"balance": reward}}
        )
        
        # Record transaction
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": chore_req["child_id"],
            "from_account": None,
            "to_account": "spending",
            "amount": reward,
            "transaction_type": "reward",
            "description": f"Chore completed: {chore['title']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Record completion
        await db.quest_completions.insert_one({
            "completion_id": f"comp_{uuid.uuid4().hex[:12]}",
            "user_id": chore_req["child_id"],
            "quest_id": chore_req["chore_id"],
            "is_completed": True,
            "has_earned": True,
            "earned_amount": reward,
            "completed_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Notify child
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": chore_req["child_id"],
            "message": f"Great job! {user.get('name', 'Parent')} approved your chore. You earned ₹{reward}!",
            "type": "chore_approved",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # For recurring chores, reset for next occurrence
        if chore.get("frequency") != "one_time":
            # Keep chore active for next time
            pass
        else:
            # One-time chore, mark as inactive
            await db.new_quests.update_one(
                {"chore_id": chore_req["chore_id"]},
                {"$set": {"is_active": False}}
            )
    else:
        # Rejected - Get chore title for notification
        chore = await db.new_quests.find_one({"chore_id": chore_req["chore_id"]})
        chore_title = chore.get("title", "chore") if chore else "chore"
        
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": chore_req["child_id"],
            "message": f"Your chore '{chore_title}' was not approved. {user.get('name', 'Parent')} wants you to try again!",
            "type": "chore_rejected",
            "link": "/quests",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Update request status
    await db.chore_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": action + "d", "validated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Chore {action}d"}

# Legacy quest routes (for backward compatibility during transition)
@api_router.get("/quests")
async def get_quests(request: Request):
    """Get available quests - redirects to new system"""
    return await get_child_quests(request)

@api_router.post("/quests/{quest_id}/accept")
async def accept_quest(quest_id: str, request: Request):
    """Legacy - quests no longer need acceptance"""
    return {"message": "Quest system updated - quests are automatically available"}

@api_router.post("/quests/{quest_id}/complete")
async def complete_quest(quest_id: str, request: Request):
    """Legacy - redirect to new submission"""
    return {"message": "Please use the new quest submission system"}
    
    return {"message": "Quest completed", "reward": quest["reward_amount"]}

# ============== STREAK ROUTES ==============

@api_router.post("/streak/checkin")
async def daily_checkin(request: Request):
    """Record daily login and update streak - Children get ₹5 daily reward"""
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
    
    # Award daily login bonus - Children get flat ₹5, others get streak-based bonus
    user_role = user.get("role")
    if user_role == "child":
        bonus = 5  # Flat ₹5 daily reward for children
        description = "Daily login reward"
    else:
        bonus = min(current_streak * 2, 20)  # Max 20 coins per day for others
        description = f"Daily login bonus (Day {current_streak})"
    
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
        "description": description,
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
        0: "You are a friendly financial buddy for kindergarten kids (5-6 years) in India. Use very simple words, lots of examples with toys and candy, and be super encouraging. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 3 sentences.",
        1: "You are a friendly financial buddy for 1st graders (6-7 years) in India. Use simple words, examples with coins and small purchases, and be encouraging. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 4 sentences.",
        2: "You are a friendly financial buddy for 2nd graders (7-8 years) in India. Use simple language, examples with money math and small purchases, and be encouraging. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 4 sentences.",
        3: "You are a friendly financial buddy for 3rd graders (8-9 years) in India. You can use slightly more complex concepts like percentages and goals. Use relatable examples. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 5 sentences.",
        4: "You are a friendly financial buddy for 4th graders (9-10 years) in India. You can discuss interest, savings accounts, and basic investing concepts. Use real-world examples relevant to India. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 5 sentences.",
        5: "You are a friendly financial buddy for 5th graders (10-11 years) in India. You can discuss credit, compound interest, diversification, and entrepreneurship basics. Use engaging examples relevant to Indian context. Always use Indian Rupees (₹) for money examples, never dollars. Keep responses under 6 sentences."
    }
    
    system_message = grade_contexts.get(grade, grade_contexts[3])
    system_message += " Always be positive, encouraging, and make learning about money fun! Never give actual financial advice - this is educational only. IMPORTANT: Always use the Indian Rupee symbol (₹) and Indian currency context. Never use dollars ($) or any other currency."
    
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
    
    system_message = f"""You are a financial education expert for grade {grade} students in India. 
    Generate a single, engaging financial tip about {topic}. 
    The tip should be age-appropriate, fun, and educational.
    Include a simple emoji at the start.
    Keep it under 2-3 sentences for younger kids (K-2) and 3-4 sentences for older kids (3-5).
    IMPORTANT: Always use Indian Rupees (₹) for any money examples. Never use dollars ($) or any other currency."""
    
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

# ============== TEACHER ROUTES ==============

@api_router.get("/teacher/dashboard")
async def teacher_dashboard(request: Request):
    """Get teacher dashboard data"""
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

@api_router.post("/teacher/classrooms")
async def create_classroom(classroom: ClassroomCreate, request: Request):
    """Create a new classroom"""
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
    # Remove MongoDB _id before returning
    classroom_doc.pop("_id", None)
    return {"message": "Classroom created", "classroom": classroom_doc}

@api_router.get("/teacher/classrooms")
async def get_classrooms(request: Request):
    """Get teacher's classrooms"""
    teacher = await require_teacher(request)
    
    classrooms = await db.classrooms.find(
        {"teacher_id": teacher["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return classrooms

@api_router.get("/teacher/classrooms/{classroom_id}")
async def get_classroom_details(classroom_id: str, request: Request):
    """Get detailed classroom info with students"""
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

@api_router.get("/teacher/classrooms/{classroom_id}/student/{student_id}/insights")
async def get_student_insights(classroom_id: str, student_id: str, request: Request):
    """Get comprehensive insights for a student in a classroom"""
    teacher = await require_teacher(request)
    
    # Verify classroom belongs to teacher
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    }, {"_id": 0})
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    # Verify student is in classroom
    student_link = await db.classroom_students.find_one({
        "classroom_id": classroom_id,
        "student_id": student_id
    })
    
    if not student_link:
        raise HTTPException(status_code=404, detail="Student not in this classroom")
    
    # Get student basic info
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 1. WALLET - Get all account balances
    wallet_accounts = await db.wallet_accounts.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(10)
    
    # Get savings goals total (money saved towards goals)
    savings_goals = await db.savings_goals.find(
        {"child_id": student_id},
        {"_id": 0}
    ).to_list(100)
    total_saved_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
    
    # Get all transactions for spending calculation per jar
    all_transactions = await db.transactions.find(
        {"user_id": student_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Calculate spent per account type (negative transactions from each account)
    spent_per_jar = {"spending": 0, "savings": 0, "gifting": 0, "investing": 0}
    for t in all_transactions:
        from_acc = t.get("from_account")
        amount = t.get("amount", 0)
        # Spending is tracked by negative amounts or explicit from_account
        if from_acc and from_acc in spent_per_jar:
            if amount < 0:
                spent_per_jar[from_acc] += abs(amount)
            # Also check transaction_type for specific spending patterns
        # Store purchases, gifts sent, etc.
        txn_type = t.get("transaction_type", "")
        if txn_type == "purchase" and amount < 0:
            spent_per_jar["spending"] += abs(amount)
        elif txn_type == "gift_sent" and amount < 0:
            spent_per_jar["gifting"] += abs(amount)
        elif txn_type in ["garden_buy", "stock_buy"] and amount < 0:
            spent_per_jar["investing"] += abs(amount)
        elif txn_type == "savings_deposit" and amount < 0:
            spent_per_jar["savings"] += abs(amount)
    
    # Build wallet summary with available balance and spent amounts
    wallet_by_type = {w.get("account_type"): w.get("balance", 0) for w in wallet_accounts}
    
    wallet_summary = {
        "accounts": [
            {
                "account_type": acc.get("account_type"),
                "balance": acc.get("balance", 0),
                "spent": spent_per_jar.get(acc.get("account_type"), 0)
            }
            for acc in wallet_accounts
        ],
        "total_balance": sum(w.get("balance", 0) for w in wallet_accounts),
        "savings_in_goals": total_saved_in_goals,
        "savings_goals_count": len(savings_goals)
    }
    
    # 2. TRANSACTIONS - Get recent transactions and summaries
    transactions = all_transactions  # Reuse already fetched transactions
    
    total_earned = sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) > 0)
    total_spent = abs(sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) < 0))
    
    transaction_summary = {
        "recent": transactions[:10],
        "total_earned": total_earned,
        "total_spent": total_spent,
        "transaction_count": len(transactions)
    }
    
    # 3. CHORES - Parent chores
    parent_chores = await db.parent_chores.find(
        {"child_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    chore_requests = await db.chore_requests.find(
        {"child_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    chores_summary = {
        "total_assigned": len(parent_chores),
        "completed": len([c for c in chore_requests if c.get("status") == "approved"]),
        "pending": len([c for c in chore_requests if c.get("status") == "pending"]),
        "rejected": len([c for c in chore_requests if c.get("status") == "rejected"]),
        "recent_chores": parent_chores[:5]
    }
    
    # 4. TEACHER QUESTS - Quests from this teacher
    teacher_quests = await db.quests.find(
        {"creator_id": teacher["user_id"], "target_grades": classroom.get("grade_level")},
        {"_id": 0}
    ).to_list(100)
    
    quest_completions = await db.quest_completions.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(100)
    completed_quest_ids = {qc.get("quest_id") for qc in quest_completions if qc.get("is_completed")}
    
    quests_summary = {
        "total_assigned": len(teacher_quests),
        "completed": len([q for q in teacher_quests if q.get("quest_id") in completed_quest_ids]),
        "completion_rate": round(len([q for q in teacher_quests if q.get("quest_id") in completed_quest_ids]) / len(teacher_quests) * 100, 1) if teacher_quests else 0
    }
    
    # 5. GIFTS - Given and received
    gifts_received = await db.transactions.find(
        {"user_id": student_id, "transaction_type": "gift_received"},
        {"_id": 0}
    ).to_list(100)
    
    gifts_sent = await db.transactions.find(
        {"user_id": student_id, "transaction_type": "gift_sent"},
        {"_id": 0}
    ).to_list(100)
    
    gifts_summary = {
        "received_count": len(gifts_received),
        "received_total": sum(g.get("amount", 0) for g in gifts_received),
        "sent_count": len(gifts_sent),
        "sent_total": abs(sum(g.get("amount", 0) for g in gifts_sent)),
        "recent_gifts": (gifts_received + gifts_sent)[:5]
    }
    
    # 6. INVESTMENTS - Garden
    farm = await db.farms.find_one({"user_id": student_id}, {"_id": 0})
    garden_transactions = await db.transactions.find(
        {"user_id": student_id, "transaction_type": {"$in": ["garden_buy", "garden_sell"]}},
        {"_id": 0}
    ).to_list(100)
    
    garden_invested = sum(abs(t.get("amount", 0)) for t in garden_transactions if t.get("transaction_type") == "garden_buy")
    garden_earned = sum(t.get("amount", 0) for t in garden_transactions if t.get("transaction_type") == "garden_sell")
    
    garden_summary = {
        "plots_owned": len(farm.get("plots", [])) if farm else 0,
        "total_invested": garden_invested,
        "total_earned": garden_earned,
        "profit_loss": garden_earned - garden_invested,
        "inventory_count": len(farm.get("inventory", [])) if farm else 0
    }
    
    # 7. INVESTMENTS - Stocks
    portfolio = await db.stock_portfolios.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    stock_transactions = await db.transactions.find(
        {"user_id": student_id, "transaction_type": {"$in": ["stock_buy", "stock_sell"]}},
        {"_id": 0}
    ).to_list(100)
    
    stock_invested = sum(abs(t.get("amount", 0)) for t in stock_transactions if t.get("transaction_type") == "stock_buy")
    stock_earned = sum(t.get("amount", 0) for t in stock_transactions if t.get("transaction_type") == "stock_sell")
    
    # Calculate current portfolio value
    portfolio_value = 0
    for holding in portfolio:
        stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
        if stock:
            portfolio_value += holding.get("quantity", 0) * stock.get("current_price", 0)
    
    stocks_summary = {
        "holdings_count": len(portfolio),
        "portfolio_value": round(portfolio_value, 2),
        "total_invested": stock_invested,
        "realized_gains": stock_earned - stock_invested,
        "unrealized_gains": round(portfolio_value - sum(h.get("total_cost", 0) for h in portfolio), 2)
    }
    
    # 8. LEARNING PROGRESS
    content_progress = await db.user_content_progress.find(
        {"user_id": student_id, "completed": True},
        {"_id": 0}
    ).to_list(1000)
    
    total_topics = await db.content_topics.count_documents({
        "parent_id": None,
        "min_grade": {"$lte": student.get("grade", 0)},
        "max_grade": {"$gte": student.get("grade", 0)}
    })
    
    total_content = await db.content_items.count_documents({
        "is_published": True
    })
    
    learning_summary = {
        "lessons_completed": len(content_progress),
        "total_lessons": total_content,
        "topics_available": total_topics,
        "completion_percentage": round(len(content_progress) / total_content * 100, 1) if total_content > 0 else 0
    }
    
    # 9. ACHIEVEMENTS/BADGES
    achievements = await db.user_achievements.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    achievements_summary = {
        "badges_earned": len(achievements),
        "recent_badges": achievements[:5]
    }
    
    # 10. STREAK
    streak_data = student.get("streak_count", 0)
    last_activity = student.get("last_activity_date")
    
    return {
        "student": {
            "user_id": student.get("user_id"),
            "name": student.get("name"),
            "email": student.get("email"),
            "grade": student.get("grade"),
            "avatar": student.get("avatar"),
            "streak_count": streak_data,
            "last_activity": last_activity
        },
        "wallet": wallet_summary,
        "transactions": transaction_summary,
        "chores": chores_summary,
        "quests": quests_summary,
        "gifts": gifts_summary,
        "garden": garden_summary,
        "stocks": stocks_summary,
        "learning": learning_summary,
        "achievements": achievements_summary
    }

@api_router.get("/teacher/classrooms/{classroom_id}/comparison")
async def get_classroom_comparison(classroom_id: str, request: Request):
    """Get comparison data for all students in a classroom"""
    teacher = await require_teacher(request)
    
    # Verify classroom belongs to teacher
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    }, {"_id": 0})
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    # Get all students in classroom
    student_links = await db.classroom_students.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    comparison_data = []
    
    for link in student_links:
        student_id = link["student_id"]
        student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
        if not student:
            continue
        
        # Wallet balances
        wallet_accounts = await db.wallet_accounts.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(10)
        
        wallet_by_type = {w.get("account_type"): w.get("balance", 0) for w in wallet_accounts}
        total_balance = sum(w.get("balance", 0) for w in wallet_accounts)
        
        # Get savings goals total
        savings_goals = await db.savings_goals.find(
            {"child_id": student_id},
            {"_id": 0, "current_amount": 1}
        ).to_list(100)
        total_saved_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
        
        # Transactions summary
        transactions = await db.transactions.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(500)
        
        total_earned = sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) > 0)
        total_spent = abs(sum(t.get("amount", 0) for t in transactions if t.get("amount", 0) < 0))
        
        # Calculate spent per jar
        spent_per_jar = {"spending": 0, "savings": 0, "gifting": 0, "investing": 0}
        for t in transactions:
            txn_type = t.get("transaction_type", "")
            amount = t.get("amount", 0)
            if txn_type == "purchase" and amount < 0:
                spent_per_jar["spending"] += abs(amount)
            elif txn_type == "gift_sent" and amount < 0:
                spent_per_jar["gifting"] += abs(amount)
            elif txn_type in ["garden_buy", "stock_buy"] and amount < 0:
                spent_per_jar["investing"] += abs(amount)
        
        # Chores completed
        chore_requests = await db.chore_requests.find(
            {"child_id": student_id, "status": "approved"},
            {"_id": 0}
        ).to_list(100)
        
        # Quests completed
        quest_completions = await db.quest_completions.find(
            {"user_id": student_id, "is_completed": True},
            {"_id": 0}
        ).to_list(100)
        
        # Learning progress
        content_progress = await db.user_content_progress.count_documents({
            "user_id": student_id,
            "completed": True
        })
        
        # Garden profit/loss
        garden_transactions = await db.transactions.find(
            {"user_id": student_id, "transaction_type": {"$in": ["garden_buy", "garden_sell"]}},
            {"_id": 0}
        ).to_list(100)
        garden_invested = sum(abs(t.get("amount", 0)) for t in garden_transactions if t.get("transaction_type") == "garden_buy")
        garden_earned = sum(t.get("amount", 0) for t in garden_transactions if t.get("transaction_type") == "garden_sell")
        garden_pl = garden_earned - garden_invested
        
        # Stock profit/loss
        portfolio = await db.stock_portfolios.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(100)
        
        portfolio_value = 0
        total_cost = 0
        for holding in portfolio:
            stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
            if stock:
                portfolio_value += holding.get("quantity", 0) * stock.get("current_price", 0)
                total_cost += holding.get("total_cost", 0)
        
        stock_pl = round(portfolio_value - total_cost, 2)
        
        # Gifts
        gifts_received = await db.transactions.count_documents(
            {"user_id": student_id, "transaction_type": "gift_received"}
        )
        gifts_sent = await db.transactions.count_documents(
            {"user_id": student_id, "transaction_type": "gift_sent"}
        )
        
        # Badges
        badges_count = await db.user_achievements.count_documents({"user_id": student_id})
        
        comparison_data.append({
            "student_id": student_id,
            "name": student.get("name"),
            "avatar": student.get("avatar"),
            "streak": student.get("streak_count", 0),
            "total_balance": round(total_balance, 2),
            "spending_balance": round(wallet_by_type.get("spending", 0), 2),
            "spending_spent": round(spent_per_jar.get("spending", 0), 2),
            "savings_balance": round(wallet_by_type.get("savings", 0), 2),
            "savings_in_goals": round(total_saved_in_goals, 2),
            "gifting_balance": round(wallet_by_type.get("gifting", 0), 2),
            "gifting_spent": round(spent_per_jar.get("gifting", 0), 2),
            "investing_balance": round(wallet_by_type.get("investing", 0), 2),
            "investing_spent": round(spent_per_jar.get("investing", 0), 2),
            "total_earned": round(total_earned, 2),
            "total_spent": round(total_spent, 2),
            "chores_completed": len(chore_requests),
            "quests_completed": len(quest_completions),
            "lessons_completed": content_progress,
            "garden_pl": round(garden_pl, 2),
            "stock_pl": stock_pl,
            "gifts_received": gifts_received,
            "gifts_sent": gifts_sent,
            "badges": badges_count
        })
    
    # Sort by total balance descending
    comparison_data.sort(key=lambda x: x["total_balance"], reverse=True)
    
    return {
        "classroom": classroom,
        "students": comparison_data,
        "count": len(comparison_data)
    }

@api_router.delete("/teacher/classrooms/{classroom_id}")
async def delete_classroom(classroom_id: str, request: Request):
    """Delete a classroom"""
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    await db.classrooms.delete_one({"classroom_id": classroom_id})
    await db.classroom_students.delete_many({"classroom_id": classroom_id})
    await db.classroom_challenges.delete_many({"classroom_id": classroom_id})
    
    return {"message": "Classroom deleted"}

@api_router.post("/teacher/classrooms/{classroom_id}/reward")
async def give_classroom_reward(classroom_id: str, reward: ClassroomReward, request: Request):
    """Give coins to students"""
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    for student_id in reward.student_ids:
        await db.wallet_accounts.update_one(
            {"user_id": student_id, "account_type": "spending"},
            {"$inc": {"balance": reward.amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": student_id,
            "from_account": None,
            "to_account": "spending",
            "amount": reward.amount,
            "transaction_type": "reward",
            "description": f"Teacher reward: {reward.reason}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create notification for student
        await create_notification(
            user_id=student_id,
            notification_type="reward",
            title="🌟 You received a reward!",
            message=f"Your teacher gave you ₹{reward.amount}: {reward.reason}",
            from_user_id=teacher["user_id"],
            from_user_name=teacher.get("name"),
            amount=reward.amount
        )
    
    return {"message": f"Rewarded {len(reward.student_ids)} students with ₹{reward.amount} each"}

@api_router.post("/teacher/classrooms/{classroom_id}/challenges")
async def create_classroom_challenge(classroom_id: str, challenge: ChallengeCreate, request: Request):
    """Create a classroom challenge"""
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    challenge_doc = {
        "challenge_id": f"chal_{uuid.uuid4().hex[:12]}",
        "classroom_id": classroom_id,
        "title": challenge.title,
        "description": challenge.description,
        "reward_amount": challenge.reward_amount,
        "deadline": challenge.deadline,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.classroom_challenges.insert_one(challenge_doc)
    return {"message": "Challenge created", "challenge_id": challenge_doc["challenge_id"]}

@api_router.delete("/teacher/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, request: Request):
    """Delete a classroom challenge"""
    teacher = await require_teacher(request)
    
    challenge = await db.classroom_challenges.find_one({"challenge_id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    classroom = await db.classrooms.find_one({
        "classroom_id": challenge["classroom_id"],
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=403, detail="Not your challenge")
    
    await db.classroom_challenges.delete_one({"challenge_id": challenge_id})
    return {"message": "Challenge deleted"}

@api_router.post("/teacher/challenges/{challenge_id}/complete/{student_id}")
async def complete_challenge_for_student(challenge_id: str, student_id: str, request: Request):
    """Mark a challenge as complete for a student and give reward"""
    teacher = await require_teacher(request)
    
    challenge = await db.classroom_challenges.find_one({"challenge_id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    classroom = await db.classrooms.find_one({
        "classroom_id": challenge["classroom_id"],
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=403, detail="Not your classroom")
    
    existing = await db.challenge_completions.find_one({
        "challenge_id": challenge_id,
        "student_id": student_id
    })
    
    if existing:
        return {"message": "Challenge already completed by this student"}
    
    await db.challenge_completions.insert_one({
        "id": f"cc_{uuid.uuid4().hex[:12]}",
        "challenge_id": challenge_id,
        "student_id": student_id,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.wallet_accounts.update_one(
        {"user_id": student_id, "account_type": "spending"},
        {"$inc": {"balance": challenge["reward_amount"]}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": student_id,
        "from_account": None,
        "to_account": "spending",
        "amount": challenge["reward_amount"],
        "transaction_type": "reward",
        "description": f"Challenge completed: {challenge['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Challenge completed", "reward": challenge["reward_amount"]}

# ============== TEACHER ANNOUNCEMENT ROUTES ==============

class AnnouncementCreate(BaseModel):
    title: str
    message: str

@api_router.post("/teacher/classrooms/{classroom_id}/announcements")
async def create_announcement(classroom_id: str, announcement: AnnouncementCreate, request: Request):
    """Post an announcement to a classroom (visible to students and their parents)"""
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=403, detail="Not your classroom")
    
    announcement_doc = {
        "announcement_id": f"ann_{uuid.uuid4().hex[:12]}",
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"],
        "teacher_name": teacher.get("name", "Teacher"),
        "title": announcement.title,
        "message": announcement.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.classroom_announcements.insert_one(announcement_doc)
    
    # Notify all students in classroom
    students = await db.classroom_students.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    for student in students:
        # Notify student
        await create_notification(
            user_id=student["student_id"],
            notification_type="announcement",
            title=f"📢 {announcement.title}",
            message=announcement.message,
            from_user_id=teacher["user_id"],
            from_user_name=teacher.get("name"),
            related_id=classroom_id
        )
        
        # Find and notify student's parents
        parent_links = await db.parent_child_links.find(
            {"child_id": student["student_id"], "status": "active"},
            {"_id": 0}
        ).to_list(5)
        
        for link in parent_links:
            child_info = await db.users.find_one(
                {"user_id": student["student_id"]},
                {"_id": 0, "name": 1}
            )
            child_name = child_info.get("name", "Your child") if child_info else "Your child"
            
            await create_notification(
                user_id=link["parent_id"],
                notification_type="announcement",
                title=f"📢 {child_name}'s Class: {announcement.title}",
                message=announcement.message,
                from_user_id=teacher["user_id"],
                from_user_name=teacher.get("name"),
                related_id=classroom_id
            )
    
    return {"message": "Announcement posted", "announcement_id": announcement_doc["announcement_id"]}

@api_router.get("/teacher/classrooms/{classroom_id}/announcements")
async def get_classroom_announcements(classroom_id: str, request: Request):
    """Get announcements for a classroom"""
    teacher = await require_teacher(request)
    
    classroom = await db.classrooms.find_one({
        "classroom_id": classroom_id,
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=403, detail="Not your classroom")
    
    announcements = await db.classroom_announcements.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return announcements

@api_router.delete("/teacher/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, request: Request):
    """Delete an announcement"""
    teacher = await require_teacher(request)
    
    announcement = await db.classroom_announcements.find_one({"announcement_id": announcement_id})
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    classroom = await db.classrooms.find_one({
        "classroom_id": announcement["classroom_id"],
        "teacher_id": teacher["user_id"]
    })
    
    if not classroom:
        raise HTTPException(status_code=403, detail="Not your announcement")
    
    await db.classroom_announcements.delete_one({"announcement_id": announcement_id})
    return {"message": "Announcement deleted"}

@api_router.get("/teacher/students/{student_id}/progress")
async def get_student_progress(student_id: str, request: Request):
    """Get detailed progress for a student"""
    teacher = await require_teacher(request)
    
    student_classrooms = await db.classroom_students.find(
        {"student_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    classroom_ids = [sc["classroom_id"] for sc in student_classrooms]
    teacher_classroom = await db.classrooms.find_one({
        "classroom_id": {"$in": classroom_ids},
        "teacher_id": teacher["user_id"]
    })
    
    if not teacher_classroom:
        raise HTTPException(status_code=403, detail="Student not in your classroom")
    
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    topics = await db.learning_topics.find({}, {"_id": 0}).to_list(100)
    topic_progress = []
    for topic in topics:
        lessons = await db.learning_lessons.find({"topic_id": topic["topic_id"]}).to_list(100)
        lesson_ids = [l["lesson_id"] for l in lessons]
        completed = await db.user_lesson_progress.count_documents({
            "user_id": student_id,
            "lesson_id": {"$in": lesson_ids},
            "completed": True
        })
        topic_progress.append({
            "topic": topic["title"],
            "total": len(lessons),
            "completed": completed
        })
    
    wallet = await db.wallet_accounts.find({"user_id": student_id}, {"_id": 0}).to_list(10)
    
    transactions = await db.transactions.find(
        {"user_id": student_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    achievements = await db.user_achievements.find(
        {"user_id": student_id},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "student": student,
        "wallet": wallet,
        "topic_progress": topic_progress,
        "transactions": transactions,
        "achievements_count": len(achievements),
        "streak": student.get("streak_count", 0)
    }

@api_router.post("/student/join-classroom")
async def join_classroom(request: Request):
    """Join a classroom using invite code"""
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only students can join classrooms")
    
    body = await request.json()
    invite_code = (body.get("invite_code") or "").upper()
    
    classroom = await db.classrooms.find_one({"invite_code": invite_code}, {"_id": 0})
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    existing = await db.classroom_students.find_one({
        "classroom_id": classroom["classroom_id"],
        "student_id": user["user_id"]
    })
    
    if existing:
        return {"message": "Already in this classroom", "classroom": classroom}
    
    await db.classroom_students.insert_one({
        "id": f"cs_{uuid.uuid4().hex[:12]}",
        "classroom_id": classroom["classroom_id"],
        "student_id": user["user_id"],
        "joined_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Joined classroom successfully", "classroom": classroom}

@api_router.get("/student/classrooms")
async def get_student_classrooms(request: Request):
    """Get classrooms the student is in"""
    user = await get_current_user(request)
    
    student_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    classrooms = []
    for link in student_links:
        classroom = await db.classrooms.find_one(
            {"classroom_id": link["classroom_id"]},
            {"_id": 0}
        )
        if classroom:
            teacher = await db.users.find_one(
                {"user_id": classroom["teacher_id"]},
                {"_id": 0, "name": 1}
            )
            classroom["teacher_name"] = teacher.get("name", "Unknown") if teacher else "Unknown"
            classrooms.append(classroom)
    
    return classrooms

@api_router.get("/student/challenges")
async def get_student_challenges(request: Request):
    """Get challenges available to the student"""
    user = await get_current_user(request)
    
    student_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    classroom_ids = [link["classroom_id"] for link in student_links]
    
    challenges = await db.classroom_challenges.find(
        {"classroom_id": {"$in": classroom_ids}},
        {"_id": 0}
    ).to_list(100)
    
    for challenge in challenges:
        completion = await db.challenge_completions.find_one({
            "challenge_id": challenge["challenge_id"],
            "student_id": user["user_id"]
        })
        challenge["completed"] = completion is not None
    
    return challenges

# ============== CHILD CONNECTION ROUTES ==============

class AddParentRequest(BaseModel):
    parent_email: str

@api_router.post("/child/add-parent")
async def child_add_parent(add_request: AddParentRequest, request: Request):
    """Child adds a parent by email (max 2 parents)"""
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only children can add parents")
    
    # Check if child already has 2 parents
    existing_links = await db.parent_child_links.find(
        {"child_id": user["user_id"], "status": "active"}
    ).to_list(10)
    
    if len(existing_links) >= 2:
        raise HTTPException(status_code=400, detail="You can only have up to 2 parents linked")
    
    # Find parent by email
    parent = await db.users.find_one(
        {"email": add_request.parent_email, "role": "parent"},
        {"_id": 0}
    )
    
    if not parent:
        raise HTTPException(status_code=404, detail="Parent account not found. Make sure they signed up as a parent.")
    
    # Check if link already exists
    existing = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": user["user_id"]
    })
    
    if existing:
        return {"message": "Already connected to this parent", "parent_name": parent.get("name")}
    
    # Create link
    await db.parent_child_links.insert_one({
        "link_id": f"link_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": user["user_id"],
        "status": "active",
        "initiated_by": "child",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Parent added successfully!", "parent_name": parent.get("name")}

@api_router.get("/child/parents")
async def get_child_parents(request: Request):
    """Get child's linked parents"""
    user = await get_current_user(request)
    
    links = await db.parent_child_links.find(
        {"child_id": user["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(10)
    
    parents = []
    for link in links:
        parent = await db.users.find_one(
            {"user_id": link["parent_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1}
        )
        if parent:
            parents.append(parent)
    
    return parents

@api_router.get("/child/announcements")
async def get_child_announcements(request: Request):
    """Get announcements from all classrooms the child is in"""
    user = await get_current_user(request)
    
    # Get child's classrooms
    student_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    classroom_ids = [link["classroom_id"] for link in student_links]
    
    if not classroom_ids:
        return []
    
    # Get announcements from those classrooms
    announcements = await db.classroom_announcements.find(
        {"classroom_id": {"$in": classroom_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Add classroom name to each announcement
    for ann in announcements:
        classroom = await db.classrooms.find_one(
            {"classroom_id": ann["classroom_id"]},
            {"_id": 0, "name": 1}
        )
        ann["classroom_name"] = classroom.get("name", "Unknown") if classroom else "Unknown"
    
    return announcements

# ============== NOTIFICATION SYSTEM ==============

class NotificationCreate(BaseModel):
    user_id: str
    notification_type: str  # announcement, reward, gift_received, gift_request, quest_created, quest_completed
    title: str
    message: str
    from_user_id: Optional[str] = None
    from_user_name: Optional[str] = None
    related_id: Optional[str] = None  # classroom_id, chore_id, etc.
    amount: Optional[float] = None

async def create_notification(
    user_id: str, 
    notification_type: str, 
    title: str, 
    message: str,
    from_user_id: str = None,
    from_user_name: str = None,
    related_id: str = None,
    amount: float = None
):
    """Helper function to create notifications"""
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "from_user_id": from_user_id,
        "from_user_name": from_user_name,
        "related_id": related_id,
        "amount": amount,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification

@api_router.get("/notifications")
async def get_notifications(request: Request):
    """Get notifications for current user"""
    user = await get_current_user(request)
    
    notifications = await db.notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Normalize notification fields for consistency
    for notif in notifications:
        # Normalize type field: use notification_type, fallback to type
        if "notification_type" not in notif and "type" in notif:
            notif["notification_type"] = notif["type"]
        # Normalize read field: use read, fallback to is_read
        if "read" not in notif and "is_read" in notif:
            notif["read"] = notif["is_read"]
        elif "read" not in notif:
            notif["read"] = False
        # Ensure title exists (fallback to first part of message)
        if "title" not in notif or not notif["title"]:
            message = notif.get("message", "Notification")
            notif["title"] = message[:50] + "..." if len(message) > 50 else message
    
    # Count unread
    unread_count = sum(1 for n in notifications if not n.get("read", False))
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(request: Request):
    """Mark all notifications as read"""
    user = await get_current_user(request)
    
    # Update notifications with read: False
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    # Also update notifications with is_read: False (legacy field)
    await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True, "read": True}}
    )
    
    return {"message": "Notifications marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read (alias)"""
    user = await get_current_user(request)
    
    # Update notifications with read: False
    result1 = await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    # Also update notifications with is_read: False (legacy field)
    result2 = await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True, "read": True}}
    )
    
    total_updated = result1.modified_count + result2.modified_count
    return {"message": "All notifications marked as read", "updated": total_updated}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

# ============== CLASSMATES & GIFTING ==============

@api_router.get("/child/classmates")
async def get_classmates(request: Request):
    """Get all classmates with their info and savings goals"""
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only children can view classmates")
    
    # Get child's classrooms
    student_links = await db.classroom_students.find(
        {"student_id": user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    
    if not student_links:
        return {"classmates": [], "classroom": None}
    
    # Get first classroom
    classroom_id = student_links[0]["classroom_id"]
    classroom = await db.classrooms.find_one(
        {"classroom_id": classroom_id},
        {"_id": 0}
    )
    
    # Get all students in classroom
    all_students = await db.classroom_students.find(
        {"classroom_id": classroom_id},
        {"_id": 0}
    ).to_list(100)
    
    classmates = []
    for student_link in all_students:
        student_id = student_link["student_id"]
        if student_id == user["user_id"]:
            continue  # Skip self
        
        student = await db.users.find_one(
            {"user_id": student_id},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "streak_count": 1}
        )
        
        if not student:
            continue
        
        # Get wallet balance
        wallet = await db.wallet_accounts.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(10)
        total_balance = sum(w.get("balance", 0) for w in wallet)
        
        # Get lessons completed
        lessons_completed = await db.user_lesson_progress.count_documents({
            "user_id": student_id,
            "completed": True
        })
        
        # Get active savings goals (public)
        savings_goals = await db.savings_goals.find(
            {"user_id": student_id, "completed": False},
            {"_id": 0, "title": 1, "target_amount": 1, "current_amount": 1, "deadline": 1, "image_url": 1}
        ).to_list(5)
        
        classmates.append({
            "user_id": student["user_id"],
            "name": student.get("name"),
            "picture": student.get("picture"),
            "total_balance": total_balance,
            "lessons_completed": lessons_completed,
            "streak_count": student.get("streak_count", 0),
            "savings_goals": savings_goals
        })
    
    return {
        "classmates": classmates,
        "classroom": classroom
    }

class GiftMoneyRequest(BaseModel):
    recipient_id: str
    amount: float
    message: Optional[str] = ""

@api_router.post("/child/gift-money")
async def gift_money_to_classmate(gift: GiftMoneyRequest, request: Request):
    """Send money as a gift to a classmate"""
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only children can send gifts")
    
    if gift.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Check sender's giving account balance
    giving_account = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "gifting"
    })
    
    if not giving_account or giving_account.get("balance", 0) < gift.amount:
        raise HTTPException(status_code=400, detail="Not enough balance in your Giving jar")
    
    # Verify recipient exists and is a classmate
    recipient = await db.users.find_one({"user_id": gift.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Deduct from sender's giving account
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "gifting"},
        {"$inc": {"balance": -gift.amount}}
    )
    
    # Add to recipient's spending account
    await db.wallet_accounts.update_one(
        {"user_id": gift.recipient_id, "account_type": "spending"},
        {"$inc": {"balance": gift.amount}}
    )
    
    # Record transactions
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": "gift_sent",
        "amount": -gift.amount,
        "description": f"Gift to {recipient.get('name', 'classmate')}",
        "account_type": "gifting",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": gift.recipient_id,
        "type": "gift_received",
        "amount": gift.amount,
        "description": f"Gift from {user.get('name', 'classmate')}",
        "account_type": "spending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create notification for recipient
    await create_notification(
        user_id=gift.recipient_id,
        notification_type="gift_received",
        title="🎁 You received a gift!",
        message=f"{user.get('name', 'A classmate')} sent you ₹{gift.amount}" + (f": {gift.message}" if gift.message else ""),
        from_user_id=user["user_id"],
        from_user_name=user.get("name"),
        amount=gift.amount
    )
    
    return {"message": f"Gift of ₹{gift.amount} sent successfully!"}

class GiftRequestCreate(BaseModel):
    recipient_id: str
    amount: float
    reason: Optional[str] = ""

@api_router.post("/child/request-gift")
async def request_gift(req: GiftRequestCreate, request: Request):
    """Request money from a classmate"""
    user = await get_current_user(request)
    
    if user.get("role") != "child":
        raise HTTPException(status_code=400, detail="Only children can request gifts")
    
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Verify recipient exists
    recipient = await db.users.find_one({"user_id": req.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Create gift request record
    gift_request = {
        "request_id": f"giftreq_{uuid.uuid4().hex[:12]}",
        "requester_id": user["user_id"],
        "requester_name": user.get("name"),
        "recipient_id": req.recipient_id,
        "amount": req.amount,
        "reason": req.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gift_requests.insert_one(gift_request)
    
    # Create notification for recipient
    await create_notification(
        user_id=req.recipient_id,
        notification_type="gift_request",
        title="💝 Gift Request",
        message=f"{user.get('name', 'A classmate')} is asking for ₹{req.amount}" + (f": {req.reason}" if req.reason else ""),
        from_user_id=user["user_id"],
        from_user_name=user.get("name"),
        related_id=gift_request["request_id"],
        amount=req.amount
    )
    
    return {"message": "Gift request sent!", "request_id": gift_request["request_id"]}

@api_router.get("/child/gift-requests")
async def get_gift_requests(request: Request):
    """Get pending gift requests for user"""
    user = await get_current_user(request)
    
    # Requests received
    received = await db.gift_requests.find(
        {"recipient_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).to_list(20)
    
    # Requests sent
    sent = await db.gift_requests.find(
        {"requester_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).to_list(20)
    
    return {"received": received, "sent": sent}

@api_router.post("/child/gift-requests/{request_id}/respond")
async def respond_to_gift_request(request_id: str, request: Request):
    """Accept or decline a gift request"""
    user = await get_current_user(request)
    body = await request.json()
    action = body.get("action")  # "accept" or "decline"
    
    gift_request = await db.gift_requests.find_one({
        "request_id": request_id,
        "recipient_id": user["user_id"],
        "status": "pending"
    })
    
    if not gift_request:
        raise HTTPException(status_code=404, detail="Gift request not found")
    
    if action == "accept":
        # Check balance
        giving_account = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": "gifting"
        })
        
        if not giving_account or giving_account.get("balance", 0) < gift_request["amount"]:
            raise HTTPException(status_code=400, detail="Not enough balance in your Giving jar")
        
        # Transfer money
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": "gifting"},
            {"$inc": {"balance": -gift_request["amount"]}}
        )
        
        await db.wallet_accounts.update_one(
            {"user_id": gift_request["requester_id"], "account_type": "spending"},
            {"$inc": {"balance": gift_request["amount"]}}
        )
        
        # Record transactions
        await db.transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "type": "gift_sent",
            "amount": -gift_request["amount"],
            "description": f"Gift to {gift_request.get('requester_name', 'classmate')}",
            "account_type": "gifting",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        await db.transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": gift_request["requester_id"],
            "type": "gift_received",
            "amount": gift_request["amount"],
            "description": f"Gift from {user.get('name', 'classmate')} (requested)",
            "account_type": "spending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Notify requester
        await create_notification(
            user_id=gift_request["requester_id"],
            notification_type="gift_received",
            title="🎁 Gift request accepted!",
            message=f"{user.get('name', 'A classmate')} accepted your request and sent ₹{gift_request['amount']}",
            from_user_id=user["user_id"],
            from_user_name=user.get("name"),
            amount=gift_request["amount"]
        )
        
        await db.gift_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "accepted"}}
        )
        
        return {"message": f"Gift sent! ₹{gift_request['amount']} given."}
    else:
        await db.gift_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "declined"}}
        )
        
        # Notify requester
        await create_notification(
            user_id=gift_request["requester_id"],
            notification_type="gift_request_declined",
            title="Gift request declined",
            message=f"{user.get('name', 'A classmate')} couldn't fulfill your gift request",
            from_user_id=user["user_id"],
            from_user_name=user.get("name")
        )
        
        return {"message": "Request declined"}

# ============== PARENT ROUTES ==============

@api_router.get("/parent/dashboard")
async def parent_dashboard(request: Request):
    """Get parent dashboard data"""
    parent = await require_parent(request)
    
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    children = []
    for link in links:
        child = await db.users.find_one(
            {"user_id": link["child_id"]},
            {"_id": 0}
        )
        if child:
            wallet = await db.wallet_accounts.find(
                {"user_id": child["user_id"]},
                {"_id": 0}
            ).to_list(10)
            total_balance = sum(w.get("balance", 0) for w in wallet)
            
            total_lessons = await db.learning_lessons.count_documents({})
            completed_lessons = await db.user_lesson_progress.count_documents({
                "user_id": child["user_id"],
                "completed": True
            })
            
            pending_chores = await db.chores.count_documents({
                "child_id": child["user_id"],
                "status": "completed"
            })
            
            children.append({
                **child,
                "total_balance": total_balance,
                "lessons_completed": completed_lessons,
                "total_lessons": total_lessons,
                "pending_chores": pending_chores
            })
    
    pending_links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "children": children,
        "pending_links": len(pending_links)
    }

@api_router.post("/parent/link-child")
async def link_child(link_request: LinkChildRequest, request: Request):
    """Send a link request to a child account"""
    parent = await require_parent(request)
    
    child = await db.users.find_one(
        {"email": link_request.child_email, "role": "child"},
        {"_id": 0}
    )
    
    if not child:
        raise HTTPException(status_code=404, detail="Child account not found")
    
    existing = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child["user_id"]
    })
    
    if existing:
        return {"message": "Link already exists", "status": existing.get("status")}
    
    await db.parent_child_links.insert_one({
        "link_id": f"link_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": child["user_id"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Child linked successfully", "child": child}

@api_router.get("/parent/children")
async def get_children(request: Request):
    """Get parent's linked children"""
    parent = await require_parent(request)
    
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    children = []
    for link in links:
        child = await db.users.find_one(
            {"user_id": link["child_id"]},
            {"_id": 0}
        )
        if child:
            children.append(child)
    
    return children

@api_router.get("/parent/children/{child_id}/progress")
async def get_child_progress(child_id: str, request: Request):
    """Get detailed progress for a child"""
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    wallet = await db.wallet_accounts.find({"user_id": child_id}, {"_id": 0}).to_list(10)
    
    topics = await db.learning_topics.find({}, {"_id": 0}).to_list(100)
    topic_progress = []
    for topic in topics:
        lessons = await db.learning_lessons.find({"topic_id": topic["topic_id"]}).to_list(100)
        lesson_ids = [l["lesson_id"] for l in lessons]
        completed = await db.user_lesson_progress.count_documents({
            "user_id": child_id,
            "lesson_id": {"$in": lesson_ids},
            "completed": True
        })
        topic_progress.append({
            "topic": topic["title"],
            "icon": topic.get("icon", "📚"),
            "total": len(lessons),
            "completed": completed
        })
    
    transactions = await db.transactions.find(
        {"user_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    chores = await db.chores.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(100)
    
    goals = await db.savings_goals.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "child": child,
        "wallet": wallet,
        "topic_progress": topic_progress,
        "transactions": transactions,
        "chores": chores,
        "savings_goals": goals,
        "streak": child.get("streak_count", 0)
    }

@api_router.get("/parent/children/{child_id}/insights")
async def get_child_insights(child_id: str, request: Request):
    """Get comprehensive insights for a child (similar to teacher insights)"""
    parent = await require_parent(request)
    
    # Verify parent-child link
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    # Get child basic info
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "password": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    child_grade = child.get("grade", 0)
    
    # 1. WALLET - Get all account balances
    wallet_accounts = await db.wallet_accounts.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(10)
    
    # Get savings goals total
    savings_goals = await db.savings_goals.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(100)
    total_saved_in_goals = sum(g.get("current_amount", 0) for g in savings_goals)
    
    # Get all transactions
    all_transactions = await db.transactions.find(
        {"user_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Calculate spent per account type
    spent_per_jar = {"spending": 0, "savings": 0, "gifting": 0, "investing": 0}
    for t in all_transactions:
        txn_type = t.get("transaction_type", "")
        amount = t.get("amount", 0)
        if txn_type == "purchase" and amount < 0:
            spent_per_jar["spending"] += abs(amount)
        elif txn_type == "gift_sent" and amount < 0:
            spent_per_jar["gifting"] += abs(amount)
        elif txn_type in ["garden_buy", "stock_buy"] and amount < 0:
            spent_per_jar["investing"] += abs(amount)
    
    wallet_summary = {
        "accounts": [
            {
                "account_type": acc.get("account_type"),
                "balance": acc.get("balance", 0),
                "spent": spent_per_jar.get(acc.get("account_type"), 0)
            }
            for acc in wallet_accounts
        ],
        "total_balance": sum(w.get("balance", 0) for w in wallet_accounts),
        "savings_in_goals": total_saved_in_goals,
        "savings_goals_count": len(savings_goals),
        "savings_goals": [
            {
                "title": g.get("title"),
                "target": g.get("target_amount", 0),
                "current": g.get("current_amount", 0),
                "completed": g.get("completed", False)
            }
            for g in savings_goals
        ]
    }
    
    # 2. TRANSACTIONS summary
    total_earned = sum(t.get("amount", 0) for t in all_transactions if t.get("amount", 0) > 0)
    total_spent = abs(sum(t.get("amount", 0) for t in all_transactions if t.get("amount", 0) < 0))
    
    transaction_summary = {
        "recent": all_transactions[:10],
        "total_earned": total_earned,
        "total_spent": total_spent,
        "transaction_count": len(all_transactions)
    }
    
    # 3. CHORES - From this parent
    parent_chores = await db.parent_chores.find(
        {"child_id": child_id, "parent_id": parent["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    chore_requests = await db.chore_requests.find(
        {"child_id": child_id},
        {"_id": 0}
    ).to_list(100)
    
    chores_summary = {
        "total_assigned": len(parent_chores),
        "completed": len([c for c in chore_requests if c.get("status") == "approved"]),
        "pending": len([c for c in chore_requests if c.get("status") == "pending"]),
        "rejected": len([c for c in chore_requests if c.get("status") == "rejected"]),
        "recent_chores": parent_chores[:5]
    }
    
    # 4. QUESTS completed
    quest_completions = await db.quest_completions.find(
        {"user_id": child_id, "is_completed": True},
        {"_id": 0}
    ).to_list(100)
    
    quests_summary = {
        "completed": len(quest_completions)
    }
    
    # 5. GIFTS
    gifts_received = await db.transactions.find(
        {"user_id": child_id, "transaction_type": "gift_received"},
        {"_id": 0}
    ).to_list(100)
    
    gifts_sent = await db.transactions.find(
        {"user_id": child_id, "transaction_type": "gift_sent"},
        {"_id": 0}
    ).to_list(100)
    
    gifts_summary = {
        "received_count": len(gifts_received),
        "received_total": sum(g.get("amount", 0) for g in gifts_received),
        "sent_count": len(gifts_sent),
        "sent_total": abs(sum(g.get("amount", 0) for g in gifts_sent))
    }
    
    # 6. INVESTMENTS - Based on grade
    # Kindergarten (0): No investments
    # Grade 1-2: Garden only
    # Grade 3-5: Stocks only
    
    garden_summary = None
    stocks_summary = None
    
    if child_grade >= 1 and child_grade <= 2:
        # Garden for Grade 1-2
        farm = await db.farms.find_one({"user_id": child_id}, {"_id": 0})
        garden_transactions = await db.transactions.find(
            {"user_id": child_id, "transaction_type": {"$in": ["garden_buy", "garden_sell"]}},
            {"_id": 0}
        ).to_list(100)
        
        garden_invested = sum(abs(t.get("amount", 0)) for t in garden_transactions if t.get("transaction_type") == "garden_buy")
        garden_earned = sum(t.get("amount", 0) for t in garden_transactions if t.get("transaction_type") == "garden_sell")
        
        garden_summary = {
            "plots_owned": len(farm.get("plots", [])) if farm else 0,
            "total_invested": garden_invested,
            "total_earned": garden_earned,
            "profit_loss": garden_earned - garden_invested,
            "inventory_count": len(farm.get("inventory", [])) if farm else 0
        }
    elif child_grade >= 3:
        # Stocks for Grade 3-5
        portfolio = await db.stock_portfolios.find(
            {"user_id": child_id},
            {"_id": 0}
        ).to_list(100)
        
        stock_transactions = await db.transactions.find(
            {"user_id": child_id, "transaction_type": {"$in": ["stock_buy", "stock_sell"]}},
            {"_id": 0}
        ).to_list(100)
        
        stock_invested = sum(abs(t.get("amount", 0)) for t in stock_transactions if t.get("transaction_type") == "stock_buy")
        stock_earned = sum(t.get("amount", 0) for t in stock_transactions if t.get("transaction_type") == "stock_sell")
        
        portfolio_value = 0
        total_cost = 0
        for holding in portfolio:
            stock = await db.stocks.find_one({"stock_id": holding.get("stock_id")})
            if stock:
                portfolio_value += holding.get("quantity", 0) * stock.get("current_price", 0)
                total_cost += holding.get("total_cost", 0)
        
        stocks_summary = {
            "holdings_count": len(portfolio),
            "portfolio_value": round(portfolio_value, 2),
            "total_invested": stock_invested,
            "realized_gains": stock_earned - stock_invested,
            "unrealized_gains": round(portfolio_value - total_cost, 2)
        }
    
    # 7. LEARNING PROGRESS
    content_progress = await db.user_content_progress.find(
        {"user_id": child_id, "completed": True},
        {"_id": 0}
    ).to_list(1000)
    
    total_content = await db.content_items.count_documents({
        "is_published": True
    })
    
    learning_summary = {
        "lessons_completed": len(content_progress),
        "total_lessons": total_content,
        "completion_percentage": round(len(content_progress) / total_content * 100, 1) if total_content > 0 else 0
    }
    
    # 8. ACHIEVEMENTS
    achievements = await db.user_achievements.find(
        {"user_id": child_id},
        {"_id": 0}
    ).to_list(100)
    
    achievements_summary = {
        "badges_earned": len(achievements),
        "recent_badges": achievements[:5]
    }
    
    return {
        "child": {
            "user_id": child.get("user_id"),
            "name": child.get("name"),
            "email": child.get("email"),
            "grade": child_grade,
            "avatar": child.get("avatar"),
            "streak_count": child.get("streak_count", 0),
            "last_activity": child.get("last_activity_date")
        },
        "wallet": wallet_summary,
        "transactions": transaction_summary,
        "chores": chores_summary,
        "quests": quests_summary,
        "gifts": gifts_summary,
        "garden": garden_summary,
        "stocks": stocks_summary,
        "learning": learning_summary,
        "achievements": achievements_summary,
        "investment_type": "garden" if child_grade >= 1 and child_grade <= 2 else ("stocks" if child_grade >= 3 else None)
    }

@api_router.get("/parent/children/{child_id}/classroom")
async def get_child_classroom(child_id: str, request: Request):
    """Get child's classroom info and announcements for parent view"""
    parent = await require_parent(request)
    
    # Verify parent-child link
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    # Get child info
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "name": 1})
    child_name = child.get("name", "Child") if child else "Child"
    
    # Get child's classroom
    student_link = await db.classroom_students.find_one(
        {"student_id": child_id},
        {"_id": 0}
    )
    
    if not student_link:
        return {
            "has_classroom": False,
            "child_name": child_name,
            "classroom": None,
            "teacher": None,
            "announcements": []
        }
    
    classroom = await db.classrooms.find_one(
        {"classroom_id": student_link["classroom_id"]},
        {"_id": 0}
    )
    
    if not classroom:
        return {
            "has_classroom": False,
            "child_name": child_name,
            "classroom": None,
            "teacher": None,
            "announcements": []
        }
    
    # Get teacher info
    teacher = await db.users.find_one(
        {"user_id": classroom["teacher_id"]},
        {"_id": 0, "name": 1, "email": 1, "picture": 1}
    )
    
    # Get announcements
    announcements = await db.classroom_announcements.find(
        {"classroom_id": classroom["classroom_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "has_classroom": True,
        "child_name": child_name,
        "classroom": {
            "name": classroom.get("name"),
            "description": classroom.get("description"),
            "grade_level": classroom.get("grade_level")
        },
        "teacher": teacher,
        "announcements": announcements
    }

@api_router.post("/parent/chores")
async def create_chore(chore: ChoreCreate, request: Request):
    """Create a chore for a child"""
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": chore.child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    chore_doc = {
        "chore_id": f"chore_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": chore.child_id,
        "title": chore.title,
        "description": chore.description,
        "reward_amount": chore.reward_amount,
        "frequency": chore.frequency,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "approved_at": None
    }
    
    await db.chores.insert_one(chore_doc)
    
    # Notify child about new chore
    await create_notification(
        user_id=chore.child_id,
        notification_type="quest_created",
        title=f"📋 New Task: {chore.title}",
        message=f"Your parent assigned you a task worth ₹{chore.reward_amount}!",
        from_user_id=parent["user_id"],
        from_user_name=parent.get("name"),
        related_id=chore_doc["chore_id"],
        amount=chore.reward_amount
    )
    
    return {"message": "Chore created", "chore_id": chore_doc["chore_id"]}

@api_router.get("/parent/chores")
async def get_parent_chores(request: Request):
    """Get all chores created by parent"""
    parent = await require_parent(request)
    
    chores = await db.chores.find(
        {"parent_id": parent["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    for chore in chores:
        child = await db.users.find_one(
            {"user_id": chore["child_id"]},
            {"_id": 0, "name": 1}
        )
        chore["child_name"] = child.get("name", "Unknown") if child else "Unknown"
    
    return chores

@api_router.post("/parent/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request):
    """Approve a completed chore and give reward"""
    parent = await require_parent(request)
    
    chore = await db.chores.find_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"]
    })
    
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    if chore.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Chore not completed yet")
    
    await db.chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.wallet_accounts.update_one(
        {"user_id": chore["child_id"], "account_type": "spending"},
        {"$inc": {"balance": chore["reward_amount"]}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": chore["child_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": chore["reward_amount"],
        "transaction_type": "reward",
        "description": f"Chore completed: {chore['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify child about approved chore
    await create_notification(
        user_id=chore["child_id"],
        notification_type="reward",
        title=f"✅ Task Approved: {chore['title']}",
        message=f"Great job! You earned ₹{chore['reward_amount']}!",
        from_user_id=parent["user_id"],
        from_user_name=parent.get("name"),
        related_id=chore_id,
        amount=chore["reward_amount"]
    )
    
    if chore.get("frequency") in ["daily", "weekly"]:
        new_chore = {
            "chore_id": f"chore_{uuid.uuid4().hex[:12]}",
            "parent_id": parent["user_id"],
            "child_id": chore["child_id"],
            "title": chore["title"],
            "description": chore.get("description"),
            "reward_amount": chore["reward_amount"],
            "frequency": chore["frequency"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chores.insert_one(new_chore)
    
    return {"message": "Chore approved", "reward": chore["reward_amount"]}

@api_router.delete("/parent/chores/{chore_id}")
async def delete_chore(chore_id: str, request: Request):
    """Delete a chore"""
    parent = await require_parent(request)
    
    result = await db.chores.delete_one({
        "chore_id": chore_id,
        "parent_id": parent["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    return {"message": "Chore deleted"}

@api_router.post("/parent/allowance")
async def create_allowance(allowance: AllowanceCreate, request: Request):
    """Set up recurring allowance for a child"""
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": allowance.child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    today = datetime.now(timezone.utc)
    if allowance.frequency == "weekly":
        next_date = today + timedelta(days=7)
    elif allowance.frequency == "biweekly":
        next_date = today + timedelta(days=14)
    else:
        next_date = today + timedelta(days=30)
    
    existing = await db.allowances.find_one({
        "parent_id": parent["user_id"],
        "child_id": allowance.child_id,
        "active": True
    })
    
    if existing:
        await db.allowances.update_one(
            {"allowance_id": existing["allowance_id"]},
            {"$set": {
                "amount": allowance.amount,
                "frequency": allowance.frequency,
                "next_date": next_date.strftime("%Y-%m-%d")
            }}
        )
        return {"message": "Allowance updated"}
    
    allowance_doc = {
        "allowance_id": f"allow_{uuid.uuid4().hex[:12]}",
        "parent_id": parent["user_id"],
        "child_id": allowance.child_id,
        "amount": allowance.amount,
        "frequency": allowance.frequency,
        "next_date": next_date.strftime("%Y-%m-%d"),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.allowances.insert_one(allowance_doc)
    return {"message": "Allowance set up", "allowance_id": allowance_doc["allowance_id"]}

@api_router.get("/parent/allowances")
async def get_allowances(request: Request):
    """Get parent's allowance settings"""
    parent = await require_parent(request)
    
    allowances = await db.allowances.find(
        {"parent_id": parent["user_id"], "active": True},
        {"_id": 0}
    ).to_list(100)
    
    for allowance in allowances:
        child = await db.users.find_one(
            {"user_id": allowance["child_id"]},
            {"_id": 0, "name": 1}
        )
        allowance["child_name"] = child.get("name", "Unknown") if child else "Unknown"
    
    return allowances

@api_router.delete("/parent/allowances/{allowance_id}")
async def delete_allowance(allowance_id: str, request: Request):
    """Cancel an allowance"""
    parent = await require_parent(request)
    
    result = await db.allowances.update_one(
        {"allowance_id": allowance_id, "parent_id": parent["user_id"]},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Allowance not found")
    
    return {"message": "Allowance cancelled"}

@api_router.post("/parent/give-money")
async def give_money_to_child(request: Request):
    """Give money directly to a child"""
    parent = await require_parent(request)
    
    body = await request.json()
    child_id = body.get("child_id")
    amount = body.get("amount", 0)
    reason = body.get("reason", "Gift from parent")
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    await db.wallet_accounts.update_one(
        {"user_id": child_id, "account_type": "spending"},
        {"$inc": {"balance": amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": child_id,
        "from_account": None,
        "to_account": "spending",
        "amount": amount,
        "transaction_type": "deposit",
        "description": reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify child about received money
    await create_notification(
        user_id=child_id,
        notification_type="gift_received",
        title="💝 You received money!",
        message=f"Your parent sent you ₹{amount}: {reason}",
        from_user_id=parent["user_id"],
        from_user_name=parent.get("name"),
        amount=amount
    )
    
    return {"message": f"Gave ₹{amount} to child"}

@api_router.post("/parent/savings-goals")
async def create_savings_goal(goal: SavingsGoalCreate, request: Request):
    """Create a savings goal for a child"""
    parent = await require_parent(request)
    
    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": goal.child_id,
        "status": "active"
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Child not linked to your account")
    
    goal_doc = {
        "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
        "child_id": goal.child_id,
        "parent_id": parent["user_id"],
        "title": goal.title,
        "target_amount": goal.target_amount,
        "current_amount": 0,
        "deadline": goal.deadline,
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.savings_goals.insert_one(goal_doc)
    return {"message": "Savings goal created", "goal_id": goal_doc["goal_id"]}

@api_router.get("/parent/savings-goals")
async def get_savings_goals(request: Request):
    """Get savings goals for all children"""
    parent = await require_parent(request)
    
    links = await db.parent_child_links.find(
        {"parent_id": parent["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    child_ids = [link["child_id"] for link in links]
    
    goals = await db.savings_goals.find(
        {"child_id": {"$in": child_ids}},
        {"_id": 0}
    ).to_list(100)
    
    for goal in goals:
        child = await db.users.find_one(
            {"user_id": goal["child_id"]},
            {"_id": 0, "name": 1}
        )
        goal["child_name"] = child.get("name", "Unknown") if child else "Unknown"
    
    return goals

@api_router.get("/child/chores")
async def get_child_chores(request: Request):
    """Get chores assigned to the child"""
    user = await get_current_user(request)
    
    chores = await db.chores.find(
        {"child_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return chores

@api_router.post("/child/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, request: Request):
    """Mark a chore as completed (awaiting parent approval)"""
    user = await get_current_user(request)
    
    chore = await db.chores.find_one({
        "chore_id": chore_id,
        "child_id": user["user_id"]
    })
    
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    if chore.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Chore already completed or approved")
    
    await db.chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify parent that child completed the chore
    await create_notification(
        user_id=chore["parent_id"],
        notification_type="quest_completed",
        title=f"✅ {user.get('name', 'Your child')} completed a task!",
        message=f"Task: {chore['title']} - Please review and approve to give the reward of ₹{chore['reward_amount']}",
        from_user_id=user["user_id"],
        from_user_name=user.get("name"),
        related_id=chore_id,
        amount=chore["reward_amount"]
    )
    
    return {"message": "Chore marked as completed, waiting for parent approval"}

@api_router.get("/child/savings-goals")
async def get_child_savings_goals(request: Request):
    """Get savings goals for the child"""
    user = await get_current_user(request)
    
    goals = await db.savings_goals.find(
        {"child_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return goals

@api_router.post("/child/savings-goals")
async def create_child_savings_goal(goal: ChildSavingsGoalCreate, request: Request):
    """User creates their own savings goal"""
    user = await get_current_user(request)
    
    goal_doc = {
        "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
        "child_id": user["user_id"],
        "parent_id": None,  # No parent for self-created goals
        "title": goal.title,
        "description": goal.description,
        "image_url": goal.image_url,
        "target_amount": goal.target_amount,
        "current_amount": 0,
        "deadline": goal.deadline,
        "completed": False,
        "created_by": user.get("role", "child"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.savings_goals.insert_one(goal_doc)
    
    return {"message": "Savings goal created", "goal_id": goal_doc["goal_id"]}

@api_router.post("/child/savings-goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, request: Request):
    """Contribute to a savings goal from savings account"""
    user = await get_current_user(request)
    
    body = await request.json()
    amount = body.get("amount", 0)
    
    goal = await db.savings_goals.find_one({
        "goal_id": goal_id,
        "child_id": user["user_id"]
    })
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if goal.get("completed"):
        raise HTTPException(status_code=400, detail="Goal already completed")
    
    savings = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "savings"
    })
    
    if not savings or savings.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient savings balance")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "savings"},
        {"$inc": {"balance": -amount}}
    )
    
    new_amount = goal.get("current_amount", 0) + amount
    completed = new_amount >= goal["target_amount"]
    
    await db.savings_goals.update_one(
        {"goal_id": goal_id},
        {"$set": {"current_amount": new_amount, "completed": completed}}
    )
    
    return {
        "message": "Contribution added",
        "new_total": new_amount,
        "completed": completed
    }

# ============== FILE UPLOAD ROUTES ==============

@api_router.post("/upload/thumbnail")
async def upload_thumbnail(file: UploadFile = File(...)):
    """Upload a thumbnail image"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = THUMBNAILS_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/thumbnails/{filename}"}

@api_router.post("/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF worksheet"""
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    filename = f"{uuid.uuid4().hex[:16]}.pdf"
    file_path = PDFS_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/pdfs/{filename}"}

@api_router.post("/upload/activity")
async def upload_activity_html(file: UploadFile = File(...)):
    """Upload an HTML activity (zip file with index.html and assets)"""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")
    
    folder_name = uuid.uuid4().hex[:16]
    activity_folder = ACTIVITIES_DIR / folder_name
    activity_folder.mkdir(parents=True, exist_ok=True)
    
    # Save the zip file temporarily
    zip_path = activity_folder / "temp.zip"
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Extract the zip file
    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(activity_folder)
        zip_path.unlink()  # Remove the zip file after extraction
        
        # Check if index.html exists
        index_path = activity_folder / "index.html"
        if not index_path.exists():
            # Check subdirectory
            for item in activity_folder.iterdir():
                if item.is_dir():
                    sub_index = item / "index.html"
                    if sub_index.exists():
                        # Move contents up
                        for sub_item in item.iterdir():
                            shutil.move(str(sub_item), str(activity_folder / sub_item.name))
                        item.rmdir()
                        break
        
        if not (activity_folder / "index.html").exists():
            shutil.rmtree(activity_folder)
            raise HTTPException(status_code=400, detail="ZIP must contain an index.html file")
            
    except zipfile.BadZipFile:
        shutil.rmtree(activity_folder)
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    
    return {"url": f"/api/uploads/activities/{folder_name}/index.html", "folder": folder_name}

@api_router.post("/upload/html")
async def upload_html_file(file: UploadFile = File(...)):
    """Upload a standalone HTML file (not zipped)"""
    if not file.filename.endswith(".html") and not file.filename.endswith(".htm"):
        raise HTTPException(status_code=400, detail="File must be an HTML file (.html or .htm)")
    
    folder_name = uuid.uuid4().hex[:16]
    html_folder = ACTIVITIES_DIR / folder_name
    html_folder.mkdir(parents=True, exist_ok=True)
    
    # Save as index.html so it can be served the same way as ZIP extracts
    file_path = html_folder / "index.html"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/activities/{folder_name}/index.html", "folder": folder_name}

@api_router.post("/upload/video")
async def upload_video_file(file: UploadFile = File(...)):
    """Upload an MP4 video file"""
    allowed_extensions = [".mp4", ".webm", ".mov"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File must be a video ({', '.join(allowed_extensions)})")
    
    # Generate unique filename
    filename = f"{uuid.uuid4().hex[:16]}{file_ext}"
    file_path = VIDEOS_DIR / filename
    
    # Save the video file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/videos/{filename}"}

@api_router.post("/upload/goal-image")
async def upload_goal_image(file: UploadFile = File(...)):
    """Upload an image for a savings goal"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"goal_{uuid.uuid4().hex[:16]}{file_ext}"
    file_path = THUMBNAILS_DIR / filename
    
    # Save the image
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/thumbnails/{filename}"}

# ============== CONTENT MANAGEMENT ROUTES (NEW HIERARCHICAL SYSTEM) ==============

@api_router.get("/content/topics")
async def get_all_topics(request: Request, grade: Optional[int] = None):
    """Get all topics with hierarchy and unlock status (for users)"""
    user = await get_current_user(request)
    user_grade = user.get("grade") if user else None
    user_id = user.get("user_id") if user else None
    is_child = user.get("role") == "child" if user else False
    is_teacher = user.get("role") == "teacher" if user else False
    
    # If teacher provides grade filter, use that instead
    if is_teacher and grade is not None:
        user_grade = grade
    
    # Build query - if user has no grade or is admin, show all topics
    if user_grade is None or (user and user.get("role") == "admin"):
        query = {"parent_id": None}
    else:
        query = {"parent_id": None, "min_grade": {"$lte": user_grade}, "max_grade": {"$gte": user_grade}}
    
    # Get parent topics (no parent_id)
    parent_topics = await db.content_topics.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Get user's completed content if child
    completed_content_ids = set()
    if is_child and user_id:
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True},
            {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
    
    # Track if previous topic is completed (for sequential unlocking)
    previous_topic_completed = True  # First topic is always unlocked
    
    # For each parent, get subtopics
    for topic_idx, topic in enumerate(parent_topics):
        if user_grade is None or (user and user.get("role") == "admin"):
            subtopic_query = {"parent_id": topic["topic_id"]}
        else:
            subtopic_query = {"parent_id": topic["topic_id"], "min_grade": {"$lte": user_grade}, "max_grade": {"$gte": user_grade}}
        
        subtopics = await db.content_topics.find(subtopic_query, {"_id": 0}).sort("order", 1).to_list(100)
        topic["subtopics"] = subtopics
        
        # Get content count for the topic
        topic["content_count"] = await db.content_items.count_documents({"topic_id": topic["topic_id"], "is_published": True})
        
        # For children, calculate unlock status
        if is_child:
            topic["is_unlocked"] = previous_topic_completed
            topic["completed_count"] = 0
            topic["total_content"] = topic["content_count"]
            
            # Track subtopic completion for this topic
            all_subtopics_completed = True
            previous_subtopic_completed = previous_topic_completed  # First subtopic unlocked if topic is unlocked
            
            for subtopic_idx, subtopic in enumerate(subtopics):
                subtopic["content_count"] = await db.content_items.count_documents({"topic_id": subtopic["topic_id"], "is_published": True})
                topic["total_content"] += subtopic["content_count"]
                
                # Get content items to check completion
                subtopic_content = await db.content_items.find(
                    {"topic_id": subtopic["topic_id"], "is_published": True},
                    {"content_id": 1}
                ).sort("order", 1).to_list(100)
                
                subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
                subtopic["completed_count"] = subtopic_completed_count
                subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
                subtopic["is_unlocked"] = previous_subtopic_completed
                
                topic["completed_count"] += subtopic_completed_count
                
                if not subtopic["is_completed"]:
                    all_subtopics_completed = False
                
                # Next subtopic unlocked only if current is completed
                previous_subtopic_completed = subtopic["is_completed"]
            
            # Topic is completed if all subtopics are completed
            topic["is_completed"] = all_subtopics_completed and len(subtopics) > 0
            
            # Next topic unlocked only if current is completed
            previous_topic_completed = topic["is_completed"]
        else:
            for subtopic in subtopics:
                subtopic["content_count"] = await db.content_items.count_documents({"topic_id": subtopic["topic_id"], "is_published": True})
    
    return parent_topics

@api_router.get("/content/topics/{topic_id}")
async def get_topic_detail(topic_id: str, request: Request):
    """Get topic details with content items and unlock status (only published for non-admin)"""
    user = await get_current_user(request)
    is_admin = user and user.get("role") == "admin"
    is_child = user and user.get("role") == "child"
    user_id = user.get("user_id") if user else None
    
    topic = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get subtopics if this is a parent topic
    subtopics = await db.content_topics.find(
        {"parent_id": topic_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get content items for this topic (only published for non-admin users)
    content_query = {"topic_id": topic_id}
    if not is_admin:
        content_query["is_published"] = True
    
    content_items = await db.content_items.find(
        content_query,
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # For children, calculate unlock status for content and subtopics
    if is_child and user_id:
        # Get completed content IDs for this user
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True},
            {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        
        # Check if this topic/subtopic is unlocked by checking previous ones
        parent_topic = await db.content_topics.find_one({"topic_id": topic.get("parent_id")}, {"_id": 0}) if topic.get("parent_id") else None
        
        # Determine if this topic is unlocked
        topic_is_unlocked = True  # Default to unlocked, will verify below
        
        if topic.get("parent_id"):
            # This is a subtopic - check if previous subtopics are completed
            sibling_subtopics = await db.content_topics.find(
                {"parent_id": topic["parent_id"]},
                {"_id": 0}
            ).sort("order", 1).to_list(100)
            
            for sibling in sibling_subtopics:
                if sibling["topic_id"] == topic_id:
                    break  # We've reached the current subtopic
                
                # Check if this sibling is completed
                sibling_content = await db.content_items.find(
                    {"topic_id": sibling["topic_id"], "is_published": True},
                    {"content_id": 1}
                ).to_list(100)
                
                sibling_completed = all(c["content_id"] in completed_content_ids for c in sibling_content) and len(sibling_content) > 0
                if not sibling_completed:
                    topic_is_unlocked = False
                    break
        else:
            # This is a parent topic - check if previous topics are completed
            all_parent_topics = await db.content_topics.find(
                {"parent_id": None},
                {"_id": 0}
            ).sort("order", 1).to_list(100)
            
            for prev_topic in all_parent_topics:
                if prev_topic["topic_id"] == topic_id:
                    break  # We've reached the current topic
                
                # Check if this previous topic is completed (all its subtopics completed)
                prev_subtopics = await db.content_topics.find(
                    {"parent_id": prev_topic["topic_id"]},
                    {"_id": 0}
                ).to_list(100)
                
                prev_topic_completed = True
                for prev_sub in prev_subtopics:
                    prev_sub_content = await db.content_items.find(
                        {"topic_id": prev_sub["topic_id"], "is_published": True},
                        {"content_id": 1}
                    ).to_list(100)
                    
                    if not (all(c["content_id"] in completed_content_ids for c in prev_sub_content) and len(prev_sub_content) > 0):
                        prev_topic_completed = False
                        break
                
                if not prev_topic_completed:
                    topic_is_unlocked = False
                    break
        
        topic["is_unlocked"] = topic_is_unlocked
        
        # Add unlock status to content items (sequential within this topic/subtopic)
        previous_content_completed = topic_is_unlocked  # First content unlocked if topic is unlocked
        for content in content_items:
            content["is_completed"] = content["content_id"] in completed_content_ids
            content["is_unlocked"] = previous_content_completed
            previous_content_completed = content["is_completed"]
        
        # Add unlock status to subtopics
        previous_subtopic_completed = topic_is_unlocked
        for subtopic in subtopics:
            subtopic_content = await db.content_items.find(
                {"topic_id": subtopic["topic_id"], "is_published": True},
                {"content_id": 1}
            ).sort("order", 1).to_list(100)
            
            subtopic_completed_count = sum(1 for c in subtopic_content if c["content_id"] in completed_content_ids)
            subtopic["completed_count"] = subtopic_completed_count
            subtopic["content_count"] = len(subtopic_content)
            subtopic["is_completed"] = subtopic_completed_count == len(subtopic_content) and len(subtopic_content) > 0
            subtopic["is_unlocked"] = previous_subtopic_completed
            
            previous_subtopic_completed = subtopic["is_completed"]
    
    return {
        **topic,
        "subtopics": subtopics,
        "content_items": content_items
    }

@api_router.get("/content/items/{content_id}")
async def get_content_item(content_id: str, request: Request):
    """Get a single content item"""
    user = await get_current_user(request)
    is_admin = user and user.get("role") == "admin"
    
    item = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Non-admin users can only view published content
    if not is_admin and not item.get("is_published", False):
        raise HTTPException(status_code=404, detail="Content not found")
    
    return item

@api_router.post("/content/items/{content_id}/complete")
async def complete_content_item(content_id: str, request: Request):
    """Mark content item as completed and award coins"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    item = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # For children, verify the content is unlocked
    if user.get("role") == "child":
        user_id = user["user_id"]
        topic_id = item.get("topic_id")
        
        # Get all completed content for this user
        completed_docs = await db.user_content_progress.find(
            {"user_id": user_id, "completed": True},
            {"content_id": 1}
        ).to_list(1000)
        completed_content_ids = {doc["content_id"] for doc in completed_docs}
        
        # Get all content in this topic/subtopic in order
        topic_content = await db.content_items.find(
            {"topic_id": topic_id, "is_published": True},
            {"content_id": 1}
        ).sort("order", 1).to_list(100)
        
        # Find if this content is unlocked
        content_is_unlocked = True  # First content is unlocked by default
        for idx, content in enumerate(topic_content):
            if content["content_id"] == content_id:
                break
            # Previous content must be completed for this to be unlocked
            if content["content_id"] not in completed_content_ids:
                content_is_unlocked = False
                break
        
        # Also check if the topic/subtopic itself is unlocked
        topic = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
        if topic and topic.get("parent_id"):
            # This is a subtopic - check if previous subtopics are completed
            sibling_subtopics = await db.content_topics.find(
                {"parent_id": topic["parent_id"]},
                {"_id": 0}
            ).sort("order", 1).to_list(100)
            
            for sibling in sibling_subtopics:
                if sibling["topic_id"] == topic_id:
                    break
                sibling_content = await db.content_items.find(
                    {"topic_id": sibling["topic_id"], "is_published": True},
                    {"content_id": 1}
                ).to_list(100)
                if not (all(c["content_id"] in completed_content_ids for c in sibling_content) and len(sibling_content) > 0):
                    content_is_unlocked = False
                    break
        
        if not content_is_unlocked:
            raise HTTPException(status_code=403, detail="This content is locked. Complete the previous content first!")
    
    # Check if already completed
    existing = await db.user_content_progress.find_one({
        "user_id": user["user_id"],
        "content_id": content_id,
        "completed": True
    })
    
    if existing:
        return {"message": "Already completed", "reward": 0}
    
    # Record completion
    progress_id = f"prog_{uuid.uuid4().hex[:12]}"
    await db.user_content_progress.update_one(
        {"user_id": user["user_id"], "content_id": content_id},
        {
            "$set": {
                "id": progress_id,
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "started_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Award coins
    reward = item.get("reward_coins", 5)
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": reward}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "amount": reward,
        "transaction_type": "reward",
        "description": f"Completed: {item['title']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Content completed!", "reward": reward}

# ============== ADMIN CONTENT MANAGEMENT ROUTES ==============

@api_router.get("/admin/content/topics")
async def admin_get_all_topics(request: Request):
    """Get all topics for admin (including hidden ones)"""
    await require_admin(request)
    
    # Get all parent topics
    parent_topics = await db.content_topics.find(
        {"parent_id": None},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get all subtopics grouped by parent
    for topic in parent_topics:
        subtopics = await db.content_topics.find(
            {"parent_id": topic["topic_id"]},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        topic["subtopics"] = subtopics
    
    return parent_topics

@api_router.post("/admin/content/topics")
async def admin_create_topic(topic: TopicCreate, request: Request):
    """Create a topic or subtopic"""
    admin = await require_admin(request)
    
    # If parent_id is provided, verify parent exists
    if topic.parent_id:
        parent = await db.content_topics.find_one({"topic_id": topic.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent topic not found")
    
    topic_doc = {
        "topic_id": f"topic_{uuid.uuid4().hex[:12]}",
        "title": topic.title,
        "description": topic.description,
        "parent_id": topic.parent_id,
        "thumbnail": topic.thumbnail,
        "order": topic.order,
        "min_grade": topic.min_grade,
        "max_grade": topic.max_grade,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.content_topics.insert_one(topic_doc)
    topic_doc.pop("_id", None)
    return {"message": "Topic created", "topic": topic_doc}

@api_router.put("/admin/content/topics/{topic_id}")
async def admin_update_topic(topic_id: str, topic: TopicUpdate, request: Request):
    """Update a topic"""
    await require_admin(request)
    
    update_data = {k: v for k, v in topic.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.content_topics.update_one(
        {"topic_id": topic_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    updated = await db.content_topics.find_one({"topic_id": topic_id}, {"_id": 0})
    return {"message": "Topic updated", "topic": updated}

@api_router.delete("/admin/content/topics/{topic_id}")
async def admin_delete_topic(topic_id: str, request: Request):
    """Delete a topic and all its content"""
    await require_admin(request)
    
    # Delete subtopics first
    subtopics = await db.content_topics.find({"parent_id": topic_id}, {"topic_id": 1}).to_list(100)
    for subtopic in subtopics:
        await db.content_items.delete_many({"topic_id": subtopic["topic_id"]})
    await db.content_topics.delete_many({"parent_id": topic_id})
    
    # Delete content items
    await db.content_items.delete_many({"topic_id": topic_id})
    
    # Delete the topic
    await db.content_topics.delete_one({"topic_id": topic_id})
    
    return {"message": "Topic and all associated content deleted"}

@api_router.post("/admin/content/topics/reorder")
async def admin_reorder_topics(reorder: ReorderRequest, request: Request):
    """Reorder topics"""
    await require_admin(request)
    
    for item in reorder.items:
        await db.content_topics.update_one(
            {"topic_id": item["id"]},
            {"$set": {"order": item["order"]}}
        )
    
    return {"message": "Topics reordered"}

@api_router.post("/admin/content/subtopics/{subtopic_id}/move")
async def admin_move_subtopic(subtopic_id: str, request: Request):
    """Move a subtopic to a different parent topic"""
    await require_admin(request)
    
    body = await request.json()
    new_parent_id = body.get("new_parent_id")
    
    if not new_parent_id:
        raise HTTPException(status_code=400, detail="new_parent_id is required")
    
    # Verify subtopic exists and is indeed a subtopic
    subtopic = await db.content_topics.find_one({"topic_id": subtopic_id})
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")
    
    if not subtopic.get("parent_id"):
        raise HTTPException(status_code=400, detail="Cannot move a parent topic. This is only for subtopics.")
    
    # Verify new parent exists and is a parent topic
    new_parent = await db.content_topics.find_one({"topic_id": new_parent_id})
    if not new_parent:
        raise HTTPException(status_code=404, detail="Target topic not found")
    
    if new_parent.get("parent_id"):
        raise HTTPException(status_code=400, detail="Cannot move subtopic to another subtopic. Target must be a parent topic.")
    
    # Get max order in the new parent
    max_order_doc = await db.content_topics.find_one(
        {"parent_id": new_parent_id},
        sort=[("order", -1)]
    )
    new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
    
    # Update the subtopic's parent
    await db.content_topics.update_one(
        {"topic_id": subtopic_id},
        {"$set": {"parent_id": new_parent_id, "order": new_order}}
    )
    
    return {"message": f"Subtopic moved to {new_parent['title']}", "new_parent_id": new_parent_id}

@api_router.post("/admin/content/items/{content_id}/move")
async def admin_move_content(content_id: str, request: Request):
    """Move a content item to a different topic/subtopic"""
    await require_admin(request)
    
    body = await request.json()
    new_topic_id = body.get("new_topic_id")
    
    if not new_topic_id:
        raise HTTPException(status_code=400, detail="new_topic_id is required")
    
    # Verify content exists
    content = await db.content_items.find_one({"content_id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Verify new topic exists
    new_topic = await db.content_topics.find_one({"topic_id": new_topic_id})
    if not new_topic:
        raise HTTPException(status_code=404, detail="Target topic/subtopic not found")
    
    # Get max order in the new topic
    max_order_doc = await db.content_items.find_one(
        {"topic_id": new_topic_id},
        sort=[("order", -1)]
    )
    new_order = (max_order_doc.get("order", 0) + 1) if max_order_doc else 0
    
    # Update the content's topic
    await db.content_items.update_one(
        {"content_id": content_id},
        {"$set": {"topic_id": new_topic_id, "order": new_order}}
    )
    
    return {"message": f"Content moved to {new_topic['title']}", "new_topic_id": new_topic_id}

@api_router.get("/admin/content/items")
async def admin_get_all_content_items(request: Request, topic_id: Optional[str] = None):
    """Get all content items, optionally filtered by topic"""
    await require_admin(request)
    
    query = {}
    if topic_id:
        query["topic_id"] = topic_id
    
    items = await db.content_items.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    return items

@api_router.post("/admin/content/items")
async def admin_create_content_item(item: ContentItemCreate, request: Request):
    """Create a content item"""
    admin = await require_admin(request)
    
    # Verify topic exists
    topic = await db.content_topics.find_one({"topic_id": item.topic_id})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    content_doc = {
        "content_id": f"content_{uuid.uuid4().hex[:12]}",
        "topic_id": item.topic_id,
        "title": item.title,
        "description": item.description,
        "content_type": item.content_type,
        "thumbnail": item.thumbnail,
        "order": item.order,
        "min_grade": item.min_grade,
        "max_grade": item.max_grade,
        "reward_coins": item.reward_coins,
        "content_data": item.content_data,
        "visible_to": item.visible_to,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.content_items.insert_one(content_doc)
    content_doc.pop("_id", None)
    return {"message": "Content created", "content": content_doc}

@api_router.put("/admin/content/items/{content_id}")
async def admin_update_content_item(content_id: str, item: ContentItemUpdate, request: Request):
    """Update a content item"""
    await require_admin(request)
    
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.content_items.update_one(
        {"content_id": content_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    updated = await db.content_items.find_one({"content_id": content_id}, {"_id": 0})
    return {"message": "Content updated", "content": updated}

@api_router.delete("/admin/content/items/{content_id}")
async def admin_delete_content_item(content_id: str, request: Request):
    """Delete a content item"""
    await require_admin(request)
    
    # Get item to check for associated files
    item = await db.content_items.find_one({"content_id": content_id})
    if item:
        content_data = item.get("content_data", {})
        # Clean up files if they exist
        if content_data.get("pdf_url"):
            pdf_path = ROOT_DIR / content_data["pdf_url"].lstrip("/")
            if pdf_path.exists():
                pdf_path.unlink()
        if content_data.get("html_folder"):
            activity_path = ACTIVITIES_DIR / content_data["html_folder"]
            if activity_path.exists():
                shutil.rmtree(activity_path)
    
    await db.content_items.delete_one({"content_id": content_id})
    await db.user_content_progress.delete_many({"content_id": content_id})
    
    return {"message": "Content deleted"}

@api_router.post("/admin/content/items/reorder")
async def admin_reorder_content_items(reorder: ReorderRequest, request: Request):
    """Reorder content items within a topic"""
    await require_admin(request)
    
    for item in reorder.items:
        await db.content_items.update_one(
            {"content_id": item["id"]},
            {"$set": {"order": item["order"]}}
        )
    
    return {"message": "Content items reordered"}

@api_router.post("/admin/content/items/{content_id}/toggle-publish")
async def admin_toggle_publish(content_id: str, request: Request):
    """Toggle the publish status of a content item"""
    await require_admin(request)
    
    item = await db.content_items.find_one({"content_id": content_id})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    new_status = not item.get("is_published", False)
    
    await db.content_items.update_one(
        {"content_id": content_id},
        {"$set": {"is_published": new_status}}
    )
    
    return {"message": f"Content {'published' if new_status else 'unpublished'}", "is_published": new_status}

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
            "topics": await db.content_topics.count_documents({"parent_id": None}),
            "subtopics": await db.content_topics.count_documents({"parent_id": {"$ne": None}}),
            "lessons": await db.content_items.count_documents({"content_type": "lesson"}),
            "books": await db.content_items.count_documents({"content_type": "book"}),
            "worksheets": await db.content_items.count_documents({"content_type": "worksheet"}),
            "activities": await db.content_items.count_documents({"content_type": "activity"}),
            "total_content": await db.content_items.count_documents({})
        },
        "legacy_content": {
            "topics": await db.learning_topics.count_documents({}),
            "lessons": await db.learning_lessons.count_documents({}),
            "books": await db.books.count_documents({}),
            "activities": await db.activities.count_documents({}),
            "quizzes": await db.quizzes.count_documents({})
        },
        "engagement": {
            "content_completed": await db.user_content_progress.count_documents({"completed": True}),
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
        {"achievement_id": "ach_007", "name": "Generous Heart", "description": "Give 50 coins to charity", "icon": "❤️", "category": "gifting", "requirement_value": 50, "points": 35},
        {"achievement_id": "ach_008", "name": "Money Master", "description": "Reach a total balance of 500", "icon": "🎓", "category": "savings", "requirement_value": 500, "points": 75},
    ]
    
    # Clear and insert (quests are now managed by admin/teacher/parent)
    await db.store_items.delete_many({})
    await db.achievements.delete_many({})
    
    if store_items:
        await db.store_items.insert_many(store_items)
    if achievements:
        await db.achievements.insert_many(achievements)
    
    return {"message": "Seed data created successfully"}

@api_router.post("/seed-learning")
async def seed_learning_content():
    """Seed learning topics, lessons, books and activities"""
    
    # Learning Topics
    topics = [
        {"topic_id": "topic_history", "title": "History of Money", "description": "Learn how money was invented and evolved over time", "category": "history", "icon": "🏛️", "order": 1, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_barter", "title": "The Barter System", "description": "Discover how people traded before money existed", "category": "history", "icon": "🤝", "order": 2, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_coins", "title": "Coins Through History", "description": "From gold and silver to modern coins", "category": "history", "icon": "🪙", "order": 3, "min_grade": 1, "max_grade": 5},
        {"topic_id": "topic_currency", "title": "Modern Currency", "description": "How money works today - bills, coins, and digital money", "category": "concepts", "icon": "💵", "order": 4, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_needs_wants", "title": "Needs vs Wants", "description": "Learn the difference between things you need and things you want", "category": "concepts", "icon": "🤔", "order": 5, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_saving", "title": "The Power of Saving", "description": "Why saving money is important and how to do it", "category": "skills", "icon": "🐷", "order": 6, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_spending", "title": "Smart Spending", "description": "How to make wise choices when spending money", "category": "skills", "icon": "🛒", "order": 7, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_earning", "title": "Earning Money", "description": "Different ways people earn money", "category": "skills", "icon": "💼", "order": 8, "min_grade": 0, "max_grade": 5},
        {"topic_id": "topic_budget", "title": "Making a Budget", "description": "Planning how to use your money wisely", "category": "skills", "icon": "📊", "order": 9, "min_grade": 2, "max_grade": 5},
        {"topic_id": "topic_giving", "title": "Giving and Sharing", "description": "The joy of helping others with your money", "category": "concepts", "icon": "❤️", "order": 10, "min_grade": 0, "max_grade": 5},
    ]
    
    # Lessons
    lessons = [
        # History of Money
        {"lesson_id": "lesson_001", "topic_id": "topic_history", "title": "Before Money Existed", "content": "# Life Before Money\n\nA long, long time ago, there was no money! People had to find other ways to get what they needed.\n\n## What Did People Do?\n\nImagine you have some apples but need shoes. What would you do? You would have to find someone who:\n- Has shoes\n- Wants apples\n\nThis was very hard! Sometimes people walked for days to find the right trade.", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_002", "topic_id": "topic_history", "title": "The Invention of Money", "content": "# How Money Was Invented\n\n## The Problem\nTrading (bartering) was hard because you had to find someone who wanted exactly what you had.\n\n## The Solution\nPeople started using special objects that everyone agreed had value:\n- Shells 🐚\n- Beads \n- Salt\n- Metal pieces\n\n## Why It Worked\nNow you could trade your apples for shells, then use shells to buy shoes anytime!", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        
        # Barter System
        {"lesson_id": "lesson_003", "topic_id": "topic_barter", "title": "What is Bartering?", "content": "# The Barter System\n\n**Bartering** means trading one thing for another without using money.\n\n## Examples of Bartering\n- Trading your sandwich for someone's cookie at lunch\n- Trading toys with a friend\n- A farmer trading vegetables for eggs\n\n## The Challenge\nWhat if someone has what you want, but doesn't want what you have? That's why bartering was tricky!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_004", "topic_id": "topic_barter", "title": "Bartering Game", "content": "# Let's Practice Bartering!\n\nImagine you have these items:\n- 3 apples 🍎🍎🍎\n- 2 pencils ✏️✏️\n- 1 book 📖\n\n## Your Mission\nYou want to get a toy car 🚗\n\n**Think about:**\n- What would you trade?\n- What might be a fair trade?\n- How would you convince someone to trade?", "lesson_type": "interactive", "duration_minutes": 10, "order": 2, "min_grade": 0, "max_grade": 3, "reward_coins": 10},
        
        # Coins Through History
        {"lesson_id": "lesson_005", "topic_id": "topic_coins", "title": "The First Coins", "content": "# The First Coins Ever Made\n\n## Gold and Silver\nAbout 2,600 years ago, people started making coins from:\n- **Gold** ✨ - Very valuable and rare\n- **Silver** 🥈 - Valuable but more common\n- **Bronze** 🥉 - For everyday purchases\n\n## Why Coins Were Great\n- Easy to carry\n- Everyone knew their value\n- Didn't spoil like food\n- Could be saved for later", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 1, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_006", "topic_id": "topic_coins", "title": "Coins Today", "content": "# Modern Coins\n\n## Coins in Your Country\nToday's coins are made from:\n- Copper\n- Nickel\n- Zinc\n\n## Did You Know?\n- Coins have different sizes for different values\n- Blind people can tell coins apart by touch\n- Some coins are worth collecting!\n\n## Fun Fact\nPennies in the US used to be bigger than today's quarters!", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 1, "max_grade": 5, "reward_coins": 5},
        
        # Modern Currency
        {"lesson_id": "lesson_007", "topic_id": "topic_currency", "title": "Paper Money", "content": "# Bills and Paper Money\n\n## Why Paper?\nCoins were heavy! Imagine carrying 100 gold coins. 😅\n\n**Paper money is:**\n- Light and easy to carry\n- Can show bigger amounts\n- Has special pictures and security features\n\n## Important!\nPaper money is only valuable because we all agree it is. The paper itself isn't worth much!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_008", "topic_id": "topic_currency", "title": "Digital Money", "content": "# Money on Computers!\n\n## What is Digital Money?\nMoney doesn't always need to be physical. Today we have:\n- Money in bank accounts 🏦\n- Credit cards 💳\n- Mobile payments 📱\n\n## How It Works\nWhen your parents pay with a card, the store's computer talks to the bank's computer to move the money.\n\n## It's Still Real!\nDigital money is just as real as cash - it's just invisible!", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 2, "max_grade": 5, "reward_coins": 5},
        
        # Needs vs Wants
        {"lesson_id": "lesson_009", "topic_id": "topic_needs_wants", "title": "What Do You Need?", "content": "# Needs - Things You Can't Live Without\n\n## What Are Needs?\nNeeds are things you MUST have to survive and stay healthy:\n\n- 🏠 **Shelter** - A safe place to live\n- 🍎 **Food** - Healthy meals to grow strong\n- 💧 **Water** - Clean water to drink\n- 👕 **Clothing** - To stay warm and protected\n- 💊 **Healthcare** - When you're sick\n\n## Remember\nNeeds come FIRST when spending money!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_010", "topic_id": "topic_needs_wants", "title": "What Do You Want?", "content": "# Wants - Nice to Have!\n\n## What Are Wants?\nWants are things that make life fun, but you can live without:\n\n- 🎮 Video games\n- 🍦 Ice cream\n- 🧸 New toys\n- 📱 Latest gadgets\n\n## Important Lesson\nWants are okay! But...\n- Pay for needs FIRST\n- Save for wants\n- You can't have EVERYTHING you want\n\n## Think About It\nIs a birthday cake a need or a want? 🎂", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_011", "topic_id": "topic_needs_wants", "title": "Need or Want? Game", "content": "# Let's Sort! Need or Want?\n\nLook at each item and decide: Is it a NEED or a WANT?\n\n1. 🥛 Milk\n2. 🎸 Guitar\n3. 🏠 House\n4. 🛹 Skateboard\n5. 🥾 Winter boots\n6. 🎪 Circus tickets\n7. 📚 School books\n8. 🍕 Pizza party\n\n## Think Deeper\nSome things can be tricky!\n- You NEED shoes, but do you NEED the most expensive ones?\n- You NEED food, but is candy a need?", "lesson_type": "quiz", "duration_minutes": 10, "order": 3, "min_grade": 0, "max_grade": 5, "reward_coins": 10},
        
        # Saving
        {"lesson_id": "lesson_012", "topic_id": "topic_saving", "title": "Why Save Money?", "content": "# The Magic of Saving!\n\n## What is Saving?\nSaving means keeping some money instead of spending it all right away.\n\n## Why Should You Save?\n\n🎯 **Goals** - Save for something special\n🛡️ **Safety** - Have money for emergencies\n😊 **Choices** - Have more options later\n📈 **Growth** - Your money can grow!\n\n## The Piggy Bank Way\nEvery time you get money, put some in your piggy bank BEFORE spending any!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_013", "topic_id": "topic_saving", "title": "Setting a Savings Goal", "content": "# Pick a Savings Goal!\n\n## How to Set a Goal\n\n1. **Choose something** you really want\n2. **Find out** how much it costs\n3. **Make a plan** to save that amount\n4. **Track** your progress\n5. **Celebrate** when you reach it! 🎉\n\n## Example\n- Goal: New book ($10)\n- You get $2 per week allowance\n- Saving half = $1 per week\n- Time to reach goal: 10 weeks!\n\n## Your Turn\nWhat would YOU save for?", "lesson_type": "interactive", "duration_minutes": 10, "order": 2, "min_grade": 0, "max_grade": 5, "reward_coins": 10},
        
        # Spending
        {"lesson_id": "lesson_014", "topic_id": "topic_spending", "title": "Think Before You Buy", "content": "# Smart Spending Starts Here!\n\n## The STOP Method\n\n🛑 **S**top - Don't buy right away\n🤔 **T**hink - Do I really need this?\n⚖️ **O**ptions - Is there a better choice?\n📝 **P**lan - Does this fit my budget?\n\n## Questions to Ask\n- Will I still want this tomorrow?\n- Can I afford it AND still save?\n- Is there something similar that costs less?", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_015", "topic_id": "topic_spending", "title": "Comparing Prices", "content": "# Become a Price Detective! 🔍\n\n## Why Compare?\nThe same thing can cost different amounts in different places!\n\n## Where to Look\n- Different stores\n- Online vs in-store\n- Sales and discounts\n- Generic vs brand name\n\n## Example\n- Toy at Store A: $15\n- Same toy at Store B: $12\n- Same toy on sale: $10\n\n**You saved $5 by comparing!**", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 1, "max_grade": 5, "reward_coins": 5},
        
        # Earning
        {"lesson_id": "lesson_016", "topic_id": "topic_earning", "title": "How Do People Earn Money?", "content": "# Ways to Earn Money\n\n## Adults Earn By:\n- Working at jobs 👨‍💼👩‍🔬👨‍🍳\n- Running businesses 🏪\n- Creating things to sell 🎨\n- Helping others with services 💇\n\n## Kids Can Earn By:\n- Doing extra chores at home 🧹\n- Helping neighbors (with parent permission) 🌻\n- Having a lemonade stand 🍋\n- Selling crafts or drawings 🖼️\n\n## Important!\nEarning money takes time and effort. That's why it's important to spend it wisely!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_017", "topic_id": "topic_earning", "title": "Work and Rewards", "content": "# The Connection: Work = Money\n\n## Understanding Value\n\nWhen you work, you're giving your:\n- ⏰ Time\n- 💪 Effort\n- 🧠 Skills\n\nIn return, you get money that represents that value!\n\n## Fair Exchange\n- Harder work often means more money\n- Special skills can earn more\n- Everyone's time is valuable\n\n## Think About It\nWhat skills do you have that could help someone?", "lesson_type": "story", "duration_minutes": 5, "order": 2, "min_grade": 1, "max_grade": 5, "reward_coins": 5},
        
        # Budget
        {"lesson_id": "lesson_018", "topic_id": "topic_budget", "title": "What is a Budget?", "content": "# Your Money Plan: The Budget!\n\n## What is a Budget?\nA budget is a plan for how to use your money.\n\n## Simple Budget Example\nIf you get $10:\n- 💰 Save: $4 (40%)\n- 🎁 Spend: $4 (40%)\n- ❤️ Give: $2 (20%)\n\n## Why Budget?\n- No surprises\n- Reach goals faster\n- Feel in control\n- Less money stress", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 2, "max_grade": 5, "reward_coins": 5},
        {"lesson_id": "lesson_019", "topic_id": "topic_budget", "title": "Create Your Budget", "content": "# Make Your Own Budget!\n\n## The Jar System 🫙\n\nGet 3 jars and label them:\n1. **SAVE** - For future goals\n2. **SPEND** - For things you want now\n3. **SHARE** - For helping others\n\n## How to Use\nEvery time you get money:\n1. Divide it between jars\n2. Only spend from SPEND jar\n3. Watch SAVE jar grow!\n\n## Your Plan\nDecide: What % goes in each jar?", "lesson_type": "interactive", "duration_minutes": 10, "order": 2, "min_grade": 2, "max_grade": 5, "reward_coins": 10},
        
        # Giving
        {"lesson_id": "lesson_020", "topic_id": "topic_giving", "title": "The Joy of Giving", "content": "# Sharing Makes Us Happy!\n\n## Why Give?\n- Helps people who need it 🤗\n- Makes you feel good inside 💖\n- Creates a kinder world 🌍\n- Sets a good example 🌟\n\n## Ways to Give\n- Donate to charity\n- Buy a gift for someone\n- Give to your community\n- Help someone in need\n\n## Fun Fact\nStudies show that giving money away actually makes people happier than spending it on themselves!", "lesson_type": "story", "duration_minutes": 5, "order": 1, "min_grade": 0, "max_grade": 5, "reward_coins": 5},
    ]
    
    # Books
    books = [
        {"book_id": "book_001", "title": "The Berenstain Bears' Trouble with Money", "author": "Stan & Jan Berenstain", "description": "Brother and Sister Bear learn the value of money and what it means to earn, save, and spend wisely.", "cover_url": "📚", "category": "story", "min_grade": 0, "max_grade": 2},
        {"book_id": "book_002", "title": "Alexander, Who Used to Be Rich Last Sunday", "author": "Judith Viorst", "description": "Alexander gets money from his grandparents, but it doesn't last long! A funny story about spending decisions.", "cover_url": "📖", "category": "story", "min_grade": 0, "max_grade": 3},
        {"book_id": "book_003", "title": "Money Ninja", "author": "Mary Nhin", "description": "A fun ninja-themed book teaching kids about saving, spending, and sharing money.", "cover_url": "🥷", "category": "story", "min_grade": 1, "max_grade": 4},
        {"book_id": "book_004", "title": "Rock, Brock, and the Savings Shock", "author": "Sheila Bair", "description": "Twin brothers learn about compound interest and the magic of saving.", "cover_url": "💎", "category": "story", "min_grade": 2, "max_grade": 5},
        {"book_id": "book_005", "title": "My First Money Book", "author": "PocketQuest Team", "description": "A beginner's guide to coins, bills, and the basics of money.", "cover_url": "🌟", "category": "workbook", "min_grade": 0, "max_grade": 1},
        {"book_id": "book_006", "title": "Budgeting for Kids", "author": "PocketQuest Team", "description": "Interactive workbook to help kids create and maintain their first budget.", "cover_url": "📊", "category": "workbook", "min_grade": 2, "max_grade": 5},
    ]
    
    # Activities
    activities = [
        {"activity_id": "act_001", "title": "Coin Sorting Game", "description": "Practice identifying and sorting different coins", "instructions": "1. Gather all the coins you can find\\n2. Sort them into piles by type\\n3. Count how much each pile is worth\\n4. Add up your total!", "activity_type": "real_world", "topic_id": "topic_currency", "min_grade": 0, "max_grade": 2, "reward_coins": 10},
        {"activity_id": "act_002", "title": "Needs vs Wants Collage", "description": "Create a visual collage sorting needs and wants", "instructions": "1. Find old magazines or print pictures\\n2. Cut out items you want and need\\n3. Glue NEEDS on one side, WANTS on the other\\n4. Share with your family!", "activity_type": "real_world", "topic_id": "topic_needs_wants", "min_grade": 0, "max_grade": 3, "reward_coins": 15},
        {"activity_id": "act_003", "title": "My Savings Tracker", "description": "Create and use a savings goal tracker", "instructions": "1. Draw a big thermometer on paper\\n2. Write your savings goal at the top\\n3. Color in your progress as you save\\n4. Celebrate when you reach the top!", "activity_type": "printable", "topic_id": "topic_saving", "min_grade": 0, "max_grade": 5, "reward_coins": 10},
        {"activity_id": "act_004", "title": "Price Comparison Challenge", "description": "Be a detective and compare prices", "instructions": "1. Choose an item you want\\n2. Find its price at 3 different stores\\n3. Record prices in a chart\\n4. Which store has the best deal?", "activity_type": "real_world", "topic_id": "topic_spending", "min_grade": 1, "max_grade": 5, "reward_coins": 15},
        {"activity_id": "act_005", "title": "Barter Simulation", "description": "Experience trading without money", "instructions": "1. With friends/family, each pick 5 items to trade\\n2. Try to trade for something you want\\n3. No money allowed!\\n4. Discuss: What was hard about bartering?", "activity_type": "real_world", "topic_id": "topic_barter", "min_grade": 0, "max_grade": 5, "reward_coins": 20},
        {"activity_id": "act_006", "title": "Design Your Own Currency", "description": "Create a pretend currency for your family", "instructions": "1. Design bills and coins (draw them!)\\n2. Give your currency a name\\n3. Decide what each is worth\\n4. Use it to practice money skills!", "activity_type": "real_world", "topic_id": "topic_currency", "min_grade": 1, "max_grade": 5, "reward_coins": 20},
        {"activity_id": "act_007", "title": "Chore Chart & Earnings", "description": "Set up a real earning system at home", "instructions": "1. List chores you can do\\n2. Agree on payment with parents\\n3. Track completed chores\\n4. Collect your earnings weekly!", "activity_type": "real_world", "topic_id": "topic_earning", "min_grade": 0, "max_grade": 5, "reward_coins": 15},
        {"activity_id": "act_008", "title": "Budget Your Allowance", "description": "Practice budgeting with real money", "instructions": "1. Get 3 jars or envelopes\\n2. Label: SAVE, SPEND, SHARE\\n3. Decide percentages for each\\n4. Divide your next allowance!", "activity_type": "real_world", "topic_id": "topic_budget", "min_grade": 2, "max_grade": 5, "reward_coins": 15},
    ]
    
    # Clear and insert
    await db.learning_topics.delete_many({})
    await db.learning_lessons.delete_many({})
    await db.books.delete_many({})
    await db.activities.delete_many({})
    
    if topics:
        await db.learning_topics.insert_many(topics)
    if lessons:
        await db.learning_lessons.insert_many(lessons)
    if books:
        await db.books.insert_many(books)
    if activities:
        await db.activities.insert_many(activities)
    
    return {"message": "Learning content seeded successfully", "topics": len(topics), "lessons": len(lessons), "books": len(books), "activities": len(activities)}

# ============== ADMIN STORE MANAGEMENT ==============

@api_router.post("/upload/store-image")
async def upload_store_image(file: UploadFile = File(...)):
    """Upload an image for store items"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = STORE_IMAGES_DIR / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/store/{filename}"}

@api_router.get("/admin/store/categories")
async def admin_get_store_categories(request: Request):
    """Get all store categories (admin only)"""
    await require_admin(request)
    categories = await db.admin_store_categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return categories

@api_router.post("/admin/store/categories")
async def admin_create_store_category(data: StoreCategoryCreate, request: Request):
    """Create a store category (admin only)"""
    await require_admin(request)
    
    category = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "name": data.name,
        "description": data.description,
        "icon": data.icon,
        "color": data.color,
        "image_url": data.image_url,
        "order": data.order,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_store_categories.insert_one(category)
    return {"message": "Category created", "category_id": category["category_id"]}

@api_router.put("/admin/store/categories/{category_id}")
async def admin_update_store_category(category_id: str, data: StoreCategoryUpdate, request: Request):
    """Update a store category (admin only)"""
    await require_admin(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    await db.admin_store_categories.update_one(
        {"category_id": category_id},
        {"$set": update_data}
    )
    
    return {"message": "Category updated"}

@api_router.delete("/admin/store/categories/{category_id}")
async def admin_delete_store_category(category_id: str, request: Request):
    """Delete a store category and its items (admin only)"""
    await require_admin(request)
    
    await db.admin_store_categories.delete_one({"category_id": category_id})
    await db.admin_store_items.delete_many({"category_id": category_id})
    
    return {"message": "Category and items deleted"}

@api_router.get("/admin/store/items")
async def admin_get_store_items(request: Request, category_id: Optional[str] = None):
    """Get all store items (admin only)"""
    await require_admin(request)
    
    query = {}
    if category_id:
        query["category_id"] = category_id
    
    items = await db.admin_store_items.find(query, {"_id": 0}).to_list(500)
    return items

@api_router.post("/admin/store/items")
async def admin_create_store_item(data: StoreItemCreate, request: Request):
    """Create a store item (admin only)"""
    await require_admin(request)
    
    item = {
        "item_id": f"item_{uuid.uuid4().hex[:12]}",
        "category_id": data.category_id,
        "name": data.name,
        "description": data.description,
        "price": data.price,
        "image_url": data.image_url,
        "unit": data.unit,
        "min_grade": data.min_grade,
        "max_grade": data.max_grade,
        "stock": data.stock,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_store_items.insert_one(item)
    return {"message": "Item created", "item_id": item["item_id"]}

@api_router.put("/admin/store/items/{item_id}")
async def admin_update_store_item(item_id: str, data: StoreItemUpdate, request: Request):
    """Update a store item (admin only)"""
    await require_admin(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    await db.admin_store_items.update_one(
        {"item_id": item_id},
        {"$set": update_data}
    )
    
    return {"message": "Item updated"}

@api_router.delete("/admin/store/items/{item_id}")
async def admin_delete_store_item(item_id: str, request: Request):
    """Delete a store item (admin only)"""
    await require_admin(request)
    
    await db.admin_store_items.delete_one({"item_id": item_id})
    
    return {"message": "Item deleted"}

# ============== ADMIN INVESTMENT MANAGEMENT ==============

@api_router.post("/upload/investment-image")
async def upload_investment_image(file: UploadFile = File(...)):
    """Upload an image for investments (plant images or stock logos)"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = INVESTMENT_IMAGES_DIR / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/investments/{filename}"}

# Plants (for K-2 grades)
@api_router.get("/admin/investments/plants")
async def admin_get_plants(request: Request):
    """Get all plants (admin only)"""
    await require_admin(request)
    plants = await db.investment_plants.find({}, {"_id": 0}).to_list(100)
    return plants

@api_router.post("/admin/investments/plants")
async def admin_create_plant(data: InvestmentPlantCreate, request: Request):
    """Create an investment plant (admin only)"""
    await require_admin(request)
    
    plant = {
        "plant_id": f"plant_{uuid.uuid4().hex[:12]}",
        "name": data.name,
        "description": data.description,
        "image_url": data.image_url,
        "base_price": data.base_price,
        "growth_rate_min": data.growth_rate_min,
        "growth_rate_max": data.growth_rate_max,
        "min_lot_size": data.min_lot_size,
        "maturity_days": data.maturity_days,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.investment_plants.insert_one(plant)
    return {"message": "Plant created", "plant_id": plant["plant_id"]}

@api_router.put("/admin/investments/plants/{plant_id}")
async def admin_update_plant(plant_id: str, data: InvestmentPlantUpdate, request: Request):
    """Update an investment plant (admin only)"""
    await require_admin(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    await db.investment_plants.update_one(
        {"plant_id": plant_id},
        {"$set": update_data}
    )
    
    return {"message": "Plant updated"}

@api_router.delete("/admin/investments/plants/{plant_id}")
async def admin_delete_plant(plant_id: str, request: Request):
    """Delete an investment plant (admin only)"""
    await require_admin(request)
    
    await db.investment_plants.delete_one({"plant_id": plant_id})
    
    return {"message": "Plant deleted"}

# Stocks (for grades 3-5)
@api_router.get("/admin/investments/stocks")
async def admin_get_stocks(request: Request):
    """Get all stocks (admin only)"""
    await require_admin(request)
    stocks = await db.investment_stocks.find({}, {"_id": 0}).to_list(100)
    return stocks

@api_router.post("/admin/investments/stocks")
async def admin_create_stock(data: InvestmentStockCreate, request: Request):
    """Create an investment stock (admin only)"""
    await require_admin(request)
    
    stock = {
        "stock_id": f"stock_{uuid.uuid4().hex[:12]}",
        "name": data.name,
        "ticker": data.ticker.upper(),
        "description": data.description,
        "category_id": data.category_id,
        "logo_url": data.logo_url,
        "current_price": data.base_price,  # Start at base price
        "base_price": data.base_price,
        "volatility": data.volatility,
        "min_lot_size": data.min_lot_size,
        "what_they_do": data.what_they_do,
        "why_price_changes": data.why_price_changes,
        "risk_level": data.risk_level,
        "dividend_yield": data.dividend_yield,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_price_update": datetime.now(timezone.utc).isoformat()
    }
    
    await db.investment_stocks.insert_one(stock)
    
    # Add initial price to history
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.stock_price_history.insert_one({
        "history_id": f"hist_{uuid.uuid4().hex[:12]}",
        "stock_id": stock["stock_id"],
        "open_price": data.base_price,
        "close_price": data.base_price,
        "high_price": data.base_price,
        "low_price": data.base_price,
        "volume": 0,
        "date": today,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Stock created", "stock_id": stock["stock_id"]}

@api_router.put("/admin/investments/stocks/{stock_id}")
async def admin_update_stock(stock_id: str, data: InvestmentStockUpdate, request: Request):
    """Update an investment stock (admin only)"""
    await require_admin(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # If updating current price manually, record in history
    if "current_price" in update_data:
        update_data["last_price_update"] = datetime.now(timezone.utc).isoformat()
        await db.price_history.insert_one({
            "history_id": f"hist_{uuid.uuid4().hex[:12]}",
            "stock_id": stock_id,
            "price": update_data["current_price"],
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.investment_stocks.update_one(
        {"stock_id": stock_id},
        {"$set": update_data}
    )
    
    return {"message": "Stock updated"}

@api_router.delete("/admin/investments/stocks/{stock_id}")
async def admin_delete_stock(stock_id: str, request: Request):
    """Delete an investment stock (admin only)"""
    await require_admin(request)
    
    await db.investment_stocks.delete_one({"stock_id": stock_id})
    await db.price_history.delete_many({"stock_id": stock_id})
    
    return {"message": "Stock deleted"}

@api_router.get("/admin/investments/stocks/{stock_id}/history")
async def admin_get_stock_history(stock_id: str, request: Request, days: int = 30):
    """Get price history for a stock (admin only)"""
    await require_admin(request)
    
    history = await db.price_history.find(
        {"stock_id": stock_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    return history

@api_router.post("/admin/investments/simulate-fluctuation")
async def admin_simulate_fluctuation(request: Request):
    """Manually trigger stock price fluctuation (admin only)"""
    await require_admin(request)
    
    # Run the fluctuation
    await stock_price_fluctuation("manual")
    
    return {"message": "Stock fluctuation triggered successfully"}

@api_router.post("/admin/investments/simulate-day")
async def admin_simulate_market_day(request: Request):
    """Simulate a full day of market fluctuations - 3 sessions (admin only)"""
    await require_admin(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Run all 3 fluctuation sessions
    await stock_price_fluctuation("opening_manual")
    await stock_price_fluctuation("midday_manual")
    await stock_price_fluctuation("closing_manual")
    
    stocks_count = await db.investment_stocks.count_documents(
        {"$or": [{"is_active": True}, {"is_active": {"$exists": False}}]}
    )
    
    return {"message": f"Simulated full market day for {stocks_count} stocks (3 sessions)", "date": today}

@api_router.get("/admin/investments/scheduler-logs")
async def admin_get_scheduler_logs(request: Request, limit: int = 30):
    """Get scheduler execution logs (admin only)"""
    await require_admin(request)
    
    logs = await db.scheduler_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return logs

@api_router.get("/admin/investments/scheduler-status")
async def admin_get_scheduler_status(request: Request):
    """Get scheduler status and next run time (admin only)"""
    await require_admin(request)
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_run = await db.scheduler_logs.find_one(
        {"task": "daily_market"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs,
        "last_run": last_run,
        "ran_today": last_run["date"] == today if last_run else False
    }

# ============== USER INVESTMENT ENDPOINTS (Updated) ==============

@api_router.get("/investments/plants")
async def get_available_plants(request: Request):
    """Get available plants for investment (K-2 grades)"""
    user = await get_current_user(request)
    
    plants = await db.investment_plants.find({"is_active": True}, {"_id": 0}).to_list(100)
    return plants

@api_router.get("/investments/stocks")
async def get_available_stocks(request: Request):
    """Get available stocks for investment (grades 3-5)"""
    user = await get_current_user(request)
    
    stocks = await db.investment_stocks.find({"is_active": True}, {"_id": 0}).to_list(100)
    return stocks

@api_router.get("/investments/stocks/{stock_id}/chart")
async def get_stock_chart(stock_id: str, request: Request, period: str = "7d"):
    """Get stock price chart data"""
    await get_current_user(request)
    
    # Determine number of days based on period
    days_map = {"7d": 7, "30d": 30, "90d": 90, "all": 365}
    days = days_map.get(period, 7)
    
    history = await db.price_history.find(
        {"stock_id": stock_id},
        {"_id": 0, "date": 1, "price": 1}
    ).sort("date", -1).limit(days).to_list(days)
    
    # Reverse to get chronological order
    history.reverse()
    
    return {"stock_id": stock_id, "period": period, "data": history}

@api_router.get("/investments/portfolio")
async def get_user_portfolio(request: Request):
    """Get user's investment portfolio with current values"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    holdings = await db.user_investment_holdings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    portfolio = []
    total_invested = 0
    total_current_value = 0
    
    for holding in holdings:
        if holding["investment_type"] == "plant":
            asset = await db.investment_plants.find_one(
                {"plant_id": holding["asset_id"]},
                {"_id": 0}
            )
            if asset:
                # Calculate plant growth based on days since purchase
                purchase_date = holding.get("purchase_date")
                if isinstance(purchase_date, str):
                    purchase_date = datetime.fromisoformat(purchase_date)
                days_held = (datetime.now(timezone.utc) - purchase_date).days
                
                # Growth rate calculation
                growth_rate = (asset.get("growth_rate_min", 0.02) + asset.get("growth_rate_max", 0.08)) / 2
                growth_multiplier = 1 + (growth_rate * days_held)
                current_value = holding["purchase_price"] * holding["quantity"] * growth_multiplier
                
                portfolio.append({
                    "holding_id": holding["holding_id"],
                    "type": "plant",
                    "asset": asset,
                    "quantity": holding["quantity"],
                    "purchase_price": holding["purchase_price"],
                    "purchase_date": holding["purchase_date"],
                    "days_held": days_held,
                    "current_value": round(current_value, 2),
                    "profit_loss": round(current_value - (holding["purchase_price"] * holding["quantity"]), 2)
                })
                total_invested += holding["purchase_price"] * holding["quantity"]
                total_current_value += current_value
        else:  # stock
            asset = await db.investment_stocks.find_one(
                {"stock_id": holding["asset_id"]},
                {"_id": 0}
            )
            if asset:
                current_value = asset["current_price"] * holding["quantity"]
                portfolio.append({
                    "holding_id": holding["holding_id"],
                    "type": "stock",
                    "asset": asset,
                    "quantity": holding["quantity"],
                    "purchase_price": holding["purchase_price"],
                    "purchase_date": holding["purchase_date"],
                    "current_value": round(current_value, 2),
                    "profit_loss": round(current_value - (holding["purchase_price"] * holding["quantity"]), 2)
                })
                total_invested += holding["purchase_price"] * holding["quantity"]
                total_current_value += current_value
    
    return {
        "holdings": portfolio,
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current_value, 2),
        "total_profit_loss": round(total_current_value - total_invested, 2)
    }

@api_router.post("/investments/buy")
async def buy_investment(data: BuyInvestmentRequest, request: Request):
    """Buy plants or stocks"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    # Get asset details
    if data.investment_type == "plant":
        asset = await db.investment_plants.find_one({"plant_id": data.asset_id, "is_active": True})
        if not asset:
            raise HTTPException(status_code=404, detail="Plant not found")
        price_per_unit = asset["base_price"]
        min_lot_size = asset.get("min_lot_size", 1)
    elif data.investment_type == "stock":
        asset = await db.investment_stocks.find_one({"stock_id": data.asset_id, "is_active": True})
        if not asset:
            raise HTTPException(status_code=404, detail="Stock not found")
        price_per_unit = asset["current_price"]
        min_lot_size = asset.get("min_lot_size", 1)
    else:
        raise HTTPException(status_code=400, detail="Invalid investment type")
    
    # Check minimum lot size
    if data.quantity < min_lot_size:
        raise HTTPException(status_code=400, detail=f"Minimum purchase is {min_lot_size} units")
    
    total_cost = price_per_unit * data.quantity
    
    # Check investing account balance
    investing_account = await db.wallet_accounts.find_one({
        "user_id": user_id,
        "account_type": "investing"
    })
    
    if not investing_account or investing_account.get("balance", 0) < total_cost:
        raise HTTPException(status_code=400, detail="Insufficient funds in investing account")
    
    # Deduct from investing account
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "investing"},
        {"$inc": {"balance": -total_cost}}
    )
    
    # Create holding
    holding = {
        "holding_id": f"hold_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "investment_type": data.investment_type,
        "asset_id": data.asset_id,
        "quantity": data.quantity,
        "purchase_price": price_per_unit,
        "purchase_date": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_investment_holdings.insert_one(holding)
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "investment_purchase",
        "amount": -total_cost,
        "description": f"Bought {data.quantity} {asset.get('name', 'investment')}",
        "from_account": "investing",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully purchased {data.quantity} {asset.get('name', 'investment')}",
        "holding_id": holding["holding_id"],
        "total_cost": total_cost
    }

@api_router.post("/investments/sell")
async def sell_investment(data: SellInvestmentRequest, request: Request):
    """Sell plants or stocks"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    holding = await db.user_investment_holdings.find_one({
        "holding_id": data.holding_id,
        "user_id": user_id
    })
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    quantity_to_sell = data.quantity if data.quantity else holding["quantity"]
    
    if quantity_to_sell > holding["quantity"]:
        raise HTTPException(status_code=400, detail="Cannot sell more than you own")
    
    # Calculate current value
    if holding["investment_type"] == "plant":
        asset = await db.investment_plants.find_one({"plant_id": holding["asset_id"]})
        purchase_date = holding.get("purchase_date")
        if isinstance(purchase_date, str):
            purchase_date = datetime.fromisoformat(purchase_date)
        days_held = (datetime.now(timezone.utc) - purchase_date).days
        growth_rate = (asset.get("growth_rate_min", 0.02) + asset.get("growth_rate_max", 0.08)) / 2
        growth_multiplier = 1 + (growth_rate * days_held)
        price_per_unit = holding["purchase_price"] * growth_multiplier
    else:  # stock
        asset = await db.investment_stocks.find_one({"stock_id": holding["asset_id"]})
        price_per_unit = asset["current_price"]
    
    total_proceeds = round(price_per_unit * quantity_to_sell, 2)
    
    # Add to investing account
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "investing"},
        {"$inc": {"balance": total_proceeds}}
    )
    
    # Update or delete holding
    if quantity_to_sell >= holding["quantity"]:
        await db.user_investment_holdings.delete_one({"holding_id": data.holding_id})
    else:
        await db.user_investment_holdings.update_one(
            {"holding_id": data.holding_id},
            {"$inc": {"quantity": -quantity_to_sell}}
        )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "investment_sale",
        "amount": total_proceeds,
        "description": f"Sold {quantity_to_sell} {asset.get('name', 'investment')}",
        "to_account": "investing",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully sold {quantity_to_sell} {asset.get('name', 'investment')}",
        "amount_received": total_proceeds
    }

# ============== USER STORE ENDPOINTS (Updated) ==============

@api_router.get("/store/categories")
async def get_store_categories(request: Request):
    """Get active store categories for users"""
    user = await get_current_user(request)
    
    categories = await db.admin_store_categories.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return categories

@api_router.get("/store/items-by-category")
async def get_store_items_by_category(request: Request):
    """Get store items grouped by category for users"""
    user = await get_current_user(request)
    user_grade = user.get("grade")
    user_role = user.get("role", "child")
    
    categories = await db.admin_store_categories.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    result = []
    for cat in categories:
        # Admin sees all items, children see grade-appropriate items
        if user_role == "admin" or user_grade is None:
            items = await db.admin_store_items.find(
                {
                    "category_id": cat["category_id"],
                    "is_active": True
                },
                {"_id": 0}
            ).to_list(100)
        else:
            items = await db.admin_store_items.find(
                {
                    "category_id": cat["category_id"],
                    "is_active": True,
                    "min_grade": {"$lte": user_grade},
                    "max_grade": {"$gte": user_grade}
                },
                {"_id": 0}
            ).to_list(100)
        
        if items:  # Only include categories with items
            result.append({
                **cat,
                "items": items
            })
    
    return result

# ============== STOCK MARKET SYSTEM (Grade 3-5) ==============

STOCK_MARKET_OPEN_HOUR = 7   # 7 AM IST
STOCK_MARKET_CLOSE_HOUR = 17  # 5 PM IST
IST_OFFSET_HOURS = 5.5  # IST is UTC+5:30

def get_ist_hour():
    """Get current hour in IST (Indian Standard Time)"""
    utc_now = datetime.now(timezone.utc)
    ist_hour = (utc_now.hour + IST_OFFSET_HOURS) % 24
    return ist_hour

def is_market_open():
    """Check if stock market is open (7 AM - 5 PM IST)"""
    current_ist_hour = get_ist_hour()
    return STOCK_MARKET_OPEN_HOUR <= current_ist_hour < STOCK_MARKET_CLOSE_HOUR

# --- Admin Stock Category Endpoints ---

@api_router.get("/admin/stock-categories")
async def admin_get_stock_categories(request: Request):
    """Get all stock categories (admin only)"""
    await require_admin(request)
    categories = await db.stock_categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/admin/stock-categories")
async def admin_create_stock_category(request: Request):
    """Create a stock category (admin only)"""
    await require_admin(request)
    data = await request.json()
    
    category = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "emoji": data.get("emoji", "📈"),
        "description": data.get("description", ""),
        "color": data.get("color", "#3B82F6"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_categories.insert_one(category)
    return {"message": "Category created", "category_id": category["category_id"]}

@api_router.put("/admin/stock-categories/{category_id}")
async def admin_update_stock_category(category_id: str, request: Request):
    """Update a stock category (admin only)"""
    await require_admin(request)
    data = await request.json()
    
    update_data = {k: v for k, v in data.items() if v is not None and k != "category_id"}
    
    await db.stock_categories.update_one(
        {"category_id": category_id},
        {"$set": update_data}
    )
    
    return {"message": "Category updated"}

@api_router.delete("/admin/stock-categories/{category_id}")
async def admin_delete_stock_category(category_id: str, request: Request):
    """Delete a stock category (admin only)"""
    await require_admin(request)
    
    # Check if any stocks use this category
    stocks_count = await db.investment_stocks.count_documents({"category_id": category_id})
    if stocks_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {stocks_count} stocks use this category")
    
    await db.stock_categories.delete_one({"category_id": category_id})
    return {"message": "Category deleted"}

# --- Admin Stock News Endpoints ---

@api_router.get("/admin/stock-news")
async def admin_get_stock_news(request: Request):
    """Get all stock news (admin only)"""
    await require_admin(request)
    news = await db.stock_news.find({}, {"_id": 0}).sort("effective_date", -1).to_list(100)
    return news

@api_router.post("/admin/stock-news")
async def admin_create_stock_news(request: Request):
    """Create stock news that affects prices (admin only)"""
    await require_admin(request)
    data = await request.json()
    
    news = {
        "news_id": f"news_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "description": data.get("description", ""),
        "category_id": data.get("category_id"),  # Affects industry
        "stock_id": data.get("stock_id"),  # Affects specific stock
        "impact_type": data.get("impact_type", "neutral"),  # positive, negative, neutral
        "impact_percent": data.get("impact_percent", 5.0),
        "is_prediction": data.get("is_prediction", False),
        "prediction_accuracy": data.get("prediction_accuracy", 0.7),
        "prediction_target_price": data.get("prediction_target_price"),
        "prediction_target_date": data.get("prediction_target_date"),
        "effective_date": data.get("effective_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "expires_date": data.get("expires_date"),
        "is_active": True,
        "is_applied": False,  # Whether the effect has been applied
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_news.insert_one(news)
    return {"message": "News created", "news_id": news["news_id"]}

@api_router.put("/admin/stock-news/{news_id}")
async def admin_update_stock_news(news_id: str, request: Request):
    """Update stock news (admin only)"""
    await require_admin(request)
    data = await request.json()
    
    update_data = {k: v for k, v in data.items() if v is not None and k != "news_id"}
    
    await db.stock_news.update_one(
        {"news_id": news_id},
        {"$set": update_data}
    )
    
    return {"message": "News updated"}

@api_router.delete("/admin/stock-news/{news_id}")
async def admin_delete_stock_news(news_id: str, request: Request):
    """Delete stock news (admin only)"""
    await require_admin(request)
    
    await db.stock_news.delete_one({"news_id": news_id})
    return {"message": "News deleted"}

@api_router.post("/admin/stock-news/{news_id}/apply")
async def admin_apply_stock_news(news_id: str, request: Request):
    """Apply news effect to stock prices (admin only)"""
    await require_admin(request)
    
    news = await db.stock_news.find_one({"news_id": news_id})
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    
    if news.get("is_applied"):
        raise HTTPException(status_code=400, detail="News effect already applied")
    
    # Calculate impact multiplier
    impact_percent = news.get("impact_percent", 0)
    if news.get("impact_type") == "negative":
        impact_percent = -impact_percent
    elif news.get("impact_type") == "neutral":
        impact_percent = 0
    
    multiplier = 1 + (impact_percent / 100)
    affected_stocks = []
    
    # Apply to specific stock or category
    if news.get("stock_id"):
        stocks = await db.investment_stocks.find({"stock_id": news["stock_id"]}).to_list(1)
    elif news.get("category_id"):
        stocks = await db.investment_stocks.find({"category_id": news["category_id"]}).to_list(100)
    else:
        stocks = await db.investment_stocks.find({}).to_list(100)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    for stock in stocks:
        new_price = round(stock["current_price"] * multiplier, 2)
        new_price = max(1, new_price)  # Minimum price of ₹1
        
        await db.investment_stocks.update_one(
            {"stock_id": stock["stock_id"]},
            {"$set": {
                "current_price": new_price,
                "last_price_update": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Record in price history
        await db.stock_price_history.insert_one({
            "history_id": f"hist_{uuid.uuid4().hex[:12]}",
            "stock_id": stock["stock_id"],
            "open_price": stock["current_price"],
            "close_price": new_price,
            "high_price": max(stock["current_price"], new_price),
            "low_price": min(stock["current_price"], new_price),
            "volume": 0,
            "date": today,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        affected_stocks.append({"ticker": stock["ticker"], "old_price": stock["current_price"], "new_price": new_price})
    
    # Mark news as applied
    await db.stock_news.update_one(
        {"news_id": news_id},
        {"$set": {"is_applied": True}}
    )
    
    return {"message": f"News applied to {len(affected_stocks)} stocks", "affected": affected_stocks}

# --- Child Stock Market Endpoints ---

@api_router.get("/stocks/market-status")
async def get_market_status(request: Request):
    """Get current market status and hours (IST)"""
    user = await get_current_user(request)
    
    current_ist_hour = get_ist_hour()
    is_open = is_market_open()
    
    return {
        "is_open": is_open,
        "open_hour": STOCK_MARKET_OPEN_HOUR,
        "close_hour": STOCK_MARKET_CLOSE_HOUR,
        "current_hour_ist": current_ist_hour,
        "timezone": "IST",
        "message": "Market is open for trading" if is_open else f"Market opens at {STOCK_MARKET_OPEN_HOUR}:00 AM IST"
    }

@api_router.get("/stocks/categories")
async def get_stock_categories(request: Request):
    """Get active stock categories"""
    user = await get_current_user(request)
    
    categories = await db.stock_categories.find({"is_active": True}, {"_id": 0}).to_list(100)
    return categories

@api_router.get("/stocks/list")
async def get_stocks_list(request: Request, category_id: Optional[str] = None):
    """Get list of all available stocks with current prices"""
    user = await get_current_user(request)
    
    # Query stocks - handle both is_active: true and missing is_active field
    query = {"$or": [{"is_active": True}, {"is_active": {"$exists": False}}]}
    if category_id:
        query["category_id"] = category_id
    
    stocks = await db.investment_stocks.find(query, {"_id": 0}).to_list(100)
    
    # Get categories for display
    categories = {c["category_id"]: c for c in await db.stock_categories.find({}, {"_id": 0}).to_list(100)}
    
    # Enrich with category info and price change
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    enriched_stocks = []
    for stock in stocks:
        # Get yesterday's price for change calculation
        yesterday_hist = await db.stock_price_history.find_one(
            {"stock_id": stock["stock_id"], "date": yesterday},
            {"_id": 0}
        )
        
        yesterday_price = yesterday_hist["close_price"] if yesterday_hist else stock["base_price"]
        price_change = stock["current_price"] - yesterday_price
        price_change_percent = (price_change / yesterday_price * 100) if yesterday_price > 0 else 0
        
        category = categories.get(stock.get("category_id"), {})
        
        enriched_stocks.append({
            **stock,
            "category_name": category.get("name", "Uncategorized"),
            "category_emoji": category.get("emoji", "📈"),
            "category_color": category.get("color", "#3B82F6"),
            "price_change": round(price_change, 2),
            "price_change_percent": round(price_change_percent, 2)
        })
    
    return enriched_stocks

@api_router.get("/stocks/portfolio")
async def get_stock_portfolio(request: Request):
    """Get user's stock portfolio with P/L"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    holdings = await db.user_stock_holdings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    portfolio = []
    total_invested = 0
    total_current_value = 0
    
    for holding in holdings:
        stock = await db.investment_stocks.find_one(
            {"stock_id": holding["stock_id"]},
            {"_id": 0}
        )
        
        if stock:
            current_value = stock["current_price"] * holding["quantity"]
            invested = holding["total_invested"]
            profit_loss = current_value - invested
            profit_loss_percent = (profit_loss / invested * 100) if invested > 0 else 0
            
            portfolio.append({
                "holding_id": holding["holding_id"],
                "stock": stock,
                "quantity": holding["quantity"],
                "average_buy_price": holding["average_buy_price"],
                "total_invested": round(invested, 2),
                "current_value": round(current_value, 2),
                "profit_loss": round(profit_loss, 2),
                "profit_loss_percent": round(profit_loss_percent, 2)
            })
            
            total_invested += invested
            total_current_value += current_value
    
    return {
        "holdings": portfolio,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current_value": round(total_current_value, 2),
            "total_profit_loss": round(total_current_value - total_invested, 2),
            "total_profit_loss_percent": round((total_current_value - total_invested) / total_invested * 100, 2) if total_invested > 0 else 0
        },
        "is_market_open": is_market_open()
    }

@api_router.get("/stocks/portfolio/history")
async def get_portfolio_history(request: Request, days: int = 30):
    """Get portfolio value history for charts"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    history = await db.portfolio_snapshots.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    history.reverse()
    return history

@api_router.get("/stocks/transactions")
async def get_stock_transactions(request: Request, limit: int = 50):
    """Get user's stock transaction history"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    transactions = await db.stock_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with stock info
    enriched = []
    for trans in transactions:
        stock = await db.investment_stocks.find_one(
            {"stock_id": trans["stock_id"]},
            {"_id": 0, "name": 1, "ticker": 1}
        )
        enriched.append({
            **trans,
            "stock_name": stock["name"] if stock else "Unknown",
            "stock_ticker": stock["ticker"] if stock else "???"
        })
    
    return enriched

@api_router.post("/stocks/buy")
async def buy_stock(data: BuyStockRequest, request: Request):
    """Buy shares of a stock"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    # Check market hours
    if not is_market_open():
        raise HTTPException(status_code=400, detail=f"Market is closed. Trading hours are {STOCK_MARKET_OPEN_HOUR}:00 AM - {STOCK_MARKET_CLOSE_HOUR}:00 PM")
    
    # Get stock
    stock = await db.investment_stocks.find_one({"stock_id": data.stock_id, "is_active": True})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Validate quantity
    if data.quantity < stock.get("min_lot_size", 1):
        raise HTTPException(status_code=400, detail=f"Minimum purchase is {stock.get('min_lot_size', 1)} shares")
    
    total_cost = stock["current_price"] * data.quantity
    
    # Check wallet balance (use investing account)
    wallet = await db.wallet_accounts.find_one({"user_id": user_id, "account_type": "investing"})
    if not wallet or wallet["balance"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Insufficient funds. Need ₹{total_cost:.2f}")
    
    # Deduct from wallet
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "investing"},
        {"$inc": {"balance": -total_cost}}
    )
    
    # Check existing holding
    existing_holding = await db.user_stock_holdings.find_one({
        "user_id": user_id,
        "stock_id": data.stock_id
    })
    
    if existing_holding:
        # Update existing holding with weighted average
        new_quantity = existing_holding["quantity"] + data.quantity
        new_total_invested = existing_holding["total_invested"] + total_cost
        new_avg_price = new_total_invested / new_quantity
        
        await db.user_stock_holdings.update_one(
            {"holding_id": existing_holding["holding_id"]},
            {"$set": {
                "quantity": new_quantity,
                "average_buy_price": round(new_avg_price, 2),
                "total_invested": round(new_total_invested, 2),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new holding
        holding = {
            "holding_id": f"hold_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "stock_id": data.stock_id,
            "quantity": data.quantity,
            "average_buy_price": stock["current_price"],
            "total_invested": total_cost,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_stock_holdings.insert_one(holding)
    
    # Record transaction
    transaction = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "stock_id": data.stock_id,
        "transaction_type": "buy",
        "quantity": data.quantity,
        "price_per_share": stock["current_price"],
        "total_amount": total_cost,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_transactions.insert_one(transaction)
    
    # Record wallet transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "from_account": "investing",
        "to_account": None,
        "amount": total_cost,
        "transaction_type": "stock_buy",
        "description": f"Bought {data.quantity} shares of {stock['ticker']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully bought {data.quantity} shares of {stock['ticker']}",
        "stock": stock["ticker"],
        "quantity": data.quantity,
        "price_per_share": stock["current_price"],
        "total_cost": round(total_cost, 2)
    }

@api_router.post("/stocks/sell")
async def sell_stock(data: SellStockRequest, request: Request):
    """Sell shares of a stock"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    # Check market hours
    if not is_market_open():
        raise HTTPException(status_code=400, detail=f"Market is closed. Trading hours are {STOCK_MARKET_OPEN_HOUR}:00 AM - {STOCK_MARKET_CLOSE_HOUR}:00 PM")
    
    # Get holding
    holding = await db.user_stock_holdings.find_one({
        "user_id": user_id,
        "stock_id": data.stock_id
    })
    
    if not holding:
        raise HTTPException(status_code=404, detail="You don't own this stock")
    
    if data.quantity > holding["quantity"]:
        raise HTTPException(status_code=400, detail=f"You only have {holding['quantity']} shares")
    
    # Get current stock price
    stock = await db.investment_stocks.find_one({"stock_id": data.stock_id})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_proceeds = stock["current_price"] * data.quantity
    
    # Add to wallet
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "investing"},
        {"$inc": {"balance": total_proceeds}}
    )
    
    # Update or remove holding
    new_quantity = holding["quantity"] - data.quantity
    if new_quantity <= 0:
        await db.user_stock_holdings.delete_one({"holding_id": holding["holding_id"]})
    else:
        # Reduce total invested proportionally
        sold_ratio = data.quantity / holding["quantity"]
        remaining_invested = holding["total_invested"] * (1 - sold_ratio)
        
        await db.user_stock_holdings.update_one(
            {"holding_id": holding["holding_id"]},
            {"$set": {
                "quantity": new_quantity,
                "total_invested": round(remaining_invested, 2),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Calculate profit/loss for this sale
    cost_basis = holding["average_buy_price"] * data.quantity
    profit_loss = total_proceeds - cost_basis
    
    # Record transaction
    transaction = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "stock_id": data.stock_id,
        "transaction_type": "sell",
        "quantity": data.quantity,
        "price_per_share": stock["current_price"],
        "total_amount": total_proceeds,
        "profit_loss": round(profit_loss, 2),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_transactions.insert_one(transaction)
    
    # Record wallet transaction
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "from_account": None,
        "to_account": "investing",
        "amount": total_proceeds,
        "transaction_type": "stock_sell",
        "description": f"Sold {data.quantity} shares of {stock['ticker']} (P/L: ₹{profit_loss:.2f})",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Successfully sold {data.quantity} shares of {stock['ticker']}",
        "stock": stock["ticker"],
        "quantity": data.quantity,
        "price_per_share": stock["current_price"],
        "total_proceeds": round(total_proceeds, 2),
        "profit_loss": round(profit_loss, 2)
    }

@api_router.get("/stocks/news")
async def get_stock_news(request: Request, stock_id: Optional[str] = None, category_id: Optional[str] = None):
    """Get active news and predictions"""
    user = await get_current_user(request)
    
    query = {"is_active": True}
    if stock_id:
        query["$or"] = [{"stock_id": stock_id}, {"stock_id": None}]
    if category_id:
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": [{"category_id": category_id}, {"category_id": None}]}]
        else:
            query["$or"] = [{"category_id": category_id}, {"category_id": None}]
    
    news = await db.stock_news.find(query, {"_id": 0}).sort("effective_date", -1).limit(20).to_list(20)
    
    return news

# NOTE: This route must be AFTER all other /stocks/* routes because {stock_id} is a catch-all
@api_router.get("/stocks/{stock_id}")
async def get_stock_detail(stock_id: str, request: Request):
    """Get detailed info about a specific stock"""
    user = await get_current_user(request)
    
    stock = await db.investment_stocks.find_one({"stock_id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Get category
    category = await db.stock_categories.find_one({"category_id": stock.get("category_id")}, {"_id": 0})
    
    # Get price history (30 days)
    history = await db.stock_price_history.find(
        {"stock_id": stock_id},
        {"_id": 0}
    ).sort("date", -1).limit(30).to_list(30)
    history.reverse()
    
    # Get relevant news
    news = await db.stock_news.find({
        "$or": [
            {"stock_id": stock_id},
            {"category_id": stock.get("category_id")}
        ],
        "is_active": True
    }, {"_id": 0}).sort("effective_date", -1).limit(5).to_list(5)
    
    # Get predictions
    predictions = await db.stock_news.find({
        "$or": [
            {"stock_id": stock_id},
            {"category_id": stock.get("category_id")}
        ],
        "is_prediction": True,
        "is_active": True
    }, {"_id": 0}).to_list(10)
    
    # Calculate today's change
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_hist = await db.stock_price_history.find_one({"stock_id": stock_id, "date": yesterday})
    yesterday_price = yesterday_hist["close_price"] if yesterday_hist else stock["base_price"]
    
    return {
        **stock,
        "category": category,
        "price_history": history,
        "news": news,
        "predictions": predictions,
        "yesterday_price": yesterday_price,
        "price_change": round(stock["current_price"] - yesterday_price, 2),
        "price_change_percent": round((stock["current_price"] - yesterday_price) / yesterday_price * 100, 2) if yesterday_price > 0 else 0
    }

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

# ============== DAILY PRICE FLUCTUATION SCHEDULER ==============

# Initialize the scheduler
scheduler = AsyncIOScheduler()

async def stock_price_fluctuation(session_name: str):
    """
    Automated stock price fluctuation.
    Runs 3 times daily at:
    - 7:15 AM IST (opening)
    - 12:00 PM IST (midday)
    - 4:30 PM IST (near closing)
    """
    logger.info(f"Running stock price fluctuation ({session_name})...")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    task_id = f"stock_fluctuation_{session_name}"
    
    # Check if already run this session today
    last_run = await db.scheduler_logs.find_one({"task": task_id, "date": today})
    if last_run:
        logger.info(f"Stock fluctuation ({session_name}) already ran today ({today}). Skipping.")
        return
    
    try:
        # Update all active stocks
        stocks = await db.investment_stocks.find(
            {"$or": [{"is_active": True}, {"is_active": {"$exists": False}}]}
        ).to_list(200)
        updated_stocks = 0
        
        for stock in stocks:
            # Random price change based on volatility
            volatility = stock.get("volatility", 0.05)
            # Divide volatility by 3 since we fluctuate 3 times a day
            session_volatility = volatility / 3
            change_percent = random.uniform(-session_volatility, session_volatility)
            current_price = stock.get("current_price", stock.get("base_price", 10))
            new_price = max(1.0, current_price * (1 + change_percent))  # Minimum price ₹1
            new_price = round(new_price, 2)
            
            # Update stock price
            await db.investment_stocks.update_one(
                {"stock_id": stock["stock_id"]},
                {"$set": {
                    "current_price": new_price,
                    "last_price_update": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Record in detailed price history
            await db.stock_price_history.update_one(
                {"stock_id": stock["stock_id"], "date": today},
                {
                    "$set": {
                        "close_price": new_price,
                        "last_update": datetime.now(timezone.utc).isoformat()
                    },
                    "$max": {"high_price": new_price},
                    "$min": {"low_price": new_price},
                    "$setOnInsert": {
                        "history_id": f"hist_{uuid.uuid4().hex[:12]}",
                        "stock_id": stock["stock_id"],
                        "open_price": current_price,
                        "date": today,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
            
            updated_stocks += 1
        
        # Log successful run
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": task_id,
            "date": today,
            "status": "success",
            "details": {
                "session": session_name,
                "stocks_updated": updated_stocks
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Stock fluctuation ({session_name}) completed: {updated_stocks} stocks updated")
        
    except Exception as e:
        logger.error(f"Stock fluctuation ({session_name}) failed: {str(e)}")
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": task_id,
            "date": today,
            "status": "failed",
            "error": str(e),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

async def daily_market_simulation():
    """
    Legacy daily simulation - now also updates plant growth values.
    Stock fluctuations are handled separately by stock_price_fluctuation()
    """
    logger.info("Running daily plant growth update...")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already run today
    last_run = await db.scheduler_logs.find_one({"task": "daily_market", "date": today})
    if last_run:
        logger.info(f"Daily plant update already ran today ({today}). Skipping.")
        return
    
    try:
        plant_holdings = await db.user_investment_holdings.find({"investment_type": "plant"}).to_list(1000)
        updated_plants = 0
        
        for holding in plant_holdings:
            plant = await db.investment_plants.find_one({"plant_id": holding["asset_id"]})
            if plant:
                # Calculate days held
                purchase_date = holding.get("purchase_date")
                if isinstance(purchase_date, str):
                    purchase_date = datetime.fromisoformat(purchase_date.replace('Z', '+00:00'))
                days_held = (datetime.now(timezone.utc) - purchase_date).days
                
                # Update days_held in holding
                await db.user_investment_holdings.update_one(
                    {"holding_id": holding["holding_id"]},
                    {"$set": {"days_held": days_held}}
                )
                updated_plants += 1
        
        # Log successful run
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": "daily_market",
            "date": today,
            "status": "success",
            "details": {
                "plant_holdings_updated": updated_plants
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Daily plant update completed: {updated_plants} plant holdings updated")
        
    except Exception as e:
        logger.error(f"Daily plant update failed: {str(e)}")
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": "daily_market",
            "date": today,
            "status": "failed",
            "error": str(e),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

@app.on_event("startup")
async def startup_scheduler():
    """Start the scheduler when the app starts"""
    # Migrate "giving" accounts to "gifting"
    result = await db.wallet_accounts.update_many(
        {"account_type": "giving"},
        {"$set": {"account_type": "gifting"}}
    )
    if result.modified_count > 0:
        logger.info(f"Migrated {result.modified_count} 'giving' accounts to 'gifting'")
    
    # Stock Price Fluctuations - 3 times daily in IST
    # IST = UTC + 5:30
    # 7:15 AM IST = 1:45 AM UTC
    scheduler.add_job(
        lambda: asyncio.create_task(stock_price_fluctuation("opening")),
        CronTrigger(hour=1, minute=45),
        id="stock_fluctuation_opening",
        replace_existing=True
    )
    
    # 12:00 PM IST = 6:30 AM UTC
    scheduler.add_job(
        lambda: asyncio.create_task(stock_price_fluctuation("midday")),
        CronTrigger(hour=6, minute=30),
        id="stock_fluctuation_midday",
        replace_existing=True
    )
    
    # 4:30 PM IST = 11:00 AM UTC
    scheduler.add_job(
        lambda: asyncio.create_task(stock_price_fluctuation("closing")),
        CronTrigger(hour=11, minute=0),
        id="stock_fluctuation_closing",
        replace_existing=True
    )
    
    # Daily plant growth update at 6:00 AM UTC
    scheduler.add_job(
        daily_market_simulation,
        CronTrigger(hour=6, minute=0),
        id="daily_plant_update",
        replace_existing=True
    )
    
    # Run quest reminders at 00:30 IST (19:00 UTC previous day) - 1 day before due
    scheduler.add_job(
        send_quest_reminders,
        CronTrigger(hour=19, minute=0),
        id="quest_reminders",
        replace_existing=True
    )
    
    # Run chore reset at 00:30 IST (6 AM IST = 00:30 UTC)
    scheduler.add_job(
        reset_daily_chores,
        CronTrigger(hour=0, minute=30),
        id="daily_chore_reset",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Schedulers started: stock fluctuations (7:15 AM, 12:00 PM, 4:30 PM IST), plant update (6 AM UTC), quest reminders (7 PM UTC), chore reset (00:30 UTC)")
    
    # Run opening fluctuation on startup if market just opened
    current_ist_hour = get_ist_hour()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # If between 7 AM and 8 AM IST and opening hasn't run
    if 7 <= current_ist_hour < 8:
        last_opening = await db.scheduler_logs.find_one({"task": "stock_fluctuation_opening", "date": today})
        if not last_opening:
            logger.info("Running opening stock fluctuation on startup...")
            await stock_price_fluctuation("opening")

async def send_quest_reminders():
    """Send reminders to children for quests due tomorrow"""
    try:
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Find quests due tomorrow
        quests_due = await db.new_quests.find({
            "due_date": tomorrow,
            "is_active": True,
            "creator_type": {"$in": ["admin", "teacher"]}
        }, {"_id": 0}).to_list(200)
        
        for quest in quests_due:
            # Find children who haven't completed this quest
            if quest["creator_type"] == "admin":
                # Get all children in grade range
                children = await db.users.find({
                    "role": "child",
                    "grade": {"$gte": quest["min_grade"], "$lte": quest["max_grade"]}
                }, {"user_id": 1}).to_list(1000)
            else:
                # Teacher quest - get children in those classrooms
                children = await db.users.find({
                    "role": "child",
                    "classroom_id": {"$in": quest.get("classroom_ids", [])}
                }, {"user_id": 1}).to_list(1000)
            
            for child in children:
                # Check if already completed
                completion = await db.quest_completions.find_one({
                    "user_id": child["user_id"],
                    "quest_id": quest["quest_id"],
                    "has_earned": True
                })
                
                if not completion:
                    await db.notifications.insert_one({
                        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                        "user_id": child["user_id"],
                        "message": f"⏰ Reminder: '{quest['title']}' is due tomorrow! Complete it to earn ₹{quest['total_points']}",
                        "type": "quest_reminder",
                        "link": "/quests",
                        "is_read": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        
        logger.info(f"Sent quest reminders for {len(quests_due)} quests due tomorrow")
    except Exception as e:
        logger.error(f"Error sending quest reminders: {e}")

async def reset_daily_chores():
    """Reset daily chores for children at 6 AM IST"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        weekday = datetime.now(timezone.utc).weekday()  # 0=Mon, 6=Sun
        day_of_month = datetime.now(timezone.utc).day
        
        # Find daily and weekly chores that need reset
        daily_chores = await db.new_quests.find({
            "creator_type": "parent",
            "is_active": True,
            "$or": [
                {"frequency": "daily"},
                {"frequency": "weekly", "weekly_days": weekday},
                {"frequency": "monthly_date", "monthly_date": day_of_month}
            ]
        }, {"_id": 0}).to_list(500)
        
        for chore in daily_chores:
            # Clear today's pending completion requests
            await db.chore_requests.delete_many({
                "chore_id": chore["chore_id"],
                "status": "pending"
            })
            
            # Notify child about recurring chore
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": chore["child_id"],
                "message": f"🔄 Time for your chore: {chore['title']}",
                "type": "chore_reminder",
                "link": "/quests",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        logger.info(f"Reset {len(daily_chores)} daily/weekly/monthly chores")
    except Exception as e:
        logger.error(f"Error resetting daily chores: {e}")

@app.on_event("shutdown")
async def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    scheduler.shutdown()
    logger.info("Daily price fluctuation scheduler stopped")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
