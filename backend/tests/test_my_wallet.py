"""Tests for the new My Wallet child endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://savings-goals-test.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def child_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": "wallet_demo_child", "password": "testpass123"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def child_client(child_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {child_token}", "Content-Type": "application/json"})
    return s


# GET /wallet/my-wallet
def test_get_my_wallet_structure(child_client):
    r = child_client.get(f"{API}/wallet/my-wallet")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("balance", "total_in", "total_out", "month_in", "month_out", "pending_count", "entries"):
        assert k in data, f"missing {k}"
    assert isinstance(data["entries"], list)
    assert isinstance(data["balance"], (int, float))


# Overspend rejection
def test_overspend_rejected(child_client):
    bal = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": bal + 10000, "category": "toys"})
    assert r.status_code == 400
    assert "wallet" in r.json().get("detail", "").lower()


# Zero amount rejection
def test_zero_amount_rejected(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 0, "category": "toys"})
    assert r.status_code == 400


# Income increases balance + entry is created
def test_income_increases_balance(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "income", "amount": 30, "category": "cash", "note": "TEST_income"})
    assert r.status_code == 200, r.text
    tx_id = r.json()["transaction_id"]
    after_data = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(after_data["balance"] - before, 2) == 30.0
    top = after_data["entries"][0]
    assert top["transaction_id"] == tx_id
    assert top["direction"] == "in"
    assert top["is_manual"] is True
    assert top["amount"] == 30.0


# Spend decreases balance + entry is created
def test_spend_decreases_balance(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 15, "category": "food", "note": "TEST_spend"})
    assert r.status_code == 200, r.text
    tx_id = r.json()["transaction_id"]
    after_data = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(before - after_data["balance"], 2) == 15.0
    top = after_data["entries"][0]
    assert top["transaction_id"] == tx_id
    assert top["direction"] == "out"
    assert top["is_manual"] is True


# Invalid entry_type
def test_invalid_entry_type(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "bogus", "amount": 10, "category": "toys"})
    assert r.status_code == 400
