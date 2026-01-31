"""
Test suite for Walkthrough Video feature
Tests: GET, PUT, DELETE /api/admin/settings/walkthrough-video
       POST /api/upload/walkthrough-video
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWalkthroughVideoEndpoints:
    """Test walkthrough video CRUD operations"""
    
    admin_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before tests"""
        if not TestWalkthroughVideoEndpoints.admin_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/admin-login",
                json={"email": "admin@learnersplanet.com", "password": "finlit@2026"}
            )
            assert response.status_code == 200, f"Admin login failed: {response.text}"
            TestWalkthroughVideoEndpoints.admin_token = response.json().get("session_token")
    
    def get_auth_headers(self):
        return {"Authorization": f"Bearer {TestWalkthroughVideoEndpoints.admin_token}"}
    
    # GET endpoint tests
    def test_get_walkthrough_video_public_access(self):
        """GET /api/admin/settings/walkthrough-video - should be publicly accessible"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "title" in data
        assert "description" in data
        print(f"✅ GET walkthrough video returns: {data}")
    
    # PUT endpoint tests
    def test_put_walkthrough_video_requires_auth(self):
        """PUT /api/admin/settings/walkthrough-video - should require admin auth"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/walkthrough-video",
            json={"url": "test.mp4", "title": "Test", "description": "Test"}
        )
        assert response.status_code == 401 or response.status_code == 403
        print("✅ PUT without auth correctly rejected")
    
    def test_put_walkthrough_video_with_auth(self):
        """PUT /api/admin/settings/walkthrough-video - should update with admin auth"""
        test_data = {
            "url": "/api/uploads/videos/test_walkthrough.mp4",
            "title": "Test Video Title",
            "description": "Test video description"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/walkthrough-video",
            json=test_data,
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Walkthrough video updated"
        
        # Verify data was saved
        get_response = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert get_response.status_code == 200
        saved_data = get_response.json()
        assert saved_data["url"] == test_data["url"]
        assert saved_data["title"] == test_data["title"]
        assert saved_data["description"] == test_data["description"]
        print(f"✅ PUT walkthrough video updated and verified: {saved_data}")
    
    # DELETE endpoint tests
    def test_delete_walkthrough_video_requires_auth(self):
        """DELETE /api/admin/settings/walkthrough-video - should require admin auth"""
        response = requests.delete(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert response.status_code == 401 or response.status_code == 403
        print("✅ DELETE without auth correctly rejected")
    
    def test_delete_walkthrough_video_with_auth(self):
        """DELETE /api/admin/settings/walkthrough-video - should delete with admin auth"""
        # First ensure there's a video to delete
        requests.put(
            f"{BASE_URL}/api/admin/settings/walkthrough-video",
            json={"url": "/api/uploads/videos/to_delete.mp4", "title": "To Delete", "description": "Will be deleted"},
            headers=self.get_auth_headers()
        )
        
        # Delete the video
        response = requests.delete(
            f"{BASE_URL}/api/admin/settings/walkthrough-video",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Walkthrough video deleted"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert get_response.status_code == 200
        assert get_response.json()["url"] is None
        print("✅ DELETE walkthrough video successful and verified")
    
    # Upload endpoint tests
    def test_upload_walkthrough_video(self):
        """POST /api/upload/walkthrough-video - should accept video file"""
        # Create a small test file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
            f.write(b'\x00' * 1024)  # 1KB dummy file
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                response = requests.post(
                    f"{BASE_URL}/api/upload/walkthrough-video",
                    files={"file": ("test_video.mp4", f, "video/mp4")}
                )
            assert response.status_code == 200
            data = response.json()
            assert "url" in data
            assert data["url"].startswith("/api/uploads/videos/")
            print(f"✅ Video upload successful: {data['url']}")
        finally:
            os.unlink(temp_path)
    
    def test_upload_rejects_non_video(self):
        """POST /api/upload/walkthrough-video - should reject non-video files"""
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as f:
            f.write(b'This is not a video')
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                response = requests.post(
                    f"{BASE_URL}/api/upload/walkthrough-video",
                    files={"file": ("test.txt", f, "text/plain")}
                )
            assert response.status_code == 400
            print("✅ Non-video file correctly rejected")
        finally:
            os.unlink(temp_path)


class TestWalkthroughVideoIntegration:
    """Integration tests for full video workflow"""
    
    admin_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before tests"""
        if not TestWalkthroughVideoIntegration.admin_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/admin-login",
                json={"email": "admin@learnersplanet.com", "password": "finlit@2026"}
            )
            assert response.status_code == 200
            TestWalkthroughVideoIntegration.admin_token = response.json().get("session_token")
    
    def get_auth_headers(self):
        return {"Authorization": f"Bearer {TestWalkthroughVideoIntegration.admin_token}"}
    
    def test_full_video_workflow(self):
        """Test complete workflow: upload -> set settings -> verify -> delete"""
        # Step 1: Upload video
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
            f.write(b'\x00' * 2048)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                upload_response = requests.post(
                    f"{BASE_URL}/api/upload/walkthrough-video",
                    files={"file": ("workflow_test.mp4", f, "video/mp4")}
                )
            assert upload_response.status_code == 200
            video_url = upload_response.json()["url"]
            print(f"Step 1: Video uploaded to {video_url}")
            
            # Step 2: Set video settings
            settings_data = {
                "url": video_url,
                "title": "CoinQuest Walkthrough",
                "description": "Learn how CoinQuest works"
            }
            put_response = requests.put(
                f"{BASE_URL}/api/admin/settings/walkthrough-video",
                json=settings_data,
                headers=self.get_auth_headers()
            )
            assert put_response.status_code == 200
            print("Step 2: Video settings saved")
            
            # Step 3: Verify settings
            get_response = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
            assert get_response.status_code == 200
            saved = get_response.json()
            assert saved["url"] == video_url
            assert saved["title"] == settings_data["title"]
            print(f"Step 3: Settings verified: {saved}")
            
            # Step 4: Delete video
            delete_response = requests.delete(
                f"{BASE_URL}/api/admin/settings/walkthrough-video",
                headers=self.get_auth_headers()
            )
            assert delete_response.status_code == 200
            print("Step 4: Video deleted")
            
            # Step 5: Verify deletion
            final_response = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
            assert final_response.json()["url"] is None
            print("Step 5: Deletion verified")
            
            print("✅ Full workflow test passed!")
            
        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
