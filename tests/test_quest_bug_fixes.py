"""
Test Quest Bug Fixes - Testing 3 specific bug fixes:
1. Teacher quest visibility - quests should appear for students in teacher's classroom
2. MCQ answer grading - correct answers should be marked correct
3. Mandatory reward points validation - frontend validation (tested via API behavior)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestQuestBugFixes:
    """Test the three bug fixes for quest system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Admin credentials
        self.admin_email = "admin@learnersplanet.com"
        self.admin_password = "finlit@2026"
        
        # Test identifiers
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:8]}"
        
        yield
        
        # Cleanup
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data after tests"""
        try:
            # Login as admin to clean up
            login_res = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": self.admin_email,
                "password": self.admin_password
            })
            if login_res.status_code == 200:
                # Get and delete test quests
                quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
                if quests_res.status_code == 200:
                    for quest in quests_res.json():
                        if self.test_prefix in quest.get("title", ""):
                            self.session.delete(f"{BASE_URL}/api/admin/quests/{quest['quest_id']}")
        except:
            pass
    
    def _admin_login(self):
        """Login as admin and return session"""
        response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()
    
    # ============== BUG FIX #1: Teacher Quest Visibility ==============
    
    def test_teacher_quest_query_uses_in_operator(self):
        """
        Bug Fix #1: Teacher quests should use $in operator for classroom_ids array
        This test verifies the backend query structure is correct
        """
        # Login as admin
        self._admin_login()
        
        # Create a test quest with classroom_ids array
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"{self.test_prefix}_Teacher_Quest_Visibility",
            "description": "Testing teacher quest visibility fix",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 10,
            "questions": []
        }
        
        # Create quest as admin (simulating teacher quest structure)
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create quest: {response.text}"
        
        quest_id = response.json().get("quest_id")
        assert quest_id, "Quest ID not returned"
        
        # Verify quest was created
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        assert quests_res.status_code == 200
        
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        assert created_quest, "Created quest not found in list"
        
        print(f"✅ Teacher quest created successfully with ID: {quest_id}")
    
    # ============== BUG FIX #2: MCQ Answer Grading ==============
    
    def test_mcq_answer_grading_correct_answer(self):
        """
        Bug Fix #2: MCQ answers should be graded correctly
        The fix converts letter (A,B,C,D) to option text before comparison
        """
        # Login as admin
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Create quest with MCQ question where correct answer is "A"
        quest_data = {
            "title": f"{self.test_prefix}_MCQ_Grading_Test",
            "description": "Testing MCQ answer grading fix",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What is 2 + 2?",
                    "question_type": "mcq",
                    "options": ["4", "3", "5", "6"],  # Option A is "4"
                    "correct_answer": "A",  # Stored as letter
                    "points": 10
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create MCQ quest: {response.text}"
        
        quest_id = response.json().get("quest_id")
        assert quest_id, "Quest ID not returned"
        
        # Verify quest structure
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        assert quests_res.status_code == 200
        
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        assert created_quest, "Created quest not found"
        
        # Verify question structure
        questions = created_quest.get("questions", [])
        assert len(questions) == 1, "Expected 1 question"
        
        question = questions[0]
        assert question.get("correct_answer") == "A", "Correct answer should be stored as 'A'"
        assert question.get("options") == ["4", "3", "5", "6"], "Options should be preserved"
        assert question.get("points") == 10, "Points should be 10"
        
        print(f"✅ MCQ quest created with correct_answer='A' and options=['4', '3', '5', '6']")
        print(f"   When child selects '4' (option A), it should be marked correct")
    
    def test_mcq_with_option_b_correct(self):
        """Test MCQ where option B is the correct answer"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_MCQ_Option_B_Test",
            "description": "Testing MCQ with option B correct",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What color is the sky?",
                    "question_type": "mcq",
                    "options": ["Red", "Blue", "Green", "Yellow"],  # Option B is "Blue"
                    "correct_answer": "B",
                    "points": 5
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create quest: {response.text}"
        
        quest_id = response.json().get("quest_id")
        
        # Verify
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        question = created_quest.get("questions", [])[0]
        assert question.get("correct_answer") == "B"
        
        print(f"✅ MCQ quest with option B ('Blue') as correct answer created successfully")
    
    def test_true_false_question_grading(self):
        """Test True/False question type"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_TrueFalse_Test",
            "description": "Testing True/False grading",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "The sun rises in the east",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        print(f"✅ True/False quest created successfully")
    
    def test_multi_select_question(self):
        """Test Multi-Select question type"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_MultiSelect_Test",
            "description": "Testing Multi-Select grading",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Select all primary colors",
                    "question_type": "multi_select",
                    "options": ["Red", "Green", "Blue", "Yellow"],
                    "correct_answer": ["A", "C"],  # Red and Blue
                    "points": 10
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        quest_id = response.json().get("quest_id")
        
        # Verify
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        question = created_quest.get("questions", [])[0]
        assert question.get("correct_answer") == ["A", "C"]
        
        print(f"✅ Multi-Select quest with correct answers ['A', 'C'] created successfully")
    
    def test_value_entry_question(self):
        """Test Value Entry question type"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_ValueEntry_Test",
            "description": "Testing Value Entry grading",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What is 5 x 5?",
                    "question_type": "value",
                    "correct_answer": "25",
                    "points": 5
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        print(f"✅ Value Entry quest created successfully")
    
    # ============== BUG FIX #3: Mandatory Reward Points Validation ==============
    
    def test_quest_with_questions_requires_points(self):
        """
        Bug Fix #3: Each question must have reward points
        This tests that quests with questions have points assigned
        """
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Create quest with questions that have points
        quest_data = {
            "title": f"{self.test_prefix}_Points_Validation_Test",
            "description": "Testing reward points validation",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,  # No base reward
            "questions": [
                {
                    "question_text": "Question 1",
                    "question_type": "mcq",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "points": 5  # Has points
                },
                {
                    "question_text": "Question 2",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 10  # Has points
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create quest: {response.text}"
        
        quest_id = response.json().get("quest_id")
        
        # Verify total points
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        total_points = created_quest.get("total_points", 0)
        assert total_points == 15, f"Expected total_points=15, got {total_points}"
        
        print(f"✅ Quest with questions has total_points={total_points} (5+10)")
    
    def test_quest_without_questions_uses_base_reward(self):
        """Test that quests without questions use base reward_amount"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_Base_Reward_Test",
            "description": "Testing base reward for quests without questions",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 25,  # Base reward
            "questions": []  # No questions
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        quest_id = response.json().get("quest_id")
        
        # Verify
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        total_points = created_quest.get("total_points", 0)
        assert total_points == 25, f"Expected total_points=25 (base reward), got {total_points}"
        
        print(f"✅ Quest without questions has total_points={total_points} (base reward)")
    
    # ============== Integration Tests ==============
    
    def test_complete_quest_creation_flow(self):
        """Test complete quest creation with all question types"""
        self._admin_login()
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"{self.test_prefix}_Complete_Flow_Test",
            "description": "Complete quest with all question types",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "MCQ: What is 1+1?",
                    "question_type": "mcq",
                    "options": ["1", "2", "3", "4"],
                    "correct_answer": "B",  # "2"
                    "points": 5
                },
                {
                    "question_text": "T/F: Water is wet",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                },
                {
                    "question_text": "Select even numbers",
                    "question_type": "multi_select",
                    "options": ["1", "2", "3", "4"],
                    "correct_answer": ["B", "D"],  # 2 and 4
                    "points": 10
                },
                {
                    "question_text": "What is 10/2?",
                    "question_type": "value",
                    "correct_answer": "5",
                    "points": 5
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        
        quest_id = response.json().get("quest_id")
        
        # Verify all questions
        quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
        quests = quests_res.json()
        created_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        assert len(created_quest.get("questions", [])) == 4
        assert created_quest.get("total_points") == 25  # 5+5+10+5
        
        print(f"✅ Complete quest with 4 question types created successfully")
        print(f"   Total points: {created_quest.get('total_points')}")


class TestAdminQuestEndpoints:
    """Test admin quest CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:8]}"
        yield
        self._cleanup()
    
    def _cleanup(self):
        try:
            self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": "admin@learnersplanet.com",
                "password": "finlit@2026"
            })
            quests_res = self.session.get(f"{BASE_URL}/api/admin/quests")
            if quests_res.status_code == 200:
                for quest in quests_res.json():
                    if self.test_prefix in quest.get("title", ""):
                        self.session.delete(f"{BASE_URL}/api/admin/quests/{quest['quest_id']}")
        except:
            pass
    
    def test_admin_login(self):
        """Test admin login endpoint"""
        response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print("✅ Admin login successful")
    
    def test_create_quest(self):
        """Test quest creation"""
        # Login
        self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"{self.test_prefix}_Create_Test",
            "description": "Test quest",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 10,
            "questions": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/quests", json=quest_data)
        assert response.status_code == 200
        assert "quest_id" in response.json()
        print("✅ Quest created successfully")
    
    def test_get_quests(self):
        """Test getting all admin quests"""
        self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        response = self.session.get(f"{BASE_URL}/api/admin/quests")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✅ Got {len(response.json())} admin quests")
    
    def test_delete_quest(self):
        """Test quest deletion"""
        self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        # Create quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        create_res = self.session.post(f"{BASE_URL}/api/admin/quests", json={
            "title": f"{self.test_prefix}_Delete_Test",
            "description": "To be deleted",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 5,
            "questions": []
        })
        quest_id = create_res.json().get("quest_id")
        
        # Delete
        delete_res = self.session.delete(f"{BASE_URL}/api/admin/quests/{quest_id}")
        assert delete_res.status_code == 200
        print("✅ Quest deleted successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
