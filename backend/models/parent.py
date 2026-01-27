"""Parent-related models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone

class ParentChildLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    link_id: str
    parent_id: str
    child_id: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LinkChildRequest(BaseModel):
    child_email: str

class Allowance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    allowance_id: str
    parent_id: str
    child_id: str
    amount: float
    frequency: str
    next_date: str
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AllowanceCreate(BaseModel):
    child_id: str
    amount: float
    frequency: str

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
    status: str = "pending"
    chore_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListItemCreate(BaseModel):
    child_id: str
    item_id: str
    quantity: int = 1

class ShoppingListChoreCreate(BaseModel):
    child_id: str
    list_item_ids: List[str]
    title: str
    description: Optional[str] = None
    reward_amount: float

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
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float
    deadline: Optional[str] = None
