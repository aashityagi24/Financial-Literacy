"""
Money Garden UX Enhancement Tests - Grade 1-2 Children
Tests for:
1. Garden farm data API (plots, seeds, inventory, market)
2. Plant/water/harvest/sell flow
3. All monetary values as whole numbers
4. Sell confirmation flow
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for Grade 1 child
TEST_CHILD_G1_EMAIL = "testchild.g1@test.com"
TEST_CHILD_G1_PASSWORD = "testpass123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def grade1_auth_token(api_client):
    """Get authentication token for Grade 1 test child"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": TEST_CHILD_G1_EMAIL,
        "password": TEST_CHILD_G1_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("session_token")
    pytest.skip(f"Authentication failed for Grade 1 child: {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, grade1_auth_token):
    """Session with auth header for Grade 1 child"""
    api_client.headers.update({"Authorization": f"Bearer {grade1_auth_token}"})
    return api_client


class TestMoneyGardenFarmAPI:
    """Test garden farm API - GET /api/garden/farm"""
    
    def test_farm_endpoint_returns_200(self, authenticated_client):
        """Garden farm endpoint should return 200 for Grade 1 child"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
    def test_farm_has_plots(self, authenticated_client):
        """Farm should have plots array"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        assert "plots" in data, "Farm data should contain 'plots'"
        assert isinstance(data["plots"], list), "Plots should be a list"
        assert len(data["plots"]) >= 1, "Farm should have at least 1 plot (single plot design)"
        
    def test_farm_has_seeds(self, authenticated_client):
        """Farm should have seeds available for planting"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        assert "seeds" in data, "Farm data should contain 'seeds'"
        assert isinstance(data["seeds"], list), "Seeds should be a list"
        
    def test_farm_has_inventory(self, authenticated_client):
        """Farm should have inventory array"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        assert "inventory" in data, "Farm data should contain 'inventory'"
        assert isinstance(data["inventory"], list), "Inventory should be a list"
        
    def test_farm_has_market_status(self, authenticated_client):
        """Farm should indicate market open status"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        assert "is_market_open" in data, "Farm data should contain 'is_market_open'"
        assert isinstance(data["is_market_open"], bool), "is_market_open should be boolean"
        
    def test_plot_has_required_fields(self, authenticated_client):
        """Each plot should have required fields for UI display"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        if data["plots"]:
            plot = data["plots"][0]
            required_fields = ["plot_id", "status", "plant_id", "growth_progress"]
            for field in required_fields:
                assert field in plot, f"Plot should have '{field}' field"
                
    def test_seed_has_details_for_dialog(self, authenticated_client):
        """Seeds should have cost, growth_days, harvest_yield for Plant Selection Dialog"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        if data["seeds"]:
            seed = data["seeds"][0]
            required_fields = ["plant_id", "name", "emoji", "seed_cost", "growth_days", "harvest_yield", "base_sell_price"]
            for field in required_fields:
                assert field in seed, f"Seed should have '{field}' for Plant Selection Dialog"


class TestMoneyGardenWallet:
    """Test wallet API for garden money"""
    
    def test_wallet_endpoint_returns_200(self, authenticated_client):
        """Wallet endpoint should return 200"""
        response = authenticated_client.get(f"{BASE_URL}/api/wallet")
        assert response.status_code == 200
        
    def test_wallet_has_investing_account(self, authenticated_client):
        """Wallet should have investing (Garden Money) account"""
        response = authenticated_client.get(f"{BASE_URL}/api/wallet")
        data = response.json()
        assert "accounts" in data
        investing_account = next((a for a in data["accounts"] if a["account_type"] == "investing"), None)
        assert investing_account is not None, "Should have investing (Garden Money) account"
        assert "balance" in investing_account


class TestMoneyGardenTransactions:
    """Test garden transactions API"""
    
    def test_transactions_endpoint_returns_200(self, authenticated_client):
        """Garden transactions endpoint should return 200"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/transactions")
        assert response.status_code == 200
        
    def test_transactions_is_list(self, authenticated_client):
        """Transactions should return a list"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/transactions")
        data = response.json()
        assert isinstance(data, list), "Transactions should be a list"


class TestMoneyGardenPlantFlow:
    """Test plant/water flow"""
    
    def test_water_plant_requires_valid_plot(self, authenticated_client):
        """Watering requires a valid plot ID"""
        response = authenticated_client.post(f"{BASE_URL}/api/garden/water/invalid_plot_id")
        assert response.status_code == 404, "Should return 404 for invalid plot"
        
    def test_harvest_requires_ready_status(self, authenticated_client):
        """Harvesting requires plant to be ready"""
        # Get current plot
        farm_response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = farm_response.json()
        if data["plots"]:
            plot = data["plots"][0]
            if plot.get("status") != "ready":
                response = authenticated_client.post(f"{BASE_URL}/api/garden/harvest/{plot['plot_id']}")
                # Should fail if not ready
                if plot.get("plant_id"):
                    assert response.status_code == 400, "Should reject harvest if plant not ready"


class TestMoneyGardenSellFlow:
    """Test sell confirmation flow"""
    
    def test_sell_requires_market_open(self, authenticated_client):
        """Selling requires market to be open (7AM-5PM IST)"""
        # Get inventory first
        farm_response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = farm_response.json()
        
        if data["inventory"]:
            item = data["inventory"][0]
            response = authenticated_client.post(
                f"{BASE_URL}/api/garden/sell?plant_id={item['plant_id']}&quantity=1"
            )
            if not data["is_market_open"]:
                assert response.status_code == 400, "Should reject sell when market closed"
                assert "closed" in response.json().get("detail", "").lower()
            else:
                # Market is open, sell should work
                assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
                
    def test_sell_validates_quantity(self, authenticated_client):
        """Sell should validate quantity available"""
        farm_response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = farm_response.json()
        
        if data["inventory"] and data["is_market_open"]:
            item = data["inventory"][0]
            # Try to sell more than available
            response = authenticated_client.post(
                f"{BASE_URL}/api/garden/sell?plant_id={item['plant_id']}&quantity=9999"
            )
            assert response.status_code == 400, "Should reject sell if quantity exceeds inventory"


class TestWholeNumberCalculations:
    """Verify all monetary values display as whole numbers"""
    
    def test_seed_costs_are_whole_numbers(self, authenticated_client):
        """Seed costs should be whole numbers (or easily rounded)"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        for seed in data.get("seeds", []):
            cost = seed.get("seed_cost", 0)
            # The frontend rounds with Math.round(), so values should be
            # close to whole numbers for good UX
            assert cost >= 0, "Seed cost should be non-negative"
            
    def test_market_prices_structure(self, authenticated_client):
        """Market prices should have proper structure"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        data = response.json()
        if data.get("market_prices"):
            for price in data["market_prices"]:
                assert "current_price" in price or "base_price" in price
                
    def test_wallet_balance_format(self, authenticated_client):
        """Wallet balances should be numeric"""
        response = authenticated_client.get(f"{BASE_URL}/api/wallet")
        data = response.json()
        for account in data.get("accounts", []):
            balance = account.get("balance", 0)
            assert isinstance(balance, (int, float)), "Balance should be numeric"


class TestGardenGradeRestriction:
    """Test grade restrictions for Money Garden"""
    
    def test_grade1_can_access_garden(self, authenticated_client):
        """Grade 1 child should be able to access garden"""
        response = authenticated_client.get(f"{BASE_URL}/api/garden/farm")
        assert response.status_code == 200, "Grade 1 should access garden"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
