"""Backend regression tests for Homework 'Open' -> highlight fix.

Verifies:
  - GET /api/content/topics/{topic_id} without highlight EXCLUDES grade-mismatched content.
  - GET /api/content/topics/{topic_id}?highlight=<content_id> forces INCLUSION of that content.
  - GET /api/child/homework returns topic_id resolved from the live content mapping.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://skillquest-deploy.preview.emergentagent.com').rstrip('/')

CHILD_IDENT = "classmate_g3"
CHILD_PASS = "testpass123"

TOPIC_ID = "topic_2731433e0a5b"
HW_EXCL_CONTENT = "content_hwtest_gradeexcl"
HW_TESTING = "content_8edef32730e2"
HW_CANDY = "content_07aae589c292"
CANDY_TOPIC = "topic_cdac2568de6f"


@pytest.fixture(scope="module")
def child_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"identifier": CHILD_IDENT, "password": CHILD_PASS},
                      timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def auth_headers(child_token):
    return {"Authorization": f"Bearer {child_token}"}


def _content_ids(topic_json):
    ids = []
    for c in topic_json.get("content_items", []) or []:
        ids.append(c.get("id") or c.get("content_id"))
    for st in topic_json.get("subtopics", []) or []:
        for c in st.get("content_items", []) or st.get("contents", []) or []:
            ids.append(c.get("id") or c.get("content_id"))
    return ids


def test_topic_without_highlight_excludes_grade_mismatch(auth_headers):
    r = requests.get(f"{BASE_URL}/api/content/topics/{TOPIC_ID}", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    ids = _content_ids(r.json())
    assert HW_EXCL_CONTENT not in ids, f"Grade-excluded content should NOT appear without highlight. Got: {ids}"


def test_topic_with_highlight_includes_grade_mismatch(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/content/topics/{TOPIC_ID}",
        params={"highlight": HW_EXCL_CONTENT},
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    ids = _content_ids(r.json())
    assert HW_EXCL_CONTENT in ids, f"Highlighted content MUST be included. Got: {ids}"


def test_child_homework_topic_ids_resolved(auth_headers):
    r = requests.get(f"{BASE_URL}/api/child/homework", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    hw_list = data if isinstance(data, list) else data.get("homework", data.get("items", []))
    assert hw_list, f"Expected homework items for {CHILD_IDENT}, got: {data}"

    by_content = {hw.get("content_id"): hw for hw in hw_list}

    # Grade-excluded HW must map to TOPIC_ID
    assert HW_EXCL_CONTENT in by_content, f"Missing HW for {HW_EXCL_CONTENT}"
    assert by_content[HW_EXCL_CONTENT]["topic_id"] == TOPIC_ID

    # "Testing" HW -> TOPIC_ID
    assert HW_TESTING in by_content
    assert by_content[HW_TESTING]["topic_id"] == TOPIC_ID

    # "Candy Shop" -> CANDY_TOPIC
    assert HW_CANDY in by_content
    assert by_content[HW_CANDY]["topic_id"] == CANDY_TOPIC


def test_candy_topic_contains_candy_content(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/content/topics/{CANDY_TOPIC}",
        params={"highlight": HW_CANDY},
        headers=auth_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    ids = _content_ids(r.json())
    assert HW_CANDY in ids
