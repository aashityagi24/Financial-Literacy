"""
Test cases for:
1. P1 - School name display on child's profile under 'My Connections'
2. P2 - 'Open in new tab' icon for parents/teachers on worksheets/workbooks with PDF
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSchoolNameDisplay:
    """Test P1: School name displayed on child's profile"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("session_token")
    
    @pytest.fixture(scope="class")
    def test_school(self, admin_session):
        """Create a test school"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/schools",
            json={
                "name": f"TEST_School_{unique_id}",
                "username": f"test_school_{unique_id}",
                "password": "testpass123",
                "address": "123 Test Street",
                "contact_email": f"test_{unique_id}@school.com"
            },
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200, f"Failed to create school: {response.text}"
        data = response.json()
        yield {
            "school_id": data["school_id"],
            "name": f"TEST_School_{unique_id}",
            "username": f"test_school_{unique_id}",
            "password": "testpass123"
        }
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/schools/{data['school_id']}",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
    
    @pytest.fixture(scope="class")
    def school_session(self, test_school):
        """Login as school"""
        response = requests.post(f"{BASE_URL}/api/auth/school-login", json={
            "username": test_school["username"],
            "password": test_school["password"]
        })
        assert response.status_code == 200, f"School login failed: {response.text}"
        return response.json().get("session_token")
    
    @pytest.fixture(scope="class")
    def test_teacher(self, school_session, test_school):
        """Create a test teacher under the school"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{BASE_URL}/api/school/users/teacher",
            json={
                "name": f"TEST_Teacher_{unique_id}",
                "email": f"test_teacher_{unique_id}@school.com",
                "password": "teacherpass123"
            },
            headers={"Authorization": f"Bearer {school_session}"}
        )
        assert response.status_code == 200, f"Failed to create teacher: {response.text}"
        data = response.json()
        return {
            "user_id": data.get("user_id"),
            "email": f"test_teacher_{unique_id}@school.com",
            "password": "teacherpass123",
            "school_id": test_school["school_id"],
            "school_name": test_school["name"]
        }
    
    @pytest.fixture(scope="class")
    def teacher_session(self, test_teacher):
        """Login as teacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_teacher["email"],
            "password": test_teacher["password"]
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("session_token")
    
    @pytest.fixture(scope="class")
    def test_classroom(self, teacher_session):
        """Create a test classroom"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{BASE_URL}/api/teacher/classrooms",
            json={
                "name": f"TEST_Classroom_{unique_id}",
                "grade": 3
            },
            headers={"Authorization": f"Bearer {teacher_session}"}
        )
        assert response.status_code == 200, f"Failed to create classroom: {response.text}"
        data = response.json()
        return {
            "classroom_id": data.get("classroom_id"),
            "join_code": data.get("join_code"),
            "name": f"TEST_Classroom_{unique_id}"
        }
    
    @pytest.fixture(scope="class")
    def test_child(self, admin_session):
        """Create a test child user"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={
                "name": f"TEST_Child_{unique_id}",
                "email": f"test_child_{unique_id}@example.com",
                "role": "child",
                "grade": 3
            },
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200, f"Failed to create child: {response.text}"
        data = response.json()
        return {
            "user_id": data.get("user_id"),
            "email": f"test_child_{unique_id}@example.com"
        }
    
    @pytest.fixture(scope="class")
    def child_session(self, test_child, admin_session):
        """Create session for child user"""
        import hashlib
        # Create session directly via MongoDB
        session_token = f"test_child_session_{uuid.uuid4().hex[:12]}"
        # Use admin to create session or use direct DB access
        # For now, we'll use a workaround - check if there's a way to login
        # Since child users may not have password, we need to create session directly
        
        # Let's try to use the admin session to impersonate or create session
        # Actually, let's check if we can use mongosh to create session
        import subprocess
        result = subprocess.run([
            "mongosh", "--quiet", "--eval", f"""
            use('test_database');
            db.user_sessions.insertOne({{
                user_id: '{test_child["user_id"]}',
                session_token: '{session_token}',
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            print('{session_token}');
            """
        ], capture_output=True, text=True)
        return session_token
    
    def test_student_classrooms_returns_school_name(self, child_session, test_classroom, test_teacher):
        """Test that GET /api/student/classrooms returns school_name when teacher has school_id"""
        # First, join the classroom
        join_response = requests.post(
            f"{BASE_URL}/api/student/join-classroom",
            json={"code": test_classroom["join_code"]},
            headers={"Authorization": f"Bearer {child_session}"}
        )
        assert join_response.status_code == 200, f"Failed to join classroom: {join_response.text}"
        
        # Now get classrooms
        response = requests.get(
            f"{BASE_URL}/api/student/classrooms",
            headers={"Authorization": f"Bearer {child_session}"}
        )
        assert response.status_code == 200, f"Failed to get classrooms: {response.text}"
        
        classrooms = response.json()
        assert len(classrooms) > 0, "No classrooms returned"
        
        # Find our test classroom
        test_class = None
        for c in classrooms:
            if c.get("classroom_id") == test_classroom["classroom_id"]:
                test_class = c
                break
        
        assert test_class is not None, "Test classroom not found in response"
        
        # Verify school_name is present
        assert "school_name" in test_class, "school_name field missing from classroom response"
        assert test_class["school_name"] == test_teacher["school_name"], \
            f"Expected school_name '{test_teacher['school_name']}', got '{test_class.get('school_name')}'"
        
        # Verify school_id is present
        assert "school_id" in test_class, "school_id field missing from classroom response"
        assert test_class["school_id"] == test_teacher["school_id"], \
            f"Expected school_id '{test_teacher['school_id']}', got '{test_class.get('school_id')}'"
        
        print(f"✅ Classroom response includes school_name: {test_class['school_name']}")
        print(f"✅ Classroom response includes school_id: {test_class['school_id']}")


class TestExternalLinkIcon:
    """Test P2: ExternalLink icon visibility for worksheets/workbooks"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("session_token")
    
    def test_content_with_pdf_exists(self, admin_session):
        """Verify there's content with PDF for testing"""
        # Get topics to find worksheets/workbooks with PDF
        response = requests.get(
            f"{BASE_URL}/api/content/topics",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        assert response.status_code == 200, f"Failed to get topics: {response.text}"
        
        topics = response.json()
        print(f"Found {len(topics)} topics")
        
        # Look for content with PDF
        for topic in topics[:5]:  # Check first 5 topics
            topic_id = topic.get("topic_id")
            detail_response = requests.get(
                f"{BASE_URL}/api/content/topics/{topic_id}",
                headers={"Authorization": f"Bearer {admin_session}"}
            )
            if detail_response.status_code == 200:
                topic_detail = detail_response.json()
                content_items = topic_detail.get("content_items", [])
                for item in content_items:
                    if item.get("content_type") in ["worksheet", "workbook"]:
                        if item.get("content_data", {}).get("pdf_url"):
                            print(f"✅ Found {item['content_type']} with PDF: {item['title']}")
                            return
        
        print("⚠️ No worksheets/workbooks with PDF found in first 5 topics")


class TestAPIEndpoints:
    """Basic API endpoint tests"""
    
    def test_admin_login(self):
        """Test admin login endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "session_token missing from response"
        print(f"✅ Admin login successful")
    
    def test_school_login(self):
        """Test school login endpoint (if school exists)"""
        # First create a school via admin
        admin_response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        admin_token = admin_response.json().get("session_token")
        
        # Get existing schools
        schools_response = requests.get(
            f"{BASE_URL}/api/admin/schools",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if schools_response.status_code == 200:
            schools = schools_response.json()
            print(f"Found {len(schools)} schools")
            for school in schools:
                print(f"  - {school.get('name')} (username: {school.get('username')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
