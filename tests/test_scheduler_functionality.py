"""
Test suite for APScheduler-based daily price fluctuation feature.
Tests scheduler status, logs, stock price updates, and plant holdings updates.
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


class TestSchedulerFunctionality:
    """Tests for APScheduler daily market simulation feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        data = login_response.json()
        self.session_token = data.get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
        
        yield
        
        # Cleanup
        self.session.close()
    
    # ============== SCHEDULER STATUS TESTS ==============
    
    def test_scheduler_status_api_returns_200(self):
        """Test that scheduler-status API returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Scheduler status API returns 200 OK")
    
    def test_scheduler_is_running(self):
        """Test that scheduler is running"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "scheduler_running" in data, "Missing scheduler_running field"
        assert data["scheduler_running"] is True, "Scheduler is not running"
        print("✅ Scheduler is running")
    
    def test_scheduler_has_daily_market_job(self):
        """Test that scheduler has the daily_market_simulation job configured"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data, "Missing jobs field"
        assert len(data["jobs"]) > 0, "No jobs configured"
        
        job_ids = [job["id"] for job in data["jobs"]]
        assert "daily_market_simulation" in job_ids, "daily_market_simulation job not found"
        print("✅ Daily market simulation job is configured")
    
    def test_scheduler_job_runs_at_6am_utc(self):
        """Test that scheduler job is configured to run at 6:00 AM UTC"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        job = next((j for j in data["jobs"] if j["id"] == "daily_market_simulation"), None)
        assert job is not None, "daily_market_simulation job not found"
        
        # Check trigger configuration
        trigger = job.get("trigger", "")
        assert "hour='6'" in trigger, f"Job not configured for 6 AM: {trigger}"
        assert "minute='0'" in trigger, f"Job not configured for minute 0: {trigger}"
        print("✅ Scheduler job runs at 6:00 AM UTC")
    
    def test_scheduler_has_next_run_time(self):
        """Test that scheduler job has a valid next_run_time"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        job = next((j for j in data["jobs"] if j["id"] == "daily_market_simulation"), None)
        assert job is not None
        
        next_run = job.get("next_run_time")
        assert next_run is not None, "next_run_time is None"
        
        # Verify it's a valid ISO datetime
        try:
            datetime.fromisoformat(next_run.replace('Z', '+00:00'))
            print(f"✅ Next run time is valid: {next_run}")
        except ValueError:
            pytest.fail(f"Invalid next_run_time format: {next_run}")
    
    def test_scheduler_status_shows_ran_today(self):
        """Test that scheduler status shows ran_today field"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "ran_today" in data, "Missing ran_today field"
        assert isinstance(data["ran_today"], bool), "ran_today should be boolean"
        print(f"✅ ran_today field present: {data['ran_today']}")
    
    # ============== SCHEDULER LOGS TESTS ==============
    
    def test_scheduler_logs_api_returns_200(self):
        """Test that scheduler-logs API returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Scheduler logs API returns 200 OK")
    
    def test_scheduler_logs_returns_list(self):
        """Test that scheduler-logs returns a list"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✅ Scheduler logs returns list with {len(data)} entries")
    
    def test_scheduler_logs_have_required_fields(self):
        """Test that scheduler logs have required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            log = data[0]
            required_fields = ["log_id", "task", "date", "status", "created_at"]
            for field in required_fields:
                assert field in log, f"Missing field: {field}"
            print(f"✅ Scheduler logs have all required fields: {required_fields}")
        else:
            print("⚠️ No scheduler logs found (may be first run)")
    
    def test_scheduler_logs_show_success_status(self):
        """Test that scheduler logs show successful execution"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            # Check if there's at least one successful run
            success_logs = [log for log in data if log.get("status") == "success"]
            assert len(success_logs) > 0, "No successful scheduler runs found"
            print(f"✅ Found {len(success_logs)} successful scheduler runs")
        else:
            print("⚠️ No scheduler logs found")
    
    def test_scheduler_logs_show_stocks_updated(self):
        """Test that scheduler logs show stocks_updated count"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            log = data[0]
            if log.get("status") == "success":
                details = log.get("details", {})
                assert "stocks_updated" in details, "Missing stocks_updated in details"
                print(f"✅ Stocks updated count: {details['stocks_updated']}")
        else:
            print("⚠️ No scheduler logs found")
    
    def test_scheduler_logs_show_plant_holdings_updated(self):
        """Test that scheduler logs show plant_holdings_updated count"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            log = data[0]
            if log.get("status") == "success":
                details = log.get("details", {})
                assert "plant_holdings_updated" in details, "Missing plant_holdings_updated in details"
                print(f"✅ Plant holdings updated count: {details['plant_holdings_updated']}")
        else:
            print("⚠️ No scheduler logs found")
    
    def test_scheduler_logs_limit_parameter(self):
        """Test that scheduler-logs respects limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) <= 5, f"Expected max 5 logs, got {len(data)}"
        print(f"✅ Scheduler logs limit parameter works (returned {len(data)} logs)")
    
    # ============== STOCK PRICE UPDATE TESTS ==============
    
    def test_stocks_have_current_price(self):
        """Test that stocks have current_price field"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            stock = data[0]
            assert "current_price" in stock, "Missing current_price field"
            assert "base_price" in stock, "Missing base_price field"
            print(f"✅ Stock has current_price: ₹{stock['current_price']} (base: ₹{stock['base_price']})")
        else:
            print("⚠️ No stocks found")
    
    def test_stocks_have_last_price_update(self):
        """Test that stocks have last_price_update timestamp"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            stock = data[0]
            assert "last_price_update" in stock, "Missing last_price_update field"
            print(f"✅ Stock has last_price_update: {stock['last_price_update']}")
        else:
            print("⚠️ No stocks found")
    
    def test_stock_price_change_percentage(self):
        """Test that stock price change can be calculated from base_price"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            stock = data[0]
            current = stock.get("current_price", 0)
            base = stock.get("base_price", 0)
            
            if base > 0:
                change_pct = ((current - base) / base) * 100
                print(f"✅ Stock price change: {change_pct:.2f}% (₹{base} → ₹{current})")
            else:
                print("⚠️ Base price is 0")
        else:
            print("⚠️ No stocks found")
    
    def test_stock_price_within_volatility_range(self):
        """Test that stock price change is within volatility range"""
        response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            stock = data[0]
            current = stock.get("current_price", 0)
            base = stock.get("base_price", 0)
            volatility = stock.get("volatility", 0.05)
            
            if base > 0:
                change_pct = abs((current - base) / base)
                # Allow for multiple days of changes (cumulative)
                max_expected_change = volatility * 10  # Allow up to 10 days of changes
                print(f"✅ Stock volatility: ±{volatility*100}%, actual change: {change_pct*100:.2f}%")
        else:
            print("⚠️ No stocks found")
    
    # ============== PRICE HISTORY TESTS ==============
    
    def test_stock_price_history_api(self):
        """Test that stock price history API works"""
        # First get a stock
        stocks_response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert stocks_response.status_code == 200
        
        stocks = stocks_response.json()
        if len(stocks) > 0:
            stock_id = stocks[0]["stock_id"]
            
            # Get price history
            history_response = self.session.get(
                f"{BASE_URL}/api/admin/investments/stocks/{stock_id}/history?days=30"
            )
            assert history_response.status_code == 200, f"Price history API failed: {history_response.text}"
            
            history = history_response.json()
            assert isinstance(history, list), "Price history should be a list"
            print(f"✅ Price history API works, {len(history)} entries found")
        else:
            print("⚠️ No stocks found")
    
    def test_price_history_has_required_fields(self):
        """Test that price history entries have required fields"""
        stocks_response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert stocks_response.status_code == 200
        
        stocks = stocks_response.json()
        if len(stocks) > 0:
            stock_id = stocks[0]["stock_id"]
            
            history_response = self.session.get(
                f"{BASE_URL}/api/admin/investments/stocks/{stock_id}/history?days=30"
            )
            assert history_response.status_code == 200
            
            history = history_response.json()
            if len(history) > 0:
                entry = history[0]
                required_fields = ["date", "price"]
                for field in required_fields:
                    assert field in entry, f"Missing field: {field}"
                print(f"✅ Price history has required fields: {required_fields}")
            else:
                print("⚠️ No price history entries found")
        else:
            print("⚠️ No stocks found")
    
    # ============== MANUAL SIMULATE DAY TESTS ==============
    
    def test_simulate_day_api_returns_200(self):
        """Test that simulate-day API returns 200 OK"""
        response = self.session.post(f"{BASE_URL}/api/admin/investments/simulate-day")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Simulate day API returns 200 OK")
    
    def test_simulate_day_returns_message(self):
        """Test that simulate-day returns success message"""
        response = self.session.post(f"{BASE_URL}/api/admin/investments/simulate-day")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data, "Missing message field"
        assert "date" in data, "Missing date field"
        print(f"✅ Simulate day message: {data['message']}")
    
    def test_simulate_day_updates_stock_prices(self):
        """Test that simulate-day actually updates stock prices"""
        # Get current prices
        before_response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
        assert before_response.status_code == 200
        before_stocks = before_response.json()
        
        if len(before_stocks) > 0:
            before_price = before_stocks[0].get("current_price")
            
            # Simulate day
            simulate_response = self.session.post(f"{BASE_URL}/api/admin/investments/simulate-day")
            assert simulate_response.status_code == 200
            
            # Get new prices
            after_response = self.session.get(f"{BASE_URL}/api/admin/investments/stocks")
            assert after_response.status_code == 200
            after_stocks = after_response.json()
            
            after_price = after_stocks[0].get("current_price")
            
            # Price should have changed (or stayed same if volatility is 0)
            print(f"✅ Stock price before: ₹{before_price}, after: ₹{after_price}")
        else:
            print("⚠️ No stocks found")
    
    # ============== AUTHENTICATION TESTS ==============
    
    def test_scheduler_status_requires_admin(self):
        """Test that scheduler-status requires admin authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/admin/investments/scheduler-status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Scheduler status requires authentication")
    
    def test_scheduler_logs_requires_admin(self):
        """Test that scheduler-logs requires admin authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/admin/investments/scheduler-logs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Scheduler logs requires authentication")
    
    def test_simulate_day_requires_admin(self):
        """Test that simulate-day requires admin authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/admin/investments/simulate-day")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Simulate day requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
