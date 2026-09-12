"""Round 4: Grade 3 Garden vs Grade 4 Investments gate + seed catalog fix."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


def _login(username, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"identifier": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {username} failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("access_token") or data.get("token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def g3_headers():
    return {"Authorization": f"Bearer {_login('classmate_g3', 'testpass123')}"}


@pytest.fixture(scope="module")
def g1_headers():
    return {"Authorization": f"Bearer {_login('classmate_g1', 'testpass123')}"}


@pytest.fixture(scope="module")
def g4_headers():
    return {"Authorization": f"Bearer {_login('classmate_g4_qa', 'testpass123')}"}


# ---------- Grade 3: Garden access + Investments blocked ----------
class TestGrade3Garden:
    def test_garden_farm_returns_200(self, g3_headers):
        r = requests.get(f"{BASE_URL}/api/garden/farm", headers=g3_headers, timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, dict)

    def test_investments_blocked_for_grade3(self, g3_headers):
        r = requests.get(f"{BASE_URL}/api/investments", headers=g3_headers, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "garden" in body, f"expected 'garden' redirect message, got {r.text}"

    def test_seed_shop_has_five_seeds(self, g3_headers):
        # Try common seed catalog endpoints
        candidates = [
            "/api/garden/seeds",
            "/api/garden/catalog",
            "/api/garden/shop",
            "/api/investments/plants",
        ]
        found = None
        for path in candidates:
            r = requests.get(f"{BASE_URL}{path}", headers=g3_headers, timeout=30)
            if r.status_code == 200:
                try:
                    j = r.json()
                except Exception:
                    continue
                items = j if isinstance(j, list) else (j.get("items") or j.get("seeds") or j.get("plants") or [])
                if isinstance(items, list) and len(items) >= 1:
                    found = (path, items)
                    break
        assert found is not None, "no seed catalog endpoint returned data for Grade 3"
        path, items = found
        names = [str(i.get("name", "")).lower() for i in items if isinstance(i, dict)]
        print(f"seed endpoint used: {path}, count={len(items)}, names={names}")
        expected = {"red chilli", "tomato", "eggplant", "wheat", "strawberry"}
        found_names = expected.intersection(set(names))
        assert len(found_names) >= 5, f"expected 5 seeds available for Grade 3, found: {found_names}"


# ---------- Grade 4: Investments works, Garden blocked ----------
class TestGrade4Investments:
    def test_investments_returns_200(self, g4_headers):
        r = requests.get(f"{BASE_URL}/api/investments", headers=g4_headers, timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"

    def test_garden_blocked_for_grade4(self, g4_headers):
        r = requests.get(f"{BASE_URL}/api/garden/farm", headers=g4_headers, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "investment" in body, f"expected 'investments' redirect message, got {r.text}"

    def test_buy_plot_blocked_for_grade4(self, g4_headers):
        r = requests.post(f"{BASE_URL}/api/garden/buy-plot", headers=g4_headers, json={}, timeout=30)
        assert r.status_code in (400, 403), f"expected 400/403 got {r.status_code}: {r.text}"


# ---------- Grade 1: Garden still works ----------
class TestGrade1Garden:
    def test_garden_farm_returns_200(self, g1_headers):
        r = requests.get(f"{BASE_URL}/api/garden/farm", headers=g1_headers, timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"
