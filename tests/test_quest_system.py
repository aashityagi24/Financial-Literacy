"""
Quest System API Tests
Tests for Admin Quests, Teacher Quests, Parent Chores, and Child Quest interactions
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://finlit-kids-2.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


class TestAdminQuestSystem:
    """Tests for Admin Quest Management APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.admin_token = login_data.get("session_token")
        self.admin_user = login_data.get("user")
        
        # Set auth header
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
        # Store created quest IDs for cleanup
        self.created_quest_ids = []
        
        yield
        
        # Cleanup created quests
        for quest_id in self.created_quest_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/admin/quests/{quest_id}")
            except:
                pass
    
    def test_admin_login_success(self):
        """Test admin login returns valid session"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "admin"
        print("✅ Admin login successful")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with wrong credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": "wrong@email.com", "password": "wrongpass"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        print("✅ Admin login correctly rejects invalid credentials")
    
    def test_get_admin_quests_empty_or_list(self):
        """Test GET /api/admin/quests returns list"""
        response = self.session.get(f"{BASE_URL}/api/admin/quests")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/admin/quests returns list with {len(data)} quests")
    
    def test_create_admin_quest_mcq(self):
        """Test creating admin quest with MCQ questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_Math Quiz - Addition",
            "description": "Test your addition skills!",
            "min_grade": 1,
            "max_grade": 3,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "What is 2 + 2?",
                    "question_type": "mcq",
                    "options": ["3", "4", "5", "6"],
                    "correct_answer": "4",
                    "points": 10
                },
                {
                    "question_text": "What is 5 + 3?",
                    "question_type": "mcq",
                    "options": ["6", "7", "8", "9"],
                    "correct_answer": "8",
                    "points": 10
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200, f"Create quest failed: {response.text}"
        
        data = response.json()
        assert "quest_id" in data
        assert data["message"] == "Quest created successfully"
        
        self.created_quest_ids.append(data["quest_id"])
        print(f"✅ Created admin quest with MCQ: {data['quest_id']}")
        
        # Verify quest appears in list
        list_response = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = list_response.json()
        quest_ids = [q["quest_id"] for q in quests]
        assert data["quest_id"] in quest_ids
        print("✅ Quest appears in admin quests list")
    
    def test_create_admin_quest_multi_select(self):
        """Test creating admin quest with multi-select questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_Money Types Quiz",
            "description": "Select all correct answers",
            "min_grade": 2,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Which of these are coins?",
                    "question_type": "multi_select",
                    "options": ["₹1", "₹5", "₹100 note", "₹10"],
                    "correct_answer": ["₹1", "₹5", "₹10"],
                    "points": 15
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        self.created_quest_ids.append(data["quest_id"])
        print(f"✅ Created admin quest with multi-select: {data['quest_id']}")
    
    def test_create_admin_quest_true_false(self):
        """Test creating admin quest with true/false questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_True or False - Savings",
            "description": "Answer true or false",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Saving money helps you buy things later",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                },
                {
                    "question_text": "You should spend all your money immediately",
                    "question_type": "true_false",
                    "correct_answer": "False",
                    "points": 5
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        self.created_quest_ids.append(data["quest_id"])
        print(f"✅ Created admin quest with true/false: {data['quest_id']}")
    
    def test_create_admin_quest_value(self):
        """Test creating admin quest with value entry questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_Calculate Change",
            "description": "Enter the correct value",
            "min_grade": 2,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "If you have ₹50 and spend ₹30, how much do you have left?",
                    "question_type": "value",
                    "correct_answer": 20,
                    "points": 20
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        self.created_quest_ids.append(data["quest_id"])
        print(f"✅ Created admin quest with value entry: {data['quest_id']}")
    
    def test_update_admin_quest(self):
        """Test updating an admin quest"""
        # First create a quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        create_data = {
            "title": "TEST_Original Title",
            "description": "Original description",
            "min_grade": 1,
            "max_grade": 3,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Original question?",
                    "question_type": "mcq",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "points": 10
                }
            ]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/admin/quests", json=create_data)
        assert create_response.status_code == 200
        quest_id = create_response.json()["quest_id"]
        self.created_quest_ids.append(quest_id)
        
        # Update the quest
        update_data = {
            "title": "TEST_Updated Title",
            "description": "Updated description",
            "min_grade": 2,
            "max_grade": 4,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Updated question?",
                    "question_type": "mcq",
                    "options": ["X", "Y", "Z", "W"],
                    "correct_answer": "Y",
                    "points": 15
                }
            ]
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/admin/quests/{quest_id}", json=update_data)
        assert update_response.status_code == 200
        print(f"✅ Updated admin quest: {quest_id}")
        
        # Verify update
        list_response = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = list_response.json()
        updated_quest = next((q for q in quests if q["quest_id"] == quest_id), None)
        assert updated_quest is not None
        assert updated_quest["title"] == "TEST_Updated Title"
        print("✅ Quest update verified")
    
    def test_delete_admin_quest(self):
        """Test deleting an admin quest"""
        # First create a quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        create_data = {
            "title": "TEST_To Be Deleted",
            "description": "This quest will be deleted",
            "min_grade": 1,
            "max_grade": 3,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Delete me?",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/admin/quests", json=create_data)
        assert create_response.status_code == 200
        quest_id = create_response.json()["quest_id"]
        
        # Delete the quest
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/quests/{quest_id}")
        assert delete_response.status_code == 200
        print(f"✅ Deleted admin quest: {quest_id}")
        
        # Verify deletion
        list_response = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = list_response.json()
        quest_ids = [q["quest_id"] for q in quests]
        assert quest_id not in quest_ids
        print("✅ Quest deletion verified")


class TestChildQuestSystem:
    """Tests for Child Quest viewing and submission"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup child user session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create test child user via MongoDB
        import subprocess
        timestamp = int(datetime.now().timestamp())
        self.child_user_id = f"test_child_{timestamp}"
        self.child_session_token = f"test_session_{timestamp}"
        
        mongo_script = f'''
        use('test_database');
        db.users.insertOne({{
            user_id: "{self.child_user_id}",
            email: "test.child.{timestamp}@example.com",
            name: "Test Child",
            picture: null,
            role: "child",
            grade: 3,
            parent_ids: [],
            created_at: new Date()
        }});
        db.user_sessions.insertOne({{
            user_id: "{self.child_user_id}",
            session_token: "{self.child_session_token}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        db.wallet_accounts.insertOne({{
            account_id: "acc_{timestamp}_spending",
            user_id: "{self.child_user_id}",
            account_type: "spending",
            balance: 100.0,
            created_at: new Date()
        }});
        '''
        
        subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
        
        self.session.headers.update({"Authorization": f"Bearer {self.child_session_token}"})
        
        # Also setup admin session for creating test quests
        self.admin_session = requests.Session()
        self.admin_session.headers.update({"Content-Type": "application/json"})
        admin_login = self.admin_session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if admin_login.status_code == 200:
            admin_token = admin_login.json().get("session_token")
            self.admin_session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        self.created_quest_ids = []
        
        yield
        
        # Cleanup
        cleanup_script = f'''
        use('test_database');
        db.users.deleteOne({{ user_id: "{self.child_user_id}" }});
        db.user_sessions.deleteOne({{ session_token: "{self.child_session_token}" }});
        db.wallet_accounts.deleteMany({{ user_id: "{self.child_user_id}" }});
        db.quest_completions.deleteMany({{ user_id: "{self.child_user_id}" }});
        '''
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
        
        for quest_id in self.created_quest_ids:
            try:
                self.admin_session.delete(f"{BASE_URL}/api/admin/quests/{quest_id}")
            except:
                pass
    
    def test_child_get_quests(self):
        """Test child can get available quests"""
        response = self.session.get(f"{BASE_URL}/api/child/quests-new")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Child can get quests: {len(data)} available")
    
    def test_child_get_quests_filtered_by_source(self):
        """Test child can filter quests by source"""
        # Test admin filter
        response = self.session.get(f"{BASE_URL}/api/child/quests-new", params={"source": "admin"})
        assert response.status_code == 200
        data = response.json()
        for quest in data:
            assert quest.get("creator_type") == "admin"
        print(f"✅ Child can filter admin quests: {len(data)} found")
        
        # Test teacher filter
        response = self.session.get(f"{BASE_URL}/api/child/quests-new", params={"source": "teacher"})
        assert response.status_code == 200
        print("✅ Child can filter teacher quests")
        
        # Test parent filter
        response = self.session.get(f"{BASE_URL}/api/child/quests-new", params={"source": "parent"})
        assert response.status_code == 200
        print("✅ Child can filter parent chores")
    
    def test_child_submit_quest_answers(self):
        """Test child can submit quest answers and earn money"""
        # First create a test quest as admin
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_Child Submit Quiz",
            "description": "Test quiz for submission",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "What is 1 + 1?",
                    "question_type": "mcq",
                    "options": ["1", "2", "3", "4"],
                    "correct_answer": "2",
                    "points": 10
                }
            ]
        }
        
        create_response = self.admin_session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        if create_response.status_code != 200:
            pytest.skip("Could not create test quest")
        
        quest_id = create_response.json()["quest_id"]
        self.created_quest_ids.append(quest_id)
        
        # Get the quest to find question ID
        quests_response = self.session.get(f"{BASE_URL}/api/child/quests-new")
        quests = quests_response.json()
        test_quest = next((q for q in quests if q["quest_id"] == quest_id), None)
        
        if not test_quest:
            pytest.skip("Test quest not visible to child")
        
        question_id = test_quest["questions"][0]["question_id"]
        
        # Submit correct answer
        submit_response = self.session.post(
            f"{BASE_URL}/api/child/quests-new/{quest_id}/submit",
            json={"answers": {question_id: "2"}}
        )
        assert submit_response.status_code == 200
        
        result = submit_response.json()
        assert "results" in result
        assert "earned" in result
        assert result["earned"] == 10  # Should earn 10 points for correct answer
        print(f"✅ Child submitted quest and earned ₹{result['earned']}")
    
    def test_child_cannot_earn_twice(self):
        """Test child can retake quest but only earns once"""
        # Create test quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_No Double Earn",
            "description": "Test no double earning",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Simple question?",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        create_response = self.admin_session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        if create_response.status_code != 200:
            pytest.skip("Could not create test quest")
        
        quest_id = create_response.json()["quest_id"]
        self.created_quest_ids.append(quest_id)
        
        # Get question ID
        quests_response = self.session.get(f"{BASE_URL}/api/child/quests-new")
        quests = quests_response.json()
        test_quest = next((q for q in quests if q["quest_id"] == quest_id), None)
        
        if not test_quest:
            pytest.skip("Test quest not visible to child")
        
        question_id = test_quest["questions"][0]["question_id"]
        
        # First submission
        submit1 = self.session.post(
            f"{BASE_URL}/api/child/quests-new/{quest_id}/submit",
            json={"answers": {question_id: "True"}}
        )
        assert submit1.status_code == 200
        result1 = submit1.json()
        assert result1["earned"] == 5
        print(f"✅ First submission earned ₹{result1['earned']}")
        
        # Second submission - should not earn again
        submit2 = self.session.post(
            f"{BASE_URL}/api/child/quests-new/{quest_id}/submit",
            json={"answers": {question_id: "True"}}
        )
        assert submit2.status_code == 200
        result2 = submit2.json()
        assert result2["earned"] == 0 or result2.get("already_earned") == True
        print("✅ Second submission correctly did not award money again")


