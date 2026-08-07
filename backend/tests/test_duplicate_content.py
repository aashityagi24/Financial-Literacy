import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://savings-goals-test.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
TOPIC_ID = "topic_80e910ce6a69"
SOURCE_CONTENT_ID = "content_90108cb5e262"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("session_token") or r.json().get("token")
    assert token, f"No session_token in response: {r.json()}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code == 200:
        token = r.json().get("session_token") or r.json().get("token")
        s.headers.update({"Authorization": f"Bearer {token}"})
        for cid in ids:
            s.delete(f"{BASE_URL}/api/admin/content/items/{cid}")


def _get_topic_items(client):
    r = client.get(f"{BASE_URL}/api/admin/content/items", params={"topic_id": TOPIC_ID})
    assert r.status_code == 200
    data = r.json()
    return data.get("items", data) if isinstance(data, dict) else data


def _find_item(client, content_id):
    for it in _get_topic_items(client):
        if it.get("content_id") == content_id:
            return it
    return None


def test_duplicate_copies_all_fields(admin_client, created_ids):
    orig = _find_item(admin_client, SOURCE_CONTENT_ID)
    assert orig is not None, "Source content not found in topic listing"

    before_items = _get_topic_items(admin_client)
    before_count = len(before_items)

    # Duplicate
    dup_r = admin_client.post(f"{BASE_URL}/api/admin/content/items/{SOURCE_CONTENT_ID}/duplicate")
    assert dup_r.status_code == 200, dup_r.text
    body = dup_r.json()
    assert "content_id" in body
    assert "item" in body
    new_id = body["content_id"]
    new_item = body["item"]
    created_ids.append(new_id)

    # Distinct id
    assert new_id != SOURCE_CONTENT_ID
    # Title + (Copy)
    assert new_item["title"] == f"{orig['title']} (Copy)", f"Got title: {new_item['title']}"
    # Draft
    assert new_item.get("is_published") is False
    # Same topic
    assert new_item.get("topic_id") == orig.get("topic_id")
    # Thumbnail
    assert new_item.get("thumbnail") == orig.get("thumbnail")
    # Grades
    assert new_item.get("min_grade") == orig.get("min_grade")
    assert new_item.get("max_grade") == orig.get("max_grade")
    # content_data
    assert new_item.get("content_data") == orig.get("content_data")
    # visible_to
    assert new_item.get("visible_to") == orig.get("visible_to")

    # Verify list count increased
    after_items = _get_topic_items(admin_client)
    assert len(after_items) == before_count + 1
    assert any(i.get("content_id") == new_id for i in after_items)


def test_duplicate_missing_id_returns_404(admin_client):
    r = admin_client.post(f"{BASE_URL}/api/admin/content/items/nonexistent_id/duplicate")
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_edit_copy_does_not_affect_original(admin_client, created_ids):
    # Duplicate again
    dup_r = admin_client.post(f"{BASE_URL}/api/admin/content/items/{SOURCE_CONTENT_ID}/duplicate")
    assert dup_r.status_code == 200
    new_id = dup_r.json()["content_id"]
    created_ids.append(new_id)

    # Original snapshot
    orig_before = _find_item(admin_client, SOURCE_CONTENT_ID)

    # Edit copy
    upd = admin_client.put(f"{BASE_URL}/api/admin/content/items/{new_id}",
                           json={"title": "Edited Copy", "min_grade": 2})
    assert upd.status_code == 200, upd.text

    # Verify copy updated
    copy_after = _find_item(admin_client, new_id)
    assert copy_after is not None
    assert copy_after["title"] == "Edited Copy"
    assert copy_after["min_grade"] == 2

    # Original unchanged
    orig_after = _find_item(admin_client, SOURCE_CONTENT_ID)
    assert orig_after["title"] == orig_before["title"]
    assert orig_after["min_grade"] == orig_before["min_grade"]
