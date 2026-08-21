"""Multi-curriculum support tests (curricula registry, admin tagging,
school curriculum enablement, and delivery scoping)."""
import os
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
CHILD = {"identifier": "classmate_g1", "password": "testpass123"}
SCHOOL_ID = "school_daee554c6477"  # St. Kabir
FL = "financial_literacy"
ENT = "money_entrepreneurship"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("session_token") or data.get("token") or data.get("access_token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def child_token():
    return _login(CHILD)


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


# --- Mongo helper for the school-linked-child scenario (mutation is reverted) ---
def _mongo():
    from pymongo import MongoClient
    env = dotenv_values("/app/backend/.env")
    client = MongoClient(env["MONGO_URL"])
    return client, client[env["DB_NAME"]]


# ---------------- GET /api/curricula ----------------
class TestCurriculaList:
    def test_unauthenticated_is_public(self):
        """Public endpoint: anonymous callers get the list and the default
        active curriculum (Financial Literacy)."""
        r = requests.get(f"{API}/curricula", timeout=30)
        assert r.status_code == 200, r.status_code
        data = r.json()
        assert any(c["id"] == "financial_literacy" for c in data["curricula"])

    def test_list_contains_both_curricula(self, child_token):
        r = requests.get(f"{API}/curricula", headers=hdr(child_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = [c["id"] for c in r.json()["curricula"]]
        assert ids == [FL, ENT], ids

    def test_admin_active_is_null(self, admin_token):
        r = requests.get(f"{API}/curricula", headers=hdr(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["active"] is None

    def test_d2c_child_active_is_fl_only(self, child_token):
        r = requests.get(f"{API}/curricula", headers=hdr(child_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["active"] == [FL]


# ---------------- Admin tagging + delivery scoping ----------------
class TestCurriculaTaggingAndScoping:
    created = {"topic": None, "item": None, "fl_topic": None, "fl_item": None}

    @pytest.fixture(scope="class", autouse=True)
    def ent_content(self, admin_token):
        """Create an ENT topic + published child-visible item, and an FL topic+item."""
        h = hdr(admin_token)
        t = requests.post(f"{API}/admin/content/topics", headers=h, json={
            "title": "TEST_ENT_Topic", "description": "qa", "min_grade": 0, "max_grade": 5,
            "curricula": [ENT]}, timeout=30)
        assert t.status_code == 200, t.text[:300]
        topic_id = t.json()["topic_id"]
        self.created["topic"] = topic_id
        i = requests.post(f"{API}/admin/content/items", headers=h, json={
            "topic_id": topic_id, "title": "TEST_ENT_Item", "content_type": "lesson",
            "content_data": {"text": "hi"}, "visible_to": ["child"], "min_grade": 0,
            "max_grade": 5, "is_published": True, "curricula": [ENT]}, timeout=30)
        assert i.status_code == 200, i.text[:300]
        self.created["item"] = i.json()["content_id"]

        t2 = requests.post(f"{API}/admin/content/topics", headers=h, json={
            "title": "TEST_FL_Topic", "min_grade": 0, "max_grade": 5, "curricula": [FL]}, timeout=30)
        self.created["fl_topic"] = t2.json()["topic_id"]
        i2 = requests.post(f"{API}/admin/content/items", headers=h, json={
            "topic_id": self.created["fl_topic"], "title": "TEST_FL_Item", "content_type": "lesson",
            "content_data": {"text": "hi"}, "visible_to": ["child"], "min_grade": 0,
            "max_grade": 5, "is_published": True, "curricula": [FL]}, timeout=30)
        self.created["fl_item"] = i2.json()["content_id"]
        yield
        for cid in [self.created["item"], self.created["fl_item"]]:
            requests.delete(f"{API}/admin/content/items/{cid}", headers=h, timeout=30)
        for tid in [self.created["topic"], self.created["fl_topic"]]:
            requests.delete(f"{API}/admin/content/topics/{tid}", headers=h, timeout=30)

    def test_topic_curricula_persisted(self, admin_token):
        r = requests.get(f"{API}/admin/content/topics", headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        topic = next(t for t in r.json() if t["topic_id"] == self.created["topic"])
        assert topic["curricula"] == [ENT], topic.get("curricula")

    def test_item_curricula_persisted(self, admin_token):
        r = requests.get(f"{API}/admin/content/items?topic_id={self.created['topic']}",
                         headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        item = next(i for i in r.json() if i["content_id"] == self.created["item"])
        assert item["curricula"] == [ENT]

    def test_update_curricula_via_put(self, admin_token):
        h = hdr(admin_token)
        r = requests.put(f"{API}/admin/content/items/{self.created['item']}", headers=h,
                         json={"curricula": [FL, ENT]}, timeout=30)
        assert r.status_code == 200
        items = requests.get(f"{API}/admin/content/items?topic_id={self.created['topic']}",
                             headers=h, timeout=60).json()
        item = next(i for i in items if i["content_id"] == self.created["item"])
        assert sorted(item["curricula"]) == sorted([FL, ENT])
        # revert to ENT-only for scoping tests
        requests.put(f"{API}/admin/content/items/{self.created['item']}", headers=h,
                     json={"curricula": [ENT]}, timeout=30)
        r2 = requests.put(f"{API}/admin/content/topics/{self.created['topic']}", headers=h,
                          json={"curricula": [ENT]}, timeout=30)
        assert r2.status_code == 200

    def test_invalid_curricula_falls_back_to_default(self, admin_token):
        h = hdr(admin_token)
        r = requests.put(f"{API}/admin/content/items/{self.created['fl_item']}", headers=h,
                         json={"curricula": ["bogus_curriculum"]}, timeout=30)
        assert r.status_code == 200
        items = requests.get(f"{API}/admin/content/items?topic_id={self.created['fl_topic']}",
                             headers=h, timeout=60).json()
        item = next(i for i in items if i["content_id"] == self.created["fl_item"])
        assert item["curricula"] == [FL]

    def test_admin_sees_ent_topic(self, admin_token):
        r = requests.get(f"{API}/content/topics", headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        assert self.created["topic"] in [t["topic_id"] for t in r.json()]

    def test_d2c_child_does_not_see_ent_topic(self, child_token):
        r = requests.get(f"{API}/content/topics", headers=hdr(child_token), timeout=60)
        assert r.status_code == 200
        ids = [t["topic_id"] for t in r.json()]
        assert self.created["topic"] not in ids, "D2C child sees ENT topic!"
        assert self.created["fl_topic"] in ids, "D2C child cannot see FL topic"

    def test_d2c_child_topic_detail_hides_ent_content(self, child_token):
        r = requests.get(f"{API}/content/topics/{self.created['topic']}",
                         headers=hdr(child_token), timeout=60)
        assert r.status_code in (200, 403, 404), r.status_code
        if r.status_code == 200:
            body = r.text
            assert self.created["item"] not in body, "ENT content item leaked to D2C child"


# ---------------- School curriculum enablement + scoped delivery ----------------
class TestSchoolCurriculaDelivery:
    state = {"topic": None, "item": None}

    @pytest.fixture(scope="class", autouse=True)
    def setup(self, admin_token):
        h = hdr(admin_token)
        t = requests.post(f"{API}/admin/content/topics", headers=h, json={
            "title": "TEST_ENT_School_Topic", "min_grade": 0, "max_grade": 5,
            "curricula": [ENT]}, timeout=30)
        self.state["topic"] = t.json()["topic_id"]
        i = requests.post(f"{API}/admin/content/items", headers=h, json={
            "topic_id": self.state["topic"], "title": "TEST_ENT_School_Item",
            "content_type": "lesson", "content_data": {"text": "x"}, "visible_to": ["child"],
            "min_grade": 0, "max_grade": 5, "is_published": True, "curricula": [ENT]}, timeout=30)
        self.state["item"] = i.json()["content_id"]
        # temporarily link the D2C child to a school
        client, db = _mongo()
        db.users.update_one({"username": "classmate_g1"}, {"$set": {"school_id": SCHOOL_ID}})
        yield
        # revert everything
        client2, db2 = _mongo()
        db2.users.update_one({"username": "classmate_g1"}, {"$unset": {"school_id": ""}})
        requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=h,
                     json={"curricula": [FL]}, timeout=30)
        requests.delete(f"{API}/admin/content/items/{self.state['item']}", headers=h, timeout=30)
        requests.delete(f"{API}/admin/content/topics/{self.state['topic']}", headers=h, timeout=30)

    def test_school_only_fl_child_cannot_see_ent(self, admin_token):
        requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=hdr(admin_token),
                     json={"curricula": [FL]}, timeout=30)
        token = _login(CHILD)
        r = requests.get(f"{API}/content/topics", headers=hdr(token), timeout=60)
        assert r.status_code == 200
        assert self.state["topic"] not in [t["topic_id"] for t in r.json()]
        # active curricula for this child is now the school's
        c = requests.get(f"{API}/curricula", headers=hdr(token), timeout=30).json()
        assert c["active"] == [FL]

    def test_enable_ent_persists_and_child_sees_it(self, admin_token):
        h = hdr(admin_token)
        r = requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=h,
                         json={"curricula": [FL, ENT]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert sorted(r.json()["curricula"]) == sorted([FL, ENT])
        schools = requests.get(f"{API}/admin/schools", headers=h, timeout=60).json()
        s_list = schools if isinstance(schools, list) else schools.get("schools", [])
        school = next(s for s in s_list if s["school_id"] == SCHOOL_ID)
        assert sorted(school["curricula"]) == sorted([FL, ENT])

        token = _login(CHILD)
        c = requests.get(f"{API}/curricula", headers=hdr(token), timeout=30).json()
        assert sorted(c["active"]) == sorted([FL, ENT])
        r2 = requests.get(f"{API}/content/topics", headers=hdr(token), timeout=60)
        ids = [t["topic_id"] for t in r2.json()]
        assert self.state["topic"] in ids, "Child of ENT-enabled school cannot see ENT topic"

    def test_curriculum_query_filter(self, admin_token):
        requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=hdr(admin_token),
                     json={"curricula": [FL, ENT]}, timeout=30)
        token = _login(CHILD)
        r = requests.get(f"{API}/content/topics?curriculum={ENT}", headers=hdr(token), timeout=60)
        assert r.status_code == 200
        ids = [t["topic_id"] for t in r.json()]
        assert ids == [self.state["topic"]], f"expected only ENT topic, got {len(ids)} topics"
        r2 = requests.get(f"{API}/content/topics?curriculum={FL}", headers=hdr(token), timeout=60)
        assert self.state["topic"] not in [t["topic_id"] for t in r2.json()]

    def test_empty_curricula_list_falls_back(self, admin_token):
        r = requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=hdr(admin_token),
                         json={"curricula": []}, timeout=30)
        assert r.status_code == 200
        assert r.json()["curricula"] == [FL]

    def test_non_admin_cannot_set_school_curricula(self, child_token):
        r = requests.put(f"{API}/admin/schools/{SCHOOL_ID}/curricula", headers=hdr(child_token),
                         json={"curricula": [FL, ENT]}, timeout=30)
        assert r.status_code in (401, 403), r.status_code
