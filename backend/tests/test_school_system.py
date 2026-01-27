"""
Test School System APIs for CoinQuest
Tests: School login, School dashboard, Admin school management
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSchoolLogin:
    """Test school login functionality"""
    
    def test_school_login_valid_credentials(self):
        """Test school login with valid credentials (springfield/test123)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "springfield", "password": "test123"}
        )
        print(f"School login response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "school" in data, "Response should contain 'school' key"
        assert "session_token" in data, "Response should contain 'session_token' key"
        assert data["school"]["username"] == "springfield"
        assert data["school"]["role"] == "school"
        print(f"✅ School login successful: {data['school']['name']}")
    
    def test_school_login_invalid_credentials(self):
        """Test school login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "invalid_school", "password": "wrongpass"}
        )
        print(f"Invalid login response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")
    
    def test_school_login_wrong_password(self):
        """Test school login with correct username but wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "springfield", "password": "wrongpassword"}
        )
        print(f"Wrong password response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Wrong password correctly rejected")


class TestSchoolDashboard:
    """Test school dashboard functionality"""
    
    @pytest.fixture
    def school_session(self):
        """Get authenticated school session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "springfield", "password": "test123"}
        )
        if response.status_code != 200:
            pytest.skip("School login failed - cannot test dashboard")
        
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_school_dashboard_authenticated(self, school_session):
        """Test school dashboard with valid session"""
        response = school_session.get(f"{BASE_URL}/api/school/dashboard")
        print(f"Dashboard response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Response should contain 'stats'"
        assert "teachers" in data, "Response should contain 'teachers'"
        assert "students" in data, "Response should contain 'students'"
        assert "school" in data, "Response should contain 'school'"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_teachers" in stats
        assert "total_students" in stats
        assert "total_classrooms" in stats
        
        print(f"✅ Dashboard loaded: {stats['total_teachers']} teachers, {stats['total_students']} students")
    
    def test_school_dashboard_unauthenticated(self):
        """Test school dashboard without authentication"""
        response = requests.get(f"{BASE_URL}/api/school/dashboard")
        print(f"Unauthenticated dashboard response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Unauthenticated access correctly rejected")
    
    def test_school_students_comparison(self, school_session):
        """Test school students comparison endpoint"""
        response = school_session.get(f"{BASE_URL}/api/school/students/comparison")
        print(f"Students comparison response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "students" in data, "Response should contain 'students'"
        print(f"✅ Students comparison loaded: {len(data['students'])} students")


class TestAdminSchoolManagement:
    """Test admin school management functionality"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": "admin@learnersplanet.com", "password": "finlit@2026"}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed - cannot test admin endpoints")
        
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_admin_get_schools(self, admin_session):
        """Test admin can get list of schools"""
        response = admin_session.get(f"{BASE_URL}/api/admin/schools")
        print(f"Admin get schools response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if springfield school exists
        school_names = [s.get("name", "") for s in data]
        print(f"✅ Found {len(data)} schools: {school_names}")
    
    def test_admin_create_and_delete_school(self, admin_session):
        """Test admin can create and delete a school"""
        test_username = f"TEST_school_{uuid.uuid4().hex[:8]}"
        
        # Create school
        create_response = admin_session.post(
            f"{BASE_URL}/api/admin/schools",
            json={
                "name": "TEST School for Deletion",
                "username": test_username,
                "password": "testpass123",
                "address": "123 Test Street",
                "contact_email": "test@school.edu"
            }
        )
        print(f"Create school response: {create_response.status_code}")
        print(f"Response body: {create_response.text[:300]}")
        
        assert create_response.status_code == 200, f"Expected 200, got {create_response.status_code}: {create_response.text}"
        
        create_data = create_response.json()
        assert "school_id" in create_data, "Response should contain school_id"
        school_id = create_data["school_id"]
        print(f"✅ School created with ID: {school_id}")
        
        # Verify school appears in list
        list_response = admin_session.get(f"{BASE_URL}/api/admin/schools")
        schools = list_response.json()
        school_ids = [s.get("school_id") for s in schools]
        assert school_id in school_ids, "Created school should appear in list"
        print("✅ School appears in admin list")
        
        # Delete school
        delete_response = admin_session.delete(f"{BASE_URL}/api/admin/schools/{school_id}")
        print(f"Delete school response: {delete_response.status_code}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print("✅ School deleted successfully")
        
        # Verify school is removed from list
        list_response2 = admin_session.get(f"{BASE_URL}/api/admin/schools")
        schools2 = list_response2.json()
        school_ids2 = [s.get("school_id") for s in schools2]
        assert school_id not in school_ids2, "Deleted school should not appear in list"
        print("✅ School removed from admin list")
    
    def test_admin_create_school_duplicate_username(self, admin_session):
        """Test admin cannot create school with duplicate username"""
        # Try to create school with existing username
        response = admin_session.post(
            f"{BASE_URL}/api/admin/schools",
            json={
                "name": "Duplicate School",
                "username": "springfield",  # Already exists
                "password": "testpass123"
            }
        )
        print(f"Duplicate username response: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Duplicate username correctly rejected")


class TestSchoolLogout:
    """Test school logout functionality"""
    
    def test_school_logout(self):
        """Test school can logout"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "springfield", "password": "test123"}
        )
        assert login_response.status_code == 200
        
        session_token = login_response.json()["session_token"]
        
        # Create session with cookie
        session = requests.Session()
        session.cookies.set("session_token", session_token)
        
        # Verify dashboard works
        dashboard_response = session.get(f"{BASE_URL}/api/school/dashboard")
        assert dashboard_response.status_code == 200
        print("✅ Dashboard accessible before logout")
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        print(f"Logout response: {logout_response.status_code}")
        assert logout_response.status_code == 200
        print("✅ Logout successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
