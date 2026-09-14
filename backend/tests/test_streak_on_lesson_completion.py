"""Regression tests for the "streak advances on lesson completion, not login" change.

Covers:
- /api/auth/me does NOT touch streak_count (login/reload should not advance).
- POST /api/content/items/{id}/complete advances streak on FIRST completion of the day
  and returns `streak` + `streak_reward` fields.
- Second completion the same day does NOT advance the streak (idempotent).
- Backward-compat: POST /api/streak/checkin still works and is idempotent.
- Grade 4-5 user's streak_count is exposed via /api/auth/me (dashboard header).
"""
import os
import asyncio
import pytest
import requests
from datetime import date, datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

CHILD_USERNAME = "blank_wallet_child"
CHILD_PASSWORD = "testpass123"
G45_USERNAME = "classmate_g4_qa"
G45_PASSWORD = "testpass123"

# Content the main agent seeded / verified as reachable for blank_wallet_child (Grade 3)
CANDY_SHOP_CONTENT_ID = "content_07aae589c292"


def _login(identifier, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s, data["user"]


@pytest.fixture(scope="module")
def child_session():
    s, u = _login(CHILD_USERNAME, CHILD_PASSWORD)
    return s, u


@pytest.fixture(scope="module")
def g45_session():
    s, u = _login(G45_USERNAME, G45_PASSWORD)
    return s, u


# ---------- Test 1: /auth/me is a no-op on streak ----------
def test_auth_me_does_not_advance_streak(child_session):
    s, _u = child_session
    r1 = s.get(f"{API}/auth/me"); assert r1.status_code == 200
    streak_before = r1.json().get("streak_count", 0)
    last_before = r1.json().get("last_checkin_date")

    for _ in range(5):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("streak_count", 0) == streak_before, "streak should NOT change on /auth/me"
        assert r.json().get("last_checkin_date") == last_before


# ---------- Test 2: lesson completion advances streak + response fields ----------
def _get_progress(session, content_id):
    """Fetch progress via topic detail — no direct endpoint exposed."""
    return None


def test_lesson_completion_advances_streak(child_session):
    s, _u = child_session

    # Snapshot pre-state
    me_before = s.get(f"{API}/auth/me").json()
    streak_before = me_before.get("streak_count", 0)
    last_before = me_before.get("last_checkin_date")
    wallet_before = s.get(f"{API}/wallet").json()
    spending_before = next((a["balance"] for a in wallet_before["accounts"] if a["account_type"] == "spending"), 0)

    # First complete
    r = s.post(f"{API}/content/items/{CANDY_SHOP_CONTENT_ID}/complete", json={})
    assert r.status_code == 200, r.text
    data = r.json()
    # If item was already completed (previous run left it completed), the flow returns
    # coins_awarded=0 with no streak fields. Treat that as skip so this test is
    # re-runnable — but at minimum we should see streak/streak_reward keys present.
    assert "streak" in data and "streak_reward" in data, f"missing streak keys in response: {data}"

    if data.get("coins_awarded", 0) == 0 and data.get("message") == "Already completed":
        pytest.skip("Content was already completed in a prior run — cannot test fresh advance without reset.")

    # streak should be advanced (either +1 vs yesterday, or reset to 1)
    today_iso = date.today().isoformat()
    me_after = s.get(f"{API}/auth/me").json()
    assert me_after.get("last_checkin_date") == today_iso, f"last_checkin_date not set to today: {me_after}"
    if last_before == today_iso:
        # was already advanced today somehow — streak_result must be None => reward 0
        assert data["streak_reward"] == 0
    else:
        assert isinstance(data["streak"], int) and data["streak"] >= 1
        assert data["streak_reward"] in (5, 10, 20), f"unexpected reward: {data['streak_reward']}"
        # 5-day milestones give ₹10
        if data["streak"] % 5 == 0:
            assert data["streak_reward"] == 10
        else:
            assert data["streak_reward"] == 5

        # Wallet should be credited BOTH the lesson coins AND streak reward
        wallet_after = s.get(f"{API}/wallet").json()
        spending_after = next((a["balance"] for a in wallet_after["accounts"] if a["account_type"] == "spending"), 0)
        expected_delta = data["coins_awarded"] + data["streak_reward"]
        assert spending_after - spending_before == pytest.approx(expected_delta, abs=0.01), \
            f"wallet delta {spending_after - spending_before} != expected {expected_delta}"


# ---------- Test 3: second same-day completion is idempotent on streak ----------
def test_second_completion_same_day_no_streak_advance(child_session):
    s, _u = child_session

    me = s.get(f"{API}/auth/me").json()
    streak_snap = me.get("streak_count", 0)
    last_snap = me.get("last_checkin_date")

    # Re-hit complete on the same content id (already completed → idempotent early return)
    r = s.post(f"{API}/content/items/{CANDY_SHOP_CONTENT_ID}/complete", json={})
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Already completed"
    assert data.get("coins_awarded") == 0

    # Even if we could complete a *different* second lesson today, streak still shouldn't
    # advance again — verified by directly calling the /streak/checkin endpoint:
    r2 = s.post(f"{API}/streak/checkin")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("reward") == 0, f"streak advanced twice same day: {d2}"

    me2 = s.get(f"{API}/auth/me").json()
    assert me2.get("streak_count") == streak_snap
    assert me2.get("last_checkin_date") == last_snap


# ---------- Test 4: backward-compat streak/checkin endpoint ----------
def test_streak_checkin_endpoint_still_works(child_session):
    s, _u = child_session
    r = s.post(f"{API}/streak/checkin")
    assert r.status_code == 200
    d = r.json()
    assert "streak" in d and "reward" in d
    # Should be a no-op today (either lesson already advanced, or previous test did)
    # so reward is 0 and message is "Already checked in today".
    assert d["reward"] == 0
    assert "Already" in d.get("message", "")


# ---------- Test 5: Grade 4-5 user exposes streak_count via /auth/me ----------
def test_g45_user_streak_visible_on_me(g45_session):
    s, _u = g45_session
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert "streak_count" in body
    assert isinstance(body["streak_count"], int)
    # And repeated calls don't move it either
    prev = body["streak_count"]
    for _ in range(3):
        assert s.get(f"{API}/auth/me").json().get("streak_count") == prev
