"""
Test Store and Investment features for child-facing pages
Tests admin-created items appearing in child Store and Investment pages
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@learnersplanet.com"
        
    def test_admin_login_wrong_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestStoreCategories:
    """Test store categories API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_store_categories(self):
        """Test getting store categories"""
        response = requests.get(f"{BASE_URL}/api/store/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 2 categories (Veggie Shop, Fruit Shop)
        assert len(data) >= 2
        
        # Check category structure
        for cat in data:
            assert "category_id" in cat
            assert "name" in cat
            assert "description" in cat
            assert "icon" in cat
            assert "color" in cat
            
    def test_store_categories_have_expected_names(self):
        """Test that expected categories exist"""
        response = requests.get(f"{BASE_URL}/api/store/categories", headers=self.headers)
        data = response.json()
        category_names = [cat["name"] for cat in data]
        
        # Check for expected categories
        assert any("Veggie" in name for name in category_names), "Veggie Shop category should exist"
        assert any("Fruit" in name for name in category_names), "Fruit Shop category should exist"


class TestStoreItemsByCategory:
    """Test store items by category API - main feature being tested"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_items_by_category_for_admin(self):
        """Test that admin (with null grade) can see all items"""
        response = requests.get(f"{BASE_URL}/api/store/items-by-category", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have categories with items
        assert len(data) >= 2
        
        # Each category should have items array
        for cat in data:
            assert "items" in cat
            assert isinstance(cat["items"], list)
            
    def test_items_have_expected_products(self):
        """Test that expected items exist (Carrots, Tomatoes, Mangoes)"""
        response = requests.get(f"{BASE_URL}/api/store/items-by-category", headers=self.headers)
        data = response.json()
        
        # Flatten all items
        all_items = []
        for cat in data:
            all_items.extend(cat.get("items", []))
        
        item_names = [item["name"] for item in all_items]
        
        # Check for expected items
        assert any("Carrot" in name for name in item_names), "Carrots should exist"
        assert any("Tomato" in name for name in item_names), "Tomatoes should exist"
        assert any("Mango" in name for name in item_names), "Mangoes should exist"
        
    def test_items_have_unit_field(self):
        """Test that items have unit field for price display"""
        response = requests.get(f"{BASE_URL}/api/store/items-by-category", headers=self.headers)
        data = response.json()
        
        # Check items have unit field
        for cat in data:
            for item in cat.get("items", []):
                # Unit field should exist (may be null for older items)
                assert "price" in item
                # If unit exists, it should be a valid value
                if "unit" in item and item["unit"]:
                    assert item["unit"] in ["piece", "kg", "gram", "litre", "ml", "pack", "dozen", "unit"]


class TestInvestmentPlants:
    """Test investment plants API for Money Garden (K-2 grades)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_investment_plants(self):
        """Test getting investment plants"""
        response = requests.get(f"{BASE_URL}/api/investments/plants", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have at least Sunflower Seeds
        
    def test_sunflower_seeds_exists(self):
        """Test that Sunflower Seeds plant exists with correct properties"""
        response = requests.get(f"{BASE_URL}/api/investments/plants", headers=self.headers)
        data = response.json()
        
        sunflower = next((p for p in data if "Sunflower" in p["name"]), None)
        assert sunflower is not None, "Sunflower Seeds should exist"
        
        # Check properties
        assert sunflower["base_price"] == 10.0, "Price should be ₹10/seed"
        assert sunflower["min_lot_size"] == 3, "Min lot size should be 3"
        assert "image_url" in sunflower
        assert sunflower["is_active"] == True


class TestInvestmentStocks:
    """Test investment stocks API for Stock Market (grades 3-5)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_investment_stocks(self):
        """Test getting investment stocks"""
        response = requests.get(f"{BASE_URL}/api/investments/stocks", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have at least one stock
        
    def test_stock_has_required_fields(self):
        """Test that stocks have required fields"""
        response = requests.get(f"{BASE_URL}/api/investments/stocks", headers=self.headers)
        data = response.json()
        
        for stock in data:
            assert "stock_id" in stock
            assert "name" in stock
            assert "ticker" in stock
            assert "current_price" in stock
            assert "base_price" in stock
            assert "min_lot_size" in stock


class TestInvestmentPortfolio:
    """Test investment portfolio API - returns holdings array correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_portfolio_returns_holdings_array(self):
        """Test that portfolio API returns holdings array"""
        response = requests.get(f"{BASE_URL}/api/investments/portfolio", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "holdings" in data
        assert isinstance(data["holdings"], list)
        assert "total_invested" in data
        assert "total_current_value" in data
        assert "total_profit_loss" in data


class TestInvestmentBuyAPI:
    """Test investment buy API uses correct field name 'investment_type'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get a plant ID for testing
        plants_response = requests.get(f"{BASE_URL}/api/investments/plants", headers=self.headers)
        plants = plants_response.json()
        if plants:
            self.plant_id = plants[0]["plant_id"]
            self.min_lot = plants[0].get("min_lot_size", 1)
        else:
            self.plant_id = None
            self.min_lot = 1
    
    def test_buy_with_investment_type_field(self):
        """Test that buy API accepts investment_type field"""
        if not self.plant_id:
            pytest.skip("No plants available for testing")
            
        # This should work with investment_type
        response = requests.post(f"{BASE_URL}/api/investments/buy", 
            headers=self.headers,
            json={
                "investment_type": "plant",
                "asset_id": self.plant_id,
                "quantity": self.min_lot
            }
        )
        # Should either succeed or fail due to insufficient funds (not validation error)
        assert response.status_code in [200, 400]
        if response.status_code == 400:
            # Should be insufficient funds, not invalid field
            assert "Insufficient" in response.json().get("detail", "") or "funds" in response.json().get("detail", "").lower()


class TestInvestmentSellAPI:
    """Test investment sell API uses holding_id"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_sell_with_holding_id_field(self):
        """Test that sell API accepts holding_id field"""
        # Try to sell with a non-existent holding_id
        response = requests.post(f"{BASE_URL}/api/investments/sell", 
            headers=self.headers,
            json={
                "holding_id": "non_existent_holding"
            }
        )
        # Should return 404 (not found), not validation error
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()


class TestWalletAPI:
    """Test wallet API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        self.admin_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_wallet(self):
        """Test getting wallet accounts"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "accounts" in data
        assert "total_balance" in data
        assert isinstance(data["accounts"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
