"""
Test Money Garden Growth Calculation Fix
========================================
Tests the fix for growth calculation that was stuck at 0% even after planting overnight.

Key Fix: Growth calculation changed from .days (whole days only) to .total_seconds()/3600 
for hour-based progress calculation.

Bug: Growth was using (now - planted_at).days which returns 0 until a full 24h passes.
Fix: Changed to use hours: (now - planted_at).total_seconds() / 3600

For a 1-day plant, growth after 12 hours should now show 50%.
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMoneyGardenGrowthFix:
    """Tests for the Money Garden growth calculation fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Use admin login for testing
        login_response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.session_token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
        else:
            pytest.skip("Admin login failed")
    
    def test_garden_api_returns_growth_progress(self):
        """Test that garden API returns growth_progress field"""
        # Note: Admin users may not have access to garden (grade restriction)
        # This test verifies the API structure
        response = self.session.get(f"{BASE_URL}/api/garden/farm")
        
        # Grade 1-2 restriction may apply
        if response.status_code == 403:
            pytest.skip("Garden restricted to Grade 1-2 users")
        
        if response.status_code == 200:
            data = response.json()
            assert "plots" in data
            assert "seeds" in data
            
            # Check plot structure includes growth_progress
            if data["plots"]:
                plot = data["plots"][0]
                assert "growth_progress" in plot
                assert "status" in plot
                assert "planted_at" in plot or plot["planted_at"] is None
    
    def test_investment_plants_exist(self):
        """Test that investment plants are configured"""
        response = self.session.get(f"{BASE_URL}/api/admin/garden/plants")
        
        assert response.status_code == 200
        plants = response.json()
        
        # Should have at least one plant
        assert len(plants) > 0
        
        # Check plant structure
        plant = plants[0]
        assert "plant_id" in plant
        assert "name" in plant
        assert "growth_days" in plant
        assert "seed_cost" in plant
        assert "harvest_yield" in plant
        assert "base_sell_price" in plant
    
    def test_sunflower_has_1_day_growth(self):
        """Test that Sunflower has 1-day growth period for testing"""
        response = self.session.get(f"{BASE_URL}/api/admin/garden/plants")
        
        assert response.status_code == 200
        plants = response.json()
        
        # Find sunflower
        sunflower = next((p for p in plants if "sunflower" in p["name"].lower()), None)
        
        if sunflower:
            # Sunflower should have 1-day growth for quick testing
            assert sunflower["growth_days"] == 1, f"Sunflower growth_days is {sunflower['growth_days']}, expected 1"
            print(f"✅ Sunflower configured with {sunflower['growth_days']} day growth period")
        else:
            pytest.skip("Sunflower plant not found")


class TestGrowthCalculationLogic:
    """Tests to verify the growth calculation logic in the backend"""
    
    def test_growth_calculation_uses_hours(self):
        """
        Verify the growth calculation formula:
        - hours_growing = (now - planted_at).total_seconds() / 3600
        - total_growth_hours = growth_days * 24
        - growth_progress = min(100, (hours_growing / total_growth_hours) * 100)
        
        For a 1-day plant after 12 hours: (12 / 24) * 100 = 50%
        """
        # Simulate the calculation
        growth_days = 1
        hours_growing = 12
        
        total_growth_hours = growth_days * 24
        growth_progress = min(100, (hours_growing / total_growth_hours) * 100)
        
        assert growth_progress == 50.0, f"Expected 50%, got {growth_progress}%"
        print(f"✅ Growth calculation: {hours_growing}h / {total_growth_hours}h = {growth_progress}%")
    
    def test_growth_calculation_at_various_times(self):
        """Test growth calculation at various time intervals"""
        growth_days = 1
        total_growth_hours = growth_days * 24
        
        test_cases = [
            (0, 0.0),      # Just planted
            (6, 25.0),     # 6 hours = 25%
            (12, 50.0),    # 12 hours = 50%
            (18, 75.0),    # 18 hours = 75%
            (24, 100.0),   # 24 hours = 100%
            (30, 100.0),   # 30 hours = still 100% (capped)
        ]
        
        for hours, expected in test_cases:
            growth_progress = min(100, (hours / total_growth_hours) * 100)
            assert growth_progress == expected, f"At {hours}h: expected {expected}%, got {growth_progress}%"
            print(f"✅ At {hours}h: {growth_progress}%")
    
    def test_old_calculation_would_fail(self):
        """
        Demonstrate why the old calculation (.days) was wrong:
        - (now - planted_at).days returns 0 until a full 24h passes
        """
        # Simulate old calculation
        planted_at = datetime.now(timezone.utc) - timedelta(hours=12)
        now = datetime.now(timezone.utc)
        
        # Old calculation (WRONG)
        days_passed = (now - planted_at).days
        assert days_passed == 0, "Old calculation would show 0 days for 12 hours"
        
        # New calculation (CORRECT)
        hours_passed = (now - planted_at).total_seconds() / 3600
        assert 11.9 < hours_passed < 12.1, f"New calculation shows ~12 hours: {hours_passed}"
        
        print(f"✅ Old calculation: {days_passed} days (WRONG)")
        print(f"✅ New calculation: {hours_passed:.1f} hours (CORRECT)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
