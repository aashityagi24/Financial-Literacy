"""
Test Teacher Quest Bug Fixes - Testing 3 specific issues:
1. Bug Fix: Teacher quests should now appear for students in that classroom 
   (child's classroom_id retrieved from classroom_students collection using student_id field)
2. New Feature: Teacher can edit existing quests - Edit button, Edit dialog, Update button
3. End-to-end flow: Teacher creates quest -> Child sees quest -> Child submits answer -> Correct answer marked correct
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTeacherQuestVisibility:
    """Test Bug Fix #1: Teacher quests appearing for students in classroom"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Test identifiers
        self.test_id = str(int(datetime.now().timestamp() * 1000))
        
        # Create test teacher
        self.teacher_id = f"test-teacher-{self.test_id}"
        self.teacher_session = f"test_teacher_sess_{self.test_id}"
        
        # Create test child
        self.child_id = f"test-child-{self.test_id}"
        self.child_session = f"test_child_sess_{self.test_id}"
        
        # Create test classroom
        self.classroom_id = f"test-classroom-{self.test_id}"
        
        self._setup_test_data()
        
        yield
        
        # Cleanup
        self._cleanup_test_data()
    
    def _setup_test_data(self):
        """Create test teacher, child, classroom, and link them"""
        import pymongo
        client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = client['test_database']
        
        # Create teacher
        db.users.insert_one({
            "user_id": self.teacher_id,
            "email": f"test.teacher.{self.test_id}@example.com",
            "name": "Test Teacher",
            "picture": "https://via.placeholder.com/150",
            "role": "teacher",
            "grade": None,
            "created_at": datetime.utcnow()
        })
        
        # Create teacher session
        db.user_sessions.insert_one({
            "user_id": self.teacher_id,
            "session_token": self.teacher_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create child
        db.users.insert_one({
            "user_id": self.child_id,
            "email": f"test.child.{self.test_id}@example.com",
            "name": "Test Child",
            "picture": "https://via.placeholder.com/150",
            "role": "child",
            "grade": 3,
            "created_at": datetime.utcnow()
        })
        
        # Create child session
        db.user_sessions.insert_one({
            "user_id": self.child_id,
            "session_token": self.child_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create wallet for child
        db.wallet_accounts.insert_one({
            "account_id": f"acc_{self.test_id}",
            "user_id": self.child_id,
            "account_type": "spending",
            "balance": 100.0,
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create classroom
        db.classrooms.insert_one({
            "classroom_id": self.classroom_id,
            "teacher_id": self.teacher_id,
            "name": "Test Classroom",
            "description": "Test classroom for quest testing",
            "grade_level": 3,
            "invite_code": f"TEST{self.test_id[-4:].upper()}",
            "created_at": datetime.utcnow()
        })
        
        # Link child to classroom using student_id field (this is the key fix!)
        db.classroom_students.insert_one({
            "id": f"cs_{self.test_id}",
            "classroom_id": self.classroom_id,
            "student_id": self.child_id,  # Using student_id, not user_id
            "joined_at": datetime.utcnow().isoformat()
        })
        
        client.close()
    
    def _cleanup_test_data(self):
        """Clean up test data"""
        try:
            import pymongo
            client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client['test_database']
            
            db.users.delete_many({"user_id": {"$in": [self.teacher_id, self.child_id]}})
            db.user_sessions.delete_many({"session_token": {"$in": [self.teacher_session, self.child_session]}})
            db.classrooms.delete_one({"classroom_id": self.classroom_id})
            db.classroom_students.delete_one({"classroom_id": self.classroom_id})
            db.new_quests.delete_many({"creator_id": self.teacher_id})
            db.quest_completions.delete_many({"user_id": self.child_id})
            db.wallet_accounts.delete_many({"user_id": self.child_id})
            
            client.close()
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def test_teacher_can_create_quest(self):
        """Test that teacher can create a quest"""
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"Test Quest {self.test_id}",
            "description": "Testing teacher quest creation",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 10,
            "questions": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create quest: {response.text}"
        
        data = response.json()
        assert "quest_id" in data
        print(f"✅ Teacher created quest: {data['quest_id']}")
        
        return data["quest_id"]
    
    def test_child_sees_teacher_quest(self):
        """Test Bug Fix #1: Child can see teacher's quest after classroom link"""
        # First create a quest as teacher
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"Visibility Test Quest {self.test_id}",
            "description": "Testing quest visibility for child",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 15,
            "questions": []
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_res.status_code == 200
        quest_id = create_res.json()["quest_id"]
        print(f"✅ Teacher created quest: {quest_id}")
        
        # Now check as child
        self.session.headers.update({"Authorization": f"Bearer {self.child_session}"})
        
        child_quests_res = self.session.get(f"{BASE_URL}/api/child/quests-new?source=teacher")
        assert child_quests_res.status_code == 200, f"Failed to get child quests: {child_quests_res.text}"
        
        quests = child_quests_res.json()
        teacher_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        
        assert teacher_quest is not None, f"Child should see teacher's quest! Got quests: {[q.get('quest_id') for q in quests]}"
        print(f"✅ Child can see teacher's quest: {teacher_quest['title']}")
    
    def test_child_sees_all_quests(self):
        """Test that child sees quests from all sources"""
        # Create teacher quest
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"All Sources Test {self.test_id}",
            "description": "Testing all quest sources",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 20,
            "questions": []
        }
        
        self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        
        # Get all quests as child
        self.session.headers.update({"Authorization": f"Bearer {self.child_session}"})
        
        all_quests_res = self.session.get(f"{BASE_URL}/api/child/quests-new")
        assert all_quests_res.status_code == 200
        
        quests = all_quests_res.json()
        print(f"✅ Child sees {len(quests)} total quests")
        
        # Check sources
        sources = set(q.get("creator_type") for q in quests)
        print(f"   Quest sources: {sources}")


class TestTeacherQuestEdit:
    """Test New Feature: Teacher can edit existing quests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        self.test_id = str(int(datetime.now().timestamp() * 1000))
        self.teacher_id = f"test-teacher-edit-{self.test_id}"
        self.teacher_session = f"test_teacher_edit_sess_{self.test_id}"
        self.classroom_id = f"test-classroom-edit-{self.test_id}"
        
        self._setup_test_data()
        
        yield
        
        self._cleanup_test_data()
    
    def _setup_test_data(self):
        """Create test teacher and classroom"""
        import pymongo
        client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = client['test_database']
        
        db.users.insert_one({
            "user_id": self.teacher_id,
            "email": f"test.teacher.edit.{self.test_id}@example.com",
            "name": "Test Teacher Edit",
            "role": "teacher",
            "created_at": datetime.utcnow()
        })
        
        db.user_sessions.insert_one({
            "user_id": self.teacher_id,
            "session_token": self.teacher_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        db.classrooms.insert_one({
            "classroom_id": self.classroom_id,
            "teacher_id": self.teacher_id,
            "name": "Edit Test Classroom",
            "grade_level": 3,
            "invite_code": f"EDIT{self.test_id[-4:].upper()}",
            "created_at": datetime.utcnow()
        })
        
        client.close()
    
    def _cleanup_test_data(self):
        """Clean up test data"""
        try:
            import pymongo
            client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client['test_database']
            
            db.users.delete_one({"user_id": self.teacher_id})
            db.user_sessions.delete_one({"session_token": self.teacher_session})
            db.classrooms.delete_one({"classroom_id": self.classroom_id})
            db.new_quests.delete_many({"creator_id": self.teacher_id})
            
            client.close()
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def test_teacher_can_get_quest_for_edit(self):
        """Test GET /api/teacher/quests/{quest_id} endpoint"""
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        # Create quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"Edit Test Quest {self.test_id}",
            "description": "Original description",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 10,
            "questions": []
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_res.status_code == 200
        quest_id = create_res.json()["quest_id"]
        
        # Get quest for editing
        get_res = self.session.get(f"{BASE_URL}/api/teacher/quests/{quest_id}")
        assert get_res.status_code == 200, f"Failed to get quest: {get_res.text}"
        
        quest = get_res.json()
        assert quest["title"] == quest_data["title"]
        assert quest["description"] == quest_data["description"]
        print(f"✅ Teacher can get quest for editing: {quest_id}")
    
    def test_teacher_can_update_quest(self):
        """Test PUT /api/teacher/quests/{quest_id} endpoint"""
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        # Create quest
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"Update Test Quest {self.test_id}",
            "description": "Original description",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 10,
            "questions": []
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_res.status_code == 200
        quest_id = create_res.json()["quest_id"]
        
        # Update quest
        updated_data = {
            "title": f"UPDATED Quest {self.test_id}",
            "description": "Updated description",
            "min_grade": 1,
            "max_grade": 4,
            "due_date": due_date,
            "reward_amount": 25,
            "questions": [
                {
                    "question_text": "What is 2+2?",
                    "question_type": "mcq",
                    "options": ["3", "4", "5", "6"],
                    "correct_answer": "B",
                    "points": 5
                }
            ]
        }
        
        update_res = self.session.put(f"{BASE_URL}/api/teacher/quests/{quest_id}", json=updated_data)
        assert update_res.status_code == 200, f"Failed to update quest: {update_res.text}"
        print(f"✅ Teacher updated quest: {quest_id}")
        
        # Verify update
        get_res = self.session.get(f"{BASE_URL}/api/teacher/quests/{quest_id}")
        assert get_res.status_code == 200
        
        quest = get_res.json()
        assert quest["title"] == updated_data["title"]
        assert quest["description"] == updated_data["description"]
        assert len(quest["questions"]) == 1
        print(f"✅ Quest update verified - title: {quest['title']}, questions: {len(quest['questions'])}")
    
    def test_teacher_cannot_edit_other_teacher_quest(self):
        """Test that teacher cannot edit another teacher's quest"""
        # Create another teacher
        import pymongo
        client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = client['test_database']
        
        other_teacher_id = f"other-teacher-{self.test_id}"
        other_session = f"other_sess_{self.test_id}"
        
        db.users.insert_one({
            "user_id": other_teacher_id,
            "email": f"other.teacher.{self.test_id}@example.com",
            "name": "Other Teacher",
            "role": "teacher",
            "created_at": datetime.utcnow()
        })
        
        db.user_sessions.insert_one({
            "user_id": other_teacher_id,
            "session_token": other_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        client.close()
        
        try:
            # Create quest as first teacher
            self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
            
            due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json={
                "title": f"Protected Quest {self.test_id}",
                "description": "Should not be editable by others",
                "min_grade": 0,
                "max_grade": 5,
                "due_date": due_date,
                "reward_amount": 10,
                "questions": []
            })
            quest_id = create_res.json()["quest_id"]
            
            # Try to edit as other teacher
            self.session.headers.update({"Authorization": f"Bearer {other_session}"})
            
            update_res = self.session.put(f"{BASE_URL}/api/teacher/quests/{quest_id}", json={
                "title": "Hacked Quest",
                "description": "Should fail",
                "min_grade": 0,
                "max_grade": 5,
                "due_date": due_date,
                "reward_amount": 100,
                "questions": []
            })
            
            assert update_res.status_code == 404, f"Should not be able to edit other's quest: {update_res.status_code}"
            print(f"✅ Teacher cannot edit other teacher's quest (got 404 as expected)")
        finally:
            # Cleanup other teacher
            client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client['test_database']
            db.users.delete_one({"user_id": other_teacher_id})
            db.user_sessions.delete_one({"session_token": other_session})
            client.close()


class TestEndToEndQuestFlow:
    """Test End-to-end flow: Teacher creates quest -> Child sees quest -> Child submits -> Correct answer marked"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        self.test_id = str(int(datetime.now().timestamp() * 1000))
        
        self.teacher_id = f"test-teacher-e2e-{self.test_id}"
        self.teacher_session = f"test_teacher_e2e_sess_{self.test_id}"
        
        self.child_id = f"test-child-e2e-{self.test_id}"
        self.child_session = f"test_child_e2e_sess_{self.test_id}"
        
        self.classroom_id = f"test-classroom-e2e-{self.test_id}"
        
        self._setup_test_data()
        
        yield
        
        self._cleanup_test_data()
    
    def _setup_test_data(self):
        """Create test teacher, child, classroom, and link them"""
        import pymongo
        client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = client['test_database']
        
        # Create teacher
        db.users.insert_one({
            "user_id": self.teacher_id,
            "email": f"test.teacher.e2e.{self.test_id}@example.com",
            "name": "Test Teacher E2E",
            "role": "teacher",
            "created_at": datetime.utcnow()
        })
        
        db.user_sessions.insert_one({
            "user_id": self.teacher_id,
            "session_token": self.teacher_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create child
        db.users.insert_one({
            "user_id": self.child_id,
            "email": f"test.child.e2e.{self.test_id}@example.com",
            "name": "Test Child E2E",
            "role": "child",
            "grade": 3,
            "created_at": datetime.utcnow()
        })
        
        db.user_sessions.insert_one({
            "user_id": self.child_id,
            "session_token": self.child_session,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create wallet for child
        db.wallet_accounts.insert_one({
            "account_id": f"acc_e2e_{self.test_id}",
            "user_id": self.child_id,
            "account_type": "spending",
            "balance": 100.0,
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Create classroom
        db.classrooms.insert_one({
            "classroom_id": self.classroom_id,
            "teacher_id": self.teacher_id,
            "name": "E2E Test Classroom",
            "grade_level": 3,
            "invite_code": f"E2E{self.test_id[-4:].upper()}",
            "created_at": datetime.utcnow()
        })
        
        # Link child to classroom using student_id
        db.classroom_students.insert_one({
            "id": f"cs_e2e_{self.test_id}",
            "classroom_id": self.classroom_id,
            "student_id": self.child_id,
            "joined_at": datetime.utcnow().isoformat()
        })
        
        client.close()
    
    def _cleanup_test_data(self):
        """Clean up test data"""
        try:
            import pymongo
            client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client['test_database']
            
            db.users.delete_many({"user_id": {"$in": [self.teacher_id, self.child_id]}})
            db.user_sessions.delete_many({"session_token": {"$in": [self.teacher_session, self.child_session]}})
            db.classrooms.delete_one({"classroom_id": self.classroom_id})
            db.classroom_students.delete_one({"classroom_id": self.classroom_id})
            db.new_quests.delete_many({"creator_id": self.teacher_id})
            db.quest_completions.delete_many({"user_id": self.child_id})
            db.wallet_accounts.delete_many({"user_id": self.child_id})
            db.transactions.delete_many({"user_id": self.child_id})
            
            client.close()
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def test_complete_e2e_flow_with_mcq(self):
        """Test complete flow: Teacher creates MCQ quest -> Child sees -> Child answers correctly -> Gets reward"""
        # Step 1: Teacher creates quest with MCQ
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"E2E MCQ Quest {self.test_id}",
            "description": "Testing complete flow",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What is 2 + 2?",
                    "question_type": "mcq",
                    "options": ["3", "4", "5", "6"],  # B is correct (4)
                    "correct_answer": "B",
                    "points": 10
                }
            ]
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_res.status_code == 200, f"Failed to create quest: {create_res.text}"
        quest_id = create_res.json()["quest_id"]
        print(f"✅ Step 1: Teacher created quest: {quest_id}")
        
        # Step 2: Child sees the quest
        self.session.headers.update({"Authorization": f"Bearer {self.child_session}"})
        
        quests_res = self.session.get(f"{BASE_URL}/api/child/quests-new?source=teacher")
        assert quests_res.status_code == 200
        
        quests = quests_res.json()
        teacher_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        assert teacher_quest is not None, f"Child should see teacher's quest! Got: {[q.get('quest_id') for q in quests]}"
        print(f"✅ Step 2: Child sees quest: {teacher_quest['title']}")
        
        # Get question ID
        question_id = teacher_quest["questions"][0]["question_id"]
        
        # Step 3: Child submits correct answer
        # The correct answer is "B" which maps to option "4"
        submit_res = self.session.post(f"{BASE_URL}/api/child/quests-new/{quest_id}/submit", json={
            "answers": {
                question_id: "4"  # User selects option text "4" (which is option B)
            }
        })
        assert submit_res.status_code == 200, f"Failed to submit: {submit_res.text}"
        
        result = submit_res.json()
        print(f"✅ Step 3: Child submitted answer")
        print(f"   Results: {result['results']}")
        print(f"   Earned: {result['earned']}")
        
        # Verify correct answer was marked correct
        assert result["results"][0]["is_correct"] == True, "Correct answer should be marked correct!"
        assert result["earned"] == 10, f"Should earn 10 points, got {result['earned']}"
        print(f"✅ Step 4: Correct answer marked correct, earned ₹{result['earned']}")
    
    def test_e2e_flow_with_wrong_answer(self):
        """Test flow with wrong answer - should not earn points"""
        # Teacher creates quest
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"E2E Wrong Answer Quest {self.test_id}",
            "description": "Testing wrong answer",
            "min_grade": 0,
            "max_grade": 5,
            "due_date": due_date,
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What is 3 + 3?",
                    "question_type": "mcq",
                    "options": ["5", "6", "7", "8"],  # B is correct (6)
                    "correct_answer": "B",
                    "points": 15
                }
            ]
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = create_res.json()["quest_id"]
        
        # Child submits wrong answer
        self.session.headers.update({"Authorization": f"Bearer {self.child_session}"})
        
        quests_res = self.session.get(f"{BASE_URL}/api/child/quests-new?source=teacher")
        quests = quests_res.json()
        teacher_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        question_id = teacher_quest["questions"][0]["question_id"]
        
        submit_res = self.session.post(f"{BASE_URL}/api/child/quests-new/{quest_id}/submit", json={
            "answers": {
                question_id: "5"  # Wrong answer (option A)
            }
        })
        
        result = submit_res.json()
        assert result["results"][0]["is_correct"] == False, "Wrong answer should be marked incorrect!"
        assert result["earned"] == 0, f"Should earn 0 points for wrong answer, got {result['earned']}"
        print(f"✅ Wrong answer correctly marked as incorrect, earned ₹0")
    
    def test_e2e_flow_with_true_false(self):
        """Test flow with True/False question"""
        self.session.headers.update({"Authorization": f"Bearer {self.teacher_session}"})
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"E2E True/False Quest {self.test_id}",
            "description": "Testing True/False",
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
        
        create_res = self.session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = create_res.json()["quest_id"]
        
        # Child answers
        self.session.headers.update({"Authorization": f"Bearer {self.child_session}"})
        
        quests_res = self.session.get(f"{BASE_URL}/api/child/quests-new?source=teacher")
        quests = quests_res.json()
        teacher_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
        question_id = teacher_quest["questions"][0]["question_id"]
        
        submit_res = self.session.post(f"{BASE_URL}/api/child/quests-new/{quest_id}/submit", json={
            "answers": {
                question_id: "True"
            }
        })
        
        result = submit_res.json()
        assert result["results"][0]["is_correct"] == True
        assert result["earned"] == 5
        print(f"✅ True/False question answered correctly, earned ₹5")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
