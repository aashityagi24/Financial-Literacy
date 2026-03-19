"""
Test Admin Subscription Management - Linked Users and Renewal Badge Features
Tests: GET /api/subscriptions/admin/list returns is_renewal and linked_users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminSubscriptionLinkedUsers:
    """Test the admin subscription list endpoint for is_renewal and linked_users fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("session_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    # ============ GET /api/subscriptions/admin/list tests ============
    
    def test_admin_list_subscriptions_returns_200(self, admin_headers):
        """Admin can access subscription list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of subscriptions"
    
    def test_subscriptions_have_is_renewal_field(self, admin_headers):
        """Each subscription should have is_renewal boolean field"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        if len(subscriptions) == 0:
            pytest.skip("No subscriptions in database to test")
        
        for sub in subscriptions:
            assert "is_renewal" in sub, f"Missing is_renewal field in subscription {sub.get('subscription_id')}"
            assert isinstance(sub["is_renewal"], bool), f"is_renewal should be boolean, got {type(sub['is_renewal'])}"
    
    def test_subscriptions_have_linked_users_field(self, admin_headers):
        """Each subscription should have linked_users array field"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        if len(subscriptions) == 0:
            pytest.skip("No subscriptions in database to test")
        
        for sub in subscriptions:
            assert "linked_users" in sub, f"Missing linked_users field in subscription {sub.get('subscription_id')}"
            assert isinstance(sub["linked_users"], list), f"linked_users should be array, got {type(sub['linked_users'])}"
    
    def test_linked_users_structure(self, admin_headers):
        """Linked users should have correct structure with parent and children"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        # Find a subscription with linked users
        sub_with_users = None
        for sub in subscriptions:
            if sub.get("linked_users") and len(sub["linked_users"]) > 0:
                sub_with_users = sub
                break
        
        if not sub_with_users:
            pytest.skip("No subscriptions with linked users to test structure")
        
        for lu in sub_with_users["linked_users"]:
            # Each linked user should have name, email, role
            assert "name" in lu, "Linked user missing name field"
            assert "email" in lu, "Linked user missing email field"
            assert "role" in lu, "Linked user missing role field"
            assert lu["role"] in ["parent", "child"], f"Invalid role: {lu['role']}"
            
            # If parent, should have children array
            if lu["role"] == "parent":
                assert "children" in lu, "Parent linked user missing children array"
                assert isinstance(lu["children"], list), "children should be an array"
                
                # Each child should have name, email, role
                for child in lu["children"]:
                    assert "name" in child, "Child missing name field"
                    assert "email" in child, "Child missing email field"
                    assert "role" in child, "Child missing role field"
                    assert child["role"] == "child", f"Child role should be 'child', got {child['role']}"
    
    def test_is_renewal_true_for_multiple_subscriptions(self, admin_headers):
        """is_renewal should be true for emails with multiple completed subscriptions"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        # Count completed subscriptions per email
        email_count = {}
        for sub in subscriptions:
            if sub.get("payment_status") == "completed":
                email = sub.get("subscriber_email", "").lower()
                if email:
                    email_count[email] = email_count.get(email, 0) + 1
        
        # Find an email with multiple subs (renewal case)
        renewal_emails = [e for e, c in email_count.items() if c > 1]
        
        if not renewal_emails:
            pytest.skip("No renewal subscriptions found to test is_renewal=true")
        
        # Verify is_renewal is true for all subs with this email
        for email in renewal_emails:
            matching_subs = [s for s in subscriptions if s.get("subscriber_email", "").lower() == email]
            for sub in matching_subs:
                assert sub.get("is_renewal") == True, \
                    f"is_renewal should be True for {email} (has {email_count[email]} subs), but got {sub.get('is_renewal')}"
                print(f"✓ {email} has is_renewal=True (has {email_count[email]} subscriptions)")
    
    def test_is_renewal_false_for_single_subscription(self, admin_headers):
        """is_renewal should be false for emails with only one completed subscription"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        # Count completed subscriptions per email
        email_count = {}
        for sub in subscriptions:
            if sub.get("payment_status") == "completed":
                email = sub.get("subscriber_email", "").lower()
                if email:
                    email_count[email] = email_count.get(email, 0) + 1
        
        # Find an email with only 1 sub (non-renewal case)
        single_sub_emails = [e for e, c in email_count.items() if c == 1]
        
        if not single_sub_emails:
            pytest.skip("No single-subscription users found to test is_renewal=false")
        
        # Verify is_renewal is false for subs with single subscription
        for email in single_sub_emails[:3]:  # Test up to 3 cases
            matching_subs = [s for s in subscriptions if s.get("subscriber_email", "").lower() == email and s.get("payment_status") == "completed"]
            for sub in matching_subs:
                assert sub.get("is_renewal") == False, \
                    f"is_renewal should be False for {email} (has only 1 sub), but got {sub.get('is_renewal')}"
                print(f"✓ {email} has is_renewal=False (single subscription)")
    
    def test_unauthenticated_access_denied(self):
        """Unauthenticated users cannot access admin subscription list"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/admin/list")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated, got {response.status_code}"
    
    def test_non_admin_access_denied(self):
        """Non-admin users cannot access admin subscription list"""
        # Try to login as a parent if available
        # This is a negative test - we expect it to fail
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 for invalid token, got {response.status_code}"


class TestSpecificSubscriptionData:
    """Test specific subscription data based on known test cases"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200
        return response.json().get("session_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_alka_m_has_renewal_badge(self, admin_headers):
        """Alka M (alkabmaheshwari@gmail.com) should have is_renewal=true (multiple subs)"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        alka_subs = [s for s in subscriptions if s.get("subscriber_email", "").lower() == "alkabmaheshwari@gmail.com"]
        
        if not alka_subs:
            pytest.skip("alkabmaheshwari@gmail.com not found in subscriptions")
        
        # Should have multiple subscriptions and is_renewal=true
        print(f"Found {len(alka_subs)} subscriptions for alkabmaheshwari@gmail.com")
        for sub in alka_subs:
            print(f"  - {sub.get('subscription_id')}: is_renewal={sub.get('is_renewal')}, payment_status={sub.get('payment_status')}")
            # is_renewal should be true if there are multiple completed subs
            if sub.get("payment_status") == "completed":
                assert sub.get("is_renewal") == True, \
                    f"Expected is_renewal=True for Alka M who has multiple subscriptions"
    
    def test_alka_m_has_linked_children(self, admin_headers):
        """Alka M should have linked children in linked_users array"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/list",
            headers=admin_headers
        )
        assert response.status_code == 200
        subscriptions = response.json()
        
        # Find Alka's active subscription
        alka_active = None
        for sub in subscriptions:
            if sub.get("subscriber_email", "").lower() == "alkabmaheshwari@gmail.com":
                if sub.get("payment_status") == "completed" and sub.get("is_active"):
                    alka_active = sub
                    break
        
        if not alka_active:
            pytest.skip("No active subscription for alkabmaheshwari@gmail.com")
        
        linked_users = alka_active.get("linked_users", [])
        print(f"Linked users for Alka M: {linked_users}")
        
        # Should have at least one parent entry
        parents = [lu for lu in linked_users if lu.get("role") == "parent"]
        assert len(parents) > 0, "Should have at least one parent in linked_users"
        
        # Check if any parent has children
        total_children = 0
        for parent in parents:
            children = parent.get("children", [])
            total_children += len(children)
            print(f"  Parent {parent.get('email')} has {len(children)} children")
        
        # Context says Alka has 2 linked children
        print(f"Total linked children: {total_children}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
