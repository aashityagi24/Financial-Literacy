"""Wallet and transaction models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone

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
