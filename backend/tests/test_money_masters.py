"""
Money Masters & Entrepreneurship standalone module subscription tests.

Covers:
- Admin batch CRUD + validation (/api/subscriptions/admin/money-masters/batches)
- Batch open/closed toggle
- Parent batch listing (grade matched) + create-order guards
- verify-payment end_date branching (money_masters keeps batch end_date,
  base plan recalculates from duration) -- regression risk
- Curriculum access gating (services/curricula.get_active_curricula)
- Admin users list active_plans badges
"""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
KEY_SECRET = backend_env.get("RAZORPAY_KEY_SECRET")

ADMIN = {"email": "admin@learnersplanet.com", "password": "finlit@2026"}
PARENT = {"identifier": "wallet_demo_parent", "password": "testpass123"}
CHILD = {"identifier": "wallet_demo_child", "password": "testpass123"}
CHILD_GRADE = 3

TAG = uuid.uuid4().hex[:6]


def iso(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


# ---------------------------------------------------------------- fixtures

@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(backend_env["MONGO_URL"])
    db = client[backend_env["DB_NAME"]]
    yield db
    client.close()


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    s = _session()
    r = s.post(f"{API}/auth/admin-login", json=ADMIN)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    return s


@pytest.fixture(scope="module")
def parent_client():
    s = _session()
    r = s.post(f"{API}/auth/login", json=PARENT)
    if r.status_code != 200:
        pytest.fail(f"Parent login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    return s


@pytest.fixture(scope="module")
def child_user_id(parent_client):
    r = parent_client.get(f"{API}/parent/dashboard")
    assert r.status_code == 200, r.text[:300]
    children = r.json().get("children", [])
    assert children, "wallet_demo_parent has no linked children"
    kid = next((c for c in children if c.get("username") == "wallet_demo_child"), children[0])
    return kid.get("user_id") or kid.get("child_id") or kid.get("id")


@pytest.fixture(scope="module")
def created_batch_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(mongo, created_batch_ids):
    yield
    mongo.money_masters_batches.delete_many({"name": {"$regex": f"^TEST_{TAG}"}})
    mongo.subscriptions.delete_many({"subscriber_name": {"$regex": f"^TEST_{TAG}"}})
    mongo.subscriptions.delete_many({"batch_name": {"$regex": f"^TEST_{TAG}"}})
    mongo.users.delete_many({"name": {"$regex": f"^TEST_{TAG}"}})
    mongo.parent_child_links.delete_many({"created_by": f"TEST_{TAG}"})


# ---------------------------------------------------------------- admin batch CRUD

class TestAdminBatchCRUD:
    def test_create_batch(self, admin_client, created_batch_ids):
        payload = {
            "name": f"TEST_{TAG} Grade3 Batch",
            "grade": CHILD_GRADE,
            "start_date": iso(1),
            "end_date": iso(90),
            "price": 1499,
        }
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json=payload)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        b = r.json()
        assert b["name"] == payload["name"]
        assert b["grade"] == CHILD_GRADE
        assert b["price"] == 1499
        assert b["is_active"] is True
        assert b["batch_id"].startswith("mmb_")
        assert "_id" not in b
        created_batch_ids.append(b["batch_id"])

        # GET verify persistence
        lst = admin_client.get(f"{API}/subscriptions/admin/money-masters/batches")
        assert lst.status_code == 200
        found = [x for x in lst.json() if x["batch_id"] == b["batch_id"]]
        assert found, "created batch not returned by admin list"
        assert found[0]["name"] == payload["name"]
        assert found[0]["enrolled_count"] == 0

    def test_create_batch_end_before_start(self, admin_client):
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Bad Dates", "grade": 1,
            "start_date": iso(30), "end_date": iso(10), "price": 100})
        assert r.status_code == 400, r.text[:300]
        assert "end_date" in r.json()["detail"]

    def test_create_batch_zero_price(self, admin_client):
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Bad Price", "grade": 1,
            "start_date": iso(1), "end_date": iso(10), "price": 0})
        assert r.status_code == 400
        assert "Price" in r.json()["detail"]

    def test_create_batch_invalid_grade(self, admin_client):
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Bad Grade", "grade": 9,
            "start_date": iso(1), "end_date": iso(10), "price": 100})
        assert r.status_code == 400
        assert "Grade" in r.json()["detail"]

    def test_create_batch_blank_name(self, admin_client):
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": "   ", "grade": 1,
            "start_date": iso(1), "end_date": iso(10), "price": 100})
        assert r.status_code == 400

    def test_create_batch_requires_admin(self, parent_client):
        r = parent_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Nope", "grade": 1,
            "start_date": iso(1), "end_date": iso(10), "price": 100})
        assert r.status_code in (401, 403), f"parent could create batch: {r.status_code}"

    def test_update_batch(self, admin_client, created_batch_ids):
        bid = created_batch_ids[0]
        r = admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                             json={"name": f"TEST_{TAG} Renamed", "price": 1999})
        assert r.status_code == 200, r.text[:300]
        lst = admin_client.get(f"{API}/subscriptions/admin/money-masters/batches").json()
        b = next(x for x in lst if x["batch_id"] == bid)
        assert b["name"] == f"TEST_{TAG} Renamed"
        assert b["price"] == 1999

    def test_update_batch_validation(self, admin_client, created_batch_ids):
        bid = created_batch_ids[0]
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={"price": -5}).status_code == 400
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={"grade": 7}).status_code == 400
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={"start_date": iso(60), "end_date": iso(5)}).status_code == 400
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={}).status_code == 400

    def test_update_missing_batch_404(self, admin_client):
        r = admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/mmb_doesnotexist",
                             json={"price": 100})
        assert r.status_code == 404

    def test_toggle_open_closed(self, admin_client, created_batch_ids):
        bid = created_batch_ids[0]
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={"is_active": False}).status_code == 200
        lst = admin_client.get(f"{API}/subscriptions/admin/money-masters/batches").json()
        assert next(x for x in lst if x["batch_id"] == bid)["is_active"] is False
        assert admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}",
                                json={"is_active": True}).status_code == 200
        lst = admin_client.get(f"{API}/subscriptions/admin/money-masters/batches").json()
        assert next(x for x in lst if x["batch_id"] == bid)["is_active"] is True

    def test_delete_batch(self, admin_client):
        r = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Deletable", "grade": 0,
            "start_date": iso(1), "end_date": iso(10), "price": 500})
        assert r.status_code == 200
        bid = r.json()["batch_id"]
        d = admin_client.delete(f"{API}/subscriptions/admin/money-masters/batches/{bid}")
        assert d.status_code == 200
        lst = admin_client.get(f"{API}/subscriptions/admin/money-masters/batches").json()
        assert not [x for x in lst if x["batch_id"] == bid]
        assert admin_client.delete(f"{API}/subscriptions/admin/money-masters/batches/{bid}").status_code == 404


