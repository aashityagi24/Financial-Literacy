"""
MCQ Answer Validation Tests - Simplified
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


def get_teacher_session():
    """Get or create teacher session"""
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
    
    # Login again
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "test.mcq.teacher@example.com",
        "password": "testteacher123"
    })
    
    if response.status_code != 200:
        return None
    
    return session


def get_teacher_classroom(teacher_session):
    """Get or create classroom for teacher"""
    response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
    if response.status_code != 200:
        return None
    
    data = response.json()
    classrooms = data.get("classrooms", [])
    
    if classrooms:
        return classrooms[0]
    
    # Create a classroom
    classroom_data = {
        "name": f"MCQ Test Classroom {uuid.uuid4().hex[:6]}",
        "description": "For testing MCQ validation",
        "grade_level": 1  # Grade 1
    }
    
    response = teacher_session.post(f"{BASE_URL}/api/teacher/classrooms", json=classroom_data)
    if response.status_code not in [200, 201]:
        return None
    
    created = response.json()
    
    # Fetch classroom again to get full details
    response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
    data = response.json()
    for c in data.get("classrooms", []):
        if c.get("classroom_id") == created.get("classroom_id"):
            return c
    
    return created


def get_child_session(classroom):
    """Get or create child session and join classroom"""
    session = requests.Session()
    
    # Try logging in with existing child
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "test_mcq_child",
        "password": "testchild123"
    })
    
    if response.status_code != 200:
        # Create child via registration
        reg_data = {
            "username": "test_mcq_child",
            "password": "testchild123",
            "name": "MCQ Test Child",
            "role": "child",
            "grade": 1  # Grade 1
        }
        
        session.post(f"{BASE_URL}/api/auth/register", json=reg_data)
        
        # Login child
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test_mcq_child",
            "password": "testchild123"
        })
        
        if response.status_code != 200:
            return None
    
    # Join classroom if code available
    join_code = classroom.get("join_code") or classroom.get("invite_code")
    if join_code:
        session.post(f"{BASE_URL}/api/child/join-classroom", json={"join_code": join_code})
    
    return session


# Initialize test fixtures once
_teacher_session = None
_classroom = None
_child_session = None

def setup_module():
    """Setup test data"""
    global _teacher_session, _classroom, _child_session
    
    _teacher_session = get_teacher_session()
    if not _teacher_session:
        pytest.skip("Could not create teacher session")
    
    _classroom = get_teacher_classroom(_teacher_session)
    if not _classroom:
        pytest.skip("Could not create classroom")
    
    _child_session = get_child_session(_classroom)
    if not _child_session:
        pytest.skip("Could not create child session")


class TestMCQAnswerValidation:
    """Test MCQ answer validation where correct_answer='C' and user submits 'Wallet'"""
    
    def test_mcq_correct_answer_letter_vs_text(self):
        """
        Test: When correct_answer='C' and options=['Bank', 'Piggy Bank', 'Wallet', 'Pocket'],
        user submitting 'Wallet' should be marked correct
        """
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Validation_{uuid.uuid4().hex[:6]}",
            "description": "Testing MCQ answer validation",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
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
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200, f"Failed to create quest: {create_response.text}"
        created_quest = create_response.json()
        quest_id = created_quest.get("quest_id")
        
        try:
            # Get quest details to find question_id
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            assert quests_response.status_code == 200, f"Failed to get child quests: {quests_response.text}"
            
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                print(f"Quest {quest_id} not found. Child may not be enrolled in classroom.")
                pytest.skip("Quest not visible to child - classroom enrollment issue")
            
            questions = test_quest.get("questions", [])
            assert len(questions) > 0, "Quest has no questions"
            question_id = questions[0].get("question_id")
            
            # Child submits answer with option TEXT "Wallet" (not letter "C")
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Wallet"}}
            )
            assert submit_response.status_code == 200, f"Submit failed: {submit_response.text}"
            
            result = submit_response.json()
            print(f"MCQ Validation Result: {result}")
            
            # Verify the score is 10 (full points) - answer should be marked correct
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}. MCQ validation bug NOT fixed!"
            
            # Check detailed results if available
            results = result.get("results", [])
            if results:
                q_result = results[0]
                assert q_result.get("is_correct") == True, f"Question should be marked correct: {q_result}"
            
            print("✅ MCQ validation PASSED: 'Wallet' == 'C' when Wallet is option C")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_mcq_wrong_answer(self):
        """Test: When correct_answer='C', user submitting 'Bank' (option A) should be wrong"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Wrong_{uuid.uuid4().hex[:6]}",
            "description": "Testing wrong MCQ answer",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
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
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit wrong answer "Bank" (option A, not C)
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Bank"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"MCQ Wrong Answer Result: {result}")
            
            # Score should be 0 for wrong answer
            assert result.get("score") == 0, f"Expected score 0 for wrong answer, got {result.get('score')}"
            
            print("✅ MCQ wrong answer validation PASSED: 'Bank' != 'C'")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestMultiSelectAnswerValidation:
    """Test multi-select answer validation"""
    
    def test_multi_select_correct_answers(self):
        """Test: Multi-select with correct answers"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MultiSelect_{uuid.uuid4().hex[:6]}",
            "description": "Testing multi-select validation",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
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
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit with option texts
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: ["Saving", "Budgeting"]}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Multi-select Result: {result}")
            
            assert result.get("score") == 15, f"Expected score 15, got {result.get('score')}"
            
            print("✅ Multi-select validation PASSED: ['Saving', 'Budgeting'] == ['A', 'C']")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTrueFalseValidation:
    """Test true/false answer validation"""
    
    def test_true_false_correct(self):
        """Test: True/False question with correct answer"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false validation",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
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
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "True"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"True/False Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5, got {result.get('score')}"
            
            print("✅ True/False validation PASSED: 'True' == 'True'")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_true_false_case_insensitive(self):
        """Test: True/False should be case insensitive"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_Case_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false case sensitivity",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Wasting money is bad.",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit "true" (lowercase)
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "true"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"True/False Case Insensitive Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5 for case-insensitive match, got {result.get('score')}"
            
            print("✅ True/False case-insensitive validation PASSED: 'true' == 'True'")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestNumberEntryValidation:
    """Test value/number entry answer validation"""
    
    def test_number_entry_correct(self):
        """Test: Number entry with correct answer"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberEntry_{uuid.uuid4().hex[:6]}",
            "description": "Testing number entry validation",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "50 - 20 = ?",
                    "question_type": "value",
                    "correct_answer": "30",
                    "points": 10
                }
            ]
        }
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "30"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Number Entry Result: {result}")
            
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}"
            
            print("✅ Number entry validation PASSED: '30' == '30'")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


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
        
        # Test with grade filter
        response = session.get(f"{BASE_URL}/api/teacher/repository?grade=1")
        assert response.status_code == 200, f"Repository with grade filter failed: {response.text}"
        data_filtered = response.json()
        print(f"Repository with grade=1: {len(data_filtered.get('items', []))} items")
        
        print("✅ Teacher repository grade filter test PASSED")


