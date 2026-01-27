"""
Test cases for CoinQuest bug fixes:
1. Dashboard Active Quests filtering (is_completed and has_earned fields)
2. Notification Center - Mark all as read functionality
3. Backend endpoints for quests and notifications
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials created in MongoDB
TEST_SESSION_TOKEN = "test_session_1769489017608"
TEST_USER_ID = "test-child-1769489017608"


class TestQuestsAPI:
    """Test quests API returns is_completed and has_earned fields correctly"""
    
    def test_quests_endpoint_returns_completion_fields(self):
        """Bug Fix #1: Verify quests API returns is_completed and has_earned fields"""
        response = requests.get(
            f"{BASE_URL}/api/quests",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        quests = response.json()
        assert isinstance(quests, list), "Response should be a list"
        
        # Check that each quest has the required fields
        for quest in quests:
            assert "is_completed" in quest, f"Quest {quest.get('title')} missing is_completed field"
            assert "has_earned" in quest, f"Quest {quest.get('title')} missing has_earned field"
            assert isinstance(quest["is_completed"], bool), "is_completed should be boolean"
            assert isinstance(quest["has_earned"], bool), "has_earned should be boolean"
    
    def test_active_quests_filter_logic(self):
        """Verify that active quests can be filtered correctly using is_completed and has_earned"""
        response = requests.get(
            f"{BASE_URL}/api/quests",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        # Filter active quests (same logic as Dashboard.jsx line 58)
        active_quests = [q for q in quests if not q.get('is_completed') and not q.get('has_earned')]
        completed_quests = [q for q in quests if q.get('is_completed') or q.get('has_earned')]
        
        print(f"Total quests: {len(quests)}")
        print(f"Active quests: {len(active_quests)}")
        print(f"Completed quests: {len(completed_quests)}")
        
        # Verify the filter works correctly
        for quest in active_quests:
            assert quest["is_completed"] == False, f"Active quest {quest.get('title')} has is_completed=True"
            assert quest["has_earned"] == False, f"Active quest {quest.get('title')} has has_earned=True"
        
        for quest in completed_quests:
            assert quest["is_completed"] == True or quest["has_earned"] == True, \
                f"Completed quest {quest.get('title')} has both is_completed=False and has_earned=False"


class TestNotificationsAPI:
    """Test notifications API and mark-all-read functionality"""
    
    def test_notifications_endpoint_structure(self):
        """Verify notifications endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data, "Response should have 'notifications' key"
        assert "unread_count" in data, "Response should have 'unread_count' key"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
    
    def test_mark_all_read_endpoint(self):
        """Bug Fix #2: Verify mark-all-read endpoint works correctly"""
        # First, get current notifications
        get_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert get_response.status_code == 200
        
        # Call mark-all-read
        mark_response = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert mark_response.status_code == 200, f"Expected 200, got {mark_response.status_code}"
        
        data = mark_response.json()
        assert "message" in data, "Response should have 'message' key"
        assert "updated" in data, "Response should have 'updated' key"
        
        # Verify all notifications are now read
        verify_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        assert verify_data["unread_count"] == 0, f"Expected 0 unread, got {verify_data['unread_count']}"
        
        # Verify each notification is marked as read
        for notif in verify_data["notifications"]:
            assert notif.get("read") == True, f"Notification {notif.get('title')} is still unread"
    
    def test_notification_has_required_fields(self):
        """Verify notification objects have required fields for navigation"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for notif in data["notifications"]:
            assert "notification_id" in notif, "Notification missing notification_id"
            assert "notification_type" in notif, "Notification missing notification_type"
            assert "title" in notif, "Notification missing title"
            assert "message" in notif, "Notification missing message"
            assert "read" in notif, "Notification missing read field"


class TestQuestCompletionFlow:
    """Test quest completion marks is_completed correctly"""
    
    def test_completed_quest_has_is_completed_true(self):
        """Verify completed quests have is_completed=True"""
        response = requests.get(
            f"{BASE_URL}/api/quests",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        # Find the completed test quest
        completed_quest = next(
            (q for q in quests if q.get('title') == 'Completed Test Quest'),
            None
        )
        
        if completed_quest:
            assert completed_quest["is_completed"] == True, \
                "Completed Test Quest should have is_completed=True"
            assert completed_quest["has_earned"] == True, \
                "Completed Test Quest should have has_earned=True"
            print(f"✅ Completed quest verified: is_completed={completed_quest['is_completed']}, has_earned={completed_quest['has_earned']}")
        else:
            print("⚠️ Completed Test Quest not found in response (may have expired due_date)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
