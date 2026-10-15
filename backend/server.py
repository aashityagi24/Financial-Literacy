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

# Mount static files for uploads under /api/uploads so it's accessible through the proxy.
# Falls back to Emergent Object Storage for files not on local disk (deployed pods have
# ephemeral disks, so new uploads are persisted to object storage - see routes/uploads.py).
from services.object_storage import get_object as _storage_get_object
import mimetypes as _mimetypes

@api_router.get("/uploads/{file_path:path}")
async def serve_uploaded_file(file_path: str):
    local_path = UPLOADS_DIR / file_path
    if local_path.is_file():
        return FileResponse(str(local_path))
    try:
        data, content_type = _storage_get_object(file_path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    guessed = _mimetypes.guess_type(file_path)[0]
    return Response(content=data, media_type=guessed or content_type)

# ============== MODULAR ROUTES INITIALIZATION ==============
# Initialize modular route modules with database
import sys
sys.path.insert(0, str(ROOT_DIR))

from services import auth as auth_service
from routes import auth as auth_routes
from routes import school as school_routes
from routes import wallet as wallet_routes
from routes import store as store_routes
from routes import garden as garden_routes
from routes import investments as investment_routes
from routes import achievements as achievement_routes
from routes import quests as quest_routes
from routes import notifications as notification_routes
from routes import teacher as teacher_routes
from routes import parent as parent_routes
from routes import admin as admin_routes
from routes import child as child_routes
from routes import learning as learning_routes
from routes import uploads as upload_routes
from routes import stocks as stocks_routes
from routes import content as content_routes
from routes import student as student_routes
from routes import lending as lending_routes
from routes import glossary as glossary_routes
from routes import repository as repository_routes
from routes import activity as activity_routes
from routes import jobs as jobs_routes
from routes import subscriptions as subscription_routes
from routes import live_classes as live_classes_routes

# Initialize database in modules
auth_service.init_db(db)
auth_routes.init_db(db)
school_routes.init_db(db)
wallet_routes.init_db(db)
store_routes.init_db(db)
garden_routes.init_db(db)
investment_routes.init_db(db)
achievement_routes.init_db(db)
quest_routes.init_db(db)
notification_routes.init_db(db)
teacher_routes.init_db(db)
parent_routes.init_db(db)
admin_routes.init_db(db)
child_routes.init_db(db)
learning_routes.init_db(db)
stocks_routes.init_db(db)
content_routes.init_db(db)
student_routes.init_db(db)
lending_routes.init_db(db)
glossary_routes.init_db(db)
repository_routes.init_db(db)
jobs_routes.init_db(db)
subscription_routes.init_db(db)
live_classes_routes.init_db(db)

# Include modular routers
api_router.include_router(auth_routes.router)
api_router.include_router(school_routes.router)
api_router.include_router(wallet_routes.router)
api_router.include_router(store_routes.router)
api_router.include_router(garden_routes.router)
api_router.include_router(investment_routes.router)
api_router.include_router(achievement_routes.router)
api_router.include_router(quest_routes.router)
api_router.include_router(notification_routes.router)
api_router.include_router(teacher_routes.router)
api_router.include_router(parent_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(child_routes.router)
api_router.include_router(learning_routes.router)
api_router.include_router(upload_routes.router)
api_router.include_router(stocks_routes.router)
api_router.include_router(content_routes.router)
api_router.include_router(student_routes.router)
api_router.include_router(lending_routes.router)
api_router.include_router(glossary_routes.router)
api_router.include_router(repository_routes.router)
api_router.include_router(activity_routes.router)
api_router.include_router(jobs_routes.router)
api_router.include_router(subscription_routes.router)
api_router.include_router(live_classes_routes.router)

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

class RewardPenaltyCreate(BaseModel):
    """Create instant reward or penalty for a child"""
    child_id: str
    title: str
    description: Optional[str] = None
    amount: float  # Positive for reward, negative for penalty
    category: str  # 'reward' or 'penalty'

class SchoolCreate(BaseModel):
    """Create a new school"""
    name: str
    username: str
    password: str
    address: Optional[str] = None
    contact_email: Optional[str] = None

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

import string

def generate_invite_code():
    """Generate a 6-character invite code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ============== AUTH ROUTES ==============
# NOTE: These routes have been moved to /routes/auth.py
# The decorators below are commented out to avoid duplicate route registration

class AdminLoginRequest(BaseModel):
    email: str
    password: str

@api_router.get("/download/activity/{folder_name}")
async def download_activity_folder(folder_name: str, request: Request):
    """Download an activity folder as a ZIP file (admin only)"""
    from services.auth import get_current_user
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    activity_folder = ACTIVITIES_DIR / folder_name
    if not activity_folder.exists():
        raise HTTPException(status_code=404, detail="Activity folder not found")
    
    # Create a zip in /tmp
    zip_path = Path(f"/tmp/activity_{folder_name}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in activity_folder.rglob("*"):
            if file_path.is_file():
                zf.write(file_path, file_path.relative_to(activity_folder))
    
    return FileResponse(
        path=str(zip_path),
        filename=f"activity_{folder_name}.zip",
        media_type="application/zip"
    )
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

# ============== ROLLING SESSION MIDDLEWARE ==============
# Keeps an actively-used session alive: every time a valid session cookie is
# seen, its expiry is pushed forward by SESSION_TTL_DAYS. An abandoned session
# still expires SESSION_TTL_DAYS after the user's last request. Only writes to
# Mongo when meaningfully stale (>1 day left unrefreshed) to avoid a DB write
# on every single request.
SESSION_TTL_DAYS = 7
SESSION_COOKIE_KWARGS = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}

@app.middleware("http")
async def refresh_rolling_session(request: Request, call_next):
    response = await call_next(request)
    try:
        session_token = request.cookies.get("session_token")
        if session_token:
            session = await db.user_sessions.find_one({"session_token": session_token}, {"expires_at": 1})
            if session:
                expires_at = session["expires_at"]
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                # Refresh once activity has aged the session by more than a day,
                # instead of on every single request.
                if expires_at > now and expires_at - now < timedelta(days=SESSION_TTL_DAYS - 1):
                    new_expiry = now + timedelta(days=SESSION_TTL_DAYS)
                    await db.user_sessions.update_one(
                        {"session_token": session_token},
                        {"$set": {"expires_at": new_expiry.isoformat()}}
                    )
                    response.set_cookie(
                        key="session_token",
                        value=session_token,
                        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
                        **SESSION_COOKIE_KWARGS
                    )
    except Exception:
        # Best-effort refresh only; never let this break the actual request.
        pass
    return response

# ============== CONTENT PROTECTION MIDDLEWARE ==============
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Add security headers to all responses
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # For uploaded content, add extra protection
    if "/api/uploads/" in str(request.url.path):
        # Prevent content from being downloaded directly
        response.headers["Content-Disposition"] = "inline"
        # Prevent caching of sensitive content
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        # Content Security Policy for HTML content
        if request.url.path.endswith('.html'):
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    
    return response

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
            new_price = max(1.0, current_price * (1 + change_percent))  # Minimum price 1 XP
            new_price = round(new_price, 2)
            
            # Create price history entry for embedded array
            price_entry = {
                "date": today,
                "price": new_price,
                "close_price": new_price,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            # Update stock price and add to embedded price_history array
            await db.investment_stocks.update_one(
                {"stock_id": stock["stock_id"]},
                {
                    "$set": {
                        "current_price": new_price,
                        "last_price_update": datetime.now(timezone.utc).isoformat()
                    },
                    "$push": {
                        "price_history": {
                            "$each": [price_entry],
                            "$slice": -30  # Keep last 30 entries
                        }
                    }
                }
            )
            
            # Also update admin_stocks if it exists there
            await db.admin_stocks.update_one(
                {"stock_id": stock["stock_id"]},
                {
                    "$set": {
                        "current_price": new_price,
                        "last_price_update": datetime.now(timezone.utc).isoformat()
                    },
                    "$push": {
                        "price_history": {
                            "$each": [price_entry],
                            "$slice": -30
                        }
                    }
                }
            )
            
            # Record in detailed price history collection (for analytics)
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

async def process_recurring_allowances():
    """
    Process recurring allowances for children.
    Runs daily at 6:00 AM IST (00:30 UTC).
    Checks all active allowances and distributes money based on frequency.
    """
    logger.info("Processing recurring allowances...")
    
    today = datetime.now(timezone.utc)
    today_str = today.strftime("%Y-%m-%d")
    task_id = "process_allowances"
    
    # Check if already run today
    last_run = await db.scheduler_logs.find_one({"task": task_id, "date": today_str})
    if last_run:
        logger.info(f"Allowance processing already ran today at {last_run.get('created_at')}")
        return
    
    try:
        # Get all active allowances
        allowances = await db.allowances.find({"active": True}).to_list(500)
        
        processed_count = 0
        total_distributed = 0
        
        for allowance in allowances:
            should_pay = False
            frequency = allowance.get("frequency", "weekly")
            last_paid = allowance.get("last_paid_at")
            
            if last_paid:
                last_paid_date = datetime.fromisoformat(last_paid.replace('Z', '+00:00'))
                days_since_last = (today - last_paid_date).days
                
                if frequency == "daily":
                    should_pay = days_since_last >= 1
                elif frequency == "weekly":
                    should_pay = days_since_last >= 7
                elif frequency == "biweekly":
                    should_pay = days_since_last >= 14
                elif frequency == "monthly":
                    should_pay = days_since_last >= 30
            else:
                # Never paid, should pay on first run
                # Check if created more than 1 day ago (don't pay immediately on creation)
                created_at = allowance.get("created_at")
                if created_at:
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    days_since_created = (today - created_date).days
                    if frequency == "daily":
                        should_pay = days_since_created >= 1
                    elif frequency == "weekly":
                        should_pay = days_since_created >= 7
                    elif frequency == "biweekly":
                        should_pay = days_since_created >= 14
                    elif frequency == "monthly":
                        should_pay = days_since_created >= 30
            
            if should_pay:
                child_id = allowance["child_id"]
                parent_id = allowance["parent_id"]
                amount = allowance["amount"]
                
                # Get parent name for transaction record
                parent = await db.users.find_one({"user_id": parent_id}, {"name": 1})
                parent_name = parent.get("name", "Parent") if parent else "Parent"
                
                # Get child name for logging
                child = await db.users.find_one({"user_id": child_id}, {"name": 1})
                child_name = child.get("name", "Child") if child else "Child"
                
                # Credit child's spending wallet
                await db.wallet_accounts.update_one(
                    {"user_id": child_id, "account_type": "spending"},
                    {"$inc": {"balance": amount}}
                )
                
                # Create transaction record
                await db.transactions.insert_one({
                    "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                    "user_id": child_id,
                    "amount": amount,
                    "transaction_type": "allowance",
                    "description": f"{frequency.capitalize()} allowance from {parent_name}",
                    "from_user": parent_id,
                    "from_name": parent_name,
                    "created_at": today.isoformat()
                })
                
                # Create notification for child
                await db.notifications.insert_one({
                    "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                    "user_id": child_id,
                    "message": f"💰 You received your {frequency} allowance of ₹{amount} from {parent_name}!",
                    "notification_type": "allowance",
                    "link": "/wallet",
                    "read": False,
                    "created_at": today.isoformat()
                })
                
                # Update last_paid_at
                await db.allowances.update_one(
                    {"allowance_id": allowance["allowance_id"]},
                    {"$set": {"last_paid_at": today.isoformat()}}
                )
                
                processed_count += 1
                total_distributed += amount
                logger.info(f"Allowance paid: ₹{amount} to {child_name} ({frequency})")
        
        # Log successful run
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": task_id,
            "date": today_str,
            "status": "success",
            "details": {
                "allowances_processed": processed_count,
                "total_distributed": total_distributed
            },
            "created_at": today.isoformat()
        })
        
        logger.info(f"Allowance processing complete: {processed_count} allowances, ₹{total_distributed} distributed")
        
    except Exception as e:
        logger.error(f"Error processing allowances: {e}")
        await db.scheduler_logs.insert_one({
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "task": task_id,
            "date": today_str,
            "status": "failed",
            "error": str(e),
            "created_at": today.isoformat()
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
    
    # Process recurring allowances at 6:00 AM IST (00:30 UTC)
    scheduler.add_job(
        process_recurring_allowances,
        CronTrigger(hour=0, minute=30),
        id="process_allowances",
        replace_existing=True
    )
    
    # Check loan due dates and send reminders at 8:00 AM IST (02:30 UTC)
    scheduler.add_job(
        check_loan_due_dates,
        CronTrigger(hour=2, minute=30),
        id="check_loan_due_dates",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Schedulers started: stock fluctuations (7:15 AM, 12:00 PM, 4:30 PM IST), plant update (6 AM UTC), quest reminders (7 PM UTC), chore reset (00:30 UTC), allowances (00:30 UTC), loan checks (8 AM IST)")
    
    # Run opening fluctuation on startup if market just opened
    current_ist_hour = get_ist_hour()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # If between 7 AM and 8 AM IST and opening hasn't run
    if 7 <= current_ist_hour < 8:
        last_opening = await db.scheduler_logs.find_one({"task": "stock_fluctuation_opening", "date": today})
        if not last_opening:
            logger.info("Running opening stock fluctuation on startup...")
            await stock_price_fluctuation("opening")

async def check_loan_due_dates():
    """Check loan due dates and send reminders/mark bad debts"""
    try:
        from routes.lending import check_overdue_loans
        await check_overdue_loans()
        logger.info("Loan due date check completed")
    except Exception as e:
        logger.error(f"Error checking loan due dates: {e}")

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
                        "message": f"⏰ Reminder: '{quest['title']}' is due tomorrow! Complete it to earn {quest['total_points']} XP",
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
