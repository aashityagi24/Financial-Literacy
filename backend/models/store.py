"""Store-related models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone

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
    unit: str = "piece"
    min_grade: int = 0
    max_grade: int = 5
    stock: int = -1  # -1 means unlimited
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StoreItemCreate(BaseModel):
    category_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None
    unit: str = "piece"
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

class PurchaseCreate(BaseModel):
    item_id: str
