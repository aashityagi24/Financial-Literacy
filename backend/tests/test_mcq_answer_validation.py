"""
MCQ Answer Validation Tests
Verifying bug fix: correct_answer stored as letter (A,B,C,D) but user submits option text
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta
from pymongo import MongoClient
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://learn-earn-41.preview.emergentagent.com').rstrip('/')

# Test credentials
TEACHER_EMAIL = "test.grade.teacher@example.com"
TEACHER_PASSWORD = "testteacher123"
CHILD_USERNAME = "test_mcq_child_final"
CHILD_PASSWORD = "testchild123"


def get_teacher_session():
    """Get teacher session"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return session
    return None


def get_child_session():
    """Get child session"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": CHILD_USERNAME,
        "password": CHILD_PASSWORD
    })
    if response.status_code == 200:
        return session
    return None


def get_classroom(teacher_session):
    """Get a classroom for testing"""
    dashboard = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
    if dashboard.status_code != 200:
        return None
    classrooms = dashboard.json().get("classrooms", [])
    return next((c for c in classrooms if c.get("grade_level") == 1), classrooms[0] if classrooms else None)


class TestMCQAnswerValidation:
    """Test MCQ answer validation - correct_answer='C' should match 'Wallet' option text"""
    
    def test_mcq_letter_to_text_conversion(self):
        """When correct_answer='C' and user submits 'Wallet' (option at index 2), it should be correct"""
        teacher = get_teacher_session()
        child = get_child_session()
        
        if not teacher or not child:
            pytest.skip("Could not login")
        
        classroom = get_classroom(teacher)
        if not classroom:
            pytest.skip("No classroom found")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"TEST_MCQ_{uuid.uuid4().hex[:6]}",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [{
                "question_text": "Where do you keep money?",
                "question_type": "mcq",
                "options": ["Bank", "Piggy Bank", "Wallet", "Pocket"],
                "correct_answer": "C",  # Letter C = index 2 = "Wallet"
                "points": 10
            }]
        }
        
        resp = teacher.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert resp.status_code == 200, f"Create quest failed: {resp.text}"
        quest_id = resp.json().get("quest_id")
        
        try:
            quests = child.get(f"{BASE_URL}/api/child/quests").json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            
            if not test_quest:
                pytest.skip("Quest not visible to child")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit 'Wallet' (option text, not letter 'C')
            submit = child.post(f"{BASE_URL}/api/child/quests/{quest_id}/submit", json={
                "answers": {question_id: "Wallet"}
            })
            assert submit.status_code == 200
            
            result = submit.json()
            assert result.get("score") == 10, f"MCQ validation bug: Expected 10, got {result.get('score')}"
            print("✅ MCQ letter-to-text validation PASSED")
        finally:
            teacher.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
    
    def test_mcq_wrong_answer(self):
        """Wrong answer should get 0 points"""
        teacher = get_teacher_session()
        child = get_child_session()
        
        if not teacher or not child:
            pytest.skip("Could not login")
        
        classroom = get_classroom(teacher)
        if not classroom:
            pytest.skip("No classroom found")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"TEST_MCQ_Wrong_{uuid.uuid4().hex[:6]}",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [{
                "question_text": "Test",
                "question_type": "mcq",
                "options": ["A_opt", "B_opt", "C_opt", "D_opt"],
                "correct_answer": "C",
                "points": 10
            }]
        }
        
        resp = teacher.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = resp.json().get("quest_id")
        
        try:
            quests = child.get(f"{BASE_URL}/api/child/quests").json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            if not test_quest:
                pytest.skip("Quest not visible")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            submit = child.post(f"{BASE_URL}/api/child/quests/{quest_id}/submit", json={
                "answers": {question_id: "A_opt"}  # Wrong
            })
            
            result = submit.json()
            assert result.get("score") == 0, f"Wrong answer should get 0, got {result.get('score')}"
            print("✅ MCQ wrong answer validation PASSED")
        finally:
            teacher.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestMultiSelectValidation:
    """Test multi-select answer validation"""
    
    def test_multi_select_correct(self):
        """Multi-select with correct option texts should get full points"""
        teacher = get_teacher_session()
        child = get_child_session()
        
        if not teacher or not child:
            pytest.skip("Could not login")
        
        classroom = get_classroom(teacher)
        if not classroom:
            pytest.skip("No classroom found")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"TEST_Multi_{uuid.uuid4().hex[:6]}",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [{
                "question_text": "Select good habits",
                "question_type": "multi_select",
                "options": ["Saving", "Wasting", "Budgeting", "Spending"],
                "correct_answer": ["A", "C"],  # Saving and Budgeting
                "points": 15
            }]
        }
        
        resp = teacher.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = resp.json().get("quest_id")
        
        try:
            quests = child.get(f"{BASE_URL}/api/child/quests").json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            if not test_quest:
                pytest.skip("Quest not visible")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            submit = child.post(f"{BASE_URL}/api/child/quests/{quest_id}/submit", json={
                "answers": {question_id: ["Saving", "Budgeting"]}
            })
            
            result = submit.json()
            assert result.get("score") == 15, f"Multi-select should get 15, got {result.get('score')}"
            print("✅ Multi-select validation PASSED")
        finally:
            teacher.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTrueFalseValidation:
    """Test true/false answer validation"""
    
    def test_true_false_case_insensitive(self):
        """True/false should be case insensitive"""
        teacher = get_teacher_session()
        child = get_child_session()
        
        if not teacher or not child:
            pytest.skip("Could not login")
        
        classroom = get_classroom(teacher)
        if not classroom:
            pytest.skip("No classroom found")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"TEST_TF_{uuid.uuid4().hex[:6]}",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [{
                "question_text": "Saving is good",
                "question_type": "true_false",
                "correct_answer": "True",
                "points": 5
            }]
        }
        
        resp = teacher.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = resp.json().get("quest_id")
        
        try:
            quests = child.get(f"{BASE_URL}/api/child/quests").json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            if not test_quest:
                pytest.skip("Quest not visible")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            # Submit lowercase "true"
            submit = child.post(f"{BASE_URL}/api/child/quests/{quest_id}/submit", json={
                "answers": {question_id: "true"}  # lowercase
            })
            
            result = submit.json()
            assert result.get("score") == 5, f"True/False should be case-insensitive, got {result.get('score')}"
            print("✅ True/False case-insensitive validation PASSED")
        finally:
            teacher.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestNumberEntryValidation:
    """Test number/value entry validation"""
    
    def test_number_entry_float(self):
        """Number entry should handle float values"""
        teacher = get_teacher_session()
        child = get_child_session()
        
        if not teacher or not child:
            pytest.skip("Could not login")
        
        classroom = get_classroom(teacher)
        if not classroom:
            pytest.skip("No classroom found")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        quest_data = {
            "title": f"TEST_Num_{uuid.uuid4().hex[:6]}",
            "due_date": due_date,
            "classroom_id": classroom.get("classroom_id"),
            "reward_amount": 0,
            "questions": [{
                "question_text": "10 / 4 = ?",
                "question_type": "value",
                "correct_answer": "2.5",
                "points": 10
            }]
        }
        
        resp = teacher.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        quest_id = resp.json().get("quest_id")
        
        try:
            quests = child.get(f"{BASE_URL}/api/child/quests").json()
            test_quest = next((q for q in quests if q.get("quest_id") == quest_id), None)
            if not test_quest:
                pytest.skip("Quest not visible")
            
            question_id = test_quest["questions"][0]["question_id"]
            
            submit = child.post(f"{BASE_URL}/api/child/quests/{quest_id}/submit", json={
                "answers": {question_id: "2.5"}
            })
            
            result = submit.json()
            assert result.get("score") == 10, f"Number entry should handle floats, got {result.get('score')}"
            print("✅ Number entry float validation PASSED")
        finally:
            teacher.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")


class TestTeacherRepositoryGradeFilter:
    """Test teacher repository grade filtering"""
    
    def test_repository_accepts_grade_param(self):
        """Repository endpoint should accept grade parameter"""
        teacher = get_teacher_session()
        if not teacher:
            pytest.skip("Could not login")
        
        # Without filter
        resp = teacher.get(f"{BASE_URL}/api/teacher/repository")
        assert resp.status_code == 200, f"Repository failed: {resp.text}"
        
        # With grade filter
        resp = teacher.get(f"{BASE_URL}/api/teacher/repository?grade=1")
        assert resp.status_code == 200, f"Repository with grade filter failed: {resp.text}"
        
        print("✅ Teacher repository grade filter PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
