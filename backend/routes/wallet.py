"""Wallet routes - Account management and transactions"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

# Database injection
_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["wallet"])

class TransactionCreate(BaseModel):
    from_account: str = None
    to_account: str = None
    amount: float
    transaction_type: str
    description: str

@router.get("/wallet")
async def get_wallet(request: Request):
    """Get all wallet accounts for current user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    accounts = await db.wallet_accounts.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    
    total_balance = sum(acc.get("balance", 0) for acc in accounts)
    
    return {
        "accounts": accounts,
        "total_balance": total_balance
    }

@router.post("/wallet/transfer")
async def transfer_money(transaction: TransactionCreate, request: Request):
    """Transfer money between accounts"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if transaction.transaction_type == "transfer":
        if not transaction.from_account or not transaction.to_account:
            raise HTTPException(status_code=400, detail="Both from_account and to_account required for transfer")
        
        from_acc = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": transaction.from_account
        })
        
        if not from_acc or from_acc.get("balance", 0) < transaction.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        # Deduct from source
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.from_account},
            {"$inc": {"balance": -transaction.amount}}
        )
        
        # Add to destination
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.to_account},
            {"$inc": {"balance": transaction.amount}}
        )
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": transaction.from_account,
        "to_account": transaction.to_account,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Transfer successful", "transaction_id": trans_doc["transaction_id"]}

@router.get("/wallet/transactions")
async def get_transactions(request: Request, limit: int = 20):
    """Get recent transactions for current user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    transactions = await db.transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return transactions
