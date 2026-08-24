"""Verify bug fix: GET /content/topics/{id} returns subtopics for teachers."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://smart-money-learn-5.preview.emergentagent.com').rstrip('/')


def _login(username, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": username, "password": password})
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    token = r.json().get("session_token")
    return s, token


@pytest.fixture(scope="module")
def teacher_session():
    return _login("test_teacher_1", "testpassword")


@pytest.fixture(scope="module")
def child_session():
    return _login("classmate_g3", "testpass123")


def _get_grade1_topics(token):
    r = requests.get(f"{BASE_URL}/api/content/tree?grade=1", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    # find topics list
    topics = []
    if isinstance(data, dict):
        for k in ("topics", "data", "tree"):
            if k in data and isinstance(data[k], list):
                topics = data[k]
                break
        if not topics:
            # maybe nested by grade
            for v in data.values():
                if isinstance(v, list) and v and isinstance(v[0], dict) and 'id' in v[0]:
                    topics = v
                    break
    elif isinstance(data, list):
        topics = data
    return topics, data


def test_teacher_topic_returns_subtopics(teacher_session):
    s, token = teacher_session
    # Try a known topic id from context
    topic_id = "topic_54162f26e2db"
    r = s.get(f"{BASE_URL}/api/content/topics/{topic_id}?grade=1")
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    data = r.json()
    subtopics = data.get("subtopics", [])
    print(f"Teacher topic {topic_id} subtopics count: {len(subtopics)}")
    for st in subtopics:
        print(f"  - {st.get('name')} (content_count={st.get('content_count')})")
    assert len(subtopics) > 0, f"Expected subtopics, got 0. Data: {data}"


def test_child_topic_returns_subtopics(child_session):
    s, token = child_session
    r = s.get(f"{BASE_URL}/api/content/topics?grade=3")
    assert r.status_code == 200, r.text
    data = r.json()
    topics = data if isinstance(data, list) else data.get("topics", [])
    if not topics:
        pytest.skip("No topics for grade 3")
    tid = topics[0].get('id') or topics[0].get('topic_id') or topics[0].get('_id')
    if not tid:
        print("Sample topic:", topics[0])
        pytest.skip("No id in topic")
    r2 = s.get(f"{BASE_URL}/api/content/topics/{tid}?grade=3")
    assert r2.status_code == 200, r2.text
    subs = r2.json().get("subtopics", [])
    print(f"Child topic {tid} subtopics: {len(subs)}")
    assert len(subs) > 0
