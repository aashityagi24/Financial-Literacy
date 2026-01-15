"""
Test Teacher Quest functionality
- POST /api/teacher/quests - Create quest
- GET /api/teacher/quests - Get teacher's quests
- DELETE /api/teacher/quests/{quest_id} - Delete quest
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import subprocess
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data - will be set during setup
TEST_TEACHER_SESSION = None
TEST_TEACHER_ID = None
TEST_CLASSROOM_ID = None
CREATED_QUEST_IDS = []


def setup_module(module):
    """Create test teacher user and classroom via MongoDB"""
    global TEST_TEACHER_SESSION, TEST_TEACHER_ID, TEST_CLASSROOM_ID
    
    timestamp = int(datetime.now().timestamp() * 1000)
    
    # Create test teacher and classroom
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', f'''
        use('test_database');
        var teacherId = 'test-teacher-quest-{timestamp}';
        var teacherSession = 'test_teacher_quest_session_{timestamp}';
        var classroomId = 'class_quest_test_{timestamp}';
        
        db.users.insertOne({{
          user_id: teacherId,
          email: 'test.teacher.quest.{timestamp}@example.com',
          name: 'Test Quest Teacher',
          picture: 'https://via.placeholder.com/150',
          role: 'teacher',
          grade: null,
          created_at: new Date()
        }});
        
        db.user_sessions.insertOne({{
          user_id: teacherId,
          session_token: teacherSession,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        
        db.classrooms.insertOne({{
          classroom_id: classroomId,
          teacher_id: teacherId,
          name: 'Quest Test Classroom',
          description: 'Classroom for quest testing',
          grade_level: 3,
          invite_code: 'QT' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          created_at: new Date()
        }});
        
        print('SESSION=' + teacherSession);
        print('TEACHER_ID=' + teacherId);
        print('CLASSROOM_ID=' + classroomId);
        '''
    ], capture_output=True, text=True)
    
    # Parse the output
    output = result.stdout
    for line in output.split('\n'):
        if line.startswith('SESSION='):
            TEST_TEACHER_SESSION = line.split('=')[1].strip()
        elif line.startswith('TEACHER_ID='):
            TEST_TEACHER_ID = line.split('=')[1].strip()
        elif line.startswith('CLASSROOM_ID='):
            TEST_CLASSROOM_ID = line.split('=')[1].strip()
    
    if not TEST_TEACHER_SESSION:
        pytest.fail("Failed to create test teacher session")


def teardown_module(module):
    """Cleanup test data"""
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        db.users.deleteMany({user_id: /test-teacher-quest-/});
        db.user_sessions.deleteMany({session_token: /test_teacher_quest_session_/});
        db.classrooms.deleteMany({classroom_id: /class_quest_test_/});
        db.new_quests.deleteMany({creator_id: /test-teacher-quest-/});
        '''
    ], capture_output=True, text=True)


@pytest.fixture
def teacher_client():
    """Create authenticated session for teacher"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_TEACHER_SESSION}"
    })
    return session


