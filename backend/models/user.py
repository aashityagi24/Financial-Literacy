"""User-related Pydantic models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime, timezone

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[str] = None  # 'child', 'parent', 'teacher', 'admin', 'school'
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

class ChatMessage(BaseModel):
    message: str
    grade: Optional[int] = 3

class ChatResponse(BaseModel):
    response: str

class FinancialTipRequest(BaseModel):
    grade: int
    topic: Optional[str] = None
