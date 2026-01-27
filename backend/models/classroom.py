"""Classroom and teacher models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone

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
