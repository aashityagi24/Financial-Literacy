"""Learning content models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class ContentTopic(BaseModel):
    """Topic or Subtopic - supports hierarchy via parent_id"""
    model_config = ConfigDict(extra="ignore")
    topic_id: str
    title: str
    description: str
    parent_id: Optional[str] = None
    thumbnail: Optional[str] = None
    order: int = 0
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
    """Generic content item"""
    model_config = ConfigDict(extra="ignore")
    content_id: str
    topic_id: str
    title: str
    description: str
    content_type: str  # 'worksheet', 'activity', 'book', 'workbook', 'video'
    thumbnail: Optional[str] = None
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5
    reward_coins: int = 5
    is_published: bool = False
    content_data: Dict[str, Any] = {}
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
    visible_to: List[str] = ["child"]

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
    score: Optional[int] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ReorderRequest(BaseModel):
    """Request to reorder items"""
    items: List[Dict[str, Any]]

class LearningTopic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic_id: str
    title: str
    description: str
    category: str
    icon: str
    order: int = 0
    min_grade: int = 0
    max_grade: int = 5

class LearningLesson(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lesson_id: str
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
    score: Optional[int] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: int
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
    answers: List[int]

class Book(BaseModel):
    model_config = ConfigDict(extra="ignore")
    book_id: str
    title: str
    author: str
    description: str
    cover_url: Optional[str] = None
    content_url: Optional[str] = None
    category: str
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
    activity_type: str
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
