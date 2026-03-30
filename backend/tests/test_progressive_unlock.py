"""
Test progressive unlock logic for learning content
Tests the bug fix for:
1. Subtopics showing locked on quick access bar but unlocked on detail page
2. Fraction display removal (backend returns counts, frontend handles display)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProgressiveUnlock:
    """Test progressive unlock logic for subtopics and content items"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - login as admin and create test child"""
        self.admin_token = None
        self.child_token = None
        self.child_user_id = None
        self.test_topic_id = "topic_71caf498c54e"  # Understanding Money
        
        # Login as admin
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        if admin_response.status_code == 200:
            self.admin_token = admin_response.json().get("session_token")
        
        # Create test child user
        if self.admin_token:
            create_response = requests.post(
                f"{BASE_URL}/api/admin/users",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json={
                    "name": "TEST_UnlockChild",
                    "email": f"test_unlock_child_{os.urandom(4).hex()}@test.com",
                    "password": "testpassword123",
                    "role": "child",
                    "grade": 1
                }
            )
            if create_response.status_code == 200:
                self.child_user_id = create_response.json().get("user_id")
                # Login as child
                child_login = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "identifier": create_response.json().get("user_id"),
                    "password": "testpassword123"
                })
                # Try with email instead
                email = f"test_unlock_child_{os.urandom(4).hex()}@test.com"
        
        yield
        
        # Cleanup - delete test user
        if self.admin_token and self.child_user_id:
            requests.delete(
                f"{BASE_URL}/api/admin/users/{self.child_user_id}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
    
    def get_child_session(self):
        """Helper to create and login a test child"""
        if not self.admin_token:
            pytest.skip("Admin login failed")
        
        email = f"test_unlock_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "name": "TEST_UnlockChild",
                "email": email,
                "password": "testpassword123",
                "role": "child",
                "grade": 1
            }
        )
        assert create_response.status_code == 200, f"Failed to create child: {create_response.text}"
        user_id = create_response.json().get("user_id")
        
        # Login as child
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": email,
            "password": "testpassword123"
        })
        assert login_response.status_code == 200, f"Child login failed: {login_response.text}"
        return login_response.json().get("session_token"), user_id
    
    def test_topic_detail_returns_is_unlocked_for_subtopics(self):
        """GET /api/content/topics/{topic_id} returns is_unlocked for subtopics when user is child"""
        child_token, user_id = self.get_child_session()
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{self.test_topic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify subtopics have is_unlocked field
        subtopics = data.get("subtopics", [])
        assert len(subtopics) > 0, "Topic should have subtopics"
        
        for subtopic in subtopics:
            assert "is_unlocked" in subtopic, f"Subtopic {subtopic.get('title')} missing is_unlocked"
            assert "is_completed" in subtopic, f"Subtopic {subtopic.get('title')} missing is_completed"
            assert "completed_count" in subtopic, f"Subtopic {subtopic.get('title')} missing completed_count"
            assert "content_count" in subtopic, f"Subtopic {subtopic.get('title')} missing content_count"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_first_subtopic_always_unlocked(self):
        """First subtopic should always be unlocked (is_unlocked=true)"""
        child_token, user_id = self.get_child_session()
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{self.test_topic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        subtopics = data.get("subtopics", [])
        
        assert len(subtopics) > 0, "Topic should have subtopics"
        
        # First subtopic should be unlocked
        first_subtopic = subtopics[0]
        assert first_subtopic.get("is_unlocked") == True, \
            f"First subtopic '{first_subtopic.get('title')}' should be unlocked"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_subsequent_subtopics_locked_until_previous_completed(self):
        """Subsequent subtopics should be locked until previous is completed"""
        child_token, user_id = self.get_child_session()
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{self.test_topic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        subtopics = data.get("subtopics", [])
        
        if len(subtopics) > 1:
            # Second subtopic should be locked (since first is not completed)
            second_subtopic = subtopics[1]
            assert second_subtopic.get("is_unlocked") == False, \
                f"Second subtopic '{second_subtopic.get('title')}' should be locked"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_content_items_have_is_unlocked(self):
        """Content items should have is_unlocked field for children"""
        child_token, user_id = self.get_child_session()
        
        # Get a subtopic with content items
        subtopic_id = "topic_2731433e0a5b"  # Money Around Me
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{subtopic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        content_items = data.get("content_items", [])
        
        if len(content_items) > 0:
            for item in content_items:
                assert "is_unlocked" in item, f"Content item {item.get('title')} missing is_unlocked"
                assert "is_completed" in item, f"Content item {item.get('title')} missing is_completed"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_first_content_item_always_unlocked(self):
        """First content item should always be unlocked"""
        child_token, user_id = self.get_child_session()
        
        # Get a subtopic with content items
        subtopic_id = "topic_2731433e0a5b"  # Money Around Me
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{subtopic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        content_items = data.get("content_items", [])
        
        if len(content_items) > 0:
            first_item = content_items[0]
            assert first_item.get("is_unlocked") == True, \
                f"First content item '{first_item.get('title')}' should be unlocked"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_subsequent_content_items_locked(self):
        """Subsequent content items should be locked until previous is completed"""
        child_token, user_id = self.get_child_session()
        
        # Get a subtopic with content items
        subtopic_id = "topic_2731433e0a5b"  # Money Around Me
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{subtopic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        content_items = data.get("content_items", [])
        
        if len(content_items) > 1:
            second_item = content_items[1]
            assert second_item.get("is_unlocked") == False, \
                f"Second content item '{second_item.get('title')}' should be locked"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_topics_listing_returns_is_unlocked_for_subtopics(self):
        """GET /api/content/topics returns is_unlocked for subtopics in quick access"""
        child_token, user_id = self.get_child_session()
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        topics = response.json()
        
        # Find the test topic
        test_topic = next((t for t in topics if t.get("topic_id") == self.test_topic_id), None)
        assert test_topic is not None, "Test topic not found"
        
        subtopics = test_topic.get("subtopics", [])
        if len(subtopics) > 0:
            for subtopic in subtopics:
                assert "is_unlocked" in subtopic, f"Subtopic {subtopic.get('title')} missing is_unlocked in listing"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
    
    def test_subtopic_counts_returned_without_fractions(self):
        """Subtopics should return content_count and completed_count as separate fields (not fractions)"""
        child_token, user_id = self.get_child_session()
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{self.test_topic_id}",
            headers={"Authorization": f"Bearer {child_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        subtopics = data.get("subtopics", [])
        
        for subtopic in subtopics:
            # Verify counts are integers, not strings with fractions
            assert isinstance(subtopic.get("content_count"), int), \
                f"content_count should be int, got {type(subtopic.get('content_count'))}"
            assert isinstance(subtopic.get("completed_count"), int), \
                f"completed_count should be int, got {type(subtopic.get('completed_count'))}"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )


class TestAdminLogin:
    """Basic test to verify admin login works"""
    
    def test_admin_login(self):
        """Admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert data.get("user", {}).get("role") == "admin"