# ---------------------------------------------------------------- parent flow

class TestParentBatchListing:
    def test_batches_match_child_grade_only(self, admin_client, parent_client, child_user_id, created_batch_ids):
        # a grade-mismatch batch, a closed batch and an ended batch must be excluded
        other = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Grade5", "grade": 5,
            "start_date": iso(1), "end_date": iso(60), "price": 999}).json()
        created_batch_ids.append(other["batch_id"])
        closed = admin_client.post(f"{API}/subscriptions/admin/money-masters/batches", json={
            "name": f"TEST_{TAG} Closed G3", "grade": CHILD_GRADE,
            "start_date": iso(1), "end_date": iso(60), "price": 999}).json()
        created_batch_ids.append(closed["batch_id"])
        admin_client.put(f"{API}/subscriptions/admin/money-masters/batches/{closed['batch_id']}",
                         json={"is_active": False})

        r = parent_client.get(f"{API}/subscriptions/money-masters/batches", params={"child_id": child_user_id})
        assert r.status_code == 200, r.text[:300]
        ids = [b["batch_id"] for b in r.json()]
        assert created_batch_ids[0] in ids, "open matching-grade batch missing"
        assert other["batch_id"] not in ids, "grade-mismatched batch leaked"
        assert closed["batch_id"] not in ids, "closed batch leaked"
        for b in r.json():
            assert b["grade"] == CHILD_GRADE

    def test_batches_unlinked_child_404(self, parent_client):
        r = parent_client.get(f"{API}/subscriptions/money-masters/batches",
                              params={"child_id": "user_not_mine_123"})
        assert r.status_code == 404

    def test_batches_requires_parent_auth(self, admin_client, child_user_id):
        r = admin_client.get(f"{API}/subscriptions/money-masters/batches", params={"child_id": child_user_id})
        assert r.status_code == 403


