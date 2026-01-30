"""Stock market routes - Grade 3-5 detailed trading"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import pytz

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/stocks", tags=["stocks"])

def is_market_open():
    """Check if market is open (7 AM - 5 PM IST)"""
    ist = pytz.timezone('Asia/Kolkata')
    ist_now = datetime.now(ist)
    return 7 <= ist_now.hour < 17

@router.get("/market-status")
async def get_market_status(request: Request):
    """Get current market status"""
    from services.auth import get_current_user
    await get_current_user(request)
    
    ist = pytz.timezone('Asia/Kolkata')
    ist_now = datetime.now(ist)
    
    return {
        "is_open": is_market_open(),
        "current_time": ist_now.strftime("%H:%M"),
        "open_time": "07:00",
        "close_time": "17:00",
        "timezone": "IST"
    }

@router.get("/categories")
async def get_stock_categories(request: Request):
    """Get stock categories"""
    from services.auth import get_current_user
    db = get_db()
    await get_current_user(request)
    
    categories = await db.stock_categories.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(50)
    
    return categories

@router.get("/list")
async def get_stocks_list(request: Request, category_id: str = None):
    """Get all stocks optionally filtered by category"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    query = {"is_active": True}
    if category_id:
        query["category_id"] = category_id
    
    # Try investment_stocks first, then admin_stocks
    stocks = await db.investment_stocks.find(query, {"_id": 0}).to_list(100)
    if not stocks:
        stocks = await db.admin_stocks.find(query, {"_id": 0}).to_list(100)
    
    # Filter by grade (only if min_grade/max_grade are set)
    filtered_stocks = []
    for stock in stocks:
        min_g = stock.get("min_grade")
        max_g = stock.get("max_grade")
        # Include stock if no grade restriction OR grade is in range
        if (min_g is None and max_g is None) or \
           (min_g is not None and max_g is not None and min_g <= grade <= max_g) or \
           (min_g is None and max_g is not None and grade <= max_g) or \
           (max_g is None and min_g is not None and grade >= min_g):
            filtered_stocks.append(stock)
    
    for stock in filtered_stocks:
        history = stock.get("price_history", [])[-10:]
        stock["recent_history"] = history
        if len(history) >= 2:
            prev = history[-2].get("price", stock["current_price"])
            curr = stock["current_price"]
            stock["price_change"] = round(curr - prev, 2)
            stock["price_change_percent"] = round((curr - prev) / prev * 100, 2) if prev > 0 else 0
        else:
            stock["price_change"] = 0
            stock["price_change_percent"] = 0
    
    return filtered_stocks

@router.get("/portfolio")
async def get_portfolio(request: Request):
    """Get user's stock portfolio"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    holdings = await db.stock_holdings.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    total_invested = 0
    total_current = 0
    
    for holding in holdings:
        # Try investment_stocks first, then admin_stocks
        stock = await db.investment_stocks.find_one(
            {"stock_id": holding["stock_id"]},
            {"_id": 0}
        )
        if not stock:
            stock = await db.admin_stocks.find_one(
                {"stock_id": holding["stock_id"]},
                {"_id": 0}
            )
        if stock:
            holding["stock_name"] = stock.get("name")
            holding["ticker"] = stock.get("ticker")
            holding["current_price"] = stock.get("current_price", 0)
            holding["current_value"] = holding["quantity"] * stock.get("current_price", 0)
            holding["profit_loss"] = holding["current_value"] - holding.get("total_invested", 0)
            
            total_invested += holding.get("total_invested", 0)
            total_current += holding["current_value"]
    
    return {
        "holdings": holdings,
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current, 2),
        "total_profit_loss": round(total_current - total_invested, 2)
    }

@router.get("/portfolio/history")
async def get_portfolio_history(request: Request):
    """Get portfolio value history"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    transactions = await db.stock_transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return transactions

