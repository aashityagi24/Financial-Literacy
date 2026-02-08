"""
Test Google OAuth Flow for CoinQuest
Tests:
1. Landing page loads correctly
2. /api/auth/google/login redirects to Google
3. /api/auth/google/callback endpoint exists
4. Admin login works with correct credentials
5. Frontend /auth/callback handles session parameter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGoogleOAuthFlow:
    """Test Google OAuth endpoints and flow"""
    
    def test_landing_page_loads(self):
        """Test that the landing page loads correctly"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Landing page failed to load: {response.status_code}"
        # Check for key content
        assert "CoinQuest" in response.text or "coinquest" in response.text.lower(), "Landing page missing CoinQuest branding"
        print("✅ Landing page loads correctly")
    
    def test_google_login_redirects_to_google(self):
        """Test that /api/auth/google/login redirects to Google OAuth"""
        # Don't follow redirects to check the redirect URL
        response = requests.get(
            f"{BASE_URL}/api/auth/google/login",
            allow_redirects=False,
            headers={"Origin": BASE_URL, "Referer": BASE_URL}
        )
        
        # Should return a redirect (302 or 307)
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}"
        
        # Check redirect location contains Google OAuth URL
        location = response.headers.get('Location', '')
        assert 'accounts.google.com' in location, f"Redirect should go to Google, got: {location[:100]}"
        assert 'client_id=' in location, "Redirect URL should contain client_id"
        assert 'redirect_uri=' in location, "Redirect URL should contain redirect_uri"
        assert 'response_type=code' in location, "Redirect URL should contain response_type=code"
        
        print(f"✅ /api/auth/google/login redirects to Google OAuth")
        print(f"   Redirect URL: {location[:100]}...")
    
    def test_google_callback_endpoint_exists(self):
        """Test that /api/auth/google/callback endpoint exists and responds"""
        # Call without code parameter - should return 400 or error
        response = requests.get(f"{BASE_URL}/api/auth/google/callback")
        
        # Should return 400 (bad request) or 422 (validation error) since no code provided
        # NOT 404 (endpoint doesn't exist)
        assert response.status_code != 404, f"Callback endpoint not found (404)"
        assert response.status_code in [400, 422, 500], f"Unexpected status: {response.status_code}"
        
        print(f"✅ /api/auth/google/callback endpoint exists (returns {response.status_code} without code)")
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={
                "email": "admin@learnersplanet.com",
                "password": "finlit@2026"
            }
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user data"
        assert "session_token" in data, "Response should contain session_token"
        assert data["user"]["email"] == "admin@learnersplanet.com", "User email mismatch"
        assert data["user"]["role"] == "admin", "User role should be admin"
        
        print(f"✅ Admin login successful")
        print(f"   User: {data['user']['email']}, Role: {data['user']['role']}")
        return data["session_token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={
                "email": "wrong@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print("✅ Admin login correctly rejects invalid credentials")
    
    def test_auth_me_with_admin_session(self):
        """Test /api/auth/me endpoint with admin session"""
        # First login to get session token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={
                "email": "admin@learnersplanet.com",
                "password": "finlit@2026"
            }
        )
        
        assert login_response.status_code == 200, "Admin login failed"
        session_token = login_response.json()["session_token"]
        
        # Now test /api/auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        
        assert me_response.status_code == 200, f"/api/auth/me failed: {me_response.status_code}"
        
        user = me_response.json()
        assert user["email"] == "admin@learnersplanet.com", "User email mismatch"
        assert user["role"] == "admin", "User role should be admin"
        
        print(f"✅ /api/auth/me returns correct user data")
    
    def test_frontend_auth_callback_route_exists(self):
        """Test that frontend /auth/callback route exists"""
        response = requests.get(f"{BASE_URL}/auth/callback")
        
        # React SPA should return 200 for any route (client-side routing)
        assert response.status_code == 200, f"Frontend route failed: {response.status_code}"
        
        # Check it's a React app response
        assert "root" in response.text or "React" in response.text or "script" in response.text.lower(), \
            "Response doesn't look like a React app"
        
        print("✅ Frontend /auth/callback route exists")
    
    def test_frontend_auth_callback_with_session_param(self):
        """Test that frontend /auth/callback handles session parameter"""
        # This tests that the route accepts the session parameter
        response = requests.get(f"{BASE_URL}/auth/callback?session=test_token_123")
        
        assert response.status_code == 200, f"Frontend route with session param failed: {response.status_code}"
        print("✅ Frontend /auth/callback accepts session parameter")
    
    def test_logout_endpoint(self):
        """Test logout endpoint"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={
                "email": "admin@learnersplanet.com",
                "password": "finlit@2026"
            }
        )
        
        session_token = login_response.json()["session_token"]
        
        # Now logout
        logout_response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.status_code}"
        assert "message" in logout_response.json(), "Logout should return message"
        
        print("✅ Logout endpoint works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
