import requests
import sys
import json
from datetime import datetime
import subprocess
import time

class PocketQuestAPITester:
    def __init__(self, base_url="https://moneymagic-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def create_test_user_and_session(self):
        """Create test user and session using MongoDB"""
        print("\n🔧 Creating test user and session...")
        
        timestamp = int(time.time())
        self.user_id = f"test-user-{timestamp}"
        self.session_token = f"test_session_{timestamp}"
        
        mongo_script = f"""
use('test_database');
var userId = '{self.user_id}';
var sessionToken = '{self.session_token}';

// Create test user
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{timestamp}@example.com',
  name: 'Test User {timestamp}',
  picture: 'https://via.placeholder.com/150',
  role: 'child',
  grade: 3,
  avatar: {{"body": "default", "hair": "default", "clothes": "default", "accessories": []}},
  streak_count: 0,
  last_login_date: null,
  created_at: new Date()
}});

// Create wallet accounts
var accountTypes = ['spending', 'savings', 'investing', 'giving'];
accountTypes.forEach(function(type) {{
  db.wallet_accounts.insertOne({{
    account_id: 'acc_' + Math.random().toString(36).substr(2, 12),
    user_id: userId,
    account_type: type,
    balance: type === 'spending' ? 100.0 : 50.0,
    created_at: new Date()
  }});
}});

// Create session
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print('✅ Test user and session created');
print('User ID: ' + userId);
print('Session Token: ' + sessionToken);
"""
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Test user and session created successfully")
                return True
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Error creating test user: {e}")
            return False

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        cleanup_script = """
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
db.wallet_accounts.deleteMany({user_id: /test-user-/});
db.transactions.deleteMany({user_id: /test-user-/});
db.purchases.deleteMany({user_id: /test-user-/});
db.investments.deleteMany({user_id: /test-user-/});
db.user_achievements.deleteMany({user_id: /test-user-/});
db.user_quests.deleteMany({user_id: /test-user-/});
print('✅ Test data cleaned up');
"""
        
        try:
            subprocess.run(['mongosh', '--eval', cleanup_script], 
                          capture_output=True, text=True, timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def test_seed_data(self):
        """Test seeding initial data"""
        return self.run_test("Seed Data", "POST", "seed", 200)

    def test_auth_me(self):
        """Test getting current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_wallet_operations(self):
        """Test wallet operations"""
        print("\n📊 Testing Wallet Operations...")
        
        # Get wallet
        success, wallet_data = self.run_test("Get Wallet", "GET", "wallet", 200)
        if not success:
            return False
        
        # Transfer money
        transfer_data = {
            "from_account": "spending",
            "to_account": "savings", 
            "amount": 25.0,
            "transaction_type": "transfer",
            "description": "Test transfer"
        }
        success, _ = self.run_test("Transfer Money", "POST", "wallet/transfer", 200, transfer_data)
        if not success:
            return False
            
        # Get transactions
        success, _ = self.run_test("Get Transactions", "GET", "wallet/transactions", 200)
        return success

    def test_store_operations(self):
        """Test store operations"""
        print("\n🛒 Testing Store Operations...")
        
        # Get store items
        success, items_data = self.run_test("Get Store Items", "GET", "store/items", 200)
        if not success or not items_data:
            return False
        
        # Purchase an item (if available)
        if isinstance(items_data, list) and len(items_data) > 0:
            item_id = items_data[0].get("item_id")
            if item_id:
                purchase_data = {"item_id": item_id}
                success, _ = self.run_test("Purchase Item", "POST", "store/purchase", 200, purchase_data)
                if success:
                    # Get purchase history
                    self.run_test("Get Purchase History", "GET", "store/purchases", 200)
                return success
        
        return True

    def test_investment_operations(self):
        """Test investment operations"""
        print("\n📈 Testing Investment Operations...")
        
        # Get investments
        success, _ = self.run_test("Get Investments", "GET", "investments", 200)
        if not success:
            return False
        
        # Create investment
        investment_data = {
            "investment_type": "garden",
            "name": "Test Garden",
            "amount": 20.0
        }
        success, inv_response = self.run_test("Create Investment", "POST", "investments", 200, investment_data)
        if not success:
            return False
        
        # Get investments again to see the new one
        success, investments = self.run_test("Get Investments After Creation", "GET", "investments", 200)
        
        # Try to sell investment if we have one
        if success and isinstance(investments, list) and len(investments) > 0:
            investment_id = investments[0].get("investment_id")
            if investment_id:
                success, _ = self.run_test("Sell Investment", "POST", f"investments/{investment_id}/sell", 200)
        
        return True

    def test_quest_operations(self):
        """Test quest operations"""
        print("\n🎯 Testing Quest Operations...")
        
        # Get quests
        success, quests_data = self.run_test("Get Quests", "GET", "quests", 200)
        if not success:
            return False
        
        # Accept a quest if available
        if isinstance(quests_data, list) and len(quests_data) > 0:
            quest_id = quests_data[0].get("quest_id")
            if quest_id:
                success, _ = self.run_test("Accept Quest", "POST", f"quests/{quest_id}/accept", 200)
                if success:
                    # Complete the quest
                    success, _ = self.run_test("Complete Quest", "POST", f"quests/{quest_id}/complete", 200)
        
        return True

    def test_achievement_operations(self):
        """Test achievement operations"""
        print("\n🏆 Testing Achievement Operations...")
        
        # Get achievements
        success, achievements_data = self.run_test("Get Achievements", "GET", "achievements", 200)
        if not success:
            return False
        
        # Try to claim an achievement if available
        if isinstance(achievements_data, list) and len(achievements_data) > 0:
            achievement_id = achievements_data[0].get("achievement_id")
            if achievement_id:
                # This might fail if already claimed, which is okay
                self.run_test("Claim Achievement", "POST", f"achievements/{achievement_id}/claim", 200)
        
        return True

    def test_streak_operations(self):
        """Test streak operations"""
        print("\n🔥 Testing Streak Operations...")
        
        return self.run_test("Daily Checkin", "POST", "streak/checkin", 200)

    def test_ai_operations(self):
        """Test AI operations"""
        print("\n🤖 Testing AI Operations...")
        
        # Test AI chat
        chat_data = {
            "message": "What is saving money?",
            "grade": 3
        }
        success, _ = self.run_test("AI Chat", "POST", "ai/chat", 200, chat_data)
        if not success:
            return False
        
        # Test AI tip
        tip_data = {
            "grade": 3,
            "topic": "saving money"
        }
        success, _ = self.run_test("AI Financial Tip", "POST", "ai/tip", 200, tip_data)
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting PocketQuest API Testing...")
        print(f"Backend URL: {self.base_url}")
        
        # Create test user and session
        if not self.create_test_user_and_session():
            print("❌ Failed to create test user. Stopping tests.")
            return False
        
        try:
            # Test basic endpoints
            print("\n" + "="*50)
            print("BASIC API TESTS")
            print("="*50)
            
            # Seed data first
            self.test_seed_data()
            
            # Test authentication
            self.test_auth_me()
            
            # Test all features
            print("\n" + "="*50)
            print("FEATURE TESTS")
            print("="*50)
            
            self.test_wallet_operations()
            self.test_store_operations()
            self.test_investment_operations()
            self.test_quest_operations()
            self.test_achievement_operations()
            self.test_streak_operations()
            self.test_ai_operations()
            
        finally:
            # Clean up test data
            self.cleanup_test_data()
        
        # Print results
        print("\n" + "="*50)
        print("TEST RESULTS")
        print("="*50)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for test in self.failed_tests:
                print(f"   - {test}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        return success_rate > 80  # Consider 80%+ as passing

def main():
    tester = PocketQuestAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())