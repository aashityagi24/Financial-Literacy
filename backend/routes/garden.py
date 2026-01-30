"""Money Garden routes - Grade 1-2 investment simulation"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import random
import pytz

# Database injection
_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["garden"])

PLOT_COST = 20

class PlantSeedRequest(BaseModel):
    plot_id: str
    plant_id: str

def is_market_open():
    """Check if market is open (7 AM - 5 PM IST)"""
    ist = pytz.timezone('Asia/Kolkata')
    ist_now = datetime.now(ist)
    return 7 <= ist_now.hour < 17

@router.get("/garden/farm")
async def get_farm(request: Request):
    """Get child's farm with all plots and their status"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    if grade == 0:
        raise HTTPException(status_code=403, detail="Investments not available for Kindergarten")
    if grade >= 3:
        raise HTTPException(status_code=400, detail="Use /investments for Grade 3+")
    
    plots = await db.farm_plots.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    
    if not plots:
        initial_plots = []
        for i in range(4):
            plot = {
                "plot_id": f"plot_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "position": i,
                "plant_id": None,
                "plant_name": None,
                "plant_emoji": None,
                "planted_at": None,
                "last_watered": None,
                "growth_days_total": 0,
                "growth_progress": 0,
                "status": "empty",
                "is_active": True
            }
            initial_plots.append(plot)
        await db.farm_plots.insert_many(initial_plots)
        plots = initial_plots
    
    now = datetime.now(timezone.utc)
    for plot in plots:
        if plot.get("plant_id") and plot.get("status") not in ["empty", "dead", "ready"]:
            plant = await db.investment_plants.find_one({"plant_id": plot["plant_id"]}, {"_id": 0})
            if plant:
                last_watered = plot.get("last_watered")
                if last_watered:
                    last_water_time = datetime.fromisoformat(last_watered.replace('Z', '+00:00'))
                    hours_since_water = (now - last_water_time).total_seconds() / 3600
                    water_freq = plant.get("water_frequency_hours", 24)
                    
                    if hours_since_water > water_freq * 2:
                        plot["status"] = "dead"
                        await db.farm_plots.update_one({"plot_id": plot["plot_id"]}, {"$set": {"status": "dead"}})
                    elif hours_since_water > water_freq * 1.5:
                        plot["status"] = "wilting"
                    elif hours_since_water > water_freq:
                        plot["status"] = "water_needed"
                    else:
                        planted_at = datetime.fromisoformat(plot["planted_at"].replace('Z', '+00:00'))
                        hours_growing = (now - planted_at).total_seconds() / 3600
                        total_growth_hours = plant["growth_days"] * 24
                        growth_progress = min(100, (hours_growing / total_growth_hours) * 100)
                        plot["growth_progress"] = round(growth_progress, 1)
                        
                        if growth_progress >= 100:
                            plot["status"] = "ready"
                            await db.farm_plots.update_one({"plot_id": plot["plot_id"]}, {"$set": {"status": "ready", "growth_progress": 100}})
                        else:
                            plot["status"] = "growing"
    
    seeds = await db.investment_plants.find({"is_active": True}, {"_id": 0}).to_list(50)
    inventory = await db.harvest_inventory.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    market_prices = await db.market_prices.find({"date": today}, {"_id": 0}).to_list(50)
    
    return {
        "plots": plots,
        "seeds": seeds,
        "inventory": inventory,
        "market_prices": market_prices,
        "is_market_open": is_market_open(),
        "plot_cost": PLOT_COST
    }