@router.get("/transactions")
async def get_stock_transactions(request: Request):
    """Get stock transaction history"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    transactions = await db.stock_transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return transactions

@router.post("/buy")
async def buy_stock(request: Request):
    """Buy stocks"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    body = await request.json()
    stock_id = body.get("stock_id")
    quantity = body.get("quantity", 1)
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    
    # Try investment_stocks first, then admin_stocks
    stock = await db.investment_stocks.find_one({"stock_id": stock_id, "is_active": True}, {"_id": 0})
    if not stock:
        stock = await db.admin_stocks.find_one({"stock_id": stock_id, "is_active": True}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_cost = stock["current_price"] * quantity
    
    investing_acc = await db.wallet_accounts.find_one({
        "user_id": user["user_id"],
        "account_type": "investing"
    })
    
    if not investing_acc or investing_acc.get("balance", 0) < total_cost:
        raise HTTPException(status_code=400, detail="Insufficient balance in investing account")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": -total_cost}}
    )
    
    existing_holding = await db.stock_holdings.find_one({
        "user_id": user["user_id"],
        "stock_id": stock_id
    })
    
    if existing_holding:
        new_quantity = existing_holding["quantity"] + quantity
        new_invested = existing_holding.get("total_invested", 0) + total_cost
        new_avg = new_invested / new_quantity
        
        await db.stock_holdings.update_one(
            {"holding_id": existing_holding["holding_id"]},
            {"$set": {
                "quantity": new_quantity,
                "total_invested": new_invested,
                "average_buy_price": new_avg
            }}
        )
    else:
        await db.stock_holdings.insert_one({
            "holding_id": f"hold_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "stock_id": stock_id,
            "quantity": quantity,
            "average_buy_price": stock["current_price"],
            "total_invested": total_cost,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.stock_transactions.insert_one({
        "transaction_id": f"stx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "stock_id": stock_id,
        "stock_name": stock["name"],
        "type": "buy",
        "quantity": quantity,
        "price": stock["current_price"],
        "total": total_cost,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Record in transactions for wallet history
    await db.transactions.insert_one({
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "transaction_type": "stock_buy",
        "amount": -total_cost,
        "description": f"Bought {quantity} shares of {stock['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award "Stock Star" badge for first stock investment
    from routes.achievements import award_badge
    badge = await award_badge(db, user["user_id"], "stock_buy")
    
    return {
        "message": f"Bought {quantity} shares of {stock['name']}",
        "total_cost": total_cost,
        "badge_earned": badge
    }

@router.post("/sell")
async def sell_stock(request: Request):
    """Sell stocks"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not is_market_open():
        raise HTTPException(status_code=400, detail="Market is closed! Trading hours: 9 AM - 4 PM IST")
    
    body = await request.json()
    stock_id = body.get("stock_id")
    quantity = body.get("quantity", 1)
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    
    holding = await db.stock_holdings.find_one({
        "user_id": user["user_id"],
        "stock_id": stock_id
    })
    
    if not holding or holding.get("quantity", 0) < quantity:
        raise HTTPException(status_code=400, detail="Insufficient shares")
    
    # Try investment_stocks first, then admin_stocks
    stock = await db.investment_stocks.find_one({"stock_id": stock_id}, {"_id": 0})
    if not stock:
        stock = await db.admin_stocks.find_one({"stock_id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_value = stock["current_price"] * quantity
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "investing"},
        {"$inc": {"balance": total_value}}
    )
    
    new_quantity = holding["quantity"] - quantity
    if new_quantity <= 0:
        await db.stock_holdings.delete_one({"holding_id": holding["holding_id"]})
    else:
        sold_portion = quantity / holding["quantity"]
        new_invested = holding.get("total_invested", 0) * (1 - sold_portion)
        
        await db.stock_holdings.update_one(
            {"holding_id": holding["holding_id"]},
            {"$set": {
                "quantity": new_quantity,
                "total_invested": new_invested
            }}
        )
    
    await db.stock_transactions.insert_one({
        "transaction_id": f"stx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "stock_id": stock_id,
        "stock_name": stock["name"],
        "type": "sell",
        "quantity": quantity,
        "price": stock["current_price"],
        "total": total_value,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Record in transactions for wallet history
    await db.transactions.insert_one({
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "transaction_type": "stock_sale",
        "amount": total_value,
        "description": f"Sold {quantity} shares of {stock['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check if this sale resulted in profit
    avg_buy_price = holding.get("average_buy_price", stock["current_price"])
    cost_basis = avg_buy_price * quantity
    profit = total_value - cost_basis
    
    badge = None
    if profit > 0:
        # Award "Profit Pro" badge for first stock profit
        from routes.achievements import award_badge
        badge = await award_badge(db, user["user_id"], "stock_profit")
    
    return {
        "message": f"Sold {quantity} shares of {stock['name']}",
        "total_received": total_value,
        "profit": profit,
        "badge_earned": badge
    }

@router.get("/news")
async def get_stock_news(request: Request):
    """Get market news"""
    from services.auth import get_current_user
    db = get_db()
    await get_current_user(request)
    
    news = await db.stock_news.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return news

@router.get("/{stock_id}")
async def get_stock_details(stock_id: str, request: Request):
    """Get single stock details"""
    from services.auth import get_current_user
    db = get_db()
    await get_current_user(request)
    
    # Try investment_stocks first, then admin_stocks
    stock = await db.investment_stocks.find_one({"stock_id": stock_id}, {"_id": 0})
    if not stock:
        stock = await db.admin_stocks.find_one({"stock_id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Add price history if available
    history = stock.get("price_history", [])
    if history:
        stock["price_history"] = history[-30:]  # Last 30 entries
    
    return stock
