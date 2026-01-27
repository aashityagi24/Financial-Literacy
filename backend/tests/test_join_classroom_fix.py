"""
Test Join Classroom Bug Fix - ObjectId Serialization and Teacher Info
Tests: POST /api/student/join-classroom, GET /api/student/classrooms
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session for child user Aashi M
CHILD_TOKEN = "test_sess_607235502edf45a6b4f7f0191a9fd1c0"

# Available classroom codes
CLASSROOM_CODE_1 = "88O02U"  # Class 3-A
CLASSROOM_CODE_2 = "X8YAH7"  # Class 1-C


@pytest.fixture
def child_session():
    """Session with child user authentication"""
    session = requests.Session()
    session.cookies.set("session_token", CHILD_TOKEN)
    return session


class TestJoinClassroomFix:
    """Test join classroom bug fix - ObjectId serialization and teacher info"""
    
    def test_01_join_classroom_returns_teacher_info(self, child_session):
        """POST /api/student/join-classroom returns classroom with teacher info"""
        response = child_session.post(
            f"{BASE_URL}/api/student/join-classroom",
            json={"code": CLASSROOM_CODE_1}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "classroom" in data, "Response should contain classroom"
        classroom = data["classroom"]
        
        # Verify classroom fields
        assert "classroom_id" in classroom, "Classroom should have classroom_id"
        assert "name" in classroom, "Classroom should have name"
        assert "teacher_id" in classroom, "Classroom should have teacher_id"
        
        # Verify teacher info is included
        assert "teacher" in classroom, "Classroom should have teacher info"
        teacher = classroom["teacher"]
        assert teacher is not None, "Teacher should not be None"
        assert "name" in teacher, "Teacher should have name"
        
        # Verify no ObjectId serialization error (would have failed with 500)
        print(f"✅ Join classroom returns teacher info: {teacher.get('name')}")
    
    def test_02_join_classroom_with_second_code(self, child_session):
        """POST /api/student/join-classroom works with second classroom code"""
        response = child_session.post(
            f"{BASE_URL}/api/student/join-classroom",
            json={"code": CLASSROOM_CODE_2}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        classroom = data["classroom"]
        assert "teacher" in classroom, "Classroom should have teacher info"
        assert classroom["teacher"]["name"], "Teacher name should be present"
        print(f"✅ Second classroom join works: {classroom['name']}")
    
    def test_03_get_student_classrooms_returns_teacher_info(self, child_session):
        """GET /api/student/classrooms returns classrooms with teacher info"""
        response = child_session.get(f"{BASE_URL}/api/student/classrooms")
        assert response.status_code == 200, f"Failed: {response.text}"
        classrooms = response.json()
        
        assert isinstance(classrooms, list), "Response should be a list"
        assert len(classrooms) > 0, "Student should be enrolled in at least one classroom"
        
        for classroom in classrooms:
            # Verify classroom structure
            assert "classroom_id" in classroom, "Classroom should have classroom_id"
            assert "name" in classroom, "Classroom should have name"
            
            # Verify teacher info
            assert "teacher" in classroom, f"Classroom {classroom['name']} should have teacher info"
            teacher = classroom["teacher"]
            assert teacher is not None, "Teacher should not be None"
            assert "name" in teacher, "Teacher should have name"
            print(f"✅ Classroom '{classroom['name']}' has teacher: {teacher['name']}")
    
    def test_04_invalid_classroom_code_returns_404(self, child_session):
        """POST /api/student/join-classroom with invalid code returns 404"""
        response = child_session.post(
            f"{BASE_URL}/api/student/join-classroom",
            json={"code": "INVALID123"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have detail"
        print("✅ Invalid classroom code returns 404")
    
    def test_05_join_classroom_case_insensitive(self, child_session):
        """POST /api/student/join-classroom handles lowercase codes"""
        response = child_session.post(
            f"{BASE_URL}/api/student/join-classroom",
            json={"code": CLASSROOM_CODE_1.lower()}  # lowercase
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✅ Classroom code is case-insensitive")


class TestDefaultAvatars:
    """Test default avatar utility - verified via frontend"""
    
    def test_01_auth_me_returns_user_without_picture(self, child_session):
        """GET /api/auth/me returns user data (picture may be null for default avatar)"""
        response = child_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Failed: {response.text}"
        user = response.json()
        
        assert "user_id" in user, "User should have user_id"
        assert "name" in user, "User should have name"
        assert "role" in user, "User should have role"
        
        # Picture can be null - frontend uses getDefaultAvatar utility
        print(f"✅ User data returned: {user['name']} ({user['role']})")
        if user.get("picture"):
            print(f"   Has picture: {user['picture'][:50]}...")
        else:
            print("   No picture - frontend will use default avatar")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