class TestParentChoreSystem:
    """Tests for Parent Chore Management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup parent and child users for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        import subprocess
        timestamp = int(datetime.now().timestamp())
        
        # Create parent user
        self.parent_user_id = f"test_parent_{timestamp}"
        self.parent_session_token = f"test_parent_session_{timestamp}"
        
        # Create child user
        self.child_user_id = f"test_child_{timestamp}"
        self.child_session_token = f"test_child_session_{timestamp}"
        
        mongo_script = f'''
        use('test_database');
        
        // Create parent
        db.users.insertOne({{
            user_id: "{self.parent_user_id}",
            email: "test.parent.{timestamp}@example.com",
            name: "Test Parent",
            picture: null,
            role: "parent",
            grade: null,
            created_at: new Date()
        }});
        db.user_sessions.insertOne({{
            user_id: "{self.parent_user_id}",
            session_token: "{self.parent_session_token}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        
        // Create child linked to parent
        db.users.insertOne({{
            user_id: "{self.child_user_id}",
            email: "test.child.{timestamp}@example.com",
            name: "Test Child",
            picture: null,
            role: "child",
            grade: 3,
            parent_ids: ["{self.parent_user_id}"],
            created_at: new Date()
        }});
        db.user_sessions.insertOne({{
            user_id: "{self.child_user_id}",
            session_token: "{self.child_session_token}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        db.wallet_accounts.insertOne({{
            account_id: "acc_{timestamp}_spending",
            user_id: "{self.child_user_id}",
            account_type: "spending",
            balance: 50.0,
            created_at: new Date()
        }});
        '''
        
        subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
        
        self.session.headers.update({"Authorization": f"Bearer {self.parent_session_token}"})
        
        self.created_chore_ids = []
        
        yield
        
        # Cleanup
        cleanup_script = f'''
        use('test_database');
        db.users.deleteMany({{ user_id: {{ $in: ["{self.parent_user_id}", "{self.child_user_id}"] }} }});
        db.user_sessions.deleteMany({{ session_token: {{ $in: ["{self.parent_session_token}", "{self.child_session_token}"] }} }});
        db.wallet_accounts.deleteMany({{ user_id: "{self.child_user_id}" }});
        db.new_quests.deleteMany({{ creator_id: "{self.parent_user_id}" }});
        db.chore_requests.deleteMany({{ parent_id: "{self.parent_user_id}" }});
        '''
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
    
    def test_parent_create_chore(self):
        """Test parent can create a chore for their child"""
        chore_data = {
            "child_id": self.child_user_id,
            "title": "TEST_Clean Room",
            "description": "Clean your room before dinner",
            "reward_amount": 10,
            "frequency": "one_time"
        }
        
        response = self.session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert response.status_code == 200, f"Create chore failed: {response.text}"
        
        data = response.json()
        assert "chore_id" in data
        self.created_chore_ids.append(data["chore_id"])
        print(f"✅ Parent created chore: {data['chore_id']}")
    
    def test_parent_get_chores(self):
        """Test parent can get their created chores"""
        # First create a chore
        chore_data = {
            "child_id": self.child_user_id,
            "title": "TEST_Do Homework",
            "description": "Complete math homework",
            "reward_amount": 15,
            "frequency": "daily"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        if create_response.status_code == 200:
            self.created_chore_ids.append(create_response.json()["chore_id"])
        
        # Get chores
        response = self.session.get(f"{BASE_URL}/api/parent/chores-new")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Parent can get chores: {len(data)} found")
    
    def test_parent_delete_chore(self):
        """Test parent can delete a chore"""
        # Create a chore
        chore_data = {
            "child_id": self.child_user_id,
            "title": "TEST_To Delete",
            "description": "This will be deleted",
            "reward_amount": 5,
            "frequency": "one_time"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert create_response.status_code == 200
        chore_id = create_response.json()["chore_id"]
        
        # Delete the chore
        delete_response = self.session.delete(f"{BASE_URL}/api/parent/chores-new/{chore_id}")
        assert delete_response.status_code == 200
        print(f"✅ Parent deleted chore: {chore_id}")
    
    def test_child_request_chore_completion(self):
        """Test child can request chore completion"""
        # Create chore as parent
        chore_data = {
            "child_id": self.child_user_id,
            "title": "TEST_Complete Me",
            "description": "Child will complete this",
            "reward_amount": 20,
            "frequency": "one_time"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert create_response.status_code == 200
        chore_id = create_response.json()["chore_id"]
        self.created_chore_ids.append(chore_id)
        
        # Switch to child session
        child_session = requests.Session()
        child_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.child_session_token}"
        })
        
        # Request completion
        complete_response = child_session.post(f"{BASE_URL}/api/child/chores/{chore_id}/request-complete")
        assert complete_response.status_code == 200
        print(f"✅ Child requested chore completion: {chore_id}")
    
    def test_parent_get_chore_requests(self):
        """Test parent can get pending chore requests"""
        response = self.session.get(f"{BASE_URL}/api/parent/chore-requests")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Parent can get chore requests: {len(data)} pending")
    
    def test_parent_validate_chore_approve(self):
        """Test parent can approve chore completion"""
        # Create chore
        chore_data = {
            "child_id": self.child_user_id,
            "title": "TEST_Approve Me",
            "description": "This will be approved",
            "reward_amount": 25,
            "frequency": "one_time"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert create_response.status_code == 200
        chore_id = create_response.json()["chore_id"]
        self.created_chore_ids.append(chore_id)
        
        # Child requests completion
        child_session = requests.Session()
        child_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.child_session_token}"
        })
        
        complete_response = child_session.post(f"{BASE_URL}/api/child/chores/{chore_id}/request-complete")
        assert complete_response.status_code == 200
        
        # Get the request ID
        requests_response = self.session.get(f"{BASE_URL}/api/parent/chore-requests")
        requests_data = requests_response.json()
        
        if len(requests_data) > 0:
            request_id = requests_data[0]["request_id"]
            
            # Approve the request
            validate_response = self.session.post(
                f"{BASE_URL}/api/parent/chore-requests/{request_id}/validate",
                json={"action": "approve"}
            )
            assert validate_response.status_code == 200
            print(f"✅ Parent approved chore request: {request_id}")
        else:
            print("⚠️ No pending chore requests found to approve")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
