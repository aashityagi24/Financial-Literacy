"""
Regression tests for the 'Optional vs Mandatory' content unlock feature.

Behavior:
  - is_mandatory defaults to True (existing content remains gated).
  - A child must complete a Mandatory item before the next item unlocks.
  - When is_mandatory=False, the next item unlocks automatically — i.e.,
    skipping an optional item does NOT block progression.
"""
import os
import asyncio
import uuid
import hashlib
import requests
import pytest
from datetime import datetime, timezone

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001") + "/api"

ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
CHILD_PASSWORD = "optional_kid_pw_123"


def _mongo():
    """Synchronous client for test fixture mutations (avoids motor's
    event-loop caching pitfalls between asyncio.run() calls)."""
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _admin_cookies():
    r = requests.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.cookies


def _ensure_child(username, grade=3):
    """Seed a child user (returns user_id)."""
    db = _mongo()
    existing = db.users.find_one({"username": username})
    if existing:
        return existing["user_id"]
    user_id = str(uuid.uuid4())
    db.users.insert_one({
        "user_id": user_id,
        "username": username,
        "name": username,
        "role": "child",
        "grade": grade,
        "password_hash": hashlib.sha256(CHILD_PASSWORD.encode()).hexdigest(),
        "is_test_user": False,
        "created_at": datetime.now(timezone.utc),
        "has_completed_onboarding": True,
    })
    return user_id


def _child_cookies(username):
    r = requests.post(f"{API}/auth/login", json={"identifier": username, "password": CHILD_PASSWORD})
    assert r.status_code == 200, r.text
    return r.cookies


@pytest.fixture(scope="module")
def fixtures():
    """Create a fresh topic + subtopic + 3 content items: mandatory, optional, mandatory."""
    admin_c = _admin_cookies()
    
    # Topic
    topic_title = f"OptionalTest {uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/admin/content/topics", cookies=admin_c, json={
        "title": topic_title, "description": "test topic", "min_grade": 0, "max_grade": 5
    })
    assert r.status_code == 200, r.text
    topic_id = r.json()["topic_id"]
    
    # Subtopic
    r = requests.post(f"{API}/admin/content/topics", cookies=admin_c, json={
        "title": f"{topic_title} sub", "description": "sub", "parent_id": topic_id,
        "min_grade": 0, "max_grade": 5
    })
    subtopic_id = r.json()["topic_id"]
    
    # Item A — mandatory
    r = requests.post(f"{API}/admin/content/items", cookies=admin_c, json={
        "topic_id": subtopic_id, "title": "Item A (mandatory)", "content_type": "lesson",
        "min_grade": 0, "max_grade": 5, "reward_coins": 5, "is_published": True,
        # is_mandatory not sent → defaults to True
    })
    item_a = r.json()["content_id"]
    
    # Item B — optional
    r = requests.post(f"{API}/admin/content/items", cookies=admin_c, json={
        "topic_id": subtopic_id, "title": "Item B (optional)", "content_type": "lesson",
        "min_grade": 0, "max_grade": 5, "reward_coins": 5, "is_published": True,
        "is_mandatory": False,
    })
    item_b = r.json()["content_id"]
    
    # Item C — mandatory (last)
    r = requests.post(f"{API}/admin/content/items", cookies=admin_c, json={
        "topic_id": subtopic_id, "title": "Item C (mandatory)", "content_type": "lesson",
        "min_grade": 0, "max_grade": 5, "reward_coins": 5, "is_published": True,
        "is_mandatory": True,
    })
    item_c = r.json()["content_id"]
    
    # A non-test child so we get real progressive-unlock behavior.
    username = f"optional_kid_{uuid.uuid4().hex[:6]}"
    user_id = _ensure_child(username)
    db = _mongo()
    db.subscriptions.update_one(
        {"child_user_ids": user_id},
        {"$set": {
            "subscription_id": f"sub_{uuid.uuid4().hex[:8]}",
            "child_user_ids": [user_id],
            "parent_emails": [],
            "payment_status": "completed",
            "is_active": True,
            "plan_type": "1y",
            "num_children": 1,
            "num_parents": 1,
            "end_date": "2099-01-01T00:00:00+00:00",
        }},
        upsert=True
    )
    db.user_content_progress.delete_many({"user_id": user_id})
    
    yield {
        "topic_id": topic_id, "subtopic_id": subtopic_id,
        "item_a": item_a, "item_b": item_b, "item_c": item_c,
        "username": username, "user_id": user_id, "admin_c": admin_c,
    }
    
    # Cleanup
    db = _mongo()
    for cid in [item_a, item_b, item_c]:
        db.content_items.delete_one({"content_id": cid})
    for tid in [subtopic_id, topic_id]:
        db.content_topics.delete_one({"topic_id": tid})
    db.users.delete_one({"username": username})
    db.user_content_progress.delete_many({"user_id": user_id})
    db.subscriptions.delete_many({"child_user_ids": user_id})


