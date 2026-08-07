"""Tests for the My Wallet child endpoints incl. Save/Give buckets, pagination, breakdown, parent view."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
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


@pytest.fixture(scope="module")
def parent_client():
    r = requests.post(f"{API}/auth/login", json={"identifier": "wallet_demo_parent", "password": "testpass123"})
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s, r.json().get("user", {})


# GET /wallet/my-wallet — structure includes new keys
def test_get_my_wallet_structure(child_client):
    r = child_client.get(f"{API}/wallet/my-wallet")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("balance", "total_in", "total_out", "month_in", "month_out",
              "breakdown", "entries", "page", "total_pages", "total_entries", "page_size"):
        assert k in data, f"missing {k}"
    assert set(data["breakdown"].keys()) == {"spend", "save", "give"}
    for b in ("spend", "save", "give"):
        assert "total" in data["breakdown"][b]
        assert "categories" in data["breakdown"][b]
    assert isinstance(data["entries"], list)


# Overspend rejection with specific message
def test_overspend_rejected(child_client):
    bal = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": bal + 10000, "category": "toys"})
    assert r.status_code == 400
    assert "don't have that much" in r.json().get("detail", "").lower() or "wallet" in r.json().get("detail", "").lower()


def test_zero_amount_rejected(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 0, "category": "toys"})
    assert r.status_code == 400


def test_invalid_entry_type(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "bogus", "amount": 10, "category": "toys"})
    assert r.status_code == 400


# Income increases balance
def test_income_increases_balance(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "income", "amount": 60, "category": "cash", "note": "TEST_income"})
    assert r.status_code == 200, r.text
    after = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(after["balance"] - before, 2) == 60.0
    top = after["entries"][0]
    assert top["direction"] == "in"
    assert top["is_manual"] is True


# Spend decreases balance and updates spend breakdown
def test_spend_updates_breakdown(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 10, "category": "toys", "note": "TEST_spend"})
    assert r.status_code == 200, r.text
    after = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(before["balance"] - after["balance"], 2) == 10.0
    # Spend bucket total went up by 10
    assert round(after["breakdown"]["spend"]["total"] - before["breakdown"]["spend"]["total"], 2) == 10.0
    # toys category present in spend breakdown
    cats = {c["category"]: c["amount"] for c in after["breakdown"]["spend"]["categories"]}
    assert "toys" in cats


# Save moves my_wallet -> savings and appears in save breakdown
def test_save_moves_to_savings_and_breakdown(child_client):
    wallet_before = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_before = child_client.get(f"{API}/wallet").json().get("accounts", [])
    piggy_before = next((a for a in accounts_before if a["account_type"] == "savings"), {}).get("balance", 0.0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 20, "category": "goal", "note": "TEST_save"})
    assert r.status_code == 200, r.text

    wallet_after = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_after = child_client.get(f"{API}/wallet").json().get("accounts", [])
    piggy_after = next((a for a in accounts_after if a["account_type"] == "savings"), {}).get("balance", 0.0)

    assert round(wallet_before["balance"] - wallet_after["balance"], 2) == 20.0
    assert round(piggy_after - piggy_before, 2) == 20.0
    assert round(wallet_after["breakdown"]["save"]["total"] - wallet_before["breakdown"]["save"]["total"], 2) == 20.0
    top = wallet_after["entries"][0]
    assert top["bucket"] == "save"
    assert top["direction"] == "out"
    assert top["is_manual"] is True


# Give moves my_wallet -> gifting and appears in give breakdown
def test_give_moves_to_gifting_and_breakdown(child_client):
    wallet_before = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_before = child_client.get(f"{API}/wallet").json().get("accounts", [])
    gift_before = next((a for a in accounts_before if a["account_type"] == "gifting"), {}).get("balance", 0.0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "give", "amount": 8, "category": "charity", "note": "TEST_give"})
    assert r.status_code == 200, r.text

    wallet_after = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_after = child_client.get(f"{API}/wallet").json().get("accounts", [])
    gift_after = next((a for a in accounts_after if a["account_type"] == "gifting"), {}).get("balance", 0.0)

    assert round(wallet_before["balance"] - wallet_after["balance"], 2) == 8.0
    assert round(gift_after - gift_before, 2) == 8.0
    assert round(wallet_after["breakdown"]["give"]["total"] - wallet_before["breakdown"]["give"]["total"], 2) == 8.0
    top = wallet_after["entries"][0]
    assert top["bucket"] == "give"


# Pagination — 10/page, newest first
def test_pagination(child_client):
    p1 = child_client.get(f"{API}/wallet/my-wallet?page=1&page_size=10").json()
    assert p1["page"] == 1
    assert p1["page_size"] == 10
    assert len(p1["entries"]) <= 10
    # Should have >10 entries because we've been adding through this run
    if p1["total_entries"] > 10:
        assert p1["total_pages"] >= 2
        p2 = child_client.get(f"{API}/wallet/my-wallet?page=2&page_size=10").json()
        assert p2["page"] == 2
        assert len(p2["entries"]) >= 1
        # newest first: page 1 first entry created_at >= page 2 first entry created_at
        assert p1["entries"][0]["created_at"] >= p2["entries"][0]["created_at"]
        # No overlap
        p1_ids = {e["transaction_id"] for e in p1["entries"]}
        p2_ids = {e["transaction_id"] for e in p2["entries"]}
        assert p1_ids.isdisjoint(p2_ids)


# Parent money-story: linked parent should get the same shape
def test_parent_money_story(parent_client):
    session, _ = parent_client
    # Find the linked child
    r = session.get(f"{API}/parent/children")
    assert r.status_code == 200, r.text
    children = r.json()
    assert len(children) >= 1
    child_id = children[0].get("child_id") or children[0].get("user_id") or children[0].get("id")
    assert child_id, f"no child id in {children[0]}"

    r = session.get(f"{API}/parent/child/{child_id}/money-story")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("balance", "breakdown", "entries", "page", "total_pages"):
        assert k in data
    assert set(data["breakdown"].keys()) == {"spend", "save", "give"}


# Parent unlinked -> 403
def test_parent_unlinked_forbidden(parent_client):
    session, _ = parent_client
    r = session.get(f"{API}/parent/child/nonexistent_child_xyz/money-story")
    assert r.status_code == 403
