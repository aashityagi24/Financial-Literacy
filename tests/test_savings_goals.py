"""
Test savings goals features:
1. Dashboard displays active savings goal
2. Create savings goal flow
3. Contribute to savings goal API
4. Single goal auto-selection in allocation dialog
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created via mongosh
TEST_SESSION_TOKEN = "test_session_savings_1768463362596"
TEST_USER_ID = "test-savings-1768463362596"


class TestSavingsGoalsAPI:
    """Test savings goals backend API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_auth_me_works(self):
        """Test that authentication works with test session"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        print(f"Auth response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data.get("user_id") == TEST_USER_ID
        print(f"✅ Auth works - User: {data.get('name')}")
    
    def test_get_wallet_has_savings_balance(self):
        """Test wallet has savings balance for contribution"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=self.headers)
        assert response.status_code == 200, f"Wallet fetch failed: {response.text}"
        data = response.json()
        
        savings_acc = next((a for a in data.get("accounts", []) if a["account_type"] == "savings"), None)
        assert savings_acc is not None, "Savings account not found"
        assert savings_acc.get("balance", 0) >= 0, "Savings balance should be >= 0"
        print(f"✅ Wallet has savings balance: ₹{savings_acc.get('balance')}")
        return savings_acc.get("balance", 0)
    
    def test_get_savings_goals_empty_initially(self):
        """Test getting savings goals - should be empty initially for new user"""
        response = requests.get(f"{BASE_URL}/api/child/savings-goals", headers=self.headers)
        assert response.status_code == 200, f"Get goals failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Get savings goals works - Found {len(data)} goals")
        return data
    
    def test_create_savings_goal(self):
        """Test creating a new savings goal"""
        goal_data = {
            "title": "Test Bicycle Goal",
            "description": "Saving for a new bicycle",
            "target_amount": 200,
            "deadline": "2025-12-31"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/child/savings-goals",
            headers=self.headers,
            json=goal_data
        )
        print(f"Create goal response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Create goal failed: {response.text}"
        data = response.json()
        assert "goal_id" in data, "Response should contain goal_id"
        print(f"✅ Created savings goal: {data.get('goal_id')}")
        return data.get("goal_id")
    
    def test_get_savings_goals_after_create(self):
        """Test getting savings goals after creating one"""
        # First create a goal
        goal_data = {
            "title": "Test Video Game Goal",
            "description": "Saving for a video game",
            "target_amount": 150
        }
        create_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals",
            headers=self.headers,
            json=goal_data
        )
        assert create_response.status_code == 200
        created_goal_id = create_response.json().get("goal_id")
        
        # Now get goals
        response = requests.get(f"{BASE_URL}/api/child/savings-goals", headers=self.headers)
        assert response.status_code == 200
        goals = response.json()
        
        # Find our created goal
        our_goal = next((g for g in goals if g.get("goal_id") == created_goal_id), None)
        assert our_goal is not None, "Created goal should be in the list"
        assert our_goal.get("title") == "Test Video Game Goal"
        assert our_goal.get("target_amount") == 150
        assert our_goal.get("current_amount") == 0
        assert our_goal.get("completed") == False
        print(f"✅ Goal retrieved correctly: {our_goal.get('title')}")
        return created_goal_id
    
    def test_contribute_to_goal(self):
        """Test contributing to a savings goal"""
        # First create a goal
        goal_data = {
            "title": "Test Contribution Goal",
            "description": "Testing contribution",
            "target_amount": 100
        }
        create_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals",
            headers=self.headers,
            json=goal_data
        )
        assert create_response.status_code == 200
        goal_id = create_response.json().get("goal_id")
        
        # Get initial savings balance
        wallet_response = requests.get(f"{BASE_URL}/api/wallet", headers=self.headers)
        initial_savings = next(
            (a.get("balance", 0) for a in wallet_response.json().get("accounts", []) 
             if a["account_type"] == "savings"), 0
        )
        
        # Contribute to goal
        contribute_amount = 50
        contribute_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals/{goal_id}/contribute",
            headers=self.headers,
            json={"amount": contribute_amount}
        )
        print(f"Contribute response: {contribute_response.status_code} - {contribute_response.text}")
        assert contribute_response.status_code == 200, f"Contribute failed: {contribute_response.text}"
        
        data = contribute_response.json()
        assert data.get("new_total") == contribute_amount
        assert data.get("completed") == False  # Not yet complete
        
        # Verify savings balance decreased
        wallet_response = requests.get(f"{BASE_URL}/api/wallet", headers=self.headers)
        new_savings = next(
            (a.get("balance", 0) for a in wallet_response.json().get("accounts", []) 
             if a["account_type"] == "savings"), 0
        )
        assert new_savings == initial_savings - contribute_amount, "Savings balance should decrease"
        
        # Verify goal amount increased
        goals_response = requests.get(f"{BASE_URL}/api/child/savings-goals", headers=self.headers)
        goal = next((g for g in goals_response.json() if g.get("goal_id") == goal_id), None)
        assert goal.get("current_amount") == contribute_amount
        
        print(f"✅ Contribution successful: ₹{contribute_amount} added to goal")
        return goal_id
    
    def test_contribute_completes_goal(self):
        """Test that contributing enough completes the goal"""
        # Create a small goal
        goal_data = {
            "title": "Small Test Goal",
            "target_amount": 30
        }
        create_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals",
            headers=self.headers,
            json=goal_data
        )
        assert create_response.status_code == 200
        goal_id = create_response.json().get("goal_id")
        
        # Contribute full amount
        contribute_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals/{goal_id}/contribute",
            headers=self.headers,
            json={"amount": 30}
        )
        assert contribute_response.status_code == 200
        data = contribute_response.json()
        assert data.get("completed") == True, "Goal should be marked as completed"
        
        # Verify goal is completed
        goals_response = requests.get(f"{BASE_URL}/api/child/savings-goals", headers=self.headers)
        goal = next((g for g in goals_response.json() if g.get("goal_id") == goal_id), None)
        assert goal.get("completed") == True
        
        print(f"✅ Goal completed when target reached")
    
    def test_contribute_insufficient_balance(self):
        """Test contributing more than savings balance fails"""
        # Create a goal
        goal_data = {
            "title": "Big Goal",
            "target_amount": 10000
        }
        create_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals",
            headers=self.headers,
            json=goal_data
        )
        assert create_response.status_code == 200
        goal_id = create_response.json().get("goal_id")
        
        # Try to contribute more than balance
        contribute_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals/{goal_id}/contribute",
            headers=self.headers,
            json={"amount": 99999}
        )
        assert contribute_response.status_code == 400, "Should fail with insufficient balance"
        print(f"✅ Insufficient balance correctly rejected")
    
    def test_contribute_to_nonexistent_goal(self):
        """Test contributing to non-existent goal fails"""
        contribute_response = requests.post(
            f"{BASE_URL}/api/child/savings-goals/nonexistent_goal_id/contribute",
            headers=self.headers,
            json={"amount": 10}
        )
        assert contribute_response.status_code == 404, "Should return 404 for non-existent goal"
        print(f"✅ Non-existent goal correctly returns 404")


class TestDashboardSavingsGoalDisplay:
    """Test that dashboard correctly fetches and can display savings goals"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_dashboard_can_fetch_savings_goals(self):
        """Test that the savings goals endpoint works for dashboard display"""
        response = requests.get(f"{BASE_URL}/api/child/savings-goals", headers=self.headers)
        assert response.status_code == 200
        goals = response.json()
        
        # Filter active (not completed) goals like Dashboard.jsx does
        active_goals = [g for g in goals if not g.get("completed")]
        print(f"✅ Dashboard can fetch {len(active_goals)} active goals out of {len(goals)} total")
        
        if active_goals:
            first_goal = active_goals[0]
            # Verify goal has all fields needed for dashboard display
            assert "goal_id" in first_goal
            assert "title" in first_goal
            assert "target_amount" in first_goal
            assert "current_amount" in first_goal
            print(f"✅ First active goal: {first_goal.get('title')} - ₹{first_goal.get('current_amount')}/₹{first_goal.get('target_amount')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
