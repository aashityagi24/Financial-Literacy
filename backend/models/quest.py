"""Quest and chore models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

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

class QuestQuestion(BaseModel):
    """A single question in a quest"""
    question_id: str
    question_text: str
    question_type: str  # 'mcq', 'multi_select', 'true_false', 'value'
    image_url: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Any
    points: float

class QuestCreate(BaseModel):
    """Create a new quest (admin/teacher)"""
    title: str
    description: str = ""
    image_url: Optional[str] = None
    pdf_url: Optional[str] = None
    min_grade: int = 0
    max_grade: int = 5
    due_date: str
    reward_amount: float = 0
    questions: List[Dict[str, Any]] = []

class UserQuest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    quest_id: str
    progress: float = 0.0
    completed: bool = False
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ChoreCreate(BaseModel):
    """Create a new chore (parent)"""
    child_id: str
    title: str
    description: Optional[str] = None
    reward_amount: float
    frequency: str  # 'one_time', 'daily', 'weekly', 'monthly_date'
    weekly_days: Optional[List[int]] = None
    monthly_date: Optional[int] = None

class Chore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chore_id: str
    parent_id: str
    child_id: str
    title: str
    description: Optional[str] = None
    reward_amount: float
    frequency: str = "once"
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

class RewardPenaltyCreate(BaseModel):
    """Create instant reward or penalty for a child"""
    child_id: str
    title: str
    description: Optional[str] = None
    amount: float
    category: str  # 'reward' or 'penalty'