class TestTeacherQuestAPIs:
    """Test Teacher Quest CRUD operations"""
    
    def test_get_teacher_quests_initial(self, teacher_client):
        """GET /api/teacher/quests - should return list (may be empty)"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/quests")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_teacher_quest_mcq(self, teacher_client):
        """POST /api/teacher/quests - create quest with MCQ questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_MCQ Math Quiz",
            "description": "Test MCQ quiz for students",
            "min_grade": 2,
            "max_grade": 4,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "What is 5 + 3?",
                    "question_type": "mcq",
                    "options": ["6", "7", "8", "9"],
                    "correct_answer": "8",
                    "points": 10
                }
            ]
        }
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "quest_id" in data
        assert data["message"] == "Quest created successfully"
        
        CREATED_QUEST_IDS.append(data["quest_id"])
    
    def test_create_teacher_quest_multi_select(self, teacher_client):
        """POST /api/teacher/quests - create quest with multi-select questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_MultiSelect Quiz",
            "description": "Test multi-select quiz",
            "min_grade": 3,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "Select all even numbers",
                    "question_type": "multi_select",
                    "options": ["1", "2", "3", "4"],
                    "correct_answer": ["2", "4"],
                    "points": 15
                }
            ]
        }
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "quest_id" in data
        CREATED_QUEST_IDS.append(data["quest_id"])
    
    def test_create_teacher_quest_true_false(self, teacher_client):
        """POST /api/teacher/quests - create quest with true/false questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_TrueFalse Quiz",
            "description": "Test true/false quiz",
            "min_grade": 1,
            "max_grade": 3,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "The sun rises in the east",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                }
            ]
        }
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "quest_id" in data
        CREATED_QUEST_IDS.append(data["quest_id"])
    
    def test_create_teacher_quest_value_entry(self, teacher_client):
        """POST /api/teacher/quests - create quest with value entry questions"""
        due_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_ValueEntry Quiz",
            "description": "Test value entry quiz",
            "min_grade": 2,
            "max_grade": 5,
            "due_date": due_date,
            "questions": [
                {
                    "question_text": "What is 10 x 5?",
                    "question_type": "value",
                    "correct_answer": "50",
                    "points": 20
                }
            ]
        }
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "quest_id" in data
        CREATED_QUEST_IDS.append(data["quest_id"])
    
    def test_get_teacher_quests_with_data(self, teacher_client):
        """GET /api/teacher/quests - should return created quests"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/quests")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Find our test quests
        test_quests = [q for q in data if q["title"].startswith("TEST_")]
        assert len(test_quests) >= 4, f"Expected at least 4 test quests, found {len(test_quests)}"
        
        # Verify quest structure
        for quest in test_quests:
            assert "quest_id" in quest
            assert "title" in quest
            assert "description" in quest
            assert "questions" in quest
            assert "total_points" in quest
            assert "due_date" in quest
            assert quest["creator_type"] == "teacher"
    
    def test_create_quest_with_multiple_questions(self, teacher_client):
        """POST /api/teacher/quests - create quest with multiple question types"""
        due_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        quest_data = {
            "title": "TEST_Mixed Quiz",
            "description": "Quiz with multiple question types",
            "min_grade": 0,
            "max_grade": 5,
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
                    "question_text": "Water is wet",
                    "question_type": "true_false",
                    "correct_answer": "True",
                    "points": 5
                },
                {
                    "question_text": "Select all primary colors",
                    "question_type": "multi_select",
                    "options": ["Red", "Green", "Blue", "Yellow"],
                    "correct_answer": ["Red", "Blue", "Yellow"],
                    "points": 15
                },
                {
                    "question_text": "How many days in a week?",
                    "question_type": "value",
                    "correct_answer": "7",
                    "points": 10
                }
            ]
        }
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "quest_id" in data
        CREATED_QUEST_IDS.append(data["quest_id"])
        
        # Verify the quest was created with correct total points
        response = teacher_client.get(f"{BASE_URL}/api/teacher/quests")
        quests = response.json()
        mixed_quest = next((q for q in quests if q["title"] == "TEST_Mixed Quiz"), None)
        assert mixed_quest is not None
        assert mixed_quest["total_points"] == 40  # 10 + 5 + 15 + 10
        assert len(mixed_quest["questions"]) == 4
    
    def test_delete_teacher_quest(self, teacher_client):
        """DELETE /api/teacher/quests/{quest_id} - delete a quest"""
        if not CREATED_QUEST_IDS:
            pytest.skip("No quests to delete")
        
        quest_id = CREATED_QUEST_IDS[0]
        response = teacher_client.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Quest deleted"
        
        # Verify quest was deleted
        response = teacher_client.get(f"{BASE_URL}/api/teacher/quests")
        quests = response.json()
        deleted_quest = next((q for q in quests if q["quest_id"] == quest_id), None)
        assert deleted_quest is None
        
        CREATED_QUEST_IDS.remove(quest_id)
    
    def test_teacher_dashboard_api(self, teacher_client):
        """GET /api/teacher/dashboard - verify dashboard loads"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "classrooms" in data
        assert "total_students" in data
    
    def test_teacher_classroom_details(self, teacher_client):
        """GET /api/teacher/classrooms/{id} - verify classroom details"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/classrooms/{TEST_CLASSROOM_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "classroom" in data
        assert "students" in data
        assert "challenges" in data


class TestTeacherQuestCleanup:
    """Cleanup remaining test quests"""
    
    def test_cleanup_remaining_quests(self, teacher_client):
        """Delete all remaining test quests"""
        for quest_id in CREATED_QUEST_IDS[:]:
            response = teacher_client.delete(f"{BASE_URL}/api/teacher/quests/{quest_id}")
            if response.status_code == 200:
                CREATED_QUEST_IDS.remove(quest_id)
        
        # Verify all cleaned up
        response = teacher_client.get(f"{BASE_URL}/api/teacher/quests")
        quests = response.json()
        test_quests = [q for q in quests if q["title"].startswith("TEST_")]
        # Just log if any remain, don't fail
        if test_quests:
            print(f"Note: {len(test_quests)} test quests remain")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
