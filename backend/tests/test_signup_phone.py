"""
Regression tests for the mandatory mobile-phone field on non-SSO signup
and its surfacing in the admin users list.
"""
import os
import uuid
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001") + "/api"
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


def _mongo():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _seed_subscription(email):
    db = _mongo()
    db.users.delete_many({"email": email})
    db.subscriptions.delete_many({"parent_emails": email})
    db.subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex[:8]}",
        "parent_emails": [email],
        "payment_status": "completed",
        "is_active": True,
        "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "plan_type": "1y",
        "num_children": 1,
    })


def _cleanup(email):
    db = _mongo()
    db.users.delete_many({"email": email})
    db.subscriptions.delete_many({"parent_emails": email})


def test_signup_phone_required():
    email = f"phone_required_{uuid.uuid4().hex[:6]}@x.com"
    _seed_subscription(email)
    try:
        r = requests.post(f"{API}/auth/signup", json={
            "name": "Test", "email": email, "password": "abc123"
        })
        assert r.status_code == 422, r.text  # pydantic validation
        body = r.json()
        assert any("phone" in str(loc) for loc in [e.get("loc") for e in body["detail"]])
    finally:
        _cleanup(email)


def test_signup_invalid_phone_rejected():
    email = f"phone_invalid_{uuid.uuid4().hex[:6]}@x.com"
    _seed_subscription(email)
    try:
        for bad in ["12345", "abcdefghij", "5876543210", "98765"]:
            r = requests.post(f"{API}/auth/signup", json={
                "name": "Test", "email": email, "password": "abc123", "phone": bad
            })
            assert r.status_code == 400, f"Phone '{bad}' should be rejected: {r.text}"
            assert "10-digit Indian mobile" in r.json()["detail"]
    finally:
        _cleanup(email)


def test_signup_valid_phone_variants_normalized():
    """Accept 10-digit, +91-prefixed, 0-prefixed, and store as +91XXXXXXXXXX."""
    for raw in ["9876543210", "+91 98765 43210", "+919876543210", "09876543210", "91-9876-543-210"]:
        email = f"phone_ok_{uuid.uuid4().hex[:6]}@x.com"
        _seed_subscription(email)
        try:
            r = requests.post(f"{API}/auth/signup", json={
                "name": "T", "email": email, "password": "abc123", "phone": raw
            })
            assert r.status_code == 200, f"{raw} should succeed: {r.text}"
            assert r.json()["user"]["phone"] == "+919876543210"
            doc = _mongo().users.find_one({"email": email})
            assert doc["phone"] == "+919876543210"
        finally:
            _cleanup(email)


def test_signup_phone_starting_with_5_rejected():
    """Indian mobile numbers must start with 6-9."""
    email = f"phone_5_{uuid.uuid4().hex[:6]}@x.com"
    _seed_subscription(email)
    try:
        r = requests.post(f"{API}/auth/signup", json={
            "name": "T", "email": email, "password": "abc123", "phone": "5876543210"
        })
        assert r.status_code == 400
    finally:
        _cleanup(email)


def test_admin_users_endpoint_exposes_phone():
    email = f"phone_admin_{uuid.uuid4().hex[:6]}@x.com"
    _seed_subscription(email)
    try:
        # Signup
        requests.post(f"{API}/auth/signup", json={
            "name": "Admin Phone Test", "email": email, "password": "abc123",
            "phone": "9876543210"
        })
        # Admin login
        admin_login = requests.post(f"{API}/auth/admin-login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert admin_login.status_code == 200
        # Fetch users
        r = requests.get(f"{API}/admin/users", cookies=admin_login.cookies)
        assert r.status_code == 200
        users = r.json()
        match = next((u for u in users if u.get("email") == email), None)
        assert match is not None, f"Newly signed-up user not in admin list"
        assert match.get("phone") == "+919876543210", f"phone missing in admin payload: {match}"
    finally:
        _cleanup(email)
