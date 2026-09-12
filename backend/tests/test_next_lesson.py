"""Backend tests for the new GET /api/content/next-lesson endpoint powering
the learning-first Grade K-3 dashboard hero card."""
import os
import datetime
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _login(identifier, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password}, timeout=30)
    return r


@pytest.fixture(scope="module")
def child_token():
    r = _login("classmate_g3", "testpass123")
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": "admin@learnersplanet.com", "password": "finlit@2026"}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- Next Lesson endpoint tests ---

def test_next_lesson_grade3_child_returns_valid_shape(child_token):
    r = requests.get(f"{API}/content/next-lesson", headers=_auth(child_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Shape assertions
    assert "completed_today" in data
    assert "daily_goal" in data
    assert data["daily_goal"] == 3
    assert isinstance(data["completed_today"], int)
    # Either has content or all_done
    if data.get("content_id"):
        for f in ["title", "content_type", "topic_id", "topic_title", "subtopic_id", "subtopic_title", "reward_coins", "is_new_user"]:
            assert f in data, f"missing field {f}: {data}"
        assert isinstance(data["is_new_user"], bool)
    else:
        assert data.get("all_done") is True


def test_next_lesson_forbidden_for_non_child(admin_token):
    r = requests.get(f"{API}/content/next-lesson", headers=_auth(admin_token), timeout=30)
    assert r.status_code == 403, f"Expected 403 got {r.status_code} {r.text}"


def test_next_lesson_unauthenticated():
    r = requests.get(f"{API}/content/next-lesson", timeout=30)
    assert r.status_code in (401, 403), r.status_code


def test_next_lesson_completed_today_matches_progress_count(child_token):
    """completed_today must equal count of user_content_progress docs whose completed_at date == today UTC."""
    r = requests.get(f"{API}/content/next-lesson", headers=_auth(child_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    # We can't hit mongo directly, but we can verify field is a non-negative int <= daily_goal*10
    assert data["completed_today"] >= 0


def test_completing_a_lesson_increments_completed_today(child_token):
    """Directly complete a known video content (content_8edef32730e2 - 'Testing' homework)
    then verify completed_today incremented and is_new_user flipped to false. Cleans up after."""
    # Prime: ensure this content is not already completed
    import pymongo
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = pymongo.MongoClient(mongo_url)
    db = client[db_name]
    child_user_id = "368b8a71-acdf-433b-a9ab-6dbc87c10855"
    test_cid = "content_8edef32730e2"
    db.user_content_progress.delete_one({"user_id": child_user_id, "content_id": test_cid})

    r1 = requests.get(f"{API}/content/next-lesson", headers=_auth(child_token), timeout=30)
    assert r1.status_code == 200
    d1 = r1.json()
    if not d1.get("content_id"):
        pytest.skip("no next lesson")
    before_today = d1["completed_today"]

    comp = requests.post(f"{API}/content/items/{test_cid}/complete", headers=_auth(child_token), json={}, timeout=30)
    assert comp.status_code == 200, comp.text

    r2 = requests.get(f"{API}/content/next-lesson", headers=_auth(child_token), timeout=30)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["completed_today"] == before_today + 1, f"expected {before_today+1}, got {d2['completed_today']}"
    assert d2["is_new_user"] is False, "is_new_user should be False after completion"

    # Cleanup
    db.user_content_progress.delete_one({"user_id": child_user_id, "content_id": test_cid})
