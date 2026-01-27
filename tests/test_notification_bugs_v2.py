"""
Test cases for CoinQuest Notification Center Bug Fixes (Iteration 23)
Tests for:
1. Bug 1: Notification navigation - clicking notification should navigate to correct page
2. Bug 2: Mark all as read - notification count should persist as 0 after reload
3. Backend: GET /api/notifications normalizes type/notification_type and read/is_read fields
4. Backend: POST /api/notifications/mark-all-read updates both read and is_read fields
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created for alkabmaheshwari@gmail.com
TEST_SESSION_TOKEN = "test_notif_sess_1769490532403"
TEST_USER_ID = "user_2ff67222259d"


class TestNotificationFieldNormalization:
    """Test that GET /api/notifications normalizes both old and new field patterns"""
    
    def test_notifications_endpoint_returns_200(self):
        """Basic health check for notifications endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_notifications_have_normalized_type_field(self):
        """Verify all notifications have notification_type field (normalized from type)"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for notif in data["notifications"]:
            assert "notification_type" in notif, \
                f"Notification {notif.get('notification_id')} missing notification_type field"
            assert notif["notification_type"] is not None, \
                f"Notification {notif.get('notification_id')} has null notification_type"
    
    def test_notifications_have_normalized_read_field(self):
        """Verify all notifications have read field (normalized from is_read)"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for notif in data["notifications"]:
            assert "read" in notif, \
                f"Notification {notif.get('notification_id')} missing read field"
            assert isinstance(notif["read"], bool), \
                f"Notification {notif.get('notification_id')} read field is not boolean"
    
    def test_notifications_have_title_fallback(self):
        """Verify all notifications have title field (with fallback from message)"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for notif in data["notifications"]:
            assert "title" in notif, \
                f"Notification {notif.get('notification_id')} missing title field"
            assert notif["title"] is not None and len(notif["title"]) > 0, \
                f"Notification {notif.get('notification_id')} has empty title"
    
    def test_unread_count_is_integer(self):
        """Verify unread_count is returned as integer"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "unread_count" in data, "Response missing unread_count"
        assert isinstance(data["unread_count"], int), "unread_count should be integer"
        assert data["unread_count"] >= 0, "unread_count should be non-negative"


class TestMarkAllReadEndpoint:
    """Test POST /api/notifications/mark-all-read endpoint"""
    
    def test_mark_all_read_returns_200(self):
        """Verify mark-all-read endpoint returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_mark_all_read_returns_updated_count(self):
        """Verify mark-all-read returns updated count"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data, "Response missing message"
        assert "updated" in data, "Response missing updated count"
        assert isinstance(data["updated"], int), "updated should be integer"
    
    def test_mark_all_read_sets_unread_count_to_zero(self):
        """Verify after mark-all-read, unread_count is 0"""
        # Call mark-all-read
        mark_response = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert mark_response.status_code == 200
        
        # Verify unread count is 0
        get_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["unread_count"] == 0, \
            f"Expected unread_count=0 after mark-all-read, got {data['unread_count']}"
    
    def test_mark_all_read_updates_all_notifications(self):
        """Verify all notifications have read=True after mark-all-read"""
        # Call mark-all-read
        mark_response = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert mark_response.status_code == 200
        
        # Verify all notifications are read
        get_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        for notif in data["notifications"]:
            assert notif.get("read") == True, \
                f"Notification {notif.get('notification_id')} still has read=False"


class TestNotificationNavigation:
    """Test notification navigation paths are correctly set"""
    
    def test_notifications_have_navigation_info(self):
        """Verify notifications have either link field or valid notification_type for navigation"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Valid notification types that have navigation paths in frontend
        valid_types = [
            'announcement', 'reward', 'gift_received', 'gift_request', 
            'gift_request_declined', 'gift_sent', 'quest', 'quest_created',
            'quest_completed', 'quest_reminder', 'chore', 'chore_created',
            'chore_approved', 'chore_rejected', 'chore_validation', 'chore_reminder',
            'stock_update', 'garden_update', 'investment_purchase', 'investment_sale'
        ]
        
        for notif in data["notifications"]:
            has_link = notif.get("link") is not None
            has_valid_type = notif.get("notification_type") in valid_types
            
            # At least one should be true for navigation to work
            assert has_link or has_valid_type, \
                f"Notification {notif.get('notification_id')} has no navigation path " \
                f"(link={notif.get('link')}, type={notif.get('notification_type')})"


class TestNotificationStructure:
    """Test notification response structure"""
    
    def test_notification_has_required_fields(self):
        """Verify each notification has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['notification_id', 'user_id', 'notification_type', 'title', 'message', 'read', 'created_at']
        
        for notif in data["notifications"]:
            for field in required_fields:
                assert field in notif, \
                    f"Notification {notif.get('notification_id')} missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