@router.post("/garden/buy-plot")
async def buy_farm_plot(request: Request):
    """Buy an additional plot for the farm"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    grade = user.get("grade", 3) or 3
    
    if grade == 0 or grade >= 3:
        raise HTTPException(status_code=403, detail="Money Garden is for Grade 1-2 only")
    
    spending_acc = await db.wallet_accounts.find_one({"user_id": user["user_id"], "account_type": "spending"})
    if not spending_acc or spending_acc.get("balance", 0) < PLOT_COST:
        raise HTTPException(status_code=400, detail=f"Need ₹{PLOT_COST} in spending account to buy a plot")
    
    plot_count = await db.farm_plots.count_documents({"user_id": user["user_id"]})
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -PLOT_COST}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": PLOT_COST,
        "transaction_type": "garden_buy",
        "description": "Purchased new garden plot",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    new_plot = {
        "plot_id": f"plot_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "position": plot_count,
        "plant_id": None,
        "plant_name": None,
        "plant_emoji": None,
        "planted_at": None,
        "last_watered": None,
        "growth_days_total": 0,
        "growth_progress": 0,
        "status": "empty",
        "is_active": True
    }
    await db.farm_plots.insert_one(new_plot)
    
    return {"message": "New plot purchased!", "plot": {k: v for k, v in new_plot.items() if k != "_id"}}

@router.post("/garden/plant")
async def plant_seed(data: PlantSeedRequest, request: Request):
    """Plant a seed in a plot"""
    from services.auth import get_current_user
    from routes.achievements import award_badge
    db = get_db()
    user = await get_current_user(request)
    
    plot = await db.farm_plots.find_one({"plot_id": data.plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") != "empty":
        raise HTTPException(status_code=400, detail="Plot is not empty")
    
    seed = await db.investment_plants.find_one({"plant_id": data.plant_id, "is_active": True})
    if not seed:
        raise HTTPException(status_code=404, detail="Seed not found")
    
    spending_acc = await db.wallet_accounts.find_one({"user_id": user["user_id"], "account_type": "spending"})
    if not spending_acc or spending_acc.get("balance", 0) < seed["seed_cost"]:
        raise HTTPException(status_code=400, detail=f"Need ₹{seed['seed_cost']} to buy this seed")
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": -seed["seed_cost"]}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": "spending",
        "to_account": None,
        "amount": seed["seed_cost"],
        "transaction_type": "garden_buy",
        "description": f"Planted {seed['name']} seed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    now = datetime.now(timezone.utc).isoformat()
    await db.farm_plots.update_one(
        {"plot_id": data.plot_id},
        {"$set": {
            "plant_id": seed["plant_id"],
            "plant_name": seed["name"],
            "plant_emoji": seed["emoji"],
            "planted_at": now,
            "last_watered": now,
            "growth_days_total": seed["growth_days"],
            "growth_progress": 0,
            "status": "growing"
        }}
    )
    
    # Award "Green Thumb" badge for first garden planting
    badge = await award_badge(db, user["user_id"], "garden_plant")
    
    return {"message": f"{seed['name']} planted!", "seed_cost": seed["seed_cost"], "badge_earned": badge}

@router.post("/garden/water/{plot_id}")
async def water_plant(plot_id: str, request: Request):
    """Water a plant"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    plot = await db.farm_plots.find_one({"plot_id": plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") in ["empty", "dead", "ready"]:
        raise HTTPException(status_code=400, detail="Cannot water this plot")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.farm_plots.update_one(
        {"plot_id": plot_id},
        {"$set": {"last_watered": now, "status": "growing"}}
    )
    
    return {"message": "Plant watered!"}