def _fetch_items(child_cookies, topic_id):
    r = requests.get(f"{API}/content/topics/{topic_id}", cookies=child_cookies)
    assert r.status_code == 200, r.text
    sub = r.json()["subtopics"][0]
    r2 = requests.get(f"{API}/content/topics/{sub['topic_id']}", cookies=child_cookies)
    assert r2.status_code == 200, r2.text
    return {c["content_id"]: c for c in r2.json()["content_items"]}


def test_default_is_mandatory(fixtures):
    """Items created without is_mandatory must default to True."""
    item_a = _mongo().content_items.find_one({"content_id": fixtures["item_a"]}, {"_id": 0})
    assert item_a.get("is_mandatory") is True


def test_optional_item_persists_false(fixtures):
    item_b = _mongo().content_items.find_one({"content_id": fixtures["item_b"]}, {"_id": 0})
    assert item_b.get("is_mandatory") is False


def test_initial_unlock_only_first(fixtures):
    cookies = _child_cookies(fixtures["username"])
    items = _fetch_items(cookies, fixtures["topic_id"])
    
    a = items[fixtures["item_a"]]
    b = items[fixtures["item_b"]]
    c = items[fixtures["item_c"]]
    
    assert a["is_unlocked"] is True, "First item should always be unlocked"
    assert b["is_unlocked"] is False, "Second item must wait for first"
    assert c["is_unlocked"] is False, "Third item must wait for chain"


def test_completing_mandatory_unlocks_next(fixtures):
    """After completing Item A (mandatory), Item B unlocks."""
    cookies = _child_cookies(fixtures["username"])
    r = requests.post(f"{API}/content/items/{fixtures['item_a']}/complete", cookies=cookies)
    assert r.status_code == 200, r.text
    
    items = _fetch_items(cookies, fixtures["topic_id"])
    assert items[fixtures["item_b"]]["is_unlocked"] is True
    # Item C is still locked — B is optional but hasn't been "skipped through" yet;
    # the unlock chain treats B as transparent (passes A's completion forward), so
    # actually C should ALSO be unlocked because B is optional.
    assert items[fixtures["item_c"]]["is_unlocked"] is True, \
        "Optional item must transparently unlock the next item"


def test_skipping_optional_does_not_block(fixtures):
    """Even without completing the optional Item B, Item C must remain unlocked."""
    cookies = _child_cookies(fixtures["username"])
    items = _fetch_items(cookies, fixtures["topic_id"])
    # Item B should NOT be completed (we only completed A in the prior test)
    assert items[fixtures["item_b"]]["is_completed"] is False
    assert items[fixtures["item_c"]]["is_unlocked"] is True, \
        "Skipping an optional item must NOT block subsequent items"


def test_admin_update_toggles_mandatory(fixtures):
    """Admin can flip is_mandatory on an existing item via PUT."""
    admin_c = fixtures["admin_c"]
    r = requests.put(f"{API}/admin/content/items/{fixtures['item_b']}", cookies=admin_c,
                     json={"is_mandatory": True})
    assert r.status_code == 200, r.text
    item_b = _mongo().content_items.find_one({"content_id": fixtures["item_b"]}, {"_id": 0})
    assert item_b["is_mandatory"] is True
    
    # Reset progress and re-test: now B is mandatory, C should not unlock until B done
    _mongo().user_content_progress.delete_many({"user_id": fixtures["user_id"]})
    
    cookies = _child_cookies(fixtures["username"])
    # Complete A
    requests.post(f"{API}/content/items/{fixtures['item_a']}/complete", cookies=cookies)
    items = _fetch_items(cookies, fixtures["topic_id"])
    assert items[fixtures["item_b"]]["is_unlocked"] is True
    assert items[fixtures["item_c"]]["is_unlocked"] is False, \
        "When B is mandatory again, C must wait until B is completed"
