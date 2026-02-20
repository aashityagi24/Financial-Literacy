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


class TestSetup:
    """Setup test data - create teacher, classroom, and child if needed"""
    
    @pytest.fixture(scope="module")
    def admin_session(self):
        """Get admin session via admin-login endpoint"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        return session
    
    @pytest.fixture(scope="module")
    def teacher_session(self, admin_session):
        """Create test teacher and get session"""
        session = requests.Session()
        
        # Try logging in with existing teacher
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test.mcq.teacher@example.com",
            "password": "testteacher123"
        })
        
        if response.status_code == 200:
            return session
        
        # Create teacher via registration
        reg_data = {
            "email": "test.mcq.teacher@example.com",
            "password": "testteacher123",
            "name": "MCQ Test Teacher",
            "role": "teacher",
            "school_name": "Test School"
        }
        
        response = session.post(f"{BASE_URL}/api/auth/register", json=reg_data)
        if response.status_code not in [200, 201]:
            pytest.skip(f"Failed to create teacher: {response.text}")
        
        # Now login
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test.mcq.teacher@example.com",
            "password": "testteacher123"
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed after creation: {response.text}")
        
        return session
    
    @pytest.fixture(scope="module") 
    def teacher_classroom(self, teacher_session):
        """Create or get classroom for teacher"""
        # Check if teacher has classrooms
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        if response.status_code != 200:
            pytest.skip("Failed to get teacher dashboard")
        
        data = response.json()
        classrooms = data.get("classrooms", [])
        
        if classrooms:
            return classrooms[0]
        
        # Create a classroom
        classroom_data = {
            "name": "MCQ Test Classroom",
            "description": "For testing MCQ validation",
            "grade_level": 1  # Grade 1
        }
        
        response = teacher_session.post(f"{BASE_URL}/api/teacher/classrooms", json=classroom_data)
        if response.status_code not in [200, 201]:
            pytest.skip(f"Failed to create classroom: {response.text}")
        
        created = response.json()
        
        # Fetch classroom again
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        data = response.json()
        classroom = next((c for c in data.get("classrooms", []) if c.get("classroom_id") == created.get("classroom_id")), None)
        
        if not classroom:
            classroom = created  # Use created data if not found in dashboard
        
        return classroom
    
    @pytest.fixture(scope="module")
    def child_session(self, teacher_classroom):
        """Create test child and get session"""
        session = requests.Session()
        
        # Try logging in with existing child
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test_mcq_child",
            "password": "testchild123"
        })
        
        if response.status_code == 200:
            # Check if child is in the classroom
            user_data = response.json().get("user", {})
            return session
        
        # Create child via registration
        reg_data = {
            "username": "test_mcq_child",
            "password": "testchild123",
            "name": "MCQ Test Child",
            "role": "child",
            "grade": 1  # Grade 1
        }
        
        response = session.post(f"{BASE_URL}/api/auth/register", json=reg_data)
        if response.status_code not in [200, 201]:
            pytest.skip(f"Failed to create child: {response.text}")
        
        # Login child
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test_mcq_child",
            "password": "testchild123"
        })
        if response.status_code != 200:
            pytest.skip(f"Child login failed after creation: {response.text}")
        
        # Join classroom
        join_code = teacher_classroom.get("join_code") or teacher_classroom.get("invite_code")
        if join_code:
            join_response = session.post(f"{BASE_URL}/api/child/join-classroom", json={"join_code": join_code})
            print(f"Join classroom response: {join_response.status_code} - {join_response.text}")
        
        return session


class TestMCQAnswerValidation(TestSetup):
    """Test MCQ answer validation where correct_answer='C' and user submits 'Wallet'"""
    
    def test_mcq_correct_answer_letter_vs_text(self, teacher_session, child_session, teacher_classroom):
        """
        Test: When correct_answer='C' and options=['Bank', 'Piggy Bank', 'Wallet', 'Pocket'],
        user submitting 'Wallet' should be marked correct
        """
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Validation_{uuid.uuid4().hex[:6]}",
            "description": "Testing MCQ answer validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                print(f"Quest {quest_id} not found in child's quests. Child may not be in classroom.")
                pytest.skip("Quest not visible to child - classroom enrollment issue")
            
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
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}. MCQ validation bug NOT fixed!"
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
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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


class TestMultiSelectAnswerValidation(TestSetup):
    """Test multi-select answer validation"""
    
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
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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


class TestTrueFalseValidation(TestSetup):
    """Test true/false answer validation"""
    
    def test_true_false_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: True/False question with correct answer"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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


class TestNumberEntryValidation(TestSetup):
    """Test value/number entry answer validation"""
    
    def test_number_entry_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: Number entry with correct answer"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberEntry_{uuid.uuid4().hex[:6]}",
            "description": "Testing number entry validation",
            "due_date": due_date,
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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
    
    def test_repository_grade_filter(self):
        """Test: GET /api/teacher/repository accepts grade parameter"""
        session = requests.Session()
        
        # Login as teacher
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test.mcq.teacher@example.com",
            "password": "testteacher123"
        })
        
        if response.status_code != 200:
            # Create the teacher if needed
            session.post(f"{BASE_URL}/api/auth/register", json={
                "email": "test.mcq.teacher@example.com",
                "password": "testteacher123",
                "name": "MCQ Test Teacher",
                "role": "teacher"
            })
            response = session.post(f"{BASE_URL}/api/auth/login", json={
                "identifier": "test.mcq.teacher@example.com",
                "password": "testteacher123"
            })
            if response.status_code != 200:
                pytest.skip("Could not login as teacher")
        
        # Test without grade filter
        response = session.get(f"{BASE_URL}/api/teacher/repository")
        assert response.status_code == 200, f"Repository access failed: {response.text}"
        data = response.json()
        print(f"Repository without filter: {len(data.get('items', []))} items")
        
        # Test with grade filter (grade 1)
        response = session.get(f"{BASE_URL}/api/teacher/repository?grade=1")
        assert response.status_code == 200, f"Repository with grade filter failed: {response.text}"
        data_filtered = response.json()
        print(f"Repository with grade=1: {len(data_filtered.get('items', []))} items")
        
        print("✅ Teacher repository grade filter test PASSED")


class TestMixedQuestionTypeQuest(TestSetup):
    """Test quest with multiple question types"""
    
    def test_mixed_questions_all_correct(self, teacher_session, child_session, teacher_classroom):
        """Test: Quest with MCQ + TrueFalse + Value, all answered correctly"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MixedQuestions_{uuid.uuid4().hex[:6]}",
            "description": "Testing mixed question types",
            "due_date": due_date,
            "classroom_id": teacher_classroom.get("classroom_id"),
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
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
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
