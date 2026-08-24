"""Tests for Entrepreneurship Workshop age tracks (public-curriculum endpoint)
and the platform-wide grade scale extension 0-5 -> 0-9.

Covers:
  - GET  /api/subscriptions/money-masters/public-curriculum (public, no auth)
  - POST /api/subscriptions/call-request        (child_grade cap now 9)
  - POST /api/subscriptions/money-masters/trial-enquiry (child_grade cap now 9)
  - POST /api/admin/content/topics              (min/max grade 7-9)
  - POST /api/admin/live-classes        (min_grade=7 max_grade=9)
  - POST /api/subscriptions/admin/money-masters/batches (grade=8)
"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="session")
def admin_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    content = p.read_text(encoding="utf-8")
    m = re.search(r"##\s*Admin\s*\n\s*-\s*Email:\s*(\S+)\s*\n\s*-\s*Password:\s*(\S+)", content)
    if not m:
        pytest.skip("no admin creds in test_credentials.md")
    return {"email": m.group(1), "password": m.group(2)}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_client(admin_credentials):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": admin_credentials["email"], "password": admin_credentials["password"]})
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("session_token")
    if not token:
        pytest.fail(f"no session_token in login response: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- public-curriculum endpoint ----------------
class TestPublicCurriculum:
    TRACKS = {"kidpreneur": (1, 3), "youngpreneur": (4, 6), "teenpreneur": (7, 9)}

    @pytest.mark.parametrize("track", ["kidpreneur", "youngpreneur", "teenpreneur"])
    def test_public_no_auth(self, client, track):
        lo, hi = self.TRACKS[track]
        r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum",
                       params={"min_grade": lo, "max_grade": hi})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for topic in data:
            assert "_id" not in topic
            assert "topic_id" in topic and isinstance(topic["topic_id"], str)
            assert "subtopics" in topic and isinstance(topic["subtopics"], list)
            for st in topic["subtopics"]:
                assert "_id" not in st

    def test_missing_params_rejected(self, client):
        r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum")
        assert r.status_code == 422

    def test_seeded_topic_scoping(self, admin_client, client):
        """Create a kidpreneur (grade 1-3) topic + subtopic, assert it shows only
        for the kidpreneur range and not for youngpreneur/teenpreneur."""
        suffix = uuid.uuid4().hex[:6]
        topic_id = None
        sub_id = None
        try:
            r = admin_client.post(f"{BASE_URL}/api/admin/content/topics", json={
                "title": f"TEST_Kid Topic {suffix}",
                "description": "TEST topic for kidpreneur track",
                "icon": "PiggyBank",
                "min_grade": 1, "max_grade": 3,
                "curricula": ["money_entrepreneurship"],
            })
            assert r.status_code in (200, 201), r.text[:400]
            topic = r.json()
            topic_id = topic.get("topic_id")
            assert topic_id, f"no topic_id: {topic}"

            r = admin_client.post(f"{BASE_URL}/api/admin/content/topics", json={
                "title": f"TEST_Kid Sub {suffix}",
                "description": "TEST subtopic",
                "icon": "PiggyBank",
                "min_grade": 1, "max_grade": 3,
                "curricula": ["money_entrepreneurship"],
                "parent_id": topic_id,
            })
            assert r.status_code in (200, 201), r.text[:400]
            sub_id = r.json().get("topic_id")
            assert sub_id

            # kidpreneur range -> present with nested subtopic
            r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum",
                           params={"min_grade": 1, "max_grade": 3})
            assert r.status_code == 200
            match = [t for t in r.json() if t["topic_id"] == topic_id]
            assert len(match) == 1, "seeded topic not returned for grades 1-3"
            assert match[0]["title"] == f"TEST_Kid Topic {suffix}"
            assert [s["topic_id"] for s in match[0]["subtopics"]] == [sub_id]

            # non-overlapping ranges -> absent
            for lo, hi in [(4, 6), (7, 9)]:
                r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum",
                               params={"min_grade": lo, "max_grade": hi})
                assert r.status_code == 200
                ids = [t["topic_id"] for t in r.json()]
                assert topic_id not in ids, f"kidpreneur topic leaked into grades {lo}-{hi}"
        finally:
            for tid in [sub_id, topic_id]:
                if tid:
                    admin_client.delete(f"{BASE_URL}/api/admin/content/topics/{tid}")
            r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum",
                           params={"min_grade": 1, "max_grade": 3})
            if r.status_code == 200 and topic_id:
                assert topic_id not in [t["topic_id"] for t in r.json()], "cleanup failed"

    def test_non_entrepreneurship_topic_excluded(self, admin_client, client):
        suffix = uuid.uuid4().hex[:6]
        topic_id = None
        try:
            r = admin_client.post(f"{BASE_URL}/api/admin/content/topics", json={
                "title": f"TEST_Other Curriculum {suffix}",
                "description": "TEST", "icon": "Book",
                "min_grade": 1, "max_grade": 3,
                "curricula": ["financial_literacy"],
            })
            assert r.status_code in (200, 201), r.text[:300]
            topic_id = r.json().get("topic_id")
            r = client.get(f"{BASE_URL}/api/subscriptions/money-masters/public-curriculum",
                           params={"min_grade": 1, "max_grade": 3})
            assert topic_id not in [t["topic_id"] for t in r.json()]
        finally:
            if topic_id:
                admin_client.delete(f"{BASE_URL}/api/admin/content/topics/{topic_id}")


# ---------------- grade cap raised to 9 ----------------
class TestGradeCapCallRequest:
    def _payload(self, grade):
        return {
            "name": f"TEST_QA {uuid.uuid4().hex[:5]}",
            "phone": "9876543210",
            "email": f"test_qa_{uuid.uuid4().hex[:6]}@test.com",
            "audience": "parent",
            "child_grade": grade,
            "program": "workshop",
        }

    @pytest.mark.parametrize("grade", [0, 5, 9])
    def test_valid_grades_accepted(self, client, grade):
        r = client.post(f"{BASE_URL}/api/subscriptions/call-request", json=self._payload(grade))
        assert r.status_code == 200, f"grade {grade} rejected: {r.status_code} {r.text[:300]}"

    @pytest.mark.parametrize("grade", [10, -1])
    def test_out_of_range_rejected(self, client, grade):
        r = client.post(f"{BASE_URL}/api/subscriptions/call-request", json=self._payload(grade))
        assert r.status_code == 400, f"grade {grade} should be rejected, got {r.status_code}"
        assert "9" in r.json().get("detail", "")


class TestGradeCapTrialEnquiry:
    def _payload(self, grade):
        return {
            "parent_name": f"TEST_QA {uuid.uuid4().hex[:5]}",
            "phone": "9876543210",
            "email": f"test_qa_{uuid.uuid4().hex[:6]}@test.com",
            "child_name": "TEST Child",
            "child_grade": grade,
            "state": "Maharashtra",
            "city": "Pune",
        }

    @pytest.mark.parametrize("grade", [0, 5, 9])
    def test_valid_grades_accepted(self, client, grade):
        r = client.post(f"{BASE_URL}/api/subscriptions/money-masters/trial-enquiry",
                        json=self._payload(grade))
        assert r.status_code == 200, f"grade {grade} rejected: {r.status_code} {r.text[:300]}"

    @pytest.mark.parametrize("grade", [10, -1])
    def test_out_of_range_rejected(self, client, grade):
        r = client.post(f"{BASE_URL}/api/subscriptions/money-masters/trial-enquiry",
                        json=self._payload(grade))
        assert r.status_code == 400, f"grade {grade} should be rejected, got {r.status_code}"


class TestAdminGradeNine:
    def test_content_topic_grade_7_9(self, admin_client):
        topic_id = None
        try:
            r = admin_client.post(f"{BASE_URL}/api/admin/content/topics", json={
                "title": f"TEST_Teen Topic {uuid.uuid4().hex[:6]}",
                "description": "TEST", "icon": "Rocket",
                "min_grade": 7, "max_grade": 9,
                "curricula": ["money_entrepreneurship"],
            })
            assert r.status_code in (200, 201), r.text[:400]
            body = r.json()
            topic_id = body.get("topic_id")
            assert topic_id
            # GET verify persistence
            g = admin_client.get(f"{BASE_URL}/api/admin/content/topics")
            assert g.status_code == 200
            found = [t for t in g.json() if t.get("topic_id") == topic_id]
            assert found and found[0]["min_grade"] == 7 and found[0]["max_grade"] == 9
        finally:
            if topic_id:
                admin_client.delete(f"{BASE_URL}/api/admin/content/topics/{topic_id}")

    def test_live_class_grade_7_9(self, admin_client):
        class_id = None
        try:
            r = admin_client.post(f"{BASE_URL}/api/admin/live-classes", json={
                "title": f"TEST_LC Grade9 {uuid.uuid4().hex[:5]}",
                "brief": "TEST live class",
                "min_grade": 7, "max_grade": 9,
                "scheduled_at": "2026-12-01T10:00:00Z",
                "duration_minutes": 60,
                "join_url": "https://example.com/meet",
            })
            assert r.status_code in (200, 201), f"live class 7-9 failed: {r.status_code} {r.text[:400]}"
            body = r.json()
            class_id = body.get("class_id") or body.get("id")
            assert body.get("min_grade") == 7 and body.get("max_grade") == 9
        finally:
            if class_id:
                admin_client.delete(f"{BASE_URL}/api/admin/live-classes/{class_id}")

    def test_live_class_grade_10_rejected(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/live-classes", json={
            "title": f"TEST_LC Grade10 {uuid.uuid4().hex[:5]}",
            "brief": "TEST",
            "min_grade": 0, "max_grade": 10,
            "scheduled_at": "2026-12-01T10:00:00Z",
            "duration_minutes": 60,
            "join_url": "https://example.com/meet",
        })
        assert r.status_code == 400, f"expected 400 for grade 10, got {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            cid = r.json().get("class_id")
            admin_client.delete(f"{BASE_URL}/api/admin/live-classes/{cid}")

    def test_money_masters_batch_grade_8(self, admin_client):
        batch_id = None
        try:
            r = admin_client.post(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches", json={
                "name": f"TEST_Batch G8 {uuid.uuid4().hex[:5]}",
                "grade": 8,
                "start_date": "2026-12-01",
                "end_date": "2027-03-01",
                "price": 4999,
            })
            assert r.status_code in (200, 201), f"batch grade 8 failed: {r.status_code} {r.text[:400]}"
            batch_id = r.json().get("batch_id")
            assert r.json().get("grade") == 8
        finally:
            if batch_id:
                admin_client.delete(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches/{batch_id}")

    def test_money_masters_batch_grade_10_rejected(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_Batch G10 {uuid.uuid4().hex[:5]}",
            "grade": 10,
            "start_date": "2026-12-01",
            "end_date": "2027-03-01",
            "price": 4999,
        })
        assert r.status_code == 400, f"expected 400 for grade 10, got {r.status_code}"
        if r.status_code in (200, 201):
            admin_client.delete(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches/{r.json().get('batch_id')}")
