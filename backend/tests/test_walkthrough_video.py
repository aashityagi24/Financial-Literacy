"""Tests for walkthrough video API - poster field and upload endpoint"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin@learnersplanet.com",
        "password": "finlit@2026"
    })
    if resp.status_code == 200:
        return resp.json().get("access_token") or resp.json().get("token")
    return None

class TestWalkthroughVideoAPI:
    """Test GET /api/admin/settings/walkthrough-video returns poster field"""

    def test_get_walkthrough_video_returns_poster_field(self):
        resp = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert resp.status_code == 200
        data = resp.json()
        for user_type in ['child', 'parent', 'teacher']:
            assert user_type in data, f"Missing {user_type} in response"
            assert 'url' in data[user_type]
            assert 'poster' in data[user_type], f"Missing poster field for {user_type}"
        assert 'global' in data
        print(f"Child url set: {bool(data['child'].get('url'))}, poster: {data['child'].get('poster')}")
        print("PASS: poster field present in all user types")

    def test_get_walkthrough_video_global_title(self):
        resp = requests.get(f"{BASE_URL}/api/admin/settings/walkthrough-video")
        assert resp.status_code == 200
        data = resp.json()
        global_data = data.get('global', {})
        assert 'title' in global_data
        assert 'description' in global_data
        print(f"Global title: {global_data.get('title')}")
        print("PASS: global title/description present")

    def test_upload_walkthrough_poster(self):
        """POST /api/upload/walkthrough-poster?user_type=child"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        png_bytes = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        files = {'file': ('test_poster.png', io.BytesIO(png_bytes), 'image/png')}
        headers = {'Authorization': f'Bearer {token}'}
        
        resp = requests.post(
            f"{BASE_URL}/api/upload/walkthrough-poster?user_type=child",
            files=files,
            headers=headers
        )
        print(f"Upload poster status: {resp.status_code}, response: {resp.text[:200]}")
        assert resp.status_code == 200
        data = resp.json()
        assert 'url' in data
        assert data['url']
        print(f"PASS: Poster uploaded, URL: {data['url']}")