class TestCreateOrder:
    def test_create_order_success(self, parent_client, child_user_id, created_batch_ids):
        r = parent_client.post(f"{API}/subscriptions/money-masters/create-order",
                               json={"batch_id": created_batch_ids[0], "child_id": child_user_id})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d["order_id"].startswith("order_")
        assert d["amount"] == 1999 * 100
        assert d["currency"] == "INR"
        assert d["key_id"]
        assert d["subscription_id"].startswith("sub_")

    def test_create_order_grade_mismatch(self, parent_client, child_user_id, created_batch_ids):
        grade5 = [b for b in created_batch_ids]
        # the grade-5 batch created in the previous class
        r = parent_client.post(f"{API}/subscriptions/money-masters/create-order",
                               json={"batch_id": grade5[1], "child_id": child_user_id})
        assert r.status_code == 400
        assert "grade" in r.json()["detail"].lower()

    def test_create_order_closed_batch(self, parent_client, child_user_id, created_batch_ids):
        r = parent_client.post(f"{API}/subscriptions/money-masters/create-order",
                               json={"batch_id": created_batch_ids[2], "child_id": child_user_id})
        assert r.status_code == 400
        assert "no longer open" in r.json()["detail"].lower()

    def test_create_order_unlinked_child(self, parent_client, created_batch_ids):
        r = parent_client.post(f"{API}/subscriptions/money-masters/create-order",
                               json={"batch_id": created_batch_ids[0], "child_id": "user_bogus_999"})
        assert r.status_code == 404

    def test_create_order_unknown_batch(self, parent_client, child_user_id):
        r = parent_client.post(f"{API}/subscriptions/money-masters/create-order",
                               json={"batch_id": "mmb_nope", "child_id": child_user_id})
        assert r.status_code == 400

    def test_create_order_requires_parent(self, admin_client, child_user_id, created_batch_ids):
        r = admin_client.post(f"{API}/subscriptions/money-masters/create-order",
                              json={"batch_id": created_batch_ids[0], "child_id": child_user_id})
        assert r.status_code == 403


# ---------------------------------------------------------------- verify-payment branching

