"""Live Classes module tests: admin CRUD + child/parent grade & curriculum scoped delivery."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"identifier": "admin@learnersplanet.com", "password": "finlit@2026"}
CHILD_G1 = {"identifier": "classmate_g1", "password": "testpass123"}
CHILD_G2 = {"identifier": "classmate_g2", "password": "testpass123"}
FL = "financial_literacy"
ENT = "money_entrepreneurship"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("session_token") or data.get("token") or data.get("access_token")
    assert token, f"no token in login response: {data}"
    return token


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def child_token():
    return _login(CHILD_G1)


@pytest.fixture(scope="session")
def child_g2_token():
    return _login(CHILD_G2)


@pytest.fixture(scope="session")
def created_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(admin_token, created_ids):
    yield
    for cid in created_ids:
        requests.delete(f"{API}/admin/live-classes/{cid}", headers=hdr(admin_token), timeout=30)


def _iso(delta_days, hours=0):
    return (datetime.now(timezone.utc) + timedelta(days=delta_days, hours=hours)).isoformat().replace("+00:00", "Z")


def _create(admin_token, created_ids, **over):
    payload = {
        "title": "TEST_LC " + over.pop("suffix", "default"),
        "brief": "TEST brief",
        "scheduled_at": _iso(3),
        "duration_minutes": 45,
        "meeting_link": "https://meet.example.com/test",
        "min_grade": 0,
        "max_grade": 5,
        "curricula": [FL],
        "is_published": True,
    }
    payload.update(over)
    r = requests.post(f"{API}/admin/live-classes", json=payload, headers=hdr(admin_token), timeout=30)
    assert r.status_code == 200, f"create failed {r.status_code} {r.text[:300]}"
    doc = r.json()
    created_ids.append(doc["class_id"])
    return doc


# ---------------- Admin CRUD ----------------
class TestAdminCRUD:
    def test_create_and_fields(self, admin_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="create")
        assert doc["class_id"].startswith("class_")
        assert "_id" not in doc
        assert doc["duration_minutes"] == 45
        assert doc["curricula"] == [FL]
        assert doc["is_published"] is True
        # verify in admin list
        r = requests.get(f"{API}/admin/live-classes", headers=hdr(admin_token), timeout=30)
        assert r.status_code == 200
        listed = [c for c in r.json() if c["class_id"] == doc["class_id"]]
        assert len(listed) == 1, "created class missing from admin list"
        assert listed[0]["title"] == doc["title"]

    def test_create_requires_title_and_time(self, admin_token):
        r = requests.post(f"{API}/admin/live-classes", json={"brief": "x"}, headers=hdr(admin_token), timeout=30)
        assert r.status_code == 400, r.status_code
        r2 = requests.post(f"{API}/admin/live-classes", json={"title": "TEST_no_time"},
                           headers=hdr(admin_token), timeout=30)
        assert r2.status_code == 400, r2.status_code

    def test_list_non_admin_forbidden(self, child_token):
        r = requests.get(f"{API}/admin/live-classes", headers=hdr(child_token), timeout=30)
        assert r.status_code == 403, r.status_code

    def test_list_unauthenticated_forbidden(self):
        r = requests.get(f"{API}/admin/live-classes", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_create_non_admin_forbidden(self, child_token):
        r = requests.post(f"{API}/admin/live-classes", json={"title": "TEST_x", "scheduled_at": _iso(1)},
                          headers=hdr(child_token), timeout=30)
        assert r.status_code == 403, r.status_code

    def test_update_persists(self, admin_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="update")
        cid = doc["class_id"]
        upd = {"title": "TEST_LC updated", "recording_url": "https://rec.example.com/v1",
               "is_published": False, "duration_minutes": 90, "min_grade": 1, "max_grade": 2,
               "curricula": [ENT]}
        r = requests.put(f"{API}/admin/live-classes/{cid}", json=upd, headers=hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        got = next(c for c in requests.get(f"{API}/admin/live-classes", headers=hdr(admin_token),
                                           timeout=30).json() if c["class_id"] == cid)
        assert got["title"] == "TEST_LC updated"
        assert got["recording_url"] == "https://rec.example.com/v1"
        assert got["is_published"] is False
        assert got["duration_minutes"] == 90
        assert got["min_grade"] == 1 and got["max_grade"] == 2
        assert got["curricula"] == [ENT]

    def test_update_empty_body_400(self, admin_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="empty")
        r = requests.put(f"{API}/admin/live-classes/{doc['class_id']}", json={},
                         headers=hdr(admin_token), timeout=30)
        assert r.status_code == 400, r.status_code

    def test_update_missing_404(self, admin_token):
        r = requests.put(f"{API}/admin/live-classes/class_doesnotexist", json={"title": "x"},
                         headers=hdr(admin_token), timeout=30)
        assert r.status_code == 404, r.status_code

    def test_delete_and_verify_removal(self, admin_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="delete")
        cid = doc["class_id"]
        r = requests.delete(f"{API}/admin/live-classes/{cid}", headers=hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = [c["class_id"] for c in requests.get(f"{API}/admin/live-classes",
                                                   headers=hdr(admin_token), timeout=30).json()]
        assert cid not in ids
        r2 = requests.delete(f"{API}/admin/live-classes/{cid}", headers=hdr(admin_token), timeout=30)
        assert r2.status_code == 404, r2.status_code


# ---------------- Child delivery: grade + curriculum + publish scoping ----------------
class TestChildDelivery:
    def test_unauthenticated_401(self):
        r = requests.get(f"{API}/live-classes", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_matching_class_visible(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="match", min_grade=1, max_grade=3, curricula=[FL])
        r = requests.get(f"{API}/live-classes", headers=hdr(child_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = [c["class_id"] for c in r.json()]
        assert doc["class_id"] in ids, "grade+curriculum matching class not delivered to child"

    def test_ent_only_class_hidden_from_fl_child(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="ent_only", curricula=[ENT])
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                   timeout=30).json()]
        assert doc["class_id"] not in ids, "ENT-only class leaked to Financial-Literacy child"

    def test_grade_excluded_class_hidden(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="grade_excl", min_grade=4, max_grade=5)
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                   timeout=30).json()]
        assert doc["class_id"] not in ids, "class outside child's grade range was delivered"

    def test_grade_boundaries_inclusive(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="boundary", min_grade=1, max_grade=1)
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                   timeout=30).json()]
        assert doc["class_id"] in ids, "grade range min==max==child grade should match"

    def test_unpublished_hidden_from_child_but_in_admin_list(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="draft", is_published=False, min_grade=0, max_grade=5)
        cid = doc["class_id"]
        child_ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                         timeout=30).json()]
        assert cid not in child_ids, "draft (unpublished) class visible to child"
        admin_ids = [c["class_id"] for c in requests.get(f"{API}/admin/live-classes",
                                                          headers=hdr(admin_token), timeout=30).json()]
        assert cid in admin_ids, "draft class missing from admin list"

    def test_publish_toggle_reflects_for_child(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="toggle", is_published=False)
        cid = doc["class_id"]
        requests.put(f"{API}/admin/live-classes/{cid}", json={"is_published": True},
                     headers=hdr(admin_token), timeout=30)
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                   timeout=30).json()]
        assert cid in ids, "class published via PUT not delivered to child"

    def test_multi_curricula_tag_matches_fl_child(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="both_cur", curricula=[FL, ENT])
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                   timeout=30).json()]
        assert doc["class_id"] in ids

    def test_grade_scoping_across_two_children(self, admin_token, child_token, child_g2_token, created_ids):
        g2_only = _create(admin_token, created_ids, suffix="g2_only", min_grade=2, max_grade=2)
        g1_ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                                      timeout=30).json()]
        g2_ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(child_g2_token),
                                                      timeout=30).json()]
        assert g2_only["class_id"] in g2_ids
        assert g2_only["class_id"] not in g1_ids

    def test_results_sorted_by_scheduled_at(self, admin_token, child_token, created_ids):
        later = _create(admin_token, created_ids, suffix="sort_later", scheduled_at=_iso(40))
        earlier = _create(admin_token, created_ids, suffix="sort_earlier", scheduled_at=_iso(30))
        data = requests.get(f"{API}/live-classes", headers=hdr(child_token), timeout=30).json()
        ids = [c["class_id"] for c in data]
        assert ids.index(earlier["class_id"]) < ids.index(later["class_id"]), "not sorted by scheduled_at"

    def test_past_class_with_recording_delivered(self, admin_token, child_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="past", scheduled_at=_iso(-5),
                      recording_url="https://rec.example.com/past")
        got = [c for c in requests.get(f"{API}/live-classes", headers=hdr(child_token),
                                        timeout=30).json() if c["class_id"] == doc["class_id"]]
        assert got, "past class not returned"
        assert got[0]["recording_url"] == "https://rec.example.com/past"


# ---------------- Parent aggregation (union across linked children) ----------------
PARENT_WITH_CHILD = {"identifier": "wallet_demo_parent", "password": "testpass123"}   # child grade 3, D2C -> FL
PARENT_NO_CHILD = {"identifier": "nudge_parent@test.com", "password": "testpass123"}


@pytest.fixture(scope="session")
def parent_token():
    return _login(PARENT_WITH_CHILD)


@pytest.fixture(scope="session")
def parent_no_child_token():
    return _login(PARENT_NO_CHILD)


class TestParentDelivery:
    def test_parent_sees_class_matching_linked_child_grade(self, admin_token, parent_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="parent_g3", min_grade=3, max_grade=3, curricula=[FL])
        r = requests.get(f"{API}/live-classes", headers=hdr(parent_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert doc["class_id"] in [c["class_id"] for c in r.json()], \
            "parent did not see class matching linked child's grade"

    def test_parent_does_not_see_non_matching_grade(self, admin_token, parent_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="parent_g0", min_grade=0, max_grade=1)
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(parent_token),
                                                   timeout=30).json()]
        assert doc["class_id"] not in ids, "parent saw class outside all children's grade ranges"

    def test_parent_does_not_see_ent_only(self, admin_token, parent_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="parent_ent", min_grade=3, max_grade=3, curricula=[ENT])
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(parent_token),
                                                   timeout=30).json()]
        assert doc["class_id"] not in ids, "ENT-only class leaked to FL parent"

    def test_parent_does_not_see_draft(self, admin_token, parent_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="parent_draft", min_grade=3, max_grade=3,
                      is_published=False)
        ids = [c["class_id"] for c in requests.get(f"{API}/live-classes", headers=hdr(parent_token),
                                                   timeout=30).json()]
        assert doc["class_id"] not in ids, "draft class visible to parent"

    def test_parent_without_children_gets_empty(self, admin_token, parent_no_child_token, created_ids):
        _create(admin_token, created_ids, suffix="no_child_visible", min_grade=0, max_grade=5)
        r = requests.get(f"{API}/live-classes", headers=hdr(parent_no_child_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == [], "parent with no linked children should get an empty list"


# ---------------- Validation (fixed: these now return 400) ----------------
class TestValidationGaps:
    def test_non_numeric_grade_should_be_400(self, admin_token):
        r = requests.post(f"{API}/admin/live-classes",
                          json={"title": "TEST_EDGE", "scheduled_at": _iso(1), "min_grade": "abc"},
                          headers=hdr(admin_token), timeout=30)
        assert r.status_code == 400, f"got {r.status_code}"

    def test_put_non_numeric_duration_should_be_400(self, admin_token, created_ids):
        doc = _create(admin_token, created_ids, suffix="put_bad_int")
        r = requests.put(f"{API}/admin/live-classes/{doc['class_id']}", json={"duration_minutes": "xyz"},
                         headers=hdr(admin_token), timeout=30)
        assert r.status_code == 400, f"got {r.status_code}"

    def test_invalid_datetime_should_be_rejected(self, admin_token, created_ids):
        r = requests.post(f"{API}/admin/live-classes", json={"title": "TEST_EDGE_DT", "scheduled_at": "not-a-date"},
                          headers=hdr(admin_token), timeout=30)
        if r.status_code == 200:
            created_ids.append(r.json()["class_id"])
        assert r.status_code == 400, f"got {r.status_code}"

    def test_whitespace_title_should_be_rejected(self, admin_token, created_ids):
        r = requests.post(f"{API}/admin/live-classes", json={"title": "   ", "scheduled_at": _iso(1)},
                          headers=hdr(admin_token), timeout=30)
        if r.status_code == 200:
            created_ids.append(r.json()["class_id"])
        assert r.status_code == 400, f"got {r.status_code}"

    def test_min_greater_than_max_should_be_rejected(self, admin_token, created_ids):
        r = requests.post(f"{API}/admin/live-classes",
                          json={"title": "TEST_EDGE_RANGE", "scheduled_at": _iso(1), "min_grade": 5, "max_grade": 0},
                          headers=hdr(admin_token), timeout=30)
        if r.status_code == 200:
            created_ids.append(r.json()["class_id"])
        assert r.status_code == 400, f"got {r.status_code}"

    def test_unsafe_meeting_link_should_be_rejected(self, admin_token, created_ids):
        r = requests.post(f"{API}/admin/live-classes",
                          json={"title": "TEST_EDGE_LINK", "scheduled_at": _iso(1),
                                "meeting_link": "javascript:alert(1)"},
                          headers=hdr(admin_token), timeout=30)
        if r.status_code == 200:
            created_ids.append(r.json()["class_id"])
        assert r.status_code == 400, f"got {r.status_code}"
