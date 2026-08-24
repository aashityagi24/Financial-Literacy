"""Tests for Entrepreneurship Workshop public marketing endpoints + admin Trial Requests CRUD.

Updated: trial enquiry now REQUIRES state + city (uniform dropdown values).
"""
import os
import requests
import pytest
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

ADMIN = {"identifier": "admin@learnersplanet.com", "password": "finlit@2026"}

STATE = "Maharashtra"
CITY = "Pune"


def base_payload(**over):
    p = {
        "parent_name": "TEST_Parent",
        "phone": "9876543210",
        "email": "TEST_x@example.com",
        "child_grade": 2,
        "state": STATE,
        "city": CITY,
    }
    p.update(over)
    return p


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text[:300]}"
    token = r.json().get("session_token") or r.json().get("access_token") or r.json().get("token")
    assert token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup(created_ids, admin_headers):
    yield
    for i in created_ids:
        requests.delete(f"{API}/subscriptions/admin/trial-enquiries/{i}", headers=admin_headers, timeout=30)


# ---------------- public batches
class TestPublicBatches:
    def test_public_batches_no_auth(self):
        r = requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for b in data:
            assert "batch_id" in b and "name" in b and "grade" in b
            assert "price" in b and "start_date" in b and "end_date" in b
            assert "_id" not in b

    def test_public_batches_only_active(self, admin_headers):
        pub = requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30).json()
        adm = requests.get(f"{API}/subscriptions/admin/money-masters/batches", headers=admin_headers, timeout=30)
        assert adm.status_code == 200
        inactive_ids = {b["batch_id"] for b in adm.json() if not b.get("is_active")}
        pub_ids = {b["batch_id"] for b in pub}
        assert not (pub_ids & inactive_ids), "inactive batches leaked into public list"


# ---------------- public trial enquiry (state/city feature)
class TestTrialEnquirySubmit:
    def test_submit_success_and_persist_with_state_city(self, created_ids, admin_headers):
        payload = base_payload(parent_name="TEST_Parent QA", email="TEST_qa_trial@example.com",
                               child_name="TEST_Child", child_grade=3)
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        eid = r.json()["enquiry_id"]
        created_ids.append(eid)

        lst = requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30)
        assert lst.status_code == 200
        lead = next((x for x in lst.json() if x["enquiry_id"] == eid), None)
        assert lead is not None, "submitted lead not persisted"
        assert lead["parent_name"] == "TEST_Parent QA"
        assert lead["email"] == "test_qa_trial@example.com"  # lowercased
        assert lead["child_grade"] == 3
        assert lead["status"] == "new"
        assert lead["batch_id"] is None
        assert lead["state"] == STATE
        assert lead["city"] == CITY
        assert "_id" not in lead

    def test_state_city_trimmed(self, created_ids, admin_headers):
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry",
                          json=base_payload(state="  Karnataka  ", city="  Bengaluru  ",
                                            email="TEST_trim@example.com"), timeout=30)
        assert r.status_code == 200, r.text[:300]
        eid = r.json()["enquiry_id"]
        created_ids.append(eid)
        lead = next(x for x in requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30).json() if x["enquiry_id"] == eid)
        assert lead["state"] == "Karnataka"
        assert lead["city"] == "Bengaluru"

    @pytest.mark.parametrize("over,label,expected", [
        ({"state": None}, "state missing", (422,)),
        ({"city": None}, "city missing", (422,)),
        ({"state": "   "}, "state blank", (400,)),
        ({"city": "   "}, "city blank", (400,)),
    ])
    def test_state_city_required(self, over, label, expected):
        payload = base_payload()
        for k, v in over.items():
            if v is None:
                payload.pop(k)
            else:
                payload[k] = v
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=payload, timeout=30)
        assert r.status_code in expected, f"{label}: expected {expected} got {r.status_code} {r.text[:200]}"

    def test_submit_with_batch_id_resolves_name(self, created_ids, admin_headers):
        batches = requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30).json()
        if not batches:
            pytest.skip("no open batches to test batch linking")
        b = batches[0]
        payload = base_payload(parent_name="TEST_Batch Parent", phone="+91 9876543211",
                              email="TEST_batchparent@example.com", child_grade=b["grade"],
                              batch_id=b["batch_id"])
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        eid = r.json()["enquiry_id"]
        created_ids.append(eid)
        lead = next(x for x in requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30).json() if x["enquiry_id"] == eid)
        assert lead["batch_id"] == b["batch_id"]
        assert lead["batch_name"] == b["name"]

    @pytest.mark.parametrize("over,label", [
        ({"parent_name": "   "}, "empty name"),
        ({"phone": "12345"}, "short phone"),
        ({"email": "nope"}, "bad email"),
        ({"child_grade": 9}, "grade too high"),
        ({"child_grade": -1}, "grade negative"),
    ])
    def test_invalid_payloads_rejected(self, over, label):
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=base_payload(**over), timeout=30)
        assert r.status_code == 400, f"{label}: expected 400 got {r.status_code} {r.text[:200]}"

    def test_missing_grade_is_422(self):
        p = base_payload()
        p.pop("child_grade")
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=p, timeout=30)
        assert r.status_code in (400, 422), r.text[:200]

    def test_grade_zero_accepted(self, created_ids):
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry",
                          json=base_payload(parent_name="TEST_KG Parent", phone="9876543212",
                                            email="TEST_kg@example.com", child_grade=0), timeout=30)
        assert r.status_code == 200, r.text[:300]
        created_ids.append(r.json()["enquiry_id"])


