"""School-related models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone

class SchoolCreate(BaseModel):
    """Create a new school"""
    name: str
    username: str
    password: str
    address: Optional[str] = None
    contact_email: Optional[str] = None

class SchoolLoginRequest(BaseModel):
    username: str
    password: str

class School(BaseModel):
    model_config = ConfigDict(extra="ignore")
    school_id: str
    name: str
    username: str
    password_hash: str
    address: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
