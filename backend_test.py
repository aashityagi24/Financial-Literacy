import requests
import sys
import json
from datetime import datetime
import subprocess
import time

class PocketQuestAPITester:
    def __init__(self, base_url="https://finlit-kids-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.admin_session_token = None
        self.admin_user_id = None
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
db.users.deleteMany({email: /test\.admin\./});
db.user_sessions.deleteMany({session_token: /test_session/});
db.user_sessions.deleteMany({session_token: /test_admin_session/});
db.wallet_accounts.deleteMany({user_id: /test-user-/});
db.transactions.deleteMany({user_id: /test-user-/});
db.purchases.deleteMany({user_id: /test-user-/});
db.investments.deleteMany({user_id: /test-user-/});
db.user_achievements.deleteMany({user_id: /test-user-/});
db.user_quests.deleteMany({user_id: /test-user-/});
db.user_lesson_progress.deleteMany({user_id: /test-user-/});
db.user_activity_progress.deleteMany({user_id: /test-user-/});
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

    def test_seed_learning_content(self):
        """Test seeding learning content"""
        return self.run_test("Seed Learning Content", "POST", "seed-learning", 200)

    def test_learning_content_operations(self):
        """Test learning content operations"""
        print("\n📚 Testing Learning Content Operations...")
        
        # Get learning topics
        success, topics_data = self.run_test("Get Learning Topics", "GET", "learn/topics", 200)
        if not success:
            return False
        
        # Get learning progress
        success, _ = self.run_test("Get Learning Progress", "GET", "learn/progress", 200)
        if not success:
            return False
        
        # Get books
        success, _ = self.run_test("Get Books", "GET", "learn/books", 200)
        if not success:
            return False
        
        # Get activities
        success, activities_data = self.run_test("Get Activities", "GET", "learn/activities", 200)
        if not success:
            return False
        
        # Test topic details if topics exist
        if isinstance(topics_data, list) and len(topics_data) > 0:
            topic_id = topics_data[0].get("topic_id")
            if topic_id:
                success, topic_details = self.run_test("Get Topic Details", "GET", f"learn/topics/{topic_id}", 200)
                if success and isinstance(topic_details, dict):
                    lessons = topic_details.get("lessons", [])
                    if len(lessons) > 0:
                        lesson_id = lessons[0].get("lesson_id")
                        if lesson_id:
                            # Get lesson details
                            success, _ = self.run_test("Get Lesson Details", "GET", f"learn/lessons/{lesson_id}", 200)
                            if success:
                                # Complete the lesson
                                success, _ = self.run_test("Complete Lesson", "POST", f"learn/lessons/{lesson_id}/complete", 200)
        
        # Complete an activity if available
        if isinstance(activities_data, list) and len(activities_data) > 0:
            activity_id = activities_data[0].get("activity_id")
            if activity_id:
                success, _ = self.run_test("Complete Activity", "POST", f"learn/activities/{activity_id}/complete", 200)
        
        return True

    def create_admin_user_and_session(self):
        """Create admin test user and session using MongoDB"""
        print("\n🔧 Creating admin test user and session...")
        
        timestamp = int(time.time())
        self.admin_user_id = f"test-admin-{timestamp}"
        self.admin_session_token = f"test_admin_session_{timestamp}"
        
        mongo_script = f"""
use('test_database');
var userId = '{self.admin_user_id}';
var sessionToken = '{self.admin_session_token}';

// Create admin test user
db.users.insertOne({{
  user_id: userId,
  email: 'test.admin.{timestamp}@example.com',
  name: 'Test Admin {timestamp}',
  picture: 'https://via.placeholder.com/150',
  role: 'admin',
  grade: null,
  avatar: {{"body": "default", "hair": "default", "clothes": "default", "accessories": []}},
  streak_count: 0,
  last_login_date: null,
  created_at: new Date()
}});

// Create admin session
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print('✅ Admin test user and session created');
print('Admin User ID: ' + userId);
print('Admin Session Token: ' + sessionToken);
"""
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Admin test user and session created successfully")
                return True
            else:
                print(f"❌ Failed to create admin test user: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Error creating admin test user: {e}")
            return False

    def test_admin_operations(self):
        """Test admin operations"""
        print("\n👑 Testing Admin Operations...")
        
        # Switch to admin session
        original_token = self.session_token
        self.session_token = self.admin_session_token
        
        try:
            # Get admin stats
            success, _ = self.run_test("Get Admin Stats", "GET", "admin/stats", 200)
            if not success:
                return False
            
            # Get all users
            success, users_data = self.run_test("Get All Users", "GET", "admin/users", 200)
            if not success:
                return False
            
            # Update a user role (if users exist)
            if isinstance(users_data, list) and len(users_data) > 0:
                user_id = users_data[0].get("user_id")
                if user_id:
                    role_data = {"role": "child"}
                    success, _ = self.run_test("Update User Role", "PUT", f"admin/users/{user_id}/role", 200, role_data)
            
            # Create a topic
            topic_data = {
                "title": "Test Topic",
                "description": "A test topic for API testing",
                "category": "concepts",
                "icon": "🧪",
                "min_grade": 0,
                "max_grade": 5
            }
            success, topic_response = self.run_test("Create Topic", "POST", "admin/topics", 200, topic_data)
            if success and isinstance(topic_response, dict):
                topic_id = topic_response.get("topic_id")
                
                # Create a lesson for the topic
                if topic_id:
                    lesson_data = {
                        "topic_id": topic_id,
                        "title": "Test Lesson",
                        "content": "This is a test lesson content.",
                        "lesson_type": "story",
                        "duration_minutes": 5,
                        "reward_coins": 5,
                        "min_grade": 0,
                        "max_grade": 5
                    }
                    success, _ = self.run_test("Create Lesson", "POST", "admin/lessons", 200, lesson_data)
            
            # Create a book
            book_data = {
                "title": "Test Book",
                "author": "Test Author",
                "description": "A test book for API testing",
                "category": "story",
                "min_grade": 0,
                "max_grade": 5
            }
            success, _ = self.run_test("Create Book", "POST", "admin/books", 200, book_data)
            
            # Create an activity
            activity_data = {
                "title": "Test Activity",
                "description": "A test activity for API testing",
                "instructions": "Follow these test instructions",
                "activity_type": "real_world",
                "reward_coins": 10,
                "min_grade": 0,
                "max_grade": 5
            }
            success, _ = self.run_test("Create Activity", "POST", "admin/activities", 200, activity_data)
            
            return True
            
        finally:
            # Restore original session
            self.session_token = original_token

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting PocketQuest API Testing...")
        print(f"Backend URL: {self.base_url}")
        
        # Create test user and session
        if not self.create_test_user_and_session():
            print("❌ Failed to create test user. Stopping tests.")
            return False
        
        # Create admin user and session
        if not self.create_admin_user_and_session():
            print("❌ Failed to create admin user. Stopping tests.")
            return False
        
        try:
            # Test basic endpoints
            print("\n" + "="*50)
            print("BASIC API TESTS")
            print("="*50)
            
            # Seed data first
            self.test_seed_data()
            
            # Seed learning content
            self.test_seed_learning_content()
            
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
            
            # Test new learning content features
            print("\n" + "="*50)
            print("LEARNING CONTENT TESTS")
            print("="*50)
            
            self.test_learning_content_operations()
            
            # Test admin features
            print("\n" + "="*50)
            print("ADMIN TESTS")
            print("="*50)
            
            self.test_admin_operations()
            
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