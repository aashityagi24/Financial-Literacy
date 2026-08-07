"""Tests: Money Garden - fully-grown plant is harvestable even if water overdue.

Setup: insert a QA plot for child classmate_g1 (user_id 50604e17-3caa-44d4-9815-1fea21d8a58b)
with plant Sunflower (plant_0eb737e556d3), planted 3 days ago, status 'water_needed'.
GET /api/garden/farm must return that plot with status 'ready' and growth_progress 100.
"""
import os
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://savings-goals-test.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

CHILD_USER_ID = "50604e17-3caa-44d4-9815-1fea21d8a58b"
CHILD_USERNAME = "classmate_g1"
CHILD_PASSWORD = "testpass123"
PLANT_ID = "plant_0eb737e556d3"
QA_PLOT_ID = "QA_garden_plot"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def seeded_plot(db, event_loop):
    """Insert QA plot and ensure Sunflower seed exists. Cleanup after."""
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()

    async def setup():
        # Ensure plant exists (id + fields required by get_farm)
        plant = await db.investment_plants.find_one({"plant_id": PLANT_ID})
        if not plant:
            await db.investment_plants.insert_one({
                "plant_id": PLANT_ID,
                "name": "Sunflower",
                "emoji": "🌻",
                "growth_days": 1,
                "water_frequency_hours": 24,
                "seed_cost": 10,
                "base_sell_price": 15,
                "harvest_yield": 3,
                "yield_unit": "flowers",
                "price_fluctuation_percent": 10,
                "min_grade": 1,
                "max_grade": 2,
                "is_active": True,
            })
        # Remove any leftover QA plot
        await db.farm_plots.delete_many({"plot_id": QA_PLOT_ID})
        await db.farm_plots.insert_one({
            "plot_id": QA_PLOT_ID,
            "user_id": CHILD_USER_ID,
            "position": 99,
            "plant_id": PLANT_ID,
            "plant_name": "Sunflower",
            "plant_emoji": "🌻",
            "planted_at": three_days_ago,
            "last_watered": three_days_ago,
            "growth_days_total": 1,
            "growth_progress": 100.0,
            "status": "water_needed",
            "is_active": True,
        })

    event_loop.run_until_complete(setup())
    yield
    # Cleanup handled by explicit test at end


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": CHILD_USERNAME,
        "password": CHILD_PASSWORD,
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("session_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_login_ok(session):
    r = session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    me = r.json()
    assert me.get("user_id") == CHILD_USER_ID


def test_fully_grown_plot_returns_ready(seeded_plot, session):
    r = session.get(f"{BASE_URL}/api/garden/farm")
    assert r.status_code == 200, r.text
    data = r.json()
    qa = next((p for p in data["plots"] if p.get("plot_id") == QA_PLOT_ID), None)
    assert qa is not None, "QA plot not returned"
    assert qa["status"] == "ready", f"Expected 'ready' got {qa['status']}"
    assert qa["growth_progress"] == 100


def test_ready_plot_persisted_ready(seeded_plot, session, db, event_loop):
    # Called GET already in previous test -> should have persisted
    async def check():
        return await db.farm_plots.find_one({"plot_id": QA_PLOT_ID}, {"_id": 0})
    doc = event_loop.run_until_complete(check())
    assert doc["status"] == "ready"


def test_harvest_ready_plot(seeded_plot, session, db, event_loop):
    r = session.post(f"{BASE_URL}/api/garden/harvest/{QA_PLOT_ID}")
    assert r.status_code == 200, r.text
    resp = r.json()
    assert "harvest" in resp

    # Verify plot reset
    async def check():
        return await db.farm_plots.find_one({"plot_id": QA_PLOT_ID}, {"_id": 0})
    doc = event_loop.run_until_complete(check())
    assert doc["status"] == "empty"
    assert doc["plant_id"] is None

    # Verify inventory added
    async def inv():
        return await db.harvest_inventory.find({"user_id": CHILD_USER_ID, "plant_id": PLANT_ID}).to_list(50)
    items = event_loop.run_until_complete(inv())
    assert len(items) >= 1


def test_cleanup(db, event_loop):
    """Delete QA plot and harvested inventory to restore original state."""
    async def cleanup():
        await db.farm_plots.delete_many({"plot_id": QA_PLOT_ID})
        # Delete inventory items for classmate_g1 for our plant_id (test-created)
        await db.harvest_inventory.delete_many({
            "user_id": CHILD_USER_ID,
            "plant_id": PLANT_ID,
        })
        # Remove garden_sell / garden_seed / harvest-related transactions won't be
        # needed since we only harvested (no wallet change). Remove any test tx if any.
    event_loop.run_until_complete(cleanup())
