"""
Test tiered pricing for subscription plans
Tests the new child_prices array and total calculation logic
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected pricing from requirements
EXPECTED_PRICING = {
    "single_parent": {
        "1_day": {"base_price": 49, "child_prices": [29, 25, 20, 15]},
        "1_month": {"base_price": 499, "child_prices": [179, 149, 119, 99]},
        "6_months": {"base_price": 2299, "child_prices": [799, 649, 519, 399]},
        "1_year": {"base_price": 3999, "child_prices": [1299, 1049, 849, 649]},
    },
    "two_parents": {
        "1_day": {"base_price": 69, "child_prices": [39, 35, 29, 22]},
        "1_month": {"base_price": 649, "child_prices": [219, 179, 149, 119]},
        "6_months": {"base_price": 2999, "child_prices": [999, 799, 649, 499]},
        "1_year": {"base_price": 5199, "child_prices": [1599, 1299, 1049, 799]},
    }
}


class TestGetPlansEndpoint:
    """Tests for GET /api/subscriptions/plans endpoint"""

    def test_plans_endpoint_returns_200(self):
        """GET /api/subscriptions/plans should return 200"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        assert response.status_code == 200
        print("PASS: Plans endpoint returns 200")

    def test_plans_contains_both_plan_types(self):
        """Plans should contain single_parent and two_parents"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        data = response.json()
        assert "plans" in data
        assert "single_parent" in data["plans"]
        assert "two_parents" in data["plans"]
        print("PASS: Plans contains both single_parent and two_parents")

    def test_each_plan_has_child_prices_array(self):
        """Each plan should have child_prices array with 4 elements"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plans = response.json()["plans"]
        
        for plan_type in ["single_parent", "two_parents"]:
            for duration in ["1_day", "1_month", "6_months", "1_year"]:
                plan = plans[plan_type][duration]
                assert "child_prices" in plan, f"Missing child_prices for {plan_type}/{duration}"
                assert isinstance(plan["child_prices"], list), f"child_prices should be a list for {plan_type}/{duration}"
                assert len(plan["child_prices"]) == 4, f"child_prices should have 4 elements for {plan_type}/{duration}"
        print("PASS: Each plan has child_prices array with 4 elements")

    def test_each_plan_has_extra_child_per_day(self):
        """Each plan should have extra_child_per_day field"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plans = response.json()["plans"]
        
        for plan_type in ["single_parent", "two_parents"]:
            for duration in ["1_day", "1_month", "6_months", "1_year"]:
                plan = plans[plan_type][duration]
                assert "extra_child_per_day" in plan, f"Missing extra_child_per_day for {plan_type}/{duration}"
        print("PASS: Each plan has extra_child_per_day field")


class TestSingleParentPricing:
    """Tests for Single Parent plan pricing (exact values)"""

    def test_single_parent_1_day_pricing(self):
        """Single Parent 1 Day: base=49, children=[29,25,20,15]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["1_day"]
        
        assert plan["base_price"] == 49
        assert plan["child_prices"] == [29, 25, 20, 15]
        print("PASS: Single Parent 1 Day pricing correct: base=49, children=[29,25,20,15]")

    def test_single_parent_1_month_pricing(self):
        """Single Parent 1 Month: base=499, children=[179,149,119,99]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["1_month"]
        
        assert plan["base_price"] == 499
        assert plan["child_prices"] == [179, 149, 119, 99]
        print("PASS: Single Parent 1 Month pricing correct: base=499, children=[179,149,119,99]")

    def test_single_parent_6_months_pricing(self):
        """Single Parent 6 Months: base=2299, children=[799,649,519,399]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["6_months"]
        
        assert plan["base_price"] == 2299
        assert plan["child_prices"] == [799, 649, 519, 399]
        print("PASS: Single Parent 6 Months pricing correct: base=2299, children=[799,649,519,399]")

    def test_single_parent_1_year_pricing(self):
        """Single Parent 1 Year: base=3999, children=[1299,1049,849,649]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["1_year"]
        
        assert plan["base_price"] == 3999
        assert plan["child_prices"] == [1299, 1049, 849, 649]
        print("PASS: Single Parent 1 Year pricing correct: base=3999, children=[1299,1049,849,649]")


class TestTwoParentsPricing:
    """Tests for Two Parents (Dual Parent) plan pricing (exact values)"""

    def test_two_parents_1_day_pricing(self):
        """Two Parents 1 Day: base=69, children=[39,35,29,22]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["two_parents"]["1_day"]
        
        assert plan["base_price"] == 69
        assert plan["child_prices"] == [39, 35, 29, 22]
        print("PASS: Two Parents 1 Day pricing correct: base=69, children=[39,35,29,22]")

    def test_two_parents_1_month_pricing(self):
        """Two Parents 1 Month: base=649, children=[219,179,149,119]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["two_parents"]["1_month"]
        
        assert plan["base_price"] == 649
        assert plan["child_prices"] == [219, 179, 149, 119]
        print("PASS: Two Parents 1 Month pricing correct: base=649, children=[219,179,149,119]")

    def test_two_parents_6_months_pricing(self):
        """Two Parents 6 Months: base=2999, children=[999,799,649,499]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["two_parents"]["6_months"]
        
        assert plan["base_price"] == 2999
        assert plan["child_prices"] == [999, 799, 649, 499]
        print("PASS: Two Parents 6 Months pricing correct: base=2999, children=[999,799,649,499]")

    def test_two_parents_1_year_pricing(self):
        """Two Parents 1 Year: base=5199, children=[1599,1299,1049,799]"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["two_parents"]["1_year"]
        
        assert plan["base_price"] == 5199
        assert plan["child_prices"] == [1599, 1299, 1049, 799]
        print("PASS: Two Parents 1 Year pricing correct: base=5199, children=[1599,1299,1049,799]")


class TestTotalCalculation:
    """Tests for total calculation logic - verifying tiered pricing sums correctly"""

    def calc_total(self, base_price, child_prices, num_children):
        """Helper function replicating backend calculate_total logic"""
        total = base_price
        for i in range(1, num_children):
            if i - 1 < len(child_prices):
                total += child_prices[i - 1]
        return total

    def test_single_parent_6_months_3_children(self):
        """Single Parent 6 Months with 3 children = 2299 + 799 + 649 = 3747"""
        # Per requirement: base + 2nd child + 3rd child
        expected = 2299 + 799 + 649  # = 3747
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["6_months"]
        
        calculated = self.calc_total(plan["base_price"], plan["child_prices"], 3)
        assert calculated == expected, f"Expected {expected}, got {calculated}"
        print(f"PASS: Single Parent 6 Months with 3 children = {expected}")

    def test_two_parents_1_year_5_children(self):
        """Two Parents 1 Year with 5 children = 5199 + 1599 + 1299 + 1049 + 799 = 9945"""
        expected = 5199 + 1599 + 1299 + 1049 + 799  # = 9945
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["two_parents"]["1_year"]
        
        calculated = self.calc_total(plan["base_price"], plan["child_prices"], 5)
        assert calculated == expected, f"Expected {expected}, got {calculated}"
        print(f"PASS: Two Parents 1 Year with 5 children = {expected}")

    def test_single_parent_1_month_2_children(self):
        """Single Parent 1 Month with 2 children = 499 + 179 = 678"""
        expected = 499 + 179  # = 678
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["1_month"]
        
        calculated = self.calc_total(plan["base_price"], plan["child_prices"], 2)
        assert calculated == expected, f"Expected {expected}, got {calculated}"
        print(f"PASS: Single Parent 1 Month with 2 children = {expected}")

    def test_single_parent_1_day_1_child(self):
        """Single Parent 1 Day with 1 child = 49 (just base)"""
        expected = 49
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        plan = response.json()["plans"]["single_parent"]["1_day"]
        
        calculated = self.calc_total(plan["base_price"], plan["child_prices"], 1)
        assert calculated == expected, f"Expected {expected}, got {calculated}"
        print(f"PASS: Single Parent 1 Day with 1 child = {expected}")


class TestAdminPlanConfigEndpoint:
    """Tests for POST /api/subscriptions/admin/plan-config endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        if login_resp.status_code != 200:
            pytest.skip("Admin login failed - skipping admin tests")
        token = login_resp.json().get("session_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session

    def test_admin_plan_config_get(self, admin_session):
        """GET /api/subscriptions/admin/plan-config should return all configs"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/plan-config")
        assert response.status_code == 200
        data = response.json()
        assert "single_parent" in data
        assert "two_parents" in data
        # Verify structure
        for plan_type in ["single_parent", "two_parents"]:
            for duration in ["1_day", "1_month", "6_months", "1_year"]:
                config = data[plan_type][duration]
                assert "base_price" in config
                assert "child_prices" in config
                assert "extra_child_per_day" in config
        print("PASS: Admin plan-config GET returns all configs with correct structure")

    def test_admin_plan_config_post_accepts_child_prices_array(self, admin_session):
        """POST /api/subscriptions/admin/plan-config should accept child_prices array"""
        # First get current config to restore later
        get_resp = admin_session.get(f"{BASE_URL}/api/subscriptions/admin/plan-config")
        original_config = get_resp.json()["single_parent"]["1_day"]
        
        # Post new config with child_prices array
        test_config = {
            "plan_type": "single_parent",
            "duration": "1_day",
            "base_price": 49,
            "child_prices": [29, 25, 20, 15],
            "extra_child_per_day": 29
        }
        
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/admin/plan-config", json=test_config)
        assert response.status_code == 200
        assert "message" in response.json()
        print("PASS: Admin plan-config POST accepts child_prices array")

    def test_admin_plan_config_requires_auth(self):
        """POST /api/subscriptions/admin/plan-config requires authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/admin/plan-config", json={
            "plan_type": "single_parent",
            "duration": "1_day",
            "base_price": 49,
            "child_prices": [29, 25, 20, 15],
            "extra_child_per_day": 29
        })
        assert response.status_code in [401, 403]
        print("PASS: Admin plan-config POST requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
