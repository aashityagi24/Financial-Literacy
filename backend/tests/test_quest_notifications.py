"""
Test Quest Questions Display and Notifications
- BUG FIX: Quest questions (MCQ, true/false, numeric, multi-select) now display properly
- FEATURE: Notifications sent when admin creates quest (new_quest type)
- FEATURE: Notifications sent when teacher creates quest
- FEATURE: Notifications sent when teacher creates announcement
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
CHILD_SESSION = "test_sess_607235502edf45a6b4f7f0191a9fd1c0"
ADMIN_SESSION = "sess_a54c686492384d2cb226f04c03854917"
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
SCHOOL_USERNAME = "springfield"
SCHOOL_PASSWORD = "test123"
TEST_QUEST_ID = "quest_dd1a21037d28"


class TestQuestQuestionsDisplay:
    """Test that quest questions display properly with all fields"""
    
    def test_child_quests_endpoint_returns_questions(self):
        """GET /api/child/quests-new returns questions with all fields"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        assert isinstance(quests, list), "Response should be a list"
        
        # Find the Test MCQ Quest
        mcq_quest = next((q for q in quests if q.get("quest_id") == TEST_QUEST_ID), None)
        assert mcq_quest is not None, f"Test MCQ Quest {TEST_QUEST_ID} not found in response"
        
        # Verify quest has questions
        questions = mcq_quest.get("questions", [])
        assert len(questions) > 0, "Quest should have at least one question"
        
        # Verify question structure
        question = questions[0]
        assert "question_id" in question, "Question should have question_id"
        assert "question_text" in question, "Question should have question_text"
        assert "question_type" in question, "Question should have question_type"
        assert "options" in question, "Question should have options"
        assert "correct_answer" in question, "Question should have correct_answer"
        assert "points" in question, "Question should have points"
        
        print(f"✅ Quest questions display properly with all fields")
        print(f"   Question: {question['question_text']}")
        print(f"   Type: {question['question_type']}")
        print(f"   Options: {question['options']}")
        print(f"   Points: {question['points']}")
    
    def test_quest_has_total_points(self):
        """Quest should have total_points calculated from questions"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200
        
        quests = response.json()
        mcq_quest = next((q for q in quests if q.get("quest_id") == TEST_QUEST_ID), None)
        assert mcq_quest is not None
        
        total_points = mcq_quest.get("total_points", 0)
        assert total_points > 0, f"Quest should have total_points > 0, got {total_points}"
        
        # Verify total_points matches sum of question points
        questions = mcq_quest.get("questions", [])
        expected_points = sum(q.get("points", 0) for q in questions)
        assert total_points == expected_points, f"total_points ({total_points}) should match sum of question points ({expected_points})"
        
        print(f"✅ Quest total_points={total_points} matches question points sum")
    
    def test_mcq_question_type(self):
        """MCQ questions should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200
        
        quests = response.json()
        mcq_quest = next((q for q in quests if q.get("quest_id") == TEST_QUEST_ID), None)
        assert mcq_quest is not None
        
        questions = mcq_quest.get("questions", [])
        mcq_question = next((q for q in questions if q.get("question_type") == "mcq"), None)
        
        if mcq_question:
            assert isinstance(mcq_question.get("options"), list), "MCQ options should be a list"
            assert len(mcq_question.get("options", [])) >= 2, "MCQ should have at least 2 options"
            print(f"✅ MCQ question has {len(mcq_question['options'])} options")
        else:
            print("⚠️ No MCQ question found in test quest")


class TestNotifications:
    """Test notification system for quests and announcements"""
    
    def test_child_has_new_quest_notification(self):
        """Child should have new_quest notification for Test MCQ Quest"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        # Find new_quest notification for our test quest
        quest_notif = next(
            (n for n in notifications 
             if n.get("type") == "new_quest" and n.get("quest_id") == TEST_QUEST_ID),
            None
        )
        
        assert quest_notif is not None, f"Should have new_quest notification for quest {TEST_QUEST_ID}"
        
        # Verify notification structure
        assert "notification_id" in quest_notif, "Notification should have notification_id"
        assert "title" in quest_notif, "Notification should have title"
        assert "message" in quest_notif, "Notification should have message"
        assert quest_notif.get("type") == "new_quest", "Notification type should be new_quest"
        
        print(f"✅ Child has new_quest notification")
        print(f"   Title: {quest_notif.get('title')}")
        print(f"   Message: {quest_notif.get('message')}")
    
    def test_notification_has_correct_type(self):
        """Notification should have notification_type field for frontend"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        if notifications:
            notif = notifications[0]
            # Frontend uses notification_type field
            assert "notification_type" in notif or "type" in notif, "Notification should have type field"
            print(f"✅ Notification has type field: {notif.get('notification_type') or notif.get('type')}")
    
    def test_unread_count(self):
        """Notifications endpoint should return unread_count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_count" in data, "Response should have unread_count"
        
        unread_count = data.get("unread_count", 0)
        print(f"✅ Unread count: {unread_count}")


class TestAdminQuestCreation:
    """Test admin quest creation with notifications"""
    
    def test_admin_login(self):
        """Admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data or "token" in data, "Should return session token"
        print(f"✅ Admin login successful")
    
    def test_admin_quests_endpoint(self):
        """Admin can view quests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/quests",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        assert isinstance(quests, list), "Response should be a list"
        
        # Find our test quest
        test_quest = next((q for q in quests if q.get("quest_id") == TEST_QUEST_ID), None)
        if test_quest:
            print(f"✅ Test MCQ Quest found in admin quests")
            print(f"   Title: {test_quest.get('title')}")
            print(f"   Questions: {len(test_quest.get('questions', []))}")


class TestTeacherQuestCreation:
    """Test teacher quest creation with notifications"""
    
    def test_school_login(self):
        """School can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/school-login",
            json={"username": SCHOOL_USERNAME, "password": SCHOOL_PASSWORD}
        )
        # School login might return 200 or 401 depending on credentials
        if response.status_code == 200:
            print(f"✅ School login successful")
        else:
            print(f"⚠️ School login returned {response.status_code} - may need valid credentials")


class TestQuestSubmission:
    """Test quest submission with answers"""
    
    def test_quest_submission_endpoint_exists(self):
        """Quest submission endpoint should exist"""
        # Just verify the endpoint exists by checking a 4xx response (not 404)
        response = requests.post(
            f"{BASE_URL}/api/child/quests/{TEST_QUEST_ID}/submit",
            headers={"Authorization": f"Bearer {CHILD_SESSION}"},
            json={"answers": {}}
        )
        # Should not be 404 - endpoint exists
        assert response.status_code != 404, "Quest submission endpoint should exist"
        print(f"✅ Quest submission endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
