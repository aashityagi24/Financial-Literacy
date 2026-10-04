"""Regression tests for the new Login/Register split:
- /api/auth/login must return 404 for unknown identifiers (triggers "no account" UI)
- /api/auth/login must return 401 for wrong password on an existing account
- /api/auth/login must return 200 with session_token for valid credentials
- /api/auth/school-login still works with username/password
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Unified login state codes ---

def test_login_unknown_identifier_returns_404(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "ghost-user-7781@example.com",
        "password": "whatever123",
    })
    assert r.status_code == 404, r.text
    detail = r.json().get("detail", "")
    assert "no account" in detail.lower() or "register" in detail.lower()


def test_login_wrong_password_returns_401(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "nudge_parent@test.com",
        "password": "definitely-wrong-pw",
    })
    assert r.status_code == 401, r.text
    assert "invalid" in r.json().get("detail", "").lower()


def test_login_valid_parent_returns_200(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "nudge_parent@test.com",
        "password": "testpass123",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("session_token", "").startswith("sess_")
    assert data.get("user", {}).get("role") == "parent"


# --- School login unaffected by the new 404 behaviour ---

def test_school_login_valid(api):
    r = api.post(f"{BASE_URL}/api/auth/school-login", json={
        "username": "springfield",
        "password": "school123",
    })
    assert r.status_code == 200, r.text
    assert "school" in r.json()


def test_school_login_wrong_password_401(api):
    r = api.post(f"{BASE_URL}/api/auth/school-login", json={
        "username": "springfield",
        "password": "wrong-pw",
    })
    assert r.status_code in (401, 403), r.text