@router.post("/garden/water-all")
async def water_all_plants(request: Request):
    """Water all plants that need watering"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc).isoformat()
    result = await db.farm_plots.update_many(
        {"user_id": user["user_id"], "status": {"$in": ["growing", "water_needed", "wilting"]}},
        {"$set": {"last_watered": now, "status": "growing"}}
    )
    
    return {"message": f"Watered {result.modified_count} plants!"}

@router.post("/garden/harvest/{plot_id}")
async def harvest_plant(plot_id: str, request: Request):
    """Harvest a ready plant"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    plot = await db.farm_plots.find_one({"plot_id": plot_id, "user_id": user["user_id"]})
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    if plot.get("status") != "ready":
        raise HTTPException(status_code=400, detail="Plant is not ready for harvest")
    
    plant = await db.investment_plants.find_one({"plant_id": plot["plant_id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant info not found")
    
    inventory_item = {
        "inventory_id": f"inv_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "plant_id": plant["plant_id"],
        "plant_name": plant["name"],
        "plant_emoji": plant["emoji"],
        "quantity": plant["harvest_yield"],
        "yield_unit": plant["yield_unit"],
        "harvested_at": datetime.now(timezone.utc).isoformat()
    }
    await db.harvest_inventory.insert_one(inventory_item)
    
    await db.farm_plots.update_one(
        {"plot_id": plot_id},
        {"$set": {
            "plant_id": None,
            "plant_name": None,
            "plant_emoji": None,
            "planted_at": None,
            "last_watered": None,
            "growth_days_total": 0,
            "growth_progress": 0,
            "status": "empty"
        }}
    )
    
    return {
        "message": f"Harvested {plant['harvest_yield']} {plant['yield_unit']} of {plant['name']}!",
        "harvest": {"quantity": plant["harvest_yield"], "unit": plant["yield_unit"], "name": plant["name"]}
    }

@router.post("/garden/sell")
async def sell_produce(request: Request, plant_id: str, quantity: int):
    """Sell produce at market"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if not is_market_open():
        raise HTTPException(status_code=400, detail="Market is closed! Open 7 AM - 5 PM IST")
    
    inventory = await db.harvest_inventory.find_one({
        "user_id": user["user_id"],
        "plant_id": plant_id,
        "quantity": {"$gte": quantity}
    })
    if not inventory:
        raise HTTPException(status_code=400, detail="Not enough produce in inventory")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    market_price = await db.market_prices.find_one({"plant_id": plant_id, "date": today})
    
    if not market_price:
        plant = await db.investment_plants.find_one({"plant_id": plant_id})
        if plant:
            fluctuation = plant.get("price_fluctuation_percent", 10) / 100
            price_change = random.uniform(-fluctuation, fluctuation)
            current_price = round(plant["base_sell_price"] * (1 + price_change), 2)
            market_price = {
                "price_id": f"price_{uuid.uuid4().hex[:8]}",
                "plant_id": plant_id,
                "current_price": current_price,
                "base_price": plant["base_sell_price"],
                "fluctuation_percent": plant["price_fluctuation_percent"],
                "date": today
            }
            await db.market_prices.insert_one(market_price)
    
    total_earnings = round(market_price["current_price"] * quantity, 2)
    
    new_quantity = inventory["quantity"] - quantity
    if new_quantity <= 0:
        await db.harvest_inventory.delete_one({"inventory_id": inventory["inventory_id"]})
    else:
        await db.harvest_inventory.update_one(
            {"inventory_id": inventory["inventory_id"]},
            {"$set": {"quantity": new_quantity}}
        )
    
    await db.wallet_accounts.update_one(
        {"user_id": user["user_id"], "account_type": "spending"},
        {"$inc": {"balance": total_earnings}}
    )
    
    plant = await db.investment_plants.find_one({"plant_id": plant_id})
    plant_name = plant["name"] if plant else "produce"
    
    await db.transactions.insert_one({
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": None,
        "to_account": "spending",
        "amount": total_earnings,
        "transaction_type": "garden_sell",
        "description": f"Sold {quantity} {plant_name} at market",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check if this sale resulted in profit (compare to seed cost)
    # For simplicity, we'll award the badge on first garden sale as it's always profitable
    from routes.achievements import award_badge
    badge = await award_badge(db, user["user_id"], "garden_profit")
    
    return {
        "message": f"Sold {quantity} for ₹{total_earnings}!",
        "earnings": total_earnings,
        "price_per_unit": market_price["current_price"],
        "badge_earned": badge
    }
