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
    transaction_type: str = "transfer"
    description: str = "Account transfer"

@router.get("/wallet")
async def get_wallet(request: Request):
    """Get all wallet accounts for current user with available vs allocated breakdown"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    accounts = await db.wallet_accounts.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10)
    
    # Calculate allocated amounts for savings (money committed to goals)
    savings_goals = await db.savings_goals.find(
        {"$or": [{"child_id": user_id}, {"user_id": user_id}]},
        {"_id": 0, "current_amount": 1}
    ).to_list(100)
    savings_allocated = sum(g.get("current_amount", 0) for g in savings_goals)
    
    # Calculate allocated amounts for investing (money in stocks/plants)
    # Stock holdings value
    stock_holdings = await db.user_stock_holdings.find(
        {"user_id": user_id},
        {"_id": 0, "stock_id": 1, "shares": 1}
    ).to_list(100)
    
    stocks_allocated = 0
    for holding in stock_holdings:
        stock = await db.investment_stocks.find_one(
            {"stock_id": holding.get("stock_id")},
            {"_id": 0, "current_price": 1}
        )
        if stock:
            stocks_allocated += holding.get("shares", 0) * stock.get("current_price", 0)
    
    # Garden plots value (for grades 1-2)
    garden_plots = await db.user_garden_plots.find(
        {"user_id": user_id},
        {"_id": 0, "purchase_price": 1, "plant_value": 1}
    ).to_list(100)
    garden_allocated = sum(p.get("plant_value", p.get("purchase_price", 0)) for p in garden_plots)
    
    investing_allocated = stocks_allocated + garden_allocated
    
    # Enrich accounts with available vs allocated
    enriched_accounts = []
    for acc in accounts:
        acc_type = acc.get("account_type")
        balance = acc.get("balance", 0)
        
        if acc_type == "savings":
            # Savings: available = balance - allocated to goals
            available = max(0, balance - savings_allocated)
            enriched_accounts.append({
                **acc,
                "available_balance": available,
                "allocated_balance": savings_allocated,
                "total_balance": balance
            })
        elif acc_type == "investing":
            # Investing: available = cash balance, allocated = portfolio value
            enriched_accounts.append({
                **acc,
                "available_balance": balance,  # Cash ready to invest
                "allocated_balance": investing_allocated,  # Value of investments
                "total_balance": balance + investing_allocated
            })
        else:
            # Spending, gifting - just show balance
            enriched_accounts.append({
                **acc,
                "available_balance": balance,
                "allocated_balance": 0,
                "total_balance": balance
            })
    
    # Total available = sum of all available_balance (money that can actually be spent/used)
    total_available = sum(acc.get("available_balance", 0) for acc in enriched_accounts)
    
    return {
        "accounts": enriched_accounts,
        "total_available": total_available,
        "savings_allocated": savings_allocated,
        "investing_allocated": investing_allocated
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
