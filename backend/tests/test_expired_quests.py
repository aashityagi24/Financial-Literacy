"""
Test expired quest functionality
- Quests past their due_date should be marked as expired
- Expired quests should appear after active quests and before completed quests
- Expired quests should have is_expired=true and user_status='expired'
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created for expired quest testing
TEST_SESSION_TOKEN = "test_expired_sess_1769709169743"


class TestExpiredQuestBackend:
    """Test expired quest backend functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_quests_returns_200(self):
        """Test that GET /api/child/quests-new returns 200"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/child/quests-new returned {len(data)} quests")
    
    def test_expired_quest_has_correct_status(self):
        """Test that expired quest has is_expired=true and user_status='expired'"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find the expired test quest
        expired_quest = None
        for q in data:
            if "TEST Expired Quest" in q.get("title", ""):
                expired_quest = q
                break
        
        assert expired_quest is not None, "Expired test quest not found"
        assert expired_quest.get("is_expired") == True, f"Expected is_expired=True, got {expired_quest.get('is_expired')}"
        assert expired_quest.get("user_status") == "expired", f"Expected user_status='expired', got {expired_quest.get('user_status')}"
        print(f"✅ Expired quest has correct status: is_expired={expired_quest.get('is_expired')}, user_status={expired_quest.get('user_status')}")
    
    def test_active_quest_not_expired(self):
        """Test that active quest (future due_date) is not marked as expired"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find the active test quest
        active_quest = None
        for q in data:
            if "TEST Active Quest" in q.get("title", ""):
                active_quest = q
                break
        
        assert active_quest is not None, "Active test quest not found"
        assert active_quest.get("is_expired") == False, f"Expected is_expired=False, got {active_quest.get('is_expired')}"
        assert active_quest.get("user_status") == "available", f"Expected user_status='available', got {active_quest.get('user_status')}"
        print(f"✅ Active quest has correct status: is_expired={active_quest.get('is_expired')}, user_status={active_quest.get('user_status')}")
    
    def test_completed_quest_not_expired(self):
        """Test that completed quest is marked as completed, not expired"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find the completed test quest
        completed_quest = None
        for q in data:
            if "TEST Completed Quest" in q.get("title", ""):
                completed_quest = q
                break
        
        assert completed_quest is not None, "Completed test quest not found"
        assert completed_quest.get("is_completed") == True, f"Expected is_completed=True, got {completed_quest.get('is_completed')}"
        assert completed_quest.get("user_status") == "completed", f"Expected user_status='completed', got {completed_quest.get('user_status')}"
        print(f"✅ Completed quest has correct status: is_completed={completed_quest.get('is_completed')}, user_status={completed_quest.get('user_status')}")
    
    def test_quest_ordering_active_expired_completed(self):
        """Test that quests are ordered: Active -> Expired -> Completed"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check ordering
        last_type = 'active'
        type_order = {'active': 0, 'expired': 1, 'completed': 2}
        
        for i, q in enumerate(data):
            is_expired = q.get('is_expired', False)
            is_completed = q.get('is_completed', False)
            
            if is_completed:
                current_type = 'completed'
            elif is_expired:
                current_type = 'expired'
            else:
                current_type = 'active'
            
            # Check order: active < expired < completed
            assert type_order[current_type] >= type_order[last_type], \
                f"Order violation at index {i}: {current_type} after {last_type}"
            last_type = current_type
        
        print("✅ Quest ordering is correct: Active -> Expired -> Completed")
    
    def test_expired_quest_due_date_in_past(self):
        """Test that expired quest has due_date in the past"""
        response = requests.get(f"{BASE_URL}/api/child/quests-new", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find the expired test quest
        expired_quest = None
        for q in data:
            if "TEST Expired Quest" in q.get("title", ""):
                expired_quest = q
                break
        
        assert expired_quest is not None, "Expired test quest not found"
        due_date_str = expired_quest.get("due_date")
        assert due_date_str is not None, "Expired quest should have a due_date"
        
        # Parse due_date and check it's in the past
        due_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d")
        today = datetime.now()
        assert due_date < today, f"Expired quest due_date ({due_date_str}) should be in the past"
        print(f"✅ Expired quest due_date ({due_date_str}) is in the past")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
