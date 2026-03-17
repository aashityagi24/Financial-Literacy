"""
Test suite for Razorpay Subscription feature
Testing: Plan pricing, order creation, payment verification, access check, admin management
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coinquest-preview.preview.emergentagent.com')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_session(api_client):
    """Admin login session"""
    response = api_client.post(f"{BASE_URL}/api/auth/admin-login", json={
        "email": "admin@learnersplanet.com",
        "password": "finlit@2026"
    })
    if response.status_code == 200:
        data = response.json()
        token = data.get("session_token")
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        return api_client
    pytest.skip("Admin login failed")


# ============== PUBLIC ENDPOINT TESTS ==============

class TestPublicPlanEndpoints:
    """Test public plan pricing endpoint (no auth required)"""
    
    def test_get_plans_returns_all_pricing(self, api_client):
        """GET /api/subscriptions/plans - returns plan pricing for all types and durations"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check top-level structure
        assert "plans" in data, "Response should contain 'plans' key"
        assert "max_children" in data, "Response should contain 'max_children' key"
        assert "plan_types" in data, "Response should contain 'plan_types' key"
        
        # Check max_children
        assert data["max_children"] == 5, "Max children should be 5"
        
        # Check plan types
        assert "single_parent" in data["plan_types"]
        assert "two_parents" in data["plan_types"]
        assert data["plan_types"]["single_parent"]["max_parents"] == 1
        assert data["plan_types"]["two_parents"]["max_parents"] == 2
        
        # Check plans structure
        plans = data["plans"]
        assert "single_parent" in plans
        assert "two_parents" in plans
        
        # Check all durations exist for single_parent
        for duration in ["1_day", "1_month", "6_months", "1_year"]:
            assert duration in plans["single_parent"], f"Missing duration {duration} for single_parent"
            assert "base_price" in plans["single_parent"][duration]
            assert "per_child_price" in plans["single_parent"][duration]
            assert "duration_label" in plans["single_parent"][duration]
            assert "duration_days" in plans["single_parent"][duration]
        
        # Check all durations exist for two_parents
        for duration in ["1_day", "1_month", "6_months", "1_year"]:
            assert duration in plans["two_parents"], f"Missing duration {duration} for two_parents"
        
        print(f"Plans endpoint returned correct structure with {len(plans)} plan types")


