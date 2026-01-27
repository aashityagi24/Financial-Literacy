"""
Test Auth Flows for CoinQuest
- Admin login
- School login  
- Session persistence (/api/auth/me)
- Logout functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
SCHOOL_USERNAME = "springfield"
SCHOOL_PASSWORD = "test123"  # Verified from database


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user'"
        assert "session_token" in data, "Response should contain 'session_token'"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["session_token"].startswith("sess_")
        
        # Store for later tests
        self.__class__.admin_session_token = data["session_token"]
        print(f"✅ Admin login successful, token: {data['session_token'][:20]}...")
    
    def test_admin_login_invalid_email(self):
        """Test admin login with wrong email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": "wrong@example.com", "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin login correctly rejected invalid email")
    
    def test_admin_login_invalid_password(self):
        """Test admin login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin login correctly rejected invalid password")


class TestSchoolLogin:
    """School authentication tests"""
    
    def test_school_login_success(self):
        """Test school login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": SCHOOL_USERNAME, "password": SCHOOL_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "school" in data, "Response should contain 'school'"
        assert "session_token" in data, "Response should contain 'session_token'"
        assert data["school"]["username"] == SCHOOL_USERNAME
        assert data["school"]["role"] == "school"
        assert data["session_token"].startswith("school_sess_")
        
        # Store for later tests
        self.__class__.school_session_token = data["session_token"]
        print(f"✅ School login successful, token: {data['session_token'][:20]}...")
    
    def test_school_login_invalid_username(self):
        """Test school login with wrong username"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": "wrongschool", "password": SCHOOL_PASSWORD}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ School login correctly rejected invalid username")
    
    def test_school_login_invalid_password(self):
        """Test school login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": SCHOOL_USERNAME, "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ School login correctly rejected invalid password")


class TestSessionPersistence:
    """Test /api/auth/me endpoint for session validation"""
    
    def test_auth_me_with_admin_cookie(self):
        """Test /api/auth/me with admin session cookie"""
        # First login to get session
        login_response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        session_token = login_response.json()["session_token"]
        
        # Test /api/auth/me with cookie
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✅ /api/auth/me works with cookie, user: {data['email']}")
    
    def test_auth_me_with_authorization_header(self):
        """Test /api/auth/me with Authorization header (localStorage fallback)"""
        # First login to get session
        login_response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        session_token = login_response.json()["session_token"]
        
        # Test /api/auth/me with Authorization header
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✅ /api/auth/me works with Authorization header, user: {data['email']}")
    
    def test_auth_me_without_token(self):
        """Test /api/auth/me without any authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ /api/auth/me correctly rejects unauthenticated requests")
    
    def test_auth_me_with_invalid_token(self):
        """Test /api/auth/me with invalid session token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": "invalid_token_12345"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ /api/auth/me correctly rejects invalid tokens")


class TestLogout:
    """Test logout functionality"""
    
    def test_logout_clears_session(self):
        """Test that logout clears the session"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        session_token = login_response.json()["session_token"]
        
        # Verify session works
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert me_response.status_code == 200
        
        # Logout
        logout_response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            cookies={"session_token": session_token}
        )
        assert logout_response.status_code == 200, f"Expected 200, got {logout_response.status_code}"
        assert logout_response.json()["message"] == "Logged out"
        print("✅ Logout endpoint returned success")
        
        # Verify session is invalidated
        me_after_logout = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert me_after_logout.status_code == 401, f"Expected 401 after logout, got {me_after_logout.status_code}"
        print("✅ Session correctly invalidated after logout")


class TestOAuthRedirectURL:
    """Test OAuth redirect URL configuration"""
    
    def test_oauth_session_endpoint_exists(self):
        """Test that /api/auth/session endpoint exists and requires session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={}
        )
        # Should return 400 for missing session_id, not 404
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "session_id" in response.json().get("detail", "").lower()
        print("✅ /api/auth/session endpoint exists and validates session_id")
    
    def test_oauth_session_with_invalid_session_id(self):
        """Test /api/auth/session with invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_session_id_12345"}
        )
        # Should return 401 for invalid session
        assert response.status_code in [401, 500], f"Expected 401 or 500, got {response.status_code}"
        print("✅ /api/auth/session correctly rejects invalid session_id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
