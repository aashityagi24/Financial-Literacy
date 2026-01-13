"""
Test Admin Store and Investment Management APIs
Tests for:
- Admin login with email/password
- Store Management: Categories and Items CRUD
- Investment Management: Plants and Stocks CRUD
- Market Day Simulation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_success(self):
        """Test successful admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user data"
        assert "session_token" in data, "Response should contain session_token"
        assert data["user"]["role"] == "admin", "User role should be admin"
        assert data["user"]["email"] == ADMIN_EMAIL, "Email should match"
        print(f"✅ Admin login successful, session_token: {data['session_token'][:20]}...")
    
    def test_admin_login_invalid_email(self):
        """Test admin login with invalid email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": "wrong@email.com", "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid email correctly rejected")
    
    def test_admin_login_invalid_password(self):
        """Test admin login with invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid password correctly rejected")


@pytest.fixture(scope="module")
def admin_session():
    """Get admin session token for authenticated requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/admin-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    session = requests.Session()
    session.cookies.set("session_token", data["session_token"])
    session.headers.update({"Authorization": f"Bearer {data['session_token']}"})
    return session


class TestStoreCategories:
    """Test Store Category CRUD operations"""
    
    created_category_id = None
    
    def test_get_categories_empty_or_list(self, admin_session):
        """Test getting store categories"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Got {len(data)} store categories")
    
    def test_create_category(self, admin_session):
        """Test creating a store category"""
        category_data = {
            "name": "TEST_Vegetable Market",
            "description": "Fresh vegetables for kids to buy",
            "icon": "🥕",
            "color": "#06D6A0",
            "order": 0,
            "is_active": True
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/store/categories",
            json=category_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "category_id" in data, "Response should contain category_id"
        TestStoreCategories.created_category_id = data["category_id"]
        print(f"✅ Created category: {data['category_id']}")
    
    def test_verify_category_created(self, admin_session):
        """Verify the category was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/categories")
        assert response.status_code == 200
        
        data = response.json()
        category = next((c for c in data if c.get("category_id") == TestStoreCategories.created_category_id), None)
        assert category is not None, "Created category should exist in list"
        assert category["name"] == "TEST_Vegetable Market"
        assert category["icon"] == "🥕"
        assert category["color"] == "#06D6A0"
        print(f"✅ Category verified in database")
    
    def test_update_category(self, admin_session):
        """Test updating a store category"""
        if not TestStoreCategories.created_category_id:
            pytest.skip("No category to update")
        
        update_data = {
            "name": "TEST_Updated Vegetable Market",
            "description": "Updated description"
        }
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/store/categories/{TestStoreCategories.created_category_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Category updated successfully")
    
    def test_verify_category_updated(self, admin_session):
        """Verify the category update was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/categories")
        assert response.status_code == 200
        
        data = response.json()
        category = next((c for c in data if c.get("category_id") == TestStoreCategories.created_category_id), None)
        assert category is not None
        assert category["name"] == "TEST_Updated Vegetable Market"
        print("✅ Category update verified")


class TestStoreItems:
    """Test Store Item CRUD operations"""
    
    created_item_id = None
    
    def test_get_items_empty_or_list(self, admin_session):
        """Test getting store items"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Got {len(data)} store items")
    
    def test_create_item(self, admin_session):
        """Test creating a store item"""
        if not TestStoreCategories.created_category_id:
            pytest.skip("No category available for item")
        
        item_data = {
            "category_id": TestStoreCategories.created_category_id,
            "name": "TEST_Fresh Carrots",
            "description": "Crunchy orange carrots - good for your eyes!",
            "price": 5.0,
            "min_grade": 0,
            "max_grade": 5,
            "stock": -1,
            "is_active": True
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/store/items",
            json=item_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "item_id" in data, "Response should contain item_id"
        TestStoreItems.created_item_id = data["item_id"]
        print(f"✅ Created item: {data['item_id']}")
    
    def test_verify_item_created(self, admin_session):
        """Verify the item was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/items")
        assert response.status_code == 200
        
        data = response.json()
        item = next((i for i in data if i.get("item_id") == TestStoreItems.created_item_id), None)
        assert item is not None, "Created item should exist in list"
        assert item["name"] == "TEST_Fresh Carrots"
        assert item["price"] == 5.0
        print("✅ Item verified in database")
    
    def test_update_item(self, admin_session):
        """Test updating a store item"""
        if not TestStoreItems.created_item_id:
            pytest.skip("No item to update")
        
        update_data = {
            "name": "TEST_Updated Fresh Carrots",
            "price": 7.5
        }
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/store/items/{TestStoreItems.created_item_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Item updated successfully")
    
    def test_verify_item_updated(self, admin_session):
        """Verify the item update was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/items")
        assert response.status_code == 200
        
        data = response.json()
        item = next((i for i in data if i.get("item_id") == TestStoreItems.created_item_id), None)
        assert item is not None
        assert item["name"] == "TEST_Updated Fresh Carrots"
        assert item["price"] == 7.5
        print("✅ Item update verified")
    
    def test_delete_item(self, admin_session):
        """Test deleting a store item"""
        if not TestStoreItems.created_item_id:
            pytest.skip("No item to delete")
        
        response = admin_session.delete(
            f"{BASE_URL}/api/admin/store/items/{TestStoreItems.created_item_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Item deleted successfully")
    
    def test_verify_item_deleted(self, admin_session):
        """Verify the item was deleted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/store/items")
        assert response.status_code == 200
        
        data = response.json()
        item = next((i for i in data if i.get("item_id") == TestStoreItems.created_item_id), None)
        assert item is None, "Deleted item should not exist"
        print("✅ Item deletion verified")


class TestInvestmentPlants:
    """Test Investment Plant CRUD operations (for K-2 grades)"""
    
    created_plant_id = None
    
    def test_get_plants_empty_or_list(self, admin_session):
        """Test getting investment plants"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/plants")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Got {len(data)} investment plants")
    
    def test_create_plant(self, admin_session):
        """Test creating an investment plant"""
        plant_data = {
            "name": "TEST_Sunflower Seeds",
            "description": "Bright yellow sunflowers that grow tall!",
            "base_price": 10.0,
            "growth_rate_min": 0.02,
            "growth_rate_max": 0.08,
            "min_lot_size": 1,
            "maturity_days": 7,
            "is_active": True
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/investments/plants",
            json=plant_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plant_id" in data, "Response should contain plant_id"
        TestInvestmentPlants.created_plant_id = data["plant_id"]
        print(f"✅ Created plant: {data['plant_id']}")
    
    def test_verify_plant_created(self, admin_session):
        """Verify the plant was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/plants")
        assert response.status_code == 200
        
        data = response.json()
        plant = next((p for p in data if p.get("plant_id") == TestInvestmentPlants.created_plant_id), None)
        assert plant is not None, "Created plant should exist in list"
        assert plant["name"] == "TEST_Sunflower Seeds"
        assert plant["base_price"] == 10.0
        assert plant["min_lot_size"] == 1
        print("✅ Plant verified in database")
    
    def test_update_plant(self, admin_session):
        """Test updating an investment plant"""
        if not TestInvestmentPlants.created_plant_id:
            pytest.skip("No plant to update")
        
        update_data = {
            "name": "TEST_Updated Sunflower Seeds",
            "base_price": 15.0
        }
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/investments/plants/{TestInvestmentPlants.created_plant_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Plant updated successfully")
    
    def test_verify_plant_updated(self, admin_session):
        """Verify the plant update was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/plants")
        assert response.status_code == 200
        
        data = response.json()
        plant = next((p for p in data if p.get("plant_id") == TestInvestmentPlants.created_plant_id), None)
        assert plant is not None
        assert plant["name"] == "TEST_Updated Sunflower Seeds"
        assert plant["base_price"] == 15.0
        print("✅ Plant update verified")
    
    def test_delete_plant(self, admin_session):
        """Test deleting an investment plant"""
        if not TestInvestmentPlants.created_plant_id:
            pytest.skip("No plant to delete")
        
        response = admin_session.delete(
            f"{BASE_URL}/api/admin/investments/plants/{TestInvestmentPlants.created_plant_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Plant deleted successfully")


class TestInvestmentStocks:
    """Test Investment Stock CRUD operations (for grades 3-5)"""
    
    created_stock_id = None
    
    def test_get_stocks_empty_or_list(self, admin_session):
        """Test getting investment stocks"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Got {len(data)} investment stocks")
    
    def test_create_stock(self, admin_session):
        """Test creating an investment stock"""
        stock_data = {
            "name": "TEST_TechCo Inc.",
            "ticker": "TTCO",
            "description": "A fun technology company for kids!",
            "base_price": 25.0,
            "volatility": 0.05,
            "min_lot_size": 1,
            "is_active": True
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/investments/stocks",
            json=stock_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stock_id" in data, "Response should contain stock_id"
        TestInvestmentStocks.created_stock_id = data["stock_id"]
        print(f"✅ Created stock: {data['stock_id']}")
    
    def test_verify_stock_created(self, admin_session):
        """Verify the stock was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        stock = next((s for s in data if s.get("stock_id") == TestInvestmentStocks.created_stock_id), None)
        assert stock is not None, "Created stock should exist in list"
        assert stock["name"] == "TEST_TechCo Inc."
        assert stock["ticker"] == "TTCO"
        assert stock["base_price"] == 25.0
        assert stock["current_price"] == 25.0, "Current price should equal base price initially"
        print("✅ Stock verified in database")
    
    def test_get_stock_history(self, admin_session):
        """Test getting stock price history"""
        if not TestInvestmentStocks.created_stock_id:
            pytest.skip("No stock to get history for")
        
        response = admin_session.get(
            f"{BASE_URL}/api/admin/investments/stocks/{TestInvestmentStocks.created_stock_id}/history"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least initial price in history"
        print(f"✅ Got {len(data)} price history entries")
    
    def test_update_stock(self, admin_session):
        """Test updating an investment stock"""
        if not TestInvestmentStocks.created_stock_id:
            pytest.skip("No stock to update")
        
        update_data = {
            "name": "TEST_Updated TechCo Inc.",
            "current_price": 30.0
        }
        
        response = admin_session.put(
            f"{BASE_URL}/api/admin/investments/stocks/{TestInvestmentStocks.created_stock_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Stock updated successfully")
    
    def test_verify_stock_updated(self, admin_session):
        """Verify the stock update was persisted"""
        response = admin_session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        stock = next((s for s in data if s.get("stock_id") == TestInvestmentStocks.created_stock_id), None)
        assert stock is not None
        assert stock["name"] == "TEST_Updated TechCo Inc."
        assert stock["current_price"] == 30.0
        print("✅ Stock update verified")
    
    def test_simulate_market_day(self, admin_session):
        """Test simulating a market day"""
        response = admin_session.post(f"{BASE_URL}/api/admin/investments/simulate-day")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "date" in data
        print(f"✅ Market day simulated: {data['message']}")
    
    def test_delete_stock(self, admin_session):
        """Test deleting an investment stock"""
        if not TestInvestmentStocks.created_stock_id:
            pytest.skip("No stock to delete")
        
        response = admin_session.delete(
            f"{BASE_URL}/api/admin/investments/stocks/{TestInvestmentStocks.created_stock_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Stock deleted successfully")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_category(self, admin_session):
        """Delete the test category (and any remaining items)"""
        if TestStoreCategories.created_category_id:
            response = admin_session.delete(
                f"{BASE_URL}/api/admin/store/categories/{TestStoreCategories.created_category_id}"
            )
            assert response.status_code == 200
            print("✅ Test category cleaned up")
        else:
            print("⏭️ No test category to clean up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
