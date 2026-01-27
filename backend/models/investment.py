"""Investment models (Garden and Stock Market)"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

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

# Money Garden Models (Grade 1-2)
class GardenPlant(BaseModel):
    """Plants for Money Garden"""
    model_config = ConfigDict(extra="ignore")
    plant_id: str
    name: str
    emoji: str
    seed_cost: float
    growth_time_hours: int
    base_yield_min: float
    base_yield_max: float
    water_interval_hours: int = 4
    max_water_penalty: float = 0.3
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GardenPlantCreate(BaseModel):
    name: str
    emoji: str
    seed_cost: float
    growth_time_hours: int
    base_yield_min: float
    base_yield_max: float
    water_interval_hours: int = 4
    max_water_penalty: float = 0.3

class GardenPlot(BaseModel):
    """A plot in user's garden"""
    model_config = ConfigDict(extra="ignore")
    plot_id: str
    user_id: str
    plant_id: Optional[str] = None
    plant_name: Optional[str] = None
    plant_emoji: Optional[str] = None
    planted_at: Optional[datetime] = None
    last_watered: Optional[datetime] = None
    water_count: int = 0
    ready_to_harvest: bool = False
    is_dead: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GardenInventory(BaseModel):
    """User's harvested produce"""
    model_config = ConfigDict(extra="ignore")
    inventory_id: str
    user_id: str
    plant_id: str
    plant_name: str
    plant_emoji: str
    quantity: int
    harvested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Stock Market Models (Grade 3-5)
class StockCategory(BaseModel):
    """Stock categories like Tech, Healthcare, etc."""
    model_config = ConfigDict(extra="ignore")
    category_id: str
    name: str
    description: str
    icon: str
    color: str
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockCategoryCreate(BaseModel):
    name: str
    description: str
    icon: str = "📊"
    color: str = "#3D5A80"
    order: int = 0

class Stock(BaseModel):
    """A stock in the market"""
    model_config = ConfigDict(extra="ignore")
    stock_id: str
    category_id: str
    name: str
    ticker: str
    description: str
    current_price: float
    base_price: float
    volatility: float = 0.1
    risk_level: str = "medium"
    min_grade: int = 3
    max_grade: int = 5
    is_active: bool = True
    price_history: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockCreate(BaseModel):
    category_id: str
    name: str
    ticker: str
    description: str
    base_price: float
    volatility: float = 0.1
    risk_level: str = "medium"
    min_grade: int = 3
    max_grade: int = 5

class StockUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    ticker: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    volatility: Optional[float] = None
    risk_level: Optional[str] = None
    min_grade: Optional[int] = None
    max_grade: Optional[int] = None
    is_active: Optional[bool] = None

class StockHolding(BaseModel):
    """User's stock holdings"""
    model_config = ConfigDict(extra="ignore")
    holding_id: str
    user_id: str
    stock_id: str
    quantity: int
    average_buy_price: float
    total_invested: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockNews(BaseModel):
    """News that affects stock prices"""
    model_config = ConfigDict(extra="ignore")
    news_id: str
    title: str
    content: str
    category_id: Optional[str] = None
    stock_ids: List[str] = []
    impact: str  # 'positive', 'negative', 'neutral'
    impact_percentage: float = 0.0
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockNewsCreate(BaseModel):
    title: str
    content: str
    category_id: Optional[str] = None
    stock_ids: List[str] = []
    impact: str = "neutral"
    impact_percentage: float = 0.0
    duration_hours: int = 24