class TestCreateOrderEndpoint:
    """Test Razorpay order creation endpoint"""
    
    def test_create_order_success(self, api_client):
        """POST /api/subscriptions/create-order - creates Razorpay order with valid data"""
        unique_id = uuid.uuid4().hex[:8]
        order_data = {
            "plan_type": "single_parent",
            "duration": "1_month",
            "num_children": 2,
            "subscriber_name": f"Test User {unique_id}",
            "subscriber_email": f"test_{unique_id}@example.com",
            "subscriber_phone": "+919876543210"
        }
        
        response = api_client.post(f"{BASE_URL}/api/subscriptions/create-order", json=order_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check response structure
        assert "order_id" in data, "Response should contain 'order_id'"
        assert "amount" in data, "Response should contain 'amount'"
        assert "currency" in data, "Response should contain 'currency'"
        assert "subscription_id" in data, "Response should contain 'subscription_id'"
        assert "key_id" in data, "Response should contain 'key_id'"
        
        # Verify order_id format (Razorpay format: order_xxx)
        assert data["order_id"].startswith("order_"), "Order ID should start with 'order_'"
        
        # Verify currency
        assert data["currency"] == "INR", "Currency should be INR"
        
        # Amount should be in paise (base 500 + 1 extra child * 200 = 700 * 100 = 70000 paise)
        # Based on DEFAULT_PLANS: 1_month single_parent = base 500 + 200 per extra child
        assert data["amount"] > 0, "Amount should be positive"
        
        print(f"Order created: {data['order_id']}, amount: {data['amount']} paise, subscription: {data['subscription_id']}")
    
    def test_create_order_invalid_plan_type(self, api_client):
        """POST /api/subscriptions/create-order - returns 400 for invalid plan type"""
        order_data = {
            "plan_type": "invalid_plan",
            "duration": "1_month",
            "num_children": 1,
            "subscriber_name": "Test User",
            "subscriber_email": "test@example.com",
            "subscriber_phone": "+919876543210"
        }
        
        response = api_client.post(f"{BASE_URL}/api/subscriptions/create-order", json=order_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid plan type" in response.json().get("detail", "")
    
    def test_create_order_invalid_duration(self, api_client):
        """POST /api/subscriptions/create-order - returns 400 for invalid duration"""
        order_data = {
            "plan_type": "single_parent",
            "duration": "2_weeks",
            "num_children": 1,
            "subscriber_name": "Test User",
            "subscriber_email": "test@example.com",
            "subscriber_phone": "+919876543210"
        }
        
        response = api_client.post(f"{BASE_URL}/api/subscriptions/create-order", json=order_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid duration" in response.json().get("detail", "")
    
    def test_create_order_invalid_children_count(self, api_client):
        """POST /api/subscriptions/create-order - returns 400 for children count out of range"""
        order_data = {
            "plan_type": "single_parent",
            "duration": "1_month",
            "num_children": 10,  # Max is 5
            "subscriber_name": "Test User",
            "subscriber_email": "test@example.com",
            "subscriber_phone": "+919876543210"
        }
        
        response = api_client.post(f"{BASE_URL}/api/subscriptions/create-order", json=order_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Children count must be 1-5" in response.json().get("detail", "")


class TestVerifyPaymentEndpoint:
    """Test payment verification endpoint"""
    
    def test_verify_payment_invalid_signature(self, api_client):
        """POST /api/subscriptions/verify-payment - returns 400 for invalid signature"""
        verify_data = {
            "razorpay_order_id": "order_test123",
            "razorpay_payment_id": "pay_test123",
            "razorpay_signature": "invalid_signature_12345"
        }
        
        response = api_client.post(f"{BASE_URL}/api/subscriptions/verify-payment", json=verify_data)
        # Should return 400 or 404 (order not found since we're using fake order)
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"Invalid signature correctly rejected with status {response.status_code}")


class TestCheckAccessEndpoint:
    """Test subscription access check endpoint"""
    
    def test_check_access_no_subscription(self, api_client):
        """GET /api/subscriptions/check-access/{email} - returns has_access=false for non-subscriber"""
        test_email = f"nonexistent_{uuid.uuid4().hex[:8]}@example.com"
        response = api_client.get(f"{BASE_URL}/api/subscriptions/check-access/{test_email}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "has_access" in data, "Response should contain 'has_access' key"
        assert data["has_access"] == False, "Non-subscriber should have has_access=false"
        print(f"Access check for {test_email}: has_access={data['has_access']}")


# ============== ADMIN ENDPOINT TESTS ==============

class TestAdminSubscriptionEndpoints:
    """Test admin subscription management endpoints (requires admin auth)"""
    
    def test_admin_list_subscriptions(self, admin_session):
        """GET /api/subscriptions/admin/list - admin can list all subscriptions"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Admin list returned {len(data)} subscriptions")
    
    def test_admin_get_plan_config(self, admin_session):
        """GET /api/subscriptions/admin/plan-config - admin can get plan pricing config"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/plan-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check structure
        assert "single_parent" in data, "Config should contain 'single_parent'"
        assert "two_parents" in data, "Config should contain 'two_parents'"
        
        # Check each plan type has all durations
        for plan_type in ["single_parent", "two_parents"]:
            for duration in ["1_day", "1_month", "6_months", "1_year"]:
                assert duration in data[plan_type], f"Missing {duration} for {plan_type}"
                assert "base_price" in data[plan_type][duration]
                assert "per_child_price" in data[plan_type][duration]
        
        print(f"Admin plan config: single_parent 1_month base_price = {data['single_parent']['1_month']['base_price']}")
    
    def test_admin_update_plan_config(self, admin_session):
        """POST /api/subscriptions/admin/plan-config - admin can update plan pricing"""
        # First get current config
        get_response = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/plan-config")
        original_config = get_response.json()
        original_base = original_config["single_parent"]["1_day"]["base_price"]
        
        # Update with new price
        new_base_price = original_base + 10
        update_data = {
            "plan_type": "single_parent",
            "duration": "1_day",
            "base_price": new_base_price,
            "per_child_price": 49
        }
        
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/admin/plan-config", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("message") == "Plan pricing updated"
        
        # Verify the update
        verify_response = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/plan-config")
        updated_config = verify_response.json()
        assert updated_config["single_parent"]["1_day"]["base_price"] == new_base_price
        
        # Restore original
        restore_data = {
            "plan_type": "single_parent",
            "duration": "1_day",
            "base_price": original_base,
            "per_child_price": 49
        }
        admin_session.post(f"{BASE_URL}/api/subscriptions/admin/plan-config", json=restore_data)
        
        print(f"Admin updated and restored 1_day base_price: {original_base} -> {new_base_price} -> {original_base}")
    
    def test_admin_update_plan_config_invalid_plan_type(self, admin_session):
        """POST /api/subscriptions/admin/plan-config - returns 400 for invalid plan type"""
        update_data = {
            "plan_type": "invalid_plan",
            "duration": "1_day",
            "base_price": 100,
            "per_child_price": 50
        }
        
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/admin/plan-config", json=update_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestAdminToggleSubscription:
    """Test admin toggle subscription endpoint"""
    
    def test_admin_toggle_nonexistent_subscription(self, admin_session):
        """PUT /api/subscriptions/admin/{subscription_id}/toggle - returns 404 for non-existent subscription"""
        fake_sub_id = f"sub_nonexistent_{uuid.uuid4().hex[:8]}"
        response = admin_session.put(f"{BASE_URL}/api/subscriptions/admin/{fake_sub_id}/toggle")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "not found" in response.json().get("detail", "").lower()


class TestAdminUnauthorizedAccess:
    """Test that admin endpoints reject unauthorized access"""
    
    def test_admin_list_unauthorized(self, api_client):
        """GET /api/subscriptions/admin/list - returns 401/403 without admin auth"""
        # Clear any auth
        unauthenticated_client = requests.Session()
        unauthenticated_client.headers.update({"Content-Type": "application/json"})
        
        response = unauthenticated_client.get(f"{BASE_URL}/api/subscriptions/admin/list")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Admin list correctly rejected unauthorized access with {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
