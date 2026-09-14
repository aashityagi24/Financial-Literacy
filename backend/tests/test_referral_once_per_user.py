"""
Test suite for the "one email/phone per referral code" constraint (iteration 120).

Verifies that at order-creation time, the backend blocks reuse of a referral code
by any email or phone that has already redeemed it (payment_status='completed'),
across BOTH platform (create-order) and Money Masters (money-masters/create-order)
flows, and that legitimate use with fresh identifiers or a different code still works.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

# ------------- Config -------------
frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")

ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
PARENT_ID = "wallet_demo_parent"
PARENT_PASS = "testpass123"

BLOCK_MSG = "This referral code has already been used with this email or phone number"


# ------------- Fixtures -------------
@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def parent():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": PARENT_ID, "password": PARENT_PASS})
    if r.status_code != 200:
        pytest.fail(f"Parent login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def state():
    return {"codes": [], "subs": [], "batches": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, state, mongo):
    yield
    # Delete referral codes
    for rid in state["codes"]:
        try:
            admin.delete(f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}")
        except Exception:
            pass
    # Delete fake completed subscription docs
    if state["subs"]:
        mongo.subscriptions.delete_many({"subscription_id": {"$in": state["subs"]}})
    # Delete any pending subs created during real create-order calls (by TEST_ email marker)
    mongo.subscriptions.delete_many({"subscriber_email": {"$regex": "^qa_referral_"}})
    # Delete MM batches
    for bid in state["batches"]:
        try:
            admin.delete(f"{BASE_URL}/api/subscriptions/admin/money-masters/batches/{bid}")
        except Exception:
            pass


def _make_code():
    return f"QAONCE{uuid.uuid4().hex[:6].upper()}"


def _create_platform_code(admin, state, plan_type="single_parent", duration="1_day", discount=10):
    code = _make_code()
    r = admin.post(
        f"{BASE_URL}/api/subscriptions/admin/referral-codes",
        json={
            "code": code,
            "discount_percent": discount,
            "applicable_plans": [{"plan_type": plan_type, "duration": duration}],
            "applicable_batches": [],
        },
    )
    assert r.status_code == 200, r.text[:300]
    state["codes"].append(r.json()["referral_id"])
    return code


def _insert_fake_completed_sub(mongo, state, code, email="", phone="", plan_type="single_parent"):
    sub_id = f"sub_qatest_{uuid.uuid4().hex[:10]}"
    doc = {
        "subscription_id": sub_id,
        "plan_type": plan_type,
        "duration": "1_day",
        "referral_code": code.upper(),
        "payment_status": "completed",
        "subscriber_email": email.lower(),
        "subscriber_phone": phone,
        "amount": 44,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.subscriptions.insert_one(doc)
    state["subs"].append(sub_id)
    return sub_id


# ============================================================
# Platform create-order tests
# ============================================================

class TestPlatformCreateOrderBlock:
    def test_block_by_same_email(self, admin, mongo, state):
        code = _create_platform_code(admin, state)
        seed_email = "qa_referral_test@example.com"
        seed_phone = "9111122233"
        _insert_fake_completed_sub(mongo, state, code, email=seed_email, phone=seed_phone)

        # Same email, DIFFERENT phone -> must be blocked
        r = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={
                "plan_type": "single_parent",
                "duration": "1_day",
                "num_children": 1,
                "subscriber_name": "QA A",
                "subscriber_email": seed_email,
                "subscriber_phone": "9999999999",
                "referral_code": code,
            },
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"
        assert r.json().get("detail") == BLOCK_MSG, r.json()

    def test_block_by_same_phone_different_email(self, admin, mongo, state):
        code = _create_platform_code(admin, state)
        seed_email = "qa_referral_orig@example.com"
        seed_phone = "9222233344"
        _insert_fake_completed_sub(mongo, state, code, email=seed_email, phone=seed_phone)

        # Different email, SAME phone -> must be blocked
        r = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={
                "plan_type": "single_parent",
                "duration": "1_day",
                "num_children": 1,
                "subscriber_name": "QA B",
                "subscriber_email": "qa_referral_new@example.com",
                "subscriber_phone": seed_phone,
                "referral_code": code,
            },
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"
        assert r.json().get("detail") == BLOCK_MSG, r.json()

    def test_fresh_identifiers_succeed_with_discount(self, admin, mongo, state):
        code = _create_platform_code(admin, state, discount=10)
        # Seed a used pair
        _insert_fake_completed_sub(mongo, state, code, email="qa_referral_used@example.com", phone="9333344455")

        fresh_email = f"qa_referral_fresh_{uuid.uuid4().hex[:6]}@example.com"
        fresh_phone = f"98{uuid.uuid4().int % 100000000:08d}"
        r = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={
                "plan_type": "single_parent",
                "duration": "1_day",
                "num_children": 1,
                "subscriber_name": "QA Fresh",
                "subscriber_email": fresh_email,
                "subscriber_phone": fresh_phone,
                "referral_code": code,
            },
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("order_id", "").startswith("order_"), data
        # Persisted sub with 10% discount
        sub = mongo.subscriptions.find_one({"subscription_id": data["subscription_id"]})
        assert sub is not None
        assert sub.get("discount_percent_applied") == 10
        # cleanup
        mongo.subscriptions.delete_one({"subscription_id": data["subscription_id"]})

    def test_different_code_same_blocked_user_succeeds(self, admin, mongo, state):
        """Blocking is per-code, not blanket user-level."""
        code_a = _create_platform_code(admin, state)
        code_b = _create_platform_code(admin, state)
        blocked_email = "qa_referral_multiblock@example.com"
        blocked_phone = "9444455566"
        # Only code_a is redeemed by this user
        _insert_fake_completed_sub(mongo, state, code_a, email=blocked_email, phone=blocked_phone)

        r = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={
                "plan_type": "single_parent",
                "duration": "1_day",
                "num_children": 1,
                "subscriber_name": "QA C",
                "subscriber_email": blocked_email,
                "subscriber_phone": blocked_phone,
                "referral_code": code_b,
            },
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"
        mongo.subscriptions.delete_one({"subscription_id": r.json()["subscription_id"]})

    def test_no_referral_code_still_works(self):
        """Regression: no referral_code -> new check must no-op."""
        r = requests.post(
            f"{BASE_URL}/api/subscriptions/create-order",
            json={
                "plan_type": "single_parent",
                "duration": "1_day",
                "num_children": 1,
                "subscriber_name": "QA NoRef",
                "subscriber_email": f"qa_referral_noref_{uuid.uuid4().hex[:6]}@example.com",
                "subscriber_phone": "9555566677",
            },
        )
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:400]}"


# ============================================================
# Admin CRUD regression
# ============================================================

class TestAdminReferralCRUDRegression:
    def test_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/subscriptions/admin/referral-codes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_deactivate(self, admin, state):
        code = _make_code()
        cr = admin.post(
            f"{BASE_URL}/api/subscriptions/admin/referral-codes",
            json={
                "code": code,
                "discount_percent": 20,
                "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}],
                "applicable_batches": [],
            },
        )
        assert cr.status_code == 200, cr.text[:300]
        rid = cr.json()["referral_id"]
        state["codes"].append(rid)

        # Deactivate
        ur = admin.put(
            f"{BASE_URL}/api/subscriptions/admin/referral-codes/{rid}",
            json={"is_active": False},
        )
        assert ur.status_code == 200, ur.text[:300]

        # Validate should now say not-exist
        vr = requests.post(f"{BASE_URL}/api/subscriptions/validate-referral-code", json={"code": code})
        assert vr.status_code == 200
        assert vr.json()["valid"] is False


# ============================================================
# Money Masters flow
# ============================================================

@pytest.fixture(scope="module")
def parent_child(parent):
    r = parent.get(f"{BASE_URL}/api/parent/children")
    if r.status_code != 200:
        pytest.skip(f"cannot list parent children: {r.status_code}")
    kids = r.json()
    if isinstance(kids, dict):
        kids = kids.get("children", [])
    if not kids:
        pytest.skip("parent has no linked children")
    return kids[0]


@pytest.fixture(scope="module")
def parent_user(parent, mongo):
    """Fetch the authenticated parent's own DB record to know email/phone the MM
    order-creation check uses."""
    u = mongo.users.find_one({"user_id": PARENT_ID}) or mongo.users.find_one({"username": PARENT_ID})
    if not u:
        pytest.skip("parent user not found in DB")
    return {"email": (u.get("email") or "").lower(), "phone": u.get("phone", "") or ""}


@pytest.fixture(scope="module")
def mm_batch(admin, parent, parent_child, state):
    grade = parent_child.get("grade", 0) or 0
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    cr = admin.post(
        f"{BASE_URL}/api/subscriptions/admin/money-masters/batches",
        json={
            "name": f"TEST_ReferralOnce {uuid.uuid4().hex[:5]}",
            "grades": [grade],
            "start_date": start,
            "end_date": end,
            "price": 2000,
            "description": "TEST batch for referral-once QA",
        },
    )
    if cr.status_code != 200:
        pytest.fail(f"batch create failed {cr.status_code}: {cr.text[:300]}")
    batch = cr.json()
    state["batches"].append(batch["batch_id"])
    return batch


class TestMoneyMastersBlock:
    def test_mm_blocked_when_parent_identifiers_already_redeemed(
        self, admin, parent, mongo, state, mm_batch, parent_child, parent_user
    ):
        # Create referral code applicable to this MM batch
        code = _make_code()
        cr = admin.post(
            f"{BASE_URL}/api/subscriptions/admin/referral-codes",
            json={
                "code": code,
                "discount_percent": 10,
                "applicable_plans": [],
                "applicable_batches": [mm_batch["batch_id"]],
            },
        )
        assert cr.status_code == 200, cr.text[:300]
        state["codes"].append(cr.json()["referral_id"])

        # Seed a fake completed sub under this SAME code with the parent's own email/phone
        # (cross-plan-type on purpose: plan_type='single_parent' but code-based match should catch it)
        _insert_fake_completed_sub(
            mongo,
            state,
            code,
            email=parent_user["email"] or "wallet_demo_parent@test.local",
            phone=parent_user["phone"] or "",
            plan_type="single_parent",
        )
        # If both are empty the block can't trigger; skip
        if not parent_user["email"] and not parent_user["phone"]:
            pytest.skip("Parent has neither email nor phone; block cannot be triggered")

        child_id = parent_child.get("user_id") or parent_child.get("child_id")
        r = parent.post(
            f"{BASE_URL}/api/subscriptions/money-masters/create-order",
            json={"batch_id": mm_batch["batch_id"], "child_id": child_id, "referral_code": code},
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:400]}"
        assert r.json().get("detail") == BLOCK_MSG, r.json()