# ---------------- admin endpoints
class TestAdminTrialEnquiries:
    def test_list_requires_admin(self):
        r = requests.get(f"{API}/subscriptions/admin/trial-enquiries", timeout=30)
        assert r.status_code in (401, 403), f"unauth got {r.status_code}"

    def test_status_update_flow(self, admin_headers, created_ids):
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry",
                          json=base_payload(parent_name="TEST_Status", phone="9876543213",
                                            email="TEST_status@example.com", child_grade=1), timeout=30)
        assert r.status_code == 200, r.text[:300]
        eid = r.json()["enquiry_id"]
        created_ids.append(eid)
        for st in ["contacted", "converted", "closed", "new"]:
            u = requests.put(f"{API}/subscriptions/admin/trial-enquiries/{eid}/status",
                             headers=admin_headers, json={"status": st}, timeout=30)
            assert u.status_code == 200, f"{st}: {u.status_code} {u.text[:200]}"
            lead = next(x for x in requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30).json() if x["enquiry_id"] == eid)
            assert lead["status"] == st

    def test_invalid_status_rejected(self, admin_headers, created_ids):
        eid = created_ids[0] if created_ids else None
        if not eid:
            pytest.skip("no lead")
        u = requests.put(f"{API}/subscriptions/admin/trial-enquiries/{eid}/status",
                         headers=admin_headers, json={"status": "bogus"}, timeout=30)
        assert u.status_code == 400

    def test_status_update_unknown_id_404(self, admin_headers):
        u = requests.put(f"{API}/subscriptions/admin/trial-enquiries/trial_doesnotexist/status",
                         headers=admin_headers, json={"status": "new"}, timeout=30)
        assert u.status_code == 404

    def test_single_delete(self, admin_headers):
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry",
                          json=base_payload(parent_name="TEST_Del", phone="9876543214",
                                            email="TEST_del@example.com"), timeout=30)
        eid = r.json()["enquiry_id"]
        d = requests.delete(f"{API}/subscriptions/admin/trial-enquiries/{eid}", headers=admin_headers, timeout=30)
        assert d.status_code == 200, d.text[:200]
        remaining = [x["enquiry_id"] for x in requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30).json()]
        assert eid not in remaining
        assert requests.delete(f"{API}/subscriptions/admin/trial-enquiries/{eid}", headers=admin_headers, timeout=30).status_code == 404

    def test_bulk_delete(self, admin_headers):
        ids = []
        for i in range(2):
            r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry",
                              json=base_payload(parent_name=f"TEST_Bulk{i}", phone="987654321%d" % i,
                                                email=f"TEST_bulk{i}@example.com", child_grade=4), timeout=30)
            assert r.status_code == 200, r.text[:200]
            ids.append(r.json()["enquiry_id"])
        d = requests.delete(f"{API}/subscriptions/admin/trial-enquiries-bulk",
                            headers=admin_headers, json={"enquiry_ids": ids}, timeout=30)
        assert d.status_code == 200, f"{d.status_code} {d.text[:300]}"
        assert "2" in d.json()["message"]
        remaining = [x["enquiry_id"] for x in requests.get(f"{API}/subscriptions/admin/trial-enquiries", headers=admin_headers, timeout=30).json()]
        assert not set(ids) & set(remaining)

    def test_bulk_delete_empty_ids_400(self, admin_headers):
        d = requests.delete(f"{API}/subscriptions/admin/trial-enquiries-bulk",
                            headers=admin_headers, json={"enquiry_ids": []}, timeout=30)
        assert d.status_code == 400


# ---------------- regression: admin batches CRUD still works & feeds public list
class TestBatchAdminRegression:
    def test_create_edit_toggle_delete_and_public_visibility(self, admin_headers):
        payload = {"name": "TEST_QA Public Batch", "grade": 5, "start_date": "2026-08-01T00:00:00+00:00",
                   "end_date": "2026-12-31T00:00:00+00:00", "price": 999, "seats": 20, "description": "qa"}
        c = requests.post(f"{API}/subscriptions/admin/money-masters/batches", headers=admin_headers, json=payload, timeout=30)
        assert c.status_code in (200, 201), f"{c.status_code} {c.text[:300]}"
        bid = c.json().get("batch_id") or c.json().get("batch", {}).get("batch_id")
        assert bid
        try:
            pub = requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30).json()
            found = next((b for b in pub if b["batch_id"] == bid), None)
            assert found, "newly created active batch not visible on public endpoint"
            assert found["grade"] == 5 and found["price"] == 999

            u = requests.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}", headers=admin_headers,
                             json={"name": "TEST_QA Public Batch v2", "price": 1499}, timeout=30)
            assert u.status_code == 200, u.text[:300]
            pub = requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30).json()
            found = next(b for b in pub if b["batch_id"] == bid)
            assert found["name"] == "TEST_QA Public Batch v2" and found["price"] == 1499

            t = requests.put(f"{API}/subscriptions/admin/money-masters/batches/{bid}", headers=admin_headers,
                             json={"is_active": False}, timeout=30)
            assert t.status_code == 200
            pub_ids = [b["batch_id"] for b in requests.get(f"{API}/subscriptions/money-masters/public-batches", timeout=30).json()]
            assert bid not in pub_ids, "deactivated batch still public"
        finally:
            d = requests.delete(f"{API}/subscriptions/admin/money-masters/batches/{bid}", headers=admin_headers, timeout=30)
            assert d.status_code in (200, 204)
