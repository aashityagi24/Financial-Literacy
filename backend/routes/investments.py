"""Stock Investment routes - Grade 3-5 investment simulation"""
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

router = APIRouter(tags=["investments"])

class InvestmentCreate(BaseModel):
    investment_type: str
    name: str
    amount: float

@router.get("/investments")
async def get_investments(request: Request):
    """Get user's investments - redirects to appropriate system based on grade"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    if grade == 0:
        raise HTTPException(status_code=403, detail="Investments not available for Kindergarten")
    
    if grade <= 2:
        raise HTTPException(status_code=400, detail="Use /garden/farm for Grade 1-2")
    
    investments = await db.investments.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    for inv in investments:
        created = datetime.fromisoformat(inv["created_at"]) if isinstance(inv["created_at"], str) else inv["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_passed = (datetime.now(timezone.utc) - created).days
        growth = 1 + (inv.get("growth_rate", 0.05) * days_passed / 365)
        inv["current_value"] = round(inv["amount_invested"] * growth, 2)
    
    return investments

@router.post("/investments")
async def create_investment(investment: InvestmentCreate, request: Request):
    """Create a new investment"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    investing_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "investing"
    })
    
    if not investing_acc or investing_acc.get("balance", 0) < investment.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in investing account")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": -investment.amount}}
    )
    
    inv_doc = {
        "investment_id": f"inv_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "investment_type": investment.investment_type,
        "name": investment.name,
        "amount_invested": investment.amount,
        "current_value": investment.amount,
        "growth_rate": 0.08 if investment.investment_type == "stock" else 0.05,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    await db.investments.insert_one(inv_doc)
    
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "investing",
        "to_account": None,
        "amount": investment.amount,
        "transaction_type": "investment",
        "description": f"Invested in {investment.name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Investment created", "investment_id": inv_doc["investment_id"]}

@router.post("/investments/{investment_id}/sell")
async def sell_investment(investment_id: str, request: Request):
    """Sell an investment and get returns"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    inv = await db.investments.find_one({
        "investment_id": investment_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    created = datetime.fromisoformat(inv["created_at"]) if isinstance(inv["created_at"], str) else inv["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    days_passed = (datetime.now(timezone.utc) - created).days
    growth = 1 + (inv.get("growth_rate", 0.05) * days_passed / 365)
    current_value = round(inv["amount_invested"] * growth, 2)
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": current_value}}
    )
    
    await db.investments.delete_one({"investment_id": investment_id})
    
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "investing",
        "amount": current_value,
        "transaction_type": "investment_return",
        "description": f"Sold {inv['name']} for ₹{current_value}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    return {"message": "Investment sold", "amount_received": current_value}


# ============== INVESTMENT CATALOG ROUTES ==============

@router.get("/investments/plants")
async def get_investment_plants(request: Request):
    """Get available investment plant types"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    plants = await db.investment_plants.find(
        {"min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    return plants

@router.get("/investments/stocks")
async def get_investment_stocks(request: Request):
    """Get available stocks for investment"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    stocks = await db.investment_stocks.find(
        {"is_active": True, "min_grade": {"$lte": grade}, "max_grade": {"$gte": grade}},
        {"_id": 0}
    ).to_list(100)
    return stocks

@router.get("/investments/stocks/{stock_id}/chart")
async def get_stock_chart(stock_id: str, request: Request, days: int = 30):
    """Get stock price history for chart"""
    from services.auth import get_current_user
    db = get_db()
    await get_current_user(request)
    
    history = await db.stock_price_history.find(
        {"stock_id": stock_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    return list(reversed(history))

@router.get("/investments/portfolio")
async def get_investment_portfolio(request: Request):
    """Get user's investment portfolio"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    holdings = await db.stock_holdings.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    portfolio_value = 0
    for holding in holdings:
        stock = await db.investment_stocks.find_one(
            {"stock_id": holding["stock_id"]},
            {"current_price": 1, "name": 1, "symbol": 1}
        )
        if stock:
            holding["stock"] = stock
            holding["current_value"] = holding["quantity"] * stock.get("current_price", 0)
            portfolio_value += holding["current_value"]
    
    return {
        "holdings": holdings,
        "total_value": round(portfolio_value, 2)
    }

@router.post("/investments/buy")
async def buy_investment(request: Request):
    """Buy stocks"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    body = await request.json()
    
    stock_id = body.get("stock_id")
    quantity = body.get("quantity", 1)
    
    stock = await db.investment_stocks.find_one({"stock_id": stock_id})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_cost = stock["current_price"] * quantity
    
    investing_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "investing"
    })
    
    if not investing_acc or investing_acc.get("balance", 0) < total_cost:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": -total_cost}}
    )
    
    # Update or create holding
    existing = await db.stock_holdings.find_one({
        "user_id": user["user_id"],
        "stock_id": stock_id
    })
    
    if existing:
        await db.stock_holdings.update_one(
            {"user_id": user["user_id"], "stock_id": stock_id},
            {"$inc": {"quantity": quantity, "total_invested": total_cost}}
        )
    else:
        await db.stock_holdings.insert_one({
            "holding_id": f"hold_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "stock_id": stock_id,
            "quantity": quantity,
            "total_invested": total_cost,
            "avg_buy_price": stock["current_price"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": f"Bought {quantity} shares of {stock['name']}", "total_cost": total_cost}

@router.post("/investments/sell")
async def sell_investment_stock(request: Request):
    """Sell stocks"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    body = await request.json()
    
    stock_id = body.get("stock_id")
    quantity = body.get("quantity", 1)
    
    holding = await db.stock_holdings.find_one({
        "user_id": user["user_id"],
        "stock_id": stock_id
    })
    
    if not holding or holding.get("quantity", 0) < quantity:
        raise HTTPException(status_code=400, detail="Insufficient shares")
    
    stock = await db.investment_stocks.find_one({"stock_id": stock_id})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_value = stock["current_price"] * quantity
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": total_value}}
    )
    
    new_quantity = holding["quantity"] - quantity
    if new_quantity <= 0:
        await db.stock_holdings.delete_one({
            "user_id": user["user_id"],
            "stock_id": stock_id
        })
    else:
        await db.stock_holdings.update_one(
            {"user_id": user["user_id"], "stock_id": stock_id},
            {"$inc": {"quantity": -quantity}}
        )
    
    return {"message": f"Sold {quantity} shares of {stock['name']}", "total_value": total_value}