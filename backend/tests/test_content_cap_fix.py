import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://smart-money-learn-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "admin@learnersplanet.com"
ADMIN_PW = "finlit@2026"
TARGET_TOPIC = "topic_0b14de98fc9f"
QA_TITLE = "__QA_NEW_ACTIVITY__"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("session_token") or data.get("token") or data.get("access_token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _extract_items(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in ("items", "content_items", "data", "results"):
            if k in payload and isinstance(payload[k], list):
                return payload[k]
    return []


def test_admin_list_not_capped(headers):
    r = requests.get(f"{API}/admin/content/items", headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    items = _extract_items(r.json())
    print(f"Total items returned: {len(items)}")
    assert len(items) > 500, f"expected > 500 items, got {len(items)}"


def test_create_and_verify_appears(headers):
    payload = {
        "topic_id": TARGET_TOPIC,
        "title": QA_TITLE,
        "content_type": "activity",
        "content_data": {"html_url": "/x", "html_folder": "f"},
        "min_grade": 0,
        "max_grade": 5,
        "is_published": False,
    }
    r = requests.post(f"{API}/admin/content/items", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    body = r.json()
    content_id = body.get("content_id") or body.get("id") or body.get("_id")
    print(f"Created content_id={content_id}")
    assert content_id, f"no content_id in response: {body}"

    # Verify in full list
    r2 = requests.get(f"{API}/admin/content/items", headers=headers, timeout=60)
    assert r2.status_code == 200
    all_items = _extract_items(r2.json())
    print(f"All items count: {len(all_items)}")
    matches = [i for i in all_items if i.get("title") == QA_TITLE]
    assert matches, f"newly created item not found in full list (count={len(all_items)})"

    # Verify in topic-filtered list
    r3 = requests.get(f"{API}/admin/content/items", headers=headers, params={"topic_id": TARGET_TOPIC}, timeout=30)
    assert r3.status_code == 200
    topic_items = _extract_items(r3.json())
    print(f"Topic items count: {len(topic_items)}")
    topic_matches = [i for i in topic_items if i.get("title") == QA_TITLE]
    assert topic_matches, "newly created item not found in topic-filtered list"


def test_per_topic_query(headers):
    r = requests.get(f"{API}/admin/content/items", headers=headers, params={"topic_id": TARGET_TOPIC}, timeout=30)
    assert r.status_code == 200
    items = _extract_items(r.json())
    print(f"Per-topic items: {len(items)}")
    assert isinstance(items, list)
    assert len(items) >= 1