def _seed_pending(mongo, **extra):
    order_id = f"order_TEST{uuid.uuid4().hex[:14]}"
    doc = {
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "razorpay_order_id": order_id,
        "payment_status": "pending",
        "is_active": False,
        "subscriber_name": f"TEST_{TAG} Payer",
        "subscriber_email": f"test_{TAG}_payer@example.com",
        "parent_emails": [f"test_{TAG}_payer@example.com"],
        "child_user_ids": [],
        "amount": 999,
        "start_date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    doc.update(extra)
    mongo.subscriptions.insert_one(dict(doc))
    return doc


def _verify(session, order_id):
    payment_id = f"pay_TEST{uuid.uuid4().hex[:12]}"
    sig = hmac.new(KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return session.post(f"{API}/subscriptions/verify-payment", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
    })


class TestVerifyPaymentBranching:
    def test_money_masters_keeps_batch_end_date(self, mongo):
        batch_end = iso(45)
        sub = _seed_pending(mongo, plan_type="money_masters", batch_id=f"mmb_{TAG}",
                            batch_name=f"TEST_{TAG} VP Batch", grade=CHILD_GRADE,
                            end_date=batch_end)
        r = _verify(_session(), sub["razorpay_order_id"])
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        saved = mongo.subscriptions.find_one({"razorpay_order_id": sub["razorpay_order_id"]})
        assert saved["payment_status"] == "completed"
        assert saved["is_active"] is True
        assert saved["end_date"] == batch_end, "money_masters end_date was overwritten!"

    def test_money_masters_without_duration_field_does_not_crash(self, mongo):
        # money_masters subs never carry `duration`; DURATION_MAP lookup must be skipped
        sub = _seed_pending(mongo, plan_type="money_masters", batch_id=f"mmb_{TAG}b",
                            batch_name=f"TEST_{TAG} VP Batch2", grade=0, end_date=iso(10))
        r = _verify(_session(), sub["razorpay_order_id"])
        assert r.status_code == 200, r.text[:300]

    def test_base_plan_recalculates_end_date_from_duration(self, mongo):
        stale_end = iso(1)
        sub = _seed_pending(mongo, plan_type="single_parent", duration="1_year",
                            num_children=1, end_date=stale_end)
        r = _verify(_session(), sub["razorpay_order_id"])
        assert r.status_code == 200, r.text[:400]
        saved = mongo.subscriptions.find_one({"razorpay_order_id": sub["razorpay_order_id"]})
        assert saved["payment_status"] == "completed"
        assert saved["is_active"] is True
        assert saved["end_date"] != stale_end, "base plan end_date not recalculated"
        end = datetime.fromisoformat(saved["end_date"])
        days = (end - datetime.now(timezone.utc)).days
        assert 360 <= days <= 370, f"unexpected 1_year end_date ({days} days)"

    def test_bad_signature_rejected(self, mongo):
        sub = _seed_pending(mongo, plan_type="money_masters", batch_id="mmb_x",
                            batch_name=f"TEST_{TAG} VP Bad", grade=1, end_date=iso(20))
        r = _session().post(f"{API}/subscriptions/verify-payment", json={
            "razorpay_order_id": sub["razorpay_order_id"],
            "razorpay_payment_id": "pay_fake",
            "razorpay_signature": "deadbeef",
        })
        assert r.status_code == 400
        saved = mongo.subscriptions.find_one({"razorpay_order_id": sub["razorpay_order_id"]})
        assert saved["payment_status"] == "pending"

    def test_double_verify_idempotent(self, mongo):
        sub = _seed_pending(mongo, plan_type="money_masters", batch_id="mmb_y",
                            batch_name=f"TEST_{TAG} VP Idem", grade=1, end_date=iso(20))
        s = _session()
        assert _verify(s, sub["razorpay_order_id"]).status_code == 200
        r2 = _verify(s, sub["razorpay_order_id"])
        assert r2.status_code == 200
        assert "already verified" in r2.json()["message"].lower()

    def test_unknown_order_404(self):
        oid = f"order_TESTmissing{uuid.uuid4().hex[:8]}"
        assert _verify(_session(), oid).status_code == 404


# ---------------------------------------------------------------- curriculum access

@pytest.fixture(scope="module")
def standalone_pair(mongo):
    """Fresh parent + child with NO base plan, only a money_masters subscription."""
    pw = hashlib.sha256("testpass123".encode()).hexdigest()
    parent_id = f"user_{uuid.uuid4().hex[:12]}"
    child_id = f"user_{uuid.uuid4().hex[:12]}"
    email = f"test_{TAG}_mmonly@example.com"
    mongo.users.insert_one({
        "user_id": parent_id, "name": f"TEST_{TAG} MMOnly Parent", "email": email,
        "username": f"test_{TAG}_mmparent", "password_hash": pw, "role": "parent",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo.users.insert_one({
        "user_id": child_id, "name": f"TEST_{TAG} MMOnly Child", "email": None,
        "username": f"test_{TAG}_mmchild", "password_hash": pw, "role": "child",
        "grade": CHILD_GRADE, "coins": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo.parent_child_links.insert_one({
        "link_id": f"link_{uuid.uuid4().hex[:10]}", "parent_id": parent_id,
        "child_id": child_id, "status": "active", "created_by": f"TEST_{TAG}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo.subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}", "plan_type": "money_masters",
        "batch_id": f"mmb_{TAG}std", "batch_name": f"TEST_{TAG} Standalone Batch",
        "grade": CHILD_GRADE, "amount": 1499, "payment_status": "completed",
        "is_active": True, "subscriber_name": f"TEST_{TAG} MMOnly Parent",
        "subscriber_email": email, "parent_emails": [email], "child_user_ids": [child_id],
        "child_name": f"TEST_{TAG} MMOnly Child",
        "start_date": datetime.now(timezone.utc).isoformat(), "end_date": iso(90),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"parent_id": parent_id, "child_id": child_id, "email": email,
            "parent_username": f"test_{TAG}_mmparent", "child_username": f"test_{TAG}_mmchild"}


def _login(identifier, password="testpass123"):
    s = _session()
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    if r.status_code != 200:
        pytest.fail(f"login {identifier} failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    return s


class TestCurriculumAccess:
    def test_money_masters_only_child_sees_only_entrepreneurship(self, standalone_pair):
        s = _login(standalone_pair["child_username"])
        r = s.get(f"{API}/curricula")
        assert r.status_code == 200, r.text[:300]
        active = r.json()["active"]
        assert active == ["money_entrepreneurship"], f"expected only money_entrepreneurship, got {active}"

    def test_money_masters_only_parent_sees_only_entrepreneurship(self, standalone_pair):
        s = _login(standalone_pair["parent_username"])
        r = s.get(f"{API}/curricula")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["active"] == ["money_entrepreneurship"]

    def test_money_masters_only_child_gets_no_financial_literacy_topics(self, standalone_pair):
        s = _login(standalone_pair["child_username"])
        r = s.get(f"{API}/content/topics")
        assert r.status_code == 200, r.text[:300]
        topics = r.json()
        payload = topics if isinstance(topics, list) else topics.get("topics", [])
        for t in payload:
            curs = t.get("curricula") or ["financial_literacy"]
            assert "money_entrepreneurship" in curs, (
                f"Financial Literacy topic leaked to money-masters-only user: {t.get('title')}")

    def test_base_plan_only_child_sees_financial_literacy(self, mongo):
        s = _login("wallet_demo_child")
        r = s.get(f"{API}/curricula")
        assert r.status_code == 200
        assert r.json()["active"] == ["financial_literacy"], r.json()["active"]

    def test_base_plan_only_parent_sees_financial_literacy(self, parent_client):
        r = parent_client.get(f"{API}/curricula")
        assert r.status_code == 200
        assert r.json()["active"] == ["financial_literacy"], r.json()["active"]

    def test_both_plans_parent_sees_both(self, mongo, parent_client):
        """Parent holding base plan (via parent_emails) + a Money Masters sub."""
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        mongo.subscriptions.insert_one({
            "subscription_id": sub_id, "plan_type": "money_masters",
            "batch_id": f"mmb_{TAG}bothp", "batch_name": f"TEST_{TAG} Both Parent Batch",
            "grade": CHILD_GRADE, "amount": 1499, "payment_status": "completed",
            "is_active": True, "subscriber_name": f"TEST_{TAG} BothP",
            "subscriber_email": "wallet_demo_parent@test.com",
            "parent_emails": ["wallet_demo_parent@test.com"],
            "child_user_ids": [],
            "start_date": datetime.now(timezone.utc).isoformat(), "end_date": iso(60),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = parent_client.get(f"{API}/curricula")
            assert r.status_code == 200
            active = set(r.json()["active"])
            assert active == {"financial_literacy", "money_entrepreneurship"}, active
        finally:
            mongo.subscriptions.delete_one({"subscription_id": sub_id})

    def test_child_of_base_plan_parent_keeps_fl_after_buying_money_masters(self, mongo, child_user_id):
        """REGRESSION: a child whose PARENT holds the active base plan must keep
        Financial Literacy after a Money Masters batch is added for that child.
        Base-plan subscriptions store only parent_emails (child_user_ids stays []),
        so the subscription-derived curricula for the child collapse to
        money_entrepreneurship only once a money_masters sub exists."""
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        mongo.subscriptions.insert_one({
            "subscription_id": sub_id, "plan_type": "money_masters",
            "batch_id": f"mmb_{TAG}both", "batch_name": f"TEST_{TAG} Both Batch",
            "grade": CHILD_GRADE, "amount": 1499, "payment_status": "completed",
            "is_active": True, "subscriber_name": f"TEST_{TAG} Both",
            "subscriber_email": "wallet_demo_parent@test.com",
            "parent_emails": ["wallet_demo_parent@test.com"],
            "child_user_ids": [child_user_id],
            "start_date": datetime.now(timezone.utc).isoformat(), "end_date": iso(60),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            s = _login("wallet_demo_child")
            r = s.get(f"{API}/curricula")
            assert r.status_code == 200
            active = set(r.json()["active"])
            assert active == {"financial_literacy", "money_entrepreneurship"}, (
                f"child lost Financial Literacy after Money Masters purchase: {active}")
        finally:
            mongo.subscriptions.delete_one({"subscription_id": sub_id})

    def test_anonymous_curricula_endpoint(self):
        r = requests.get(f"{API}/curricula")
        assert r.status_code == 200
        body = r.json()
        assert [c["id"] for c in body["curricula"]] == ["financial_literacy", "money_entrepreneurship"]
        assert body["active"] is None  # unauthenticated -> no scoping info


# ---------------------------------------------------------------- my-batches + admin badges

class TestMyBatchesAndAdminBadges:
    def test_my_batches_returns_parent_subs(self, standalone_pair):
        s = _login(standalone_pair["parent_username"])
        r = s.get(f"{API}/subscriptions/money-masters/my-batches")
        assert r.status_code == 200, r.text[:300]
        subs = r.json()
        assert any(x["batch_name"] == f"TEST_{TAG} Standalone Batch" for x in subs), subs
        for x in subs:
            assert "_id" not in x
            assert x["plan_type"] == "money_masters"

    def test_my_batches_requires_parent(self, admin_client):
        assert admin_client.get(f"{API}/subscriptions/money-masters/my-batches").status_code == 403

    def test_admin_users_shows_money_masters_badge(self, admin_client, standalone_pair):
        r = admin_client.get(f"{API}/admin/users")
        assert r.status_code == 200
        users = r.json()
        parent = next((u for u in users if u["user_id"] == standalone_pair["parent_id"]), None)
        child = next((u for u in users if u["user_id"] == standalone_pair["child_id"]), None)
        assert parent and child, "seeded standalone users missing from admin list"
        assert parent["subscription_status"] == "active"
        labels = [p["label"] for p in parent["active_plans"]]
        assert labels == [f"Money Masters — TEST_{TAG} Standalone Batch"], labels
        assert parent["money_masters_batch"]["grade"] == CHILD_GRADE
        assert child["subscription_status"] == "active"
        assert [p["plan_type"] for p in child["active_plans"]] == ["money_masters"]

    def test_admin_users_shows_both_badges(self, admin_client, mongo, child_user_id):
        """Parent holding base plan + Money Masters must show BOTH badges."""
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        mongo.subscriptions.insert_one({
            "subscription_id": sub_id, "plan_type": "money_masters",
            "batch_id": f"mmb_{TAG}badge", "batch_name": f"TEST_{TAG} Badge Batch",
            "grade": CHILD_GRADE, "amount": 1499, "payment_status": "completed",
            "is_active": True, "subscriber_name": f"TEST_{TAG} Badge",
            "subscriber_email": "wallet_demo_parent@test.com",
            "parent_emails": ["wallet_demo_parent@test.com"],
            "child_user_ids": [child_user_id],
            "start_date": datetime.now(timezone.utc).isoformat(), "end_date": iso(60),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            users = admin_client.get(f"{API}/admin/users").json()
            parent = next(u for u in users if u.get("username") == "wallet_demo_parent")
            labels = sorted(p["label"] for p in parent["active_plans"])
            assert "Full Plan" in labels, labels
            assert any("Money Masters" in x for x in labels), labels
            assert parent["subscription_status"] == "active"
            assert parent["money_masters_batch"]["batch_name"] == f"TEST_{TAG} Badge Batch"
            assert parent["subscription_end_date"]  # base plan end date preserved
            # child row picks up the money masters badge via child_user_ids
            kid = next(u for u in users if u["user_id"] == child_user_id)
            assert any("Money Masters" in p["label"] for p in kid["active_plans"])
        finally:
            mongo.subscriptions.delete_one({"subscription_id": sub_id})

    def test_admin_users_status_regression(self, admin_client):
        users = admin_client.get(f"{API}/admin/users").json()
        assert users, "no users returned"
        for u in users:
            assert u["subscription_status"] in ("active", "expired", "inactive"), u["subscription_status"]
            assert isinstance(u.get("active_plans"), list)
            if u["subscription_status"] == "inactive":
                assert u["active_plans"] == []
            assert "_id" not in u
        # base-plan-only user still shows Full Plan
        parent = next((u for u in users if u.get("username") == "wallet_demo_parent"), None)
        assert parent, "wallet_demo_parent missing"
        assert parent["subscription_status"] == "active"
        assert "Full Plan" in [p["label"] for p in parent["active_plans"]]
