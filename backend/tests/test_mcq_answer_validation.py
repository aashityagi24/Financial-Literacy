"""
MCQ Answer Validation Tests - Direct API Testing
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


@pytest.fixture(scope="session")
def test_sessions():
    """Setup test data - create teacher, classroom, and child"""
    teacher_session = requests.Session()
    child_session = requests.Session()
    
    # Create/login teacher
    teacher_response = teacher_session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "test.mcq.teacher@example.com",
        "password": "testteacher123"
    })
    
    if teacher_response.status_code != 200:
        # Register teacher
        teacher_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test.mcq.teacher@example.com",
            "password": "testteacher123",
            "name": "MCQ Test Teacher",
            "role": "teacher",
            "school_name": "Test School"
        })
        teacher_response = teacher_session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test.mcq.teacher@example.com",
            "password": "testteacher123"
        })
    
    if teacher_response.status_code != 200:
        pytest.skip(f"Could not login as teacher: {teacher_response.text}")
    
    # Get or create classroom
    dashboard = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard").json()
    classrooms = dashboard.get("classrooms", [])
    
    if not classrooms:
        # Create classroom
        create_resp = teacher_session.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": f"MCQ Test Classroom {uuid.uuid4().hex[:6]}",
            "description": "For testing MCQ validation",
            "grade_level": 1
        })
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create classroom: {create_resp.text}")
        
        # Refresh dashboard
        dashboard = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard").json()
        classrooms = dashboard.get("classrooms", [])
    
    classroom = classrooms[0] if classrooms else None
    if not classroom:
        pytest.skip("No classroom available")
    
    # Create/login child
    child_response = child_session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "test_mcq_child",
        "password": "testchild123"
    })
    
    if child_response.status_code != 200:
        # Register child
        child_session.post(f"{BASE_URL}/api/auth/register", json={
            "username": "test_mcq_child",
            "password": "testchild123",
            "name": "MCQ Test Child",
            "role": "child",
            "grade": 1
        })
        child_response = child_session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test_mcq_child",
            "password": "testchild123"
        })
    
    if child_response.status_code != 200:
        pytest.skip(f"Could not login as child: {child_response.text}")
    
    # Join classroom
    join_code = classroom.get("join_code") or classroom.get("invite_code")
    if join_code:
        child_session.post(f"{BASE_URL}/api/child/join-classroom", json={"join_code": join_code})
    
    return {
        "teacher_session": teacher_session,
        "child_session": child_session,
        "classroom": classroom
    }


class TestMCQAnswerValidation:
    """Test MCQ answer validation where correct_answer='C' and user submits 'Wallet'"""
    
    def test_mcq_correct_answer_letter_vs_text(self, test_sessions):
        """
        CRITICAL TEST: When correct_answer='C' and options=['Bank', 'Piggy Bank', 'Wallet', 'Pocket'],
        user submitting 'Wallet' should be marked correct
        """
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Validation_{uuid.uuid4().hex[:6]}",
            "description": "Testing MCQ answer validation",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Where do you keep your money?",
                    "question_type": "mcq",
                    "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                    "correct_answer": "C",  # Letter C = Wallet (index 2)
                    "points": 10
                }
            ]
        }
        
        # Create quest
        create_response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert create_response.status_code == 200, f"Failed to create quest: {create_response.text}"
        quest_id = create_response.json().get("quest_id")
        
        try:
            # Get quest to find question_id
            quests_response = child_session.get(f"{BASE_URL}/api/child/quests")
            assert quests_response.status_code == 200
            
            quests = quests_response.json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip(f"Quest {quest_id} not visible to child - enrollment issue")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit answer with option TEXT "Wallet" (not letter "C")
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Wallet"}}
            )
            assert submit_response.status_code == 200, f"Submit failed: {submit_response.text}"
            
            result = submit_response.json()
            print(f"\n>>> MCQ Validation Result: {result}")
            
            # MAIN ASSERTION: score should be 10 (full points)
            assert result.get("score") == 10, \
                f"MCQ BUG: Expected score 10, got {result.get('score')}. 'Wallet' should match 'C' when Wallet is option C"
            
            # Check detailed results
            results = result.get("results", [])
            if results:
                q_result = results[0]
                assert q_result.get("is_correct") == True, f"Question should be marked correct: {q_result}"
            
            print("✅ MCQ validation PASSED: 'Wallet' == 'C' when Wallet is option C")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_mcq_wrong_answer(self, test_sessions):
        """Test: When correct_answer='C', user submitting 'Bank' (option A) should be wrong"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MCQ_Wrong_{uuid.uuid4().hex[:6]}",
            "description": "Testing wrong MCQ answer",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Where do you keep your money?",
                    "question_type": "mcq",
                    "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                    "correct_answer": "C",  # Wallet
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
            
            # Submit wrong answer "Bank" (option A)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "Bank"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> MCQ Wrong Answer Result: {result}")
            
            # Score should be 0 for wrong answer
            assert result.get("score") == 0, f"Expected score 0 for wrong answer, got {result.get('score')}"
            
            print("✅ MCQ wrong answer validation PASSED: 'Bank' != 'C'")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestMultiSelectAnswerValidation:
    """Test multi-select answer validation"""
    
    def test_multi_select_correct_answers(self, test_sessions):
        """Test: Multi-select ['A', 'C'] matches ['Saving', 'Budgeting']"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MultiSelect_{uuid.uuid4().hex[:6]}",
            "description": "Testing multi-select validation",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Which are good money habits?",
                    "question_type": "multi_select",
                    "options": ["Saving", "Spending", "Budgeting", "Wasting"],
                    "correct_answer": ["A", "C"],  # Saving (index 0) and Budgeting (index 2)
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
            
            # Submit with option texts
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: ["Saving", "Budgeting"]}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> Multi-select Result: {result}")
            
            assert result.get("score") == 15, \
                f"Multi-select BUG: Expected score 15, got {result.get('score')}. ['Saving', 'Budgeting'] should match ['A', 'C']"
            
            print("✅ Multi-select validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_multi_select_partial_wrong(self, test_sessions):
        """Test: Partial multi-select answers should get 0 points"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MultiSelect_Wrong_{uuid.uuid4().hex[:6]}",
            "description": "Testing wrong multi-select",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "Which are good money habits?",
                    "question_type": "multi_select",
                    "options": ["Saving", "Spending", "Budgeting", "Wasting"],
                    "correct_answer": ["A", "C"],
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
            
            # Submit only partial (just Saving)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: ["Saving"]}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> Multi-select Partial Result: {result}")
            
            assert result.get("score") == 0, f"Expected score 0 for partial answer, got {result.get('score')}"
            
            print("✅ Multi-select partial answer validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTrueFalseValidation:
    """Test true/false answer validation"""
    
    def test_true_false_correct(self, test_sessions):
        """Test: True/False correct answer"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_{uuid.uuid4().hex[:6]}",
            "description": "Testing true/false validation",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
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
            
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "True"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> True/False Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5, got {result.get('score')}"
            
            print("✅ True/False validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_true_false_case_insensitive(self, test_sessions):
        """Test: True/False should be case insensitive"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_TrueFalse_Case_{uuid.uuid4().hex[:6]}",
            "description": "Testing case sensitivity",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
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
            
            # Submit "true" (lowercase)
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "true"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> True/False Case Insensitive Result: {result}")
            
            assert result.get("score") == 5, f"Expected score 5 for case-insensitive match, got {result.get('score')}"
            
            print("✅ True/False case-insensitive validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestNumberEntryValidation:
    """Test value/number entry answer validation"""
    
    def test_number_entry_correct(self, test_sessions):
        """Test: Number entry with correct answer"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberEntry_{uuid.uuid4().hex[:6]}",
            "description": "Testing number entry",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
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
            
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "30"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> Number Entry Result: {result}")
            
            assert result.get("score") == 10, f"Expected score 10, got {result.get('score')}"
            
            print("✅ Number entry validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_number_entry_float(self, test_sessions):
        """Test: Number entry with float values"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_NumberFloat_{uuid.uuid4().hex[:6]}",
            "description": "Testing float numbers",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [
                {
                    "question_text": "10 / 4 = ?",
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
            
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": {question_id: "2.5"}}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> Number Float Result: {result}")
            
            assert result.get("score") == 10, f"Expected score 10 for float match, got {result.get('score')}"
            
            print("✅ Number entry float validation PASSED")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTeacherRepositoryGradeFilter:
    """Test that teacher repository filters by classroom grade level"""
    
    def test_repository_grade_filter(self, test_sessions):
        """Test: GET /api/teacher/repository accepts grade parameter"""
        teacher_session = test_sessions["teacher_session"]
        
        # Test without grade filter
        response = teacher_session.get(f"{BASE_URL}/api/teacher/repository")
        assert response.status_code == 200, f"Repository access failed: {response.text}"
        data = response.json()
        print(f"\n>>> Repository without filter: {len(data.get('items', []))} items")
        
        # Test with grade filter
        response = teacher_session.get(f"{BASE_URL}/api/teacher/repository?grade=1")
        assert response.status_code == 200, f"Repository with grade filter failed: {response.text}"
        data_filtered = response.json()
        print(f">>> Repository with grade=1: {len(data_filtered.get('items', []))} items")
        
        print("✅ Teacher repository grade filter test PASSED")


class TestMixedQuestionTypeQuest:
    """Test quest with multiple question types"""
    
    def test_mixed_questions_all_correct(self, test_sessions):
        """Test: Quest with MCQ + TrueFalse + Value, all answered correctly"""
        teacher_session = test_sessions["teacher_session"]
        child_session = test_sessions["child_session"]
        classroom = test_sessions["classroom"]
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": f"TEST_MixedQuestions_{uuid.uuid4().hex[:6]}",
            "description": "Testing mixed question types",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
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
            
            submit_response = child_session.post(
                f"{BASE_URL}/api/child/quests/{quest_id}/submit",
                json={"answers": answers}
            )
            assert submit_response.status_code == 200
            
            result = submit_response.json()
            print(f"\n>>> Mixed Questions Result: {result}")
            
            # Total points: 10 + 5 + 10 = 25
            assert result.get("score") == 25, f"Expected score 25, got {result.get('score')}"
            
            # Check each question result
            results = result.get("results", [])
            for r in results:
                assert r.get("is_correct") == True, f"Question should be correct: {r}"
            
            print("✅ Mixed question types validation PASSED: Score 25/25")
            
        finally:
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
