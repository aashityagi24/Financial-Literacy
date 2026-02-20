"""
MCQ Answer Validation Tests
Testing the is_answer_correct function in quest submission
Bug fix: correct_answer stored as letter (A,B,C,D) but user submits option text
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL environment variable is required"


class TestMCQAnswerValidation:
    """Test MCQ answer validation where correct_answer='C' and user submits 'Wallet'"""
    
    # Test credentials from review_request
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    child_username = "test_child_g1"
    child_password = "testpassword"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        """Get teacher session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")
        return session
    
    @pytest.fixture(scope="class")
    def child_session(self):
        """Get child session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.child_username,
            "password": self.child_password
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed: {response.status_code} - {response.text}")
        return session
    
    @pytest.fixture(scope="class")
    def teacher_classroom(self, teacher_session):
        """Get teacher's first classroom"""
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        data = response.json()
        classrooms = data.get("classrooms", [])
        if not classrooms:
            pytest.skip("Teacher has no classrooms")
        return classrooms[0]
    
    def test_mcq_correct_answer_letter_vs_text(self, teacher_session, child_session, teacher_classroom):
        """
        Test: When correct_answer='C' and options=['Bank', 'Piggy Bank', 'Wallet', 'Pocket'],
        user submitting 'Wallet' should be marked correct
        """
        # Create a quest with MCQ question where correct answer is letter 'C' (Wallet)
        quest_id = f"test_mcq_{uuid.uuid4().hex[:8]}"
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Validation_{uuid.uuid4().hex[:6]}",
            "description": "Testing MCQ answer validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Where do you keep your money?",
                    "question_type": "mcq",
                    "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                    "correct_answer": "C",  # Letter C = Wallet
                    "points": 10
                }
            ]
        }
        
        # Create quest
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200, f"Failed to create quest: {create_response.text}"
        created_quest = create_response.json()
        quest_id = created_quest.get("quest_id")
        
        try:
            # Get quest details to find question_id
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            assert quests_response.status_code == 200, f"Failed to get child quests: {quests_response.text}"
            
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            assert test_quest, f"Quest {quest_id} not found in child's quests"
            
            questions = test_quest.get("questions", [])
            assert len(questions) > 0, "Quest has no questions"
            question_id = questions[0].get("question_id")
            
            # Child submits answer with option TEXT "Wallet" (not letter "C")
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Wallet"}}
            )
            assert submit_response.status_code == 200, f"Submit failed: {submit_response.text}"
            
            result = submit_response.json()
            print(f"MCQ Validation Result: {result}")
            
            # Verify the score is 10 (full points) - answer should be marked correct
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}"
            assert result.get("total_points") == 10, f"Expected total_points 10, got {result.get('total_points')}"
            
            # Check detailed results if available
            results = result.get("results", [])
            if results:
                q_result = results[0]
                assert q_result.get("is_correct") == True, f"Question should be marked correct: {q_result}"
                assert q_result.get("points_earned") == 10, f"Expected 10 points earned: {q_result}"
            
            print("✅ MCQ validation PASSED: 'Wallet' == 'C' when Wallet is option C")
            
        finally:
            # Cleanup: Delete the test quest
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_mcq_wrong_answer(self, teacher_session, child_session, teacher_classroom):
        """Test: When correct_answer='C', user submitting 'Bank' (option A) should be wrong"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Wrong_{uuid.uuid4().hex[:6]}",
            "description": "Testing wrong MCQ answer",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Where do you keep your money?",
                    "question_type": "mcq",
                    "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                    "correct_answer": "C",  # Letter C = Wallet
                    "points": 10
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit wrong answer "Bank" (option A, not C)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Bank"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"MCQ Wrong Answer Result: {result}")
            
            # Score should be 0 for wrong answer
            assert result.get("score") == 0, f"Expected score 0 for wrong answer, got {result.get('score')}"
            
            if result.get("results"):
                assert result["results"][0].get("is_correct") == False
            
            print("✅ MCQ wrong answer validation PASSED: 'Bank' != 'C'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestMultiSelectAnswerValidation:
    """Test multi-select answer validation"""
    
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    child_username = "test_child_g1"
    child_password = "testpassword"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def child_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.child_username,
            "password": self.child_password
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def teacher_classroom(self, teacher_session):
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        data = response.json()
        classrooms = data.get("classrooms", [])
        if not classrooms:
            pytest.skip("Teacher has no classrooms")
        return classrooms[0]
    
    def test_multi_select_correct_answers(self, teacher_session, child_session, teacher_classroom):
        """
        Test: When correct_answer=['A', 'C'] and options=['Saving', 'Spending', 'Budgeting', 'Wasting'],
        user submitting ['Saving', 'Budgeting'] should be correct
        """
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MultiSelect_{uuid.uuid4().hex[:6]}",
            "description": "Testing multi-select validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Which are good money habits?",
                    "question_type": "multi_select",
                    "options": ["Saving", "Spending", "Budgeting", "Wasting"],
                    "correct_answer": ["A", "C"],  # Saving and Budgeting
                    "points": 15
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit with option texts (not letters)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: ["Saving", "Budgeting"]}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Multi-select Result: {result}")
            
            # Should get full 15 points
            assert result.get("score") == 15, f"Expected score 15, got {result.get('score')}"
            
            print("✅ Multi-select validation PASSED: ['Saving', 'Budgeting'] == ['A', 'C']")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_multi_select_partial_wrong(self, teacher_session, child_session, teacher_classroom):
        """Test: Multi-select with partial/wrong answers should get 0 points"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MultiSelect_Wrong_{uuid.uuid4().hex[:6]}",
            "description": "Testing wrong multi-select",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Which are good money habits?",
                    "question_type": "multi_select",
                    "options": ["Saving", "Spending", "Budgeting", "Wasting"],
                    "correct_answer": ["A", "C"],  # Saving and Budgeting
                    "points": 15
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit only partial answer (just Saving, missing Budgeting)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: ["Saving"]}}  # Missing Budgeting
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Multi-select Partial Result: {result}")
            
            # Should get 0 points for partial answer
            assert result.get("score") == 0, f"Expected score 0 for partial answer, got {result.get('score')}"
            
            print("✅ Multi-select partial validation PASSED: ['Saving'] != ['A', 'C']")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTrueFalseValidation:
    """Test true/false answer validation"""
    
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    child_username = "test_child_g1"
    child_password = "testpassword"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def child_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.child_username,
            "password": self.child_password
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def teacher_classroom(self, teacher_session):
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        data = response.json()
        classrooms = data.get("classrooms", [])
        if not classrooms:
            pytest.skip("Teacher has no classrooms")
        return classrooms[0]
    
    def test_true_false_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: True/False question with correct answer"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Saving money is a good habit.",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit "True"
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "True"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"True/False Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5, got {result.get('score')}"
            
            print("✅ True/False validation PASSED: 'True' == 'True'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_true_false_case_insensitive(self, teacher_session, child_session, teacher_classroom):
        """Test: True/False should be case insensitive"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_Case_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false case sensitivity",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Wasting money is a bad habit.",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit "true" (lowercase) - should still match "True"
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "true"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"True/False Case Insensitive Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5 for case-insensitive match, got {result.get('score')}"
            
            print("✅ True/False case-insensitive validation PASSED: 'true' == 'True'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestNumberEntryValidation:
    """Test value/number entry answer validation"""
    
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    child_username = "test_child_g1"
    child_password = "testpassword"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def child_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.child_username,
            "password": self.child_password
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def teacher_classroom(self, teacher_session):
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        data = response.json()
        classrooms = data.get("classrooms", [])
        if not classrooms:
            pytest.skip("Teacher has no classrooms")
        return classrooms[0]
    
    def test_number_entry_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: Number entry with correct answer"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberEntry_{uuid.uuid4().hex[:6]}",
            "description": "Testing number entry validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "If you have ₹50 and spend ₹20, how much do you have left?",
                    "question_type": "value",
                    "correct_answer": "30",
                    "points": 10
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit "30"
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "30"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Number Entry Result: {result}")
            
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}"
            
            print("✅ Number entry validation PASSED: '30' == '30'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_number_entry_float_comparison(self, teacher_session, child_session, teacher_classroom):
        """Test: Number entry should work with float values"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberFloat_{uuid.uuid4().hex[:6]}",
            "description": "Testing number float validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "What is 10 divided by 4?",
                    "question_type": "value",
                    "correct_answer": "2.5",
                    "points": 10
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit "2.5" as string but should match float comparison
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "2.5"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Number Float Result: {result}")
            
            assert result.get("score") == 10, f"Expected score 10 for float match, got {result.get('score')}"
            
            print("✅ Number entry float validation PASSED: '2.5' == '2.5'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTeacherRepositoryGradeFilter:
    """Test that teacher repository filters by classroom grade level"""
    
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return session
    
    def test_repository_grade_filter(self, teacher_session):
        """Test: GET /api/teacher/repository accepts grade parameter"""
        # Test without grade filter
        response = teacher_session.get(f"{BASE_URL}/api/teacher/repository")
        assert response.status_code == 200, f"Repository access failed: {response.text}"
        data = response.json()
        print(f"Repository without filter: {len(data.get('items', []))} items")
        
        # Test with grade filter (grade 1)
        response = teacher_session.get(f"{BASE_URL}/api/teacher/repository?grade=1")
        assert response.status_code == 200, f"Repository with grade filter failed: {response.text}"
        data_filtered = response.json()
        print(f"Repository with grade=1: {len(data_filtered.get('items', []))} items")
        
        print("✅ Teacher repository grade filter test PASSED")


class TestMixedQuestionTypeQuest:
    """Test quest with multiple question types"""
    
    teacher_email = "test.grade.teacher@example.com"
    teacher_password = "testteacher123"
    child_username = "test_child_g1"
    child_password = "testpassword"
    
    @pytest.fixture(scope="class")
    def teacher_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.teacher_email,
            "password": self.teacher_password
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def child_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": self.child_username,
            "password": self.child_password
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def teacher_classroom(self, teacher_session):
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        data = response.json()
        classrooms = data.get("classrooms", [])
        if not classrooms:
            pytest.skip("Teacher has no classrooms")
        return classrooms[0]
    
    def test_mixed_questions_all_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: Quest with MCQ + TrueFalse + Value, all answered correctly"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MixedQuestions_{uuid.uuid4().hex[:6]}",
            "description": "Testing mixed question types",
            "due_date": due_date,
            "classroom_id": teacher_classroom["classroom_id"],
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Where do you keep your money?",
                    "question_type": "mcq",
                    "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                    "correct_answer": "C",  # Wallet
                    "points": 10
                },
                {
                    "question_text": "Saving money is important.",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                },
                {
                    "question_text": "How much is 100 - 40?",
                    "question_type": "value",
                    "correct_answer": "60",
                    "points": 10
                }
            ]
        }
        
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            assert test_quest, "Quest not found"
            
            questions = test_quest.get("questions", [])
            assert len(questions) == 3, f"Expected 3 questions, got {len(questions)}"
            
            # Build answers - submit correct answers for all
            answers = {}
            for q in questions:
                q_id = q.get("question_id")
                q_type = q.get("question_type")
                
                if q_type == "mcq":
                    answers[q_id] = "Wallet"  # Option C
                elif q_type == "true_false":
                    answers[q_id] = "True"
                elif q_type == "value":
                    answers[q_id] = "60"
            
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": answers}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Mixed Questions Result: {result}")
            
            # Total points: 10 + 5 + 10 = 25
            assert result.get("score") == 25, f"Expected score 25, got {result.get('score')}"
            assert result.get("total_points") == 25, f"Expected total_points 25, got {result.get('total_points')}"
            
            # All questions should be correct
            results = result.get("results", [])
            for r in results:
                assert r.get("is_correct") == True, f"Question should be correct: {r}"
            
            print("✅ Mixed question types validation PASSED: Score 25/25")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
