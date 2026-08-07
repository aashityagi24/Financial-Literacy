"""Extended cap-removal tests for iteration_81.

Covers:
- Admin content list (no filter) returns > 500 items (env has ~574).
- Admin content list per subtopic returns all 152 items (> 100).
- User-facing GET /api/content/topics/{topic_id}?grade=1 returns 152 items (was capped 100).
- GET /api/admin/content/topics returns full topics/subtopics (no 100 truncation).
- Regression: POST new item (published) appears in admin list AND topic detail.
"""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://savings-goals-test.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "admin@learnersplanet.com"
ADMIN_PW = "finlit@2026"
TARGET_TOPIC = "topic_0b14de98fc9f"
QA_TITLE = "__QA_NEW_ITEM__"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("session_token") or r.json().get("token")
    assert tok
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _items(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in ("items", "content_items", "data", "results"):
            if k in payload and isinstance(payload[k], list):
                return payload[k]
    return []


def test_admin_all_items_over_500(headers):
    r = requests.get(f"{API}/admin/content/items", headers=headers, timeout=120)
    assert r.status_code == 200, r.text
    items = _items(r.json())
    print(f"[admin all items] count={len(items)}")
    assert len(items) > 500, f"expected > 500, got {len(items)}"


def test_admin_per_topic_over_100(headers):
    r = requests.get(f"{API}/admin/content/items", headers=headers, params={"topic_id": TARGET_TOPIC}, timeout=60)
    assert r.status_code == 200, r.text
    items = _items(r.json())
    print(f"[admin per-topic {TARGET_TOPIC}] count={len(items)}")
    assert len(items) == 152, f"expected 152, got {len(items)}"


def test_user_topic_detail_over_100(headers):
    url = f"{API}/content/topics/{TARGET_TOPIC}"
    r = requests.get(url, params={"grade": 1}, headers=headers, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    content_items = body.get("content_items") or _items(body)
    print(f"[user topic detail grade=1] content_items={len(content_items)}")
    assert len(content_items) == 152, f"expected 152, got {len(content_items)} (cap of 100 likely still applied)"


def test_admin_topics_list_not_truncated(headers):
    r = requests.get(f"{API}/admin/content/topics", headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    topics = body if isinstance(body, list) else body.get("topics") or _items(body)
    print(f"[admin topics] count={len(topics)}")
    # find our target subtopic somewhere in tree
    found = False
    for t in topics:
        subs = t.get("subtopics") or t.get("children") or []
        for s in subs:
            if s.get("topic_id") == TARGET_TOPIC or s.get("id") == TARGET_TOPIC:
                found = True
                break
        if found:
            break
    assert found, f"target subtopic {TARGET_TOPIC} not present in admin topics tree"


def test_regression_create_new_item_visible(headers):
    payload = {
        "topic_id": TARGET_TOPIC,
        "title": QA_TITLE,
        "content_type": "worksheet",
        "content_data": {},
        "min_grade": 0,
        "max_grade": 5,
        "is_published": True,
    }
    r = requests.post(f"{API}/admin/content/items", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"
    cid = r.json().get("content_id") or r.json().get("id")
    print(f"[created] id={cid}")
    assert cid

    # admin list contains it
    r2 = requests.get(f"{API}/admin/content/items", headers=headers, params={"topic_id": TARGET_TOPIC}, timeout=60)
    admin_items = _items(r2.json())
    assert any(i.get("title") == QA_TITLE for i in admin_items), "new item missing in admin per-topic list"

    # user-facing topic detail contains it
    r3 = requests.get(f"{API}/content/topics/{TARGET_TOPIC}", params={"grade": 1}, headers=headers, timeout=60)
    assert r3.status_code == 200
    user_items = r3.json().get("content_items") or _items(r3.json())
    print(f"[user topic after create] count={len(user_items)}")
    assert any(i.get("title") == QA_TITLE for i in user_items), "new item missing in user topic detail"
    assert len(user_items) == 153, f"expected 153 after create, got {len(user_items)}"
