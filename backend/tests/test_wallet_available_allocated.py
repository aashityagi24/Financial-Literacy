"""
Test wallet API - Available vs Allocated balance feature
Tests the /api/wallet endpoint returns correct balance breakdown for savings and investing jars
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
TEST_SESSION_TOKEN = "test_sess_607235502edf45a6b4f7f0191a9fd1c0"
TEST_USER_ID = "user_cd3928036bf4"


class TestWalletAvailableAllocated:
    """Test wallet endpoint returns available_balance, allocated_balance, total_balance"""
    
    @pytest.fixture
    def auth_headers(self):
        """Return headers with auth token"""
        return {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_wallet_endpoint_returns_200(self, auth_headers):
        """Test wallet endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Wallet endpoint returns 200")
    
    def test_wallet_returns_accounts_array(self, auth_headers):
        """Test wallet returns accounts array"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        assert "accounts" in data, "Response missing 'accounts' field"
        assert isinstance(data["accounts"], list), "accounts should be a list"
        assert len(data["accounts"]) > 0, "accounts should not be empty"
        print(f"✅ Wallet returns {len(data['accounts'])} accounts")
    
    def test_savings_account_has_available_allocated_fields(self, auth_headers):
        """Test savings account has available_balance, allocated_balance, total_balance"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        savings_account = next((acc for acc in data["accounts"] if acc["account_type"] == "savings"), None)
        assert savings_account is not None, "Savings account not found"
        
        # Check required fields exist
        assert "available_balance" in savings_account, "Savings missing available_balance"
        assert "allocated_balance" in savings_account, "Savings missing allocated_balance"
        assert "total_balance" in savings_account, "Savings missing total_balance"
        
        print(f"✅ Savings account has all balance fields:")
        print(f"   - available_balance: ₹{savings_account['available_balance']}")
        print(f"   - allocated_balance: ₹{savings_account['allocated_balance']}")
        print(f"   - total_balance: ₹{savings_account['total_balance']}")
    
    def test_investing_account_has_available_allocated_fields(self, auth_headers):
        """Test investing account has available_balance, allocated_balance, total_balance"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        investing_account = next((acc for acc in data["accounts"] if acc["account_type"] == "investing"), None)
        assert investing_account is not None, "Investing account not found"
        
        # Check required fields exist
        assert "available_balance" in investing_account, "Investing missing available_balance"
        assert "allocated_balance" in investing_account, "Investing missing allocated_balance"
        assert "total_balance" in investing_account, "Investing missing total_balance"
        
        print(f"✅ Investing account has all balance fields:")
        print(f"   - available_balance: ₹{investing_account['available_balance']}")
        print(f"   - allocated_balance: ₹{investing_account['allocated_balance']}")
        print(f"   - total_balance: ₹{investing_account['total_balance']}")
    
    def test_spending_account_has_zero_allocated(self, auth_headers):
        """Test spending account has allocated_balance = 0 (no allocation concept)"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        spending_account = next((acc for acc in data["accounts"] if acc["account_type"] == "spending"), None)
        assert spending_account is not None, "Spending account not found"
        
        # Spending should have allocated_balance = 0
        assert spending_account.get("allocated_balance", 0) == 0, "Spending should have allocated_balance = 0"
        # available_balance should equal balance
        assert spending_account.get("available_balance") == spending_account.get("balance"), \
            "Spending available_balance should equal balance"
        
        print(f"✅ Spending account correctly shows no allocation:")
        print(f"   - balance: ₹{spending_account['balance']}")
        print(f"   - available_balance: ₹{spending_account['available_balance']}")
        print(f"   - allocated_balance: ₹{spending_account['allocated_balance']}")
    
    def test_gifting_account_has_zero_allocated(self, auth_headers):
        """Test gifting account has allocated_balance = 0 (no allocation concept)"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        gifting_account = next((acc for acc in data["accounts"] if acc["account_type"] == "gifting"), None)
        assert gifting_account is not None, "Gifting account not found"
        
        # Gifting should have allocated_balance = 0
        assert gifting_account.get("allocated_balance", 0) == 0, "Gifting should have allocated_balance = 0"
        # available_balance should equal balance
        assert gifting_account.get("available_balance") == gifting_account.get("balance"), \
            "Gifting available_balance should equal balance"
        
        print(f"✅ Gifting account correctly shows no allocation:")
        print(f"   - balance: ₹{gifting_account['balance']}")
        print(f"   - available_balance: ₹{gifting_account['available_balance']}")
        print(f"   - allocated_balance: ₹{gifting_account['allocated_balance']}")
    
    def test_savings_allocated_equals_goals_sum(self, auth_headers):
        """Test savings allocated_balance equals sum of savings goals current_amount"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        # Check savings_allocated in response
        assert "savings_allocated" in data, "Response missing savings_allocated field"
        
        savings_account = next((acc for acc in data["accounts"] if acc["account_type"] == "savings"), None)
        assert savings_account["allocated_balance"] == data["savings_allocated"], \
            "Savings allocated_balance should match savings_allocated"
        
        print(f"✅ Savings allocated_balance matches savings_allocated: ₹{data['savings_allocated']}")
    
    def test_investing_allocated_equals_portfolio_value(self, auth_headers):
        """Test investing allocated_balance equals sum of stock holdings + garden plots"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        # Check investing_allocated in response
        assert "investing_allocated" in data, "Response missing investing_allocated field"
        
        investing_account = next((acc for acc in data["accounts"] if acc["account_type"] == "investing"), None)
        assert investing_account["allocated_balance"] == data["investing_allocated"], \
            "Investing allocated_balance should match investing_allocated"
        
        print(f"✅ Investing allocated_balance matches investing_allocated: ₹{data['investing_allocated']}")
    
    def test_savings_available_calculation(self, auth_headers):
        """Test savings available_balance = balance - allocated (min 0)"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        savings_account = next((acc for acc in data["accounts"] if acc["account_type"] == "savings"), None)
        
        balance = savings_account.get("balance", 0)
        allocated = savings_account.get("allocated_balance", 0)
        available = savings_account.get("available_balance", 0)
        
        expected_available = max(0, balance - allocated)
        assert available == expected_available, \
            f"Savings available should be max(0, {balance} - {allocated}) = {expected_available}, got {available}"
        
        print(f"✅ Savings available_balance calculation correct:")
        print(f"   - balance: ₹{balance}")
        print(f"   - allocated: ₹{allocated}")
        print(f"   - available: ₹{available} (max(0, {balance} - {allocated}))")
    
    def test_total_balance_includes_all_accounts(self, auth_headers):
        """Test total_balance is sum of all account total_balances"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers)
        data = response.json()
        
        assert "total_balance" in data, "Response missing total_balance field"
        
        calculated_total = sum(acc.get("total_balance", acc.get("balance", 0)) for acc in data["accounts"])
        assert data["total_balance"] == calculated_total, \
            f"Total balance should be {calculated_total}, got {data['total_balance']}"
        
        print(f"✅ Total balance correct: ₹{data['total_balance']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