class TestMixedQuestionTypeQuest:
    """Test quest with multiple question types"""
    
    def test_mixed_questions_all_correct(self):
        """Test: Quest with MCQ + TrueFalse + Value, all answered correctly"""
        if not _teacher_session or not _classroom or not _child_session:
            pytest.skip("Test data not initialized")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MixedQuestions_{uuid.uuid4().hex[:6]}",
            "description": "Testing mixed question types",
            "due_date": due_date,
            "classroom_id": _classroom.get("classroom_id"),
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
                    "question_text": "100 - 40 = ?",
                    "question_type": "value",
                    "correct_answer": "60",
                    "points": 10
                }
            ]
        }
        
        create_response = _teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200
        quest_id = create_response.json().get("quest_id")
        
        try:
            quests_response = _child_session.get(f"{BASE_URL}/api/child/quests")
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            questions = test_quest.get("questions", [])
            assert len(questions) == 3, f"Expected 3 questions, got {len(questions)}"
            
            # Build answers
            answers = {}
            for q in questions:
                q_id = q.get("question_id")
                q_type = q.get("question_type")
                
                if q_type == "mcq":
                    answers[q_id] = "Wallet"
                elif q_type == "true_false":
                    answers[q_id] = "True"
                elif q_type == "value":
                    answers[q_id] = "60"
            
            submit_response = _child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": answers}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"Mixed Questions Result: {result}")
            
            # Total points: 10 + 5 + 10 = 25
            assert result.get("score") == 25, f"Expected score 25, got {result.get('score')}"
            
            print("✅ Mixed question types validation PASSED: Score 25/25")
            
        finally:
            _teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
