"""
Regression tests for the Feb-2026 gifting changes:
  1. Giving Jar can be funded from CoinQuest (spending) OR My Wallet
  2. Children can gift / request items (toys, books, etc.) — no wallet move
  3. Existing money gifts still work
  4. Piggy Bank can still only be funded from My Wallet
"""
import os
import asyncio
import hashlib
import requests
import pytest

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001") + "/api"
PASSWORD = "testpass123"


def _login(username):
    r = requests.post(f"{API}/auth/login", json={"identifier": username, "password": PASSWORD})
    assert r.status_code == 200, f"Login {username} failed: {r.text}"
    return r.cookies


def _classmate(cookies, prefer_name=None):
    r = requests.get(f"{API}/child/classmates", cookies=cookies)
    assert r.status_code == 200
    mates = r.json().get("classmates", [])
    if prefer_name:
        for m in mates:
            if m["name"] == prefer_name:
                return m
    return mates[0]


def _seed_balance(username, account_type, amount):
    """Synchronous seed via direct mongo connection (test scaffold)."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        u = await db.users.find_one({"username": username})
        await db.wallet_accounts.update_one(
            {"user_id": u["user_id"], "account_type": account_type},
            {"$set": {"balance": amount, "user_id": u["user_id"], "account_type": account_type}},
            upsert=True
        )
    
    asyncio.run(go())


def test_coinquest_to_gifting_transfer_allowed():
    """Allow funding the Giving Jar from CoinQuest (spending) — new feature."""
    _seed_balance("classmate_g3", "spending", 100)
    cookies = _login("classmate_g3")
    r = requests.post(f"{API}/wallet/transfer", cookies=cookies, json={
        "from_account": "spending",
        "to_account": "gifting",
        "amount": 10,
        "transaction_type": "transfer",
        "description": "test CoinQuest -> Giving",
    })
    assert r.status_code == 200, r.text
    assert r.json().get("message") == "Transfer successful"


def test_my_wallet_to_gifting_transfer_still_allowed():
    _seed_balance("classmate_g3", "my_wallet", 50)
    cookies = _login("classmate_g3")
    r = requests.post(f"{API}/wallet/transfer", cookies=cookies, json={
        "from_account": "my_wallet",
        "to_account": "gifting",
        "amount": 5,
        "transaction_type": "transfer",
    })
    assert r.status_code == 200, r.text


def test_savings_only_from_my_wallet():
    """Piggy Bank funding must still be restricted to My Wallet."""
    _seed_balance("classmate_g3", "spending", 100)
    cookies = _login("classmate_g3")
    r = requests.post(f"{API}/wallet/transfer", cookies=cookies, json={
        "from_account": "spending",
        "to_account": "savings",
        "amount": 10,
        "transaction_type": "transfer",
    })
    assert r.status_code == 400
    assert "My Wallet" in r.json()["detail"]


def test_savings_outbound_still_blocked():
    cookies = _login("classmate_g3")
    r = requests.post(f"{API}/wallet/transfer", cookies=cookies, json={
        "from_account": "savings",
        "to_account": "spending",
        "amount": 1,
        "transaction_type": "transfer",
    })
    assert r.status_code == 400


def test_item_gift_no_wallet_change():
    """Item gifts must NOT move any money — just create record + notification."""
    cookies = _login("classmate_g3")
    peer = _classmate(cookies)
    
    bal_before = requests.get(f"{API}/wallet/summary", cookies=cookies).json()
    
    r = requests.post(f"{API}/child/gift-money", cookies=cookies, json={
        "to_user_id": peer["user_id"],
        "gift_type": "item",
        "item_name": "Lego set",
        "item_description": "Red 200pc",
        "message": "Happy bday!"
    })
    assert r.status_code == 200, r.text
    assert "Item gift sent" in r.json()["message"]
    
    bal_after = requests.get(f"{API}/wallet/summary", cookies=cookies).json()
    assert bal_before["coinquest_balance"] == bal_after["coinquest_balance"]
    assert bal_before["my_wallet_balance"] == bal_after["my_wallet_balance"]


def test_item_gift_requires_name():
    cookies = _login("classmate_g3")
    peer = _classmate(cookies)
    r = requests.post(f"{API}/child/gift-money", cookies=cookies, json={
        "to_user_id": peer["user_id"],
        "gift_type": "item",
        "item_name": "  ",
    })
    assert r.status_code == 400


def test_money_gift_still_works():
    """Original money-gift flow must remain intact."""
    _seed_balance("classmate_g3", "gifting", 20)
    cookies = _login("classmate_g3")
    peer = _classmate(cookies)
    r = requests.post(f"{API}/child/gift-money", cookies=cookies, json={
        "to_user_id": peer["user_id"],
        "gift_type": "money",
        "amount": 5,
        "message": "Have fun"
    })
    assert r.status_code == 200, r.text


def test_item_request_works():
    cookies = _login("classmate_g3")
    peer = _classmate(cookies)
    r = requests.post(f"{API}/child/request-gift", cookies=cookies, json={
        "to_user_id": peer["user_id"],
        "request_type": "item",
        "item_name": "Pokemon cards",
        "message": "Pretty please"
    })
    assert r.status_code == 200


def test_money_request_still_works():
    cookies = _login("classmate_g3")
    peer = _classmate(cookies)
    r = requests.post(f"{API}/child/request-gift", cookies=cookies, json={
        "to_user_id": peer["user_id"],
        "request_type": "money",
        "amount": 10,
    })
    assert r.status_code == 200
