"""
Test suite for Referral Code feature (iteration 106)
Covers:
- Admin CRUD: GET/POST/PUT/DELETE /api/subscriptions/admin/referral-codes
- Public: POST /api/subscriptions/validate-referral-code
- Platform checkout: POST /api/subscriptions/create-order with referral_code
- Money Masters checkout: POST /api/subscriptions/money-masters/create-order with referral_code
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"

PARENT_ID = "wallet_demo_parent"
PARENT_PASS = "testpass123"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created_ids):
    yield
    for rid in created_ids:
        admin.delete(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}")


def make_code(prefix="TESTREF"):
    return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


# ---------- Admin CRUD ----------
class TestAdminReferralCRUD:
    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes")
        assert r.status_code in (401, 403), r.status_code

    def test_list_ok(self, admin):
        r = admin.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes")
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)
        for c in r.json():
            assert "_id" not in c

    def test_create_and_persist(self, admin, created_ids):
        code = make_code()
        payload = {
            "code": code.lower(),  # verify normalisation to upper
            "discount_percent": 20,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}],
            "applicable_batches": [],
        }
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json=payload)
        assert r.status_code == 200, r.text[:300]
        rid = r.json()["referral_id"]
        created_ids.append(rid)

        listing = admin.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes").json()
        doc = next((c for c in listing if c["referral_id"] == rid), None)
        assert doc is not None, "created code not returned by list"
        assert doc["code"] == code.upper()
        assert doc["discount_percent"] == 20
        assert doc["is_active"] is True
        assert doc["applicable_plans"] == [{"plan_type": "single_parent", "duration": "1_month"}]

    def test_create_duplicate_rejected(self, admin, created_ids):
        code = make_code()
        p = {"code": code, "discount_percent": 10,
             "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]}
        r1 = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json=p)
        assert r1.status_code == 200
        created_ids.append(r1.json()["referral_id"])
        r2 = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json=p)
        assert r2.status_code == 400
        assert "already exists" in r2.json()["detail"]

    def test_create_empty_code_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": "   ", "discount_percent": 10,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        assert r.status_code == 400, r.text[:200]
        assert "required" in r.json()["detail"].lower()

    @pytest.mark.parametrize("bad", [5, 12, 100, 0, -10])
    def test_invalid_discount_rejected(self, admin, bad):
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": make_code("BADD"), "discount_percent": bad,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        assert r.status_code == 400, f"discount {bad} accepted: {r.text[:200]}"

    @pytest.mark.parametrize("good", [10, 15, 20, 25, 30, 35, 50])
    def test_allowed_discounts_accepted(self, admin, created_ids, good):
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": make_code("OKD"), "discount_percent": good,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        assert r.status_code == 200, r.text[:200]
        created_ids.append(r.json()["referral_id"])

    def test_no_target_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": make_code("NOTGT"), "discount_percent": 10,
            "applicable_plans": [], "applicable_batches": []})
        assert r.status_code == 400
        assert "at least one" in r.json()["detail"].lower()

    def test_update_and_toggle(self, admin, created_ids):
        code = make_code("UPD")
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 10,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        rid = r.json()["referral_id"]
        created_ids.append(rid)

        u = admin.put(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}", json={
            "discount_percent": 35,
            "applicable_plans": [{"plan_type": "two_parents", "duration": "1_year"}],
            "is_active": False})
        assert u.status_code == 200, u.text[:200]

        listing = admin.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes").json()
        doc = next(c for c in listing if c["referral_id"] == rid)
        assert doc["discount_percent"] == 35
        assert doc["applicable_plans"] == [{"plan_type": "two_parents", "duration": "1_year"}]
        assert doc["is_active"] is False

        # invalid discount on update
        bad = admin.put(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}",
                        json={"discount_percent": 13})
        assert bad.status_code == 400

    def test_update_missing_id_404(self, admin):
        r = admin.put(f"{BASE_URL}/api/subscriptions/admin/referral-codes/ref_doesnotexist",
                      json={"discount_percent": 10})
        assert r.status_code == 404, r.status_code

    def test_delete_and_verify_removal(self, admin):
        code = make_code("DEL")
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 15,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        rid = r.json()["referral_id"]
        d = admin.delete(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}")
        assert d.status_code == 200, d.text[:200]
        listing = admin.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes").json()
        assert all(c["referral_id"] != rid for c in listing)
        # public validate should now say it doesn't exist
        v = requests.post(f"{BASE_URL}/api/subscriptions/validate-referral-code", json={"code": code})
        assert v.status_code == 200
        assert v.json()["valid"] is False


# ---------- Public validate ----------
class TestValidateEndpoint:
    def test_invalid_code(self):
        r = requests.post(f"{BASE_URL}/api/subscriptions/validate-referral-code",
                          json={"code": "NOPE99XX"})
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["valid"] is False
        assert body["message"] == "This referral code does not exist"

    def test_valid_code(self, admin, created_ids):
        code = make_code("VAL")
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 25,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        created_ids.append(r.json()["referral_id"])
        v = requests.post(f"{BASE_URL}/api/subscriptions/validate-referral-code",
                          json={"code": code.lower()})
        assert v.status_code == 200
        body = v.json()
        assert body["valid"] is True
        assert body["discount_percent"] == 25
        assert "_id" not in body

    def test_inactive_code_reported_invalid(self, admin, created_ids):
        code = make_code("INACT")
        r = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 10,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        rid = r.json()["referral_id"]
        created_ids.append(rid)
        admin.put(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}", json={"is_active": False})
        v = requests.post(f"{BASE_URL}/api/subscriptions/validate-referral-code", json={"code": code})
        assert v.json()["valid"] is False


# ---------- Platform checkout ----------
SUBSCRIBER = {
    "subscriber_name": "TEST_Referral QA",
    "subscriber_email": "test_referral_qa@test.com",
    "subscriber_phone": "9999999999",
}


class TestPlatformCheckout:
    def _order(self, payload):
        return requests.post(f"{BASE_URL}/api/subscriptions/create-order", json=payload)

    def test_no_code_baseline(self):
        p = dict(SUBSCRIBER, plan_type="single_parent", duration="1_month", num_children=1)
        r = self._order(p)
        assert r.status_code == 200, r.text[:400]
        self.__class__.baseline_paise = r.json()["amount"]
        assert isinstance(self.__class__.baseline_paise, int)

    def test_invalid_code_rejected(self):
        p = dict(SUBSCRIBER, plan_type="single_parent", duration="1_month",
                 num_children=1, referral_code="NOPE99XX")
        r = self._order(p)
        assert r.status_code == 400, r.text[:300]
        assert r.json()["detail"] == "This referral code does not exist"

    def test_valid_code_applies_discount(self, admin, created_ids):
        code = make_code("PLAT")
        cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 20,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        created_ids.append(cr.json()["referral_id"])

        baseline = self._order(dict(SUBSCRIBER, plan_type="single_parent",
                                    duration="1_month", num_children=1)).json()["amount"]
        r = self._order(dict(SUBSCRIBER, plan_type="single_parent", duration="1_month",
                             num_children=1, referral_code=code))
        assert r.status_code == 200, r.text[:400]
        got = r.json()["amount"]
        expected = round(round(baseline / 100) * 0.8) * 100
        assert got == expected, f"expected {expected} paise got {got} (baseline {baseline})"

    def test_valid_code_wrong_plan_rejected(self, admin, created_ids):
        code = make_code("WRONGPLAN")
        cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 30,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        created_ids.append(cr.json()["referral_id"])
        r = self._order(dict(SUBSCRIBER, plan_type="single_parent", duration="1_year",
                             num_children=1, referral_code=code))
        assert r.status_code == 400, r.text[:300]
        assert r.json()["detail"] == "This referral code isn't valid for this plan"

    def test_inactive_code_rejected_at_checkout(self, admin, created_ids):
        code = make_code("OFF")
        cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 50,
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        rid = cr.json()["referral_id"]
        created_ids.append(rid)
        admin.put(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}", json={"is_active": False})
        r = self._order(dict(SUBSCRIBER, plan_type="single_parent", duration="1_month",
                             num_children=1, referral_code=code))
        assert r.status_code == 400
        assert r.json()["detail"] == "This referral code does not exist"


# ---------- Money Masters checkout ----------
@pytest.fixture(scope="module")
def parent():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": PARENT_ID, "password": PARENT_PASS})
    if r.status_code != 200:
        pytest.fail(f"Parent login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def parent_child(parent):
    r = parent.get(f"{BASE_URL}/api/parent/children")
    if r.status_code != 200:
        pytest.fail(f"/api/parent/children -> {r.status_code}: {r.text[:300]}")
    kids = r.json()
    if isinstance(kids, dict):
        kids = kids.get("children", [])
    if not kids:
        pytest.skip("parent has no linked children")
    return kids[0]


@pytest.fixture(scope="module")
def mm_batch(admin, parent, parent_child):
    """Creates a temporary MM batch matching the child's grade; deletes it afterwards."""
    grade = parent_child.get("grade", 0) or 0
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches", json={
        "name": f"TEST_Referral Batch {uuid.uuid4().hex[:5]}",
        "grades": [grade],
        "start_date": start,
        "end_date": end,
        "price": 2000,
        "description": "TEST batch for referral code QA",
    })
    if cr.status_code != 200:
        pytest.fail(f"batch create failed {cr.status_code}: {cr.text[:300]}")
    batch = cr.json()

    # verify the parent-facing listing exposes it
    child_id = parent_child.get("user_id") or parent_child.get("child_id")
    lst = parent.get(f"{BASE_URL}/api/subscriptions/money-masters/batches",
                     params={"child_id": child_id})
    assert lst.status_code == 200, lst.text[:300]
    assert any(b["batch_id"] == batch["batch_id"] for b in lst.json()), \
        "created batch not visible in parent batch listing"

    yield batch
    admin.delete(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches/{batch['batch_id']}")


class TestMoneyMastersCheckout:
    def test_invalid_referral_code_rejected(self, parent, mm_batch, parent_child):
        child_id = parent_child.get("user_id") or parent_child.get("child_id")
        r = parent.post(f"{BASE_URL}/api/subscriptions/money-masters/create-order", json={
            "batch_id": mm_batch["batch_id"], "child_id": child_id, "referral_code": "NOPE99XX"})
        assert r.status_code == 400, r.text[:300]
        assert "does not exist" in r.json()["detail"], r.json()

    def test_valid_batch_code_applies_discount(self, parent, admin, created_ids, mm_batch, parent_child):
        child_id = parent_child.get("user_id") or parent_child.get("child_id")
        code = make_code("MMBOTH")
        cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 25,
            "applicable_batches": [mm_batch["batch_id"]],
            "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
        assert cr.status_code == 200, cr.text[:300]
        created_ids.append(cr.json()["referral_id"])

        r = parent.post(f"{BASE_URL}/api/subscriptions/money-masters/create-order", json={
            "batch_id": mm_batch["batch_id"], "child_id": child_id, "referral_code": code})
        if r.status_code == 400 and "already has an active" in r.text:
            pytest.skip("child already has active Money Masters subscription")
        assert r.status_code == 200, r.text[:400]
        expected = round(mm_batch["price"] * 0.75) * 100
        assert r.json()["amount"] == expected, f"expected {expected}, got {r.json()['amount']}"

        # SAME code must also work on the platform plan path
        pr = requests.post(f"{BASE_URL}/api/subscriptions/create-order", json=dict(
            SUBSCRIBER, plan_type="single_parent", duration="1_month",
            num_children=1, referral_code=code))
        assert pr.status_code == 200, pr.text[:400]
        base = requests.post(f"{BASE_URL}/api/subscriptions/create-order", json=dict(
            SUBSCRIBER, plan_type="single_parent", duration="1_month", num_children=1)).json()["amount"]
        assert pr.json()["amount"] == round(round(base / 100) * 0.75) * 100

    def test_code_for_other_batch_rejected(self, parent, admin, created_ids, mm_batch, parent_child):
        child_id = parent_child.get("user_id") or parent_child.get("child_id")
        code = make_code("MMWRONG")
        cr = admin.post(f"{BASE_URL}/api/subscriptions/admin/referral-codes", json={
            "code": code, "discount_percent": 15,
            "applicable_batches": ["batch_nonexistent_xyz"]})
        created_ids.append(cr.json()["referral_id"])
        r = parent.post(f"{BASE_URL}/api/subscriptions/money-masters/create-order", json={
            "batch_id": mm_batch["batch_id"], "child_id": child_id, "referral_code": code})
        assert r.status_code == 400, r.text[:300]
        assert "isn't valid for this plan" in r.json()["detail"], r.json()


# ---------- Regression ----------
class TestRegression:
    def test_plans_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert r.status_code == 200, r.text[:200]

    def test_admin_batches_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches")
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)
