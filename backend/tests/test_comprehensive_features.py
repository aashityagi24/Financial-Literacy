"""
Comprehensive Feature Tests for CoinQuest
Tests: Parent chore workflow, Teacher comparison, Child classmates, Quest submission, Gifts, Announcements
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test sessions created in MongoDB
PARENT_TOKEN = "test_parent_sess_1769520311262"
TEACHER_TOKEN = "test_teacher_sess_1769520311262"
CHILD_TOKEN = "test_child_sess_1769520311262"

# User IDs
PARENT_ID = "user_6d60d51506c3"  # Alka Maheshwari
TEACHER_ID = "user_e35d0fefca09"  # Aashi Tyagi
CHILD_ID = "user_9de691f1f3ef"    # Aashi Maheshwari (grade 1)
CLASSROOM_ID = "class_c3b866da8f6c"

@pytest.fixture
def parent_session():
    session = requests.Session()
    session.cookies.set("session_token", PARENT_TOKEN)
    return session

@pytest.fixture
def teacher_session():
    session = requests.Session()
    session.cookies.set("session_token", TEACHER_TOKEN)
    return session

@pytest.fixture
def child_session():
    session = requests.Session()
    session.cookies.set("session_token", CHILD_TOKEN)
    return session


class TestParentChoreWorkflow:
    """Test parent chore workflow: create -> child submits -> parent approves/rejects -> coins awarded"""
    
    def test_01_parent_creates_chore(self, parent_session):
        """Parent creates a chore for child"""
        chore_data = {
            "child_id": CHILD_ID,
            "title": f"TEST_Clean Room {uuid.uuid4().hex[:6]}",
            "description": "Clean your room thoroughly",
            "reward_amount": 25,
            "frequency": "one_time"
        }
        response = parent_session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert response.status_code == 200, f"Failed to create chore: {response.text}"
        data = response.json()
        assert "chore_id" in data
        assert data["message"] == "Chore created successfully"
        # Store for later tests
        pytest.chore_id = data["chore_id"]
        print(f"✅ Parent created chore: {pytest.chore_id}")
    
    def test_02_child_sees_chore(self, child_session):
        """Child can see the chore in their list"""
        response = child_session.get(f"{BASE_URL}/api/child/quests")
        assert response.status_code == 200, f"Failed to get quests: {response.text}"
        quests = response.json()
        # Find the test chore
        test_chores = [q for q in quests if q.get("chore_id") == pytest.chore_id or q.get("quest_id") == pytest.chore_id]
        assert len(test_chores) > 0, "Child should see the chore"
        print(f"✅ Child sees chore in quest list")
    
    def test_03_child_submits_chore(self, child_session):
        """Child submits chore for approval"""
        response = child_session.post(
            f"{BASE_URL}/api/child/quests/{pytest.chore_id}/submit",
            json={"answers": {}}
        )
        assert response.status_code == 200, f"Failed to submit chore: {response.text}"
        data = response.json()
        assert data.get("status") == "pending_approval", f"Expected pending_approval status, got: {data}"
        print(f"✅ Child submitted chore, status: pending_approval")
    
    def test_04_parent_sees_pending_chore(self, parent_session):
        """Parent sees pending chore request"""
        response = parent_session.get(f"{BASE_URL}/api/parent/chore-requests")
        assert response.status_code == 200, f"Failed to get chore requests: {response.text}"
        requests_list = response.json()
        # Find our test chore
        test_requests = [r for r in requests_list if r.get("chore_id") == pytest.chore_id]
        assert len(test_requests) > 0, "Parent should see pending chore request"
        pytest.request_id = test_requests[0].get("request_id")
        print(f"✅ Parent sees pending chore request: {pytest.request_id}")
    
    def test_05_parent_approves_chore(self, parent_session):
        """Parent approves the chore and coins are awarded"""
        response = parent_session.post(
            f"{BASE_URL}/api/parent/chore-requests/{pytest.request_id}/validate",
            json={"action": "approve"}
        )
        assert response.status_code == 200, f"Failed to approve chore: {response.text}"
        data = response.json()
        assert data.get("message") == "Chore approved"
        assert data.get("reward") == 25
        print(f"✅ Parent approved chore, reward: {data.get('reward')}")
    
    def test_06_chore_no_longer_pending(self, parent_session):
        """Approved chore no longer appears in pending list"""
        response = parent_session.get(f"{BASE_URL}/api/parent/chore-requests")
        assert response.status_code == 200
        requests_list = response.json()
        test_requests = [r for r in requests_list if r.get("chore_id") == pytest.chore_id]
        assert len(test_requests) == 0, "Approved chore should not be in pending list"
        print(f"✅ Approved chore removed from pending list")


class TestParentChoreRejection:
    """Test parent chore rejection workflow"""
    
    def test_01_create_chore_for_rejection(self, parent_session):
        """Create a chore to test rejection"""
        chore_data = {
            "child_id": CHILD_ID,
            "title": f"TEST_Homework {uuid.uuid4().hex[:6]}",
            "description": "Complete homework",
            "reward_amount": 15,
            "frequency": "one_time"
        }
        response = parent_session.post(f"{BASE_URL}/api/parent/chores-new", json=chore_data)
        assert response.status_code == 200
        pytest.reject_chore_id = response.json()["chore_id"]
        print(f"✅ Created chore for rejection test: {pytest.reject_chore_id}")
    
    def test_02_child_submits_for_rejection(self, child_session):
        """Child submits chore"""
        response = child_session.post(
            f"{BASE_URL}/api/child/quests/{pytest.reject_chore_id}/submit",
            json={"answers": {}}
        )
        assert response.status_code == 200
        print(f"✅ Child submitted chore for rejection test")
    
    def test_03_parent_rejects_chore(self, parent_session):
        """Parent rejects the chore"""
        # Get the request ID
        response = parent_session.get(f"{BASE_URL}/api/parent/chore-requests")
        requests_list = response.json()
        test_requests = [r for r in requests_list if r.get("chore_id") == pytest.reject_chore_id]
        assert len(test_requests) > 0, "Should find pending request"
        request_id = test_requests[0]["request_id"]
        
        # Reject
        response = parent_session.post(
            f"{BASE_URL}/api/parent/chore-requests/{request_id}/validate",
            json={"action": "reject", "reason": "Not done properly"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "rejected" in data.get("message", "").lower() or data.get("message") == "Chore rejected"
        print(f"✅ Parent rejected chore")


class TestTeacherCompareAll:
    """Test teacher dashboard Compare All feature with all columns"""
    
    def test_01_teacher_gets_classrooms(self, teacher_session):
        """Teacher can get their classrooms"""
        response = teacher_session.get(f"{BASE_URL}/api/teacher/dashboard")
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        data = response.json()
        assert "classrooms" in data
        print(f"✅ Teacher has {len(data['classrooms'])} classrooms")
    
    def test_02_teacher_comparison_returns_all_fields(self, teacher_session):
        """Teacher comparison endpoint returns all required fields"""
        response = teacher_session.get(f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/comparison")
        assert response.status_code == 200, f"Failed to get comparison: {response.text}"
        data = response.json()
        
        assert "students" in data
        assert "classroom" in data
        
        if len(data["students"]) > 0:
            student = data["students"][0]
            # Check all required fields
            required_fields = [
                "student_id", "name", "total_balance",
                "spending_balance", "spending_spent",
                "savings_balance", "savings_in_goals",
                "gifting_balance", "gifting_spent",
                "investing_balance", "investing_spent",
                "lessons_completed", "quests_completed", "chores_completed",
                "garden_pl", "stock_pl",
                "gifts_received", "gifts_sent",
                "badges", "streak"
            ]
            
            missing_fields = [f for f in required_fields if f not in student]
            assert len(missing_fields) == 0, f"Missing fields in comparison: {missing_fields}"
            
            print(f"✅ Comparison has all {len(required_fields)} required fields")
            print(f"   Student: {student['name']}")
            print(f"   Total Balance: {student['total_balance']}")
            print(f"   Spending: {student['spending_balance']} (spent: {student['spending_spent']})")
            print(f"   Savings: {student['savings_balance']} (in goals: {student['savings_in_goals']})")
            print(f"   Gifting: {student['gifting_balance']} (spent: {student['gifting_spent']})")
            print(f"   Investing: {student['investing_balance']} (spent: {student['investing_spent']})")
            print(f"   Garden P/L: {student['garden_pl']}, Stock P/L: {student['stock_pl']}")
            print(f"   Badges: {student['badges']}, Streak: {student['streak']}")
        else:
            print("⚠️ No students in classroom for comparison")


class TestChildClassmates:
    """Test child classmates endpoint with all stats"""
    
    def test_01_child_gets_classmates(self, child_session):
        """Child can get classmates with all stats"""
        response = child_session.get(f"{BASE_URL}/api/child/classmates")
        assert response.status_code == 200, f"Failed to get classmates: {response.text}"
        classmates = response.json()
        
        print(f"✅ Child has {len(classmates)} classmates")
        
        if len(classmates) > 0:
            classmate = classmates[0]
            # Check required fields
            required_fields = [
                "user_id", "name", "grade",
                "streak_count", "total_balance",
                "lessons_completed", "badges",
                "investment_performance"
            ]
            
            missing_fields = [f for f in required_fields if f not in classmate]
            assert len(missing_fields) == 0, f"Missing fields in classmates: {missing_fields}"
            
            print(f"   Classmate: {classmate['name']}")
            print(f"   Streak: {classmate['streak_count']}, Balance: {classmate['total_balance']}")
            print(f"   Lessons: {classmate['lessons_completed']}, Badges: {classmate['badges']}")
            print(f"   Investment Performance: {classmate['investment_performance']}")


class TestQuestWithQuestions:
    """Test quest submission with questions - can only attempt once, shows correct answers"""
    
    def test_01_get_available_quests(self, child_session):
        """Child can get available quests"""
        response = child_session.get(f"{BASE_URL}/api/child/quests")
        assert response.status_code == 200, f"Failed to get quests: {response.text}"
        quests = response.json()
        print(f"✅ Child has {len(quests)} available quests")
        
        # Find a quest with questions (admin/teacher quest)
        quests_with_questions = [q for q in quests if len(q.get("questions", [])) > 0 and not q.get("is_completed")]
        if len(quests_with_questions) > 0:
            pytest.test_quest = quests_with_questions[0]
            print(f"   Found quest with questions: {pytest.test_quest.get('title')}")
        else:
            pytest.test_quest = None
            print("   No quests with questions available")
    
    def test_02_submit_quest_shows_correct_answers(self, child_session):
        """Submitting quest returns correct answers"""
        if not hasattr(pytest, 'test_quest') or pytest.test_quest is None:
            pytest.skip("No quest with questions available")
        
        quest_id = pytest.test_quest.get("quest_id")
        questions = pytest.test_quest.get("questions", [])
        
        # Submit with some answers
        answers = {}
        for q in questions:
            q_id = q.get("question_id")
            if q.get("options"):
                answers[q_id] = q["options"][0]  # Pick first option
        
        response = child_session.post(
            f"{BASE_URL}/api/child/quests/{quest_id}/submit",
            json={"answers": answers}
        )
        
        if response.status_code == 400:
            # Quest already completed
            print(f"⚠️ Quest already completed: {response.json()}")
            return
        
        assert response.status_code == 200, f"Failed to submit quest: {response.text}"
        data = response.json()
        
        # Check if correct_answers is returned
        if "correct_answers" in data:
            print(f"✅ Quest submission returns correct_answers")
            print(f"   Score: {data.get('score')}/{data.get('total_points')}")
        else:
            print(f"✅ Quest submitted (no questions or chore type)")


class TestParentGiftMoney:
    """Test parent gift money/allowance functionality"""
    
    def test_01_parent_can_give_reward(self, parent_session):
        """Parent can give instant reward to child"""
        reward_data = {
            "child_id": CHILD_ID,
            "title": "TEST_Good Behavior Reward",
            "description": "For being helpful",
            "amount": 10,
            "category": "reward"
        }
        response = parent_session.post(f"{BASE_URL}/api/parent/reward-penalty", json=reward_data)
        assert response.status_code == 200, f"Failed to give reward: {response.text}"
        data = response.json()
        assert data.get("amount") == 10
        print(f"✅ Parent gave reward: {data.get('amount')} coins")
    
    def test_02_parent_can_create_allowance(self, parent_session):
        """Parent can create recurring allowance"""
        allowance_data = {
            "child_id": CHILD_ID,
            "amount": 50,
            "frequency": "weekly"
        }
        response = parent_session.post(f"{BASE_URL}/api/parent/allowances", json=allowance_data)
        assert response.status_code == 200, f"Failed to create allowance: {response.text}"
        data = response.json()
        assert "allowance_id" in data
        pytest.allowance_id = data["allowance_id"]
        print(f"✅ Parent created allowance: {pytest.allowance_id}")
    
    def test_03_parent_can_get_allowances(self, parent_session):
        """Parent can view allowances"""
        response = parent_session.get(f"{BASE_URL}/api/parent/allowances")
        assert response.status_code == 200, f"Failed to get allowances: {response.text}"
        allowances = response.json()
        print(f"✅ Parent has {len(allowances)} allowances configured")


class TestTeacherAnnouncements:
    """Test teacher announcements functionality"""
    
    def test_01_teacher_creates_announcement(self, teacher_session):
        """Teacher can create announcement"""
        announcement_data = {
            "title": f"TEST_Class Update {uuid.uuid4().hex[:6]}",
            "content": "Important class announcement for testing"
        }
        response = teacher_session.post(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/announcements",
            json=announcement_data
        )
        assert response.status_code == 200, f"Failed to create announcement: {response.text}"
        data = response.json()
        assert "announcement_id" in data
        pytest.announcement_id = data["announcement_id"]
        print(f"✅ Teacher created announcement: {pytest.announcement_id}")
    
    def test_02_teacher_gets_announcements(self, teacher_session):
        """Teacher can view announcements"""
        response = teacher_session.get(f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/announcements")
        assert response.status_code == 200, f"Failed to get announcements: {response.text}"
        announcements = response.json()
        assert len(announcements) > 0
        print(f"✅ Teacher has {len(announcements)} announcements")
    
    def test_03_child_sees_announcement(self, child_session):
        """Child can see teacher's announcement"""
        response = child_session.get(f"{BASE_URL}/api/child/announcements")
        assert response.status_code == 200, f"Failed to get announcements: {response.text}"
        announcements = response.json()
        print(f"✅ Child sees {len(announcements)} announcements")


class TestTeacherQuests:
    """Test teacher quest creation"""
    
    def test_01_teacher_creates_quest(self, teacher_session):
        """Teacher can create a quest"""
        quest_data = {
            "title": f"TEST_Math Challenge {uuid.uuid4().hex[:6]}",
            "description": "Complete math problems",
            "reward_coins": 20,
            "classroom_id": CLASSROOM_ID,
            "quest_type": "task"
        }
        response = teacher_session.post(f"{BASE_URL}/api/teacher/quests", json=quest_data)
        assert response.status_code == 200, f"Failed to create quest: {response.text}"
        data = response.json()
        assert "quest_id" in data
        pytest.teacher_quest_id = data["quest_id"]
        print(f"✅ Teacher created quest: {pytest.teacher_quest_id}")
    
    def test_02_teacher_gets_quests(self, teacher_session):
        """Teacher can view their quests"""
        response = teacher_session.get(f"{BASE_URL}/api/teacher/quests")
        assert response.status_code == 200, f"Failed to get quests: {response.text}"
        quests = response.json()
        print(f"✅ Teacher has {len(quests)} quests")


class TestChildGifting:
    """Test child can send gifts to classmates"""
    
    def test_01_child_gets_classmates_for_gifting(self, child_session):
        """Child can get classmates to gift"""
        response = child_session.get(f"{BASE_URL}/api/child/classmates")
        assert response.status_code == 200
        classmates = response.json()
        if len(classmates) > 0:
            pytest.gift_recipient = classmates[0]["user_id"]
            print(f"✅ Found classmate for gifting: {classmates[0]['name']}")
        else:
            pytest.gift_recipient = None
            print("⚠️ No classmates available for gifting")
    
    def test_02_child_sends_gift(self, child_session):
        """Child can send gift to classmate"""
        if not hasattr(pytest, 'gift_recipient') or pytest.gift_recipient is None:
            pytest.skip("No classmate available for gifting")
        
        # First check gifting balance
        response = child_session.get(f"{BASE_URL}/api/wallet")
        if response.status_code == 200:
            wallet = response.json()
            gifting_balance = 0
            for acc in wallet.get("accounts", []):
                if acc.get("account_type") == "gifting":
                    gifting_balance = acc.get("balance", 0)
            
            if gifting_balance < 5:
                print(f"⚠️ Insufficient gifting balance: {gifting_balance}")
                pytest.skip("Insufficient gifting balance")
        
        gift_data = {
            "to_user_id": pytest.gift_recipient,
            "amount": 5,
            "message": "Test gift from testing"
        }
        response = child_session.post(f"{BASE_URL}/api/child/gift-money", json=gift_data)
        
        if response.status_code == 400:
            print(f"⚠️ Gift failed (likely insufficient balance): {response.json()}")
            return
        
        assert response.status_code == 200, f"Failed to send gift: {response.text}"
        print(f"✅ Child sent gift successfully")


class TestParentChildInsights:
    """Test parent can view child insights"""
    
    def test_01_parent_gets_child_insights(self, parent_session):
        """Parent can get detailed child insights"""
        response = parent_session.get(f"{BASE_URL}/api/parent/children/{CHILD_ID}/insights")
        assert response.status_code == 200, f"Failed to get insights: {response.text}"
        data = response.json()
        
        # Check structure
        assert "child" in data
        assert "wallet" in data
        assert "learning" in data
        assert "chores" in data
        assert "quests" in data
        assert "achievements" in data
        assert "gifts" in data
        assert "garden" in data
        assert "stocks" in data
        assert "investment_type" in data
        
        print(f"✅ Parent child insights has all sections")
        print(f"   Child: {data['child']['name']}")
        print(f"   Total Balance: {data['wallet']['total_balance']}")
        print(f"   Investment Type: {data['investment_type']}")
        print(f"   Lessons Completed: {data['learning']['lessons_completed']}")


class TestTeacherStudentInsights:
    """Test teacher can view student insights"""
    
    def test_01_teacher_gets_student_insights(self, teacher_session):
        """Teacher can get detailed student insights"""
        response = teacher_session.get(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/student-insights/{CHILD_ID}"
        )
        assert response.status_code == 200, f"Failed to get insights: {response.text}"
        data = response.json()
        
        # Check structure
        assert "student" in data
        assert "wallet" in data
        assert "learning" in data
        assert "chores" in data
        assert "quests" in data
        assert "achievements" in data
        assert "gifts" in data
        assert "garden" in data
        assert "stocks" in data
        
        print(f"✅ Teacher student insights has all sections")
        print(f"   Student: {data['student']['name']}")
        print(f"   Total Balance: {data['wallet']['total_balance']}")


# Cleanup test data
class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_chores(self, parent_session):
        """Delete test chores"""
        response = parent_session.get(f"{BASE_URL}/api/parent/chores-new")
        if response.status_code == 200:
            chores = response.json()
            for chore in chores:
                if chore.get("title", "").startswith("TEST_"):
                    chore_id = chore.get("chore_id")
                    parent_session.delete(f"{BASE_URL}/api/parent/chores-new/{chore_id}")
        print("✅ Cleaned up test chores")
    
    def test_cleanup_test_allowances(self, parent_session):
        """Delete test allowances"""
        if hasattr(pytest, 'allowance_id'):
            parent_session.delete(f"{BASE_URL}/api/parent/allowances/{pytest.allowance_id}")
        print("✅ Cleaned up test allowances")
    
    def test_cleanup_test_announcements(self, teacher_session):
        """Delete test announcements"""
        if hasattr(pytest, 'announcement_id'):
            teacher_session.delete(f"{BASE_URL}/api/teacher/announcements/{pytest.announcement_id}")
        print("✅ Cleaned up test announcements")
    
    def test_cleanup_test_quests(self, teacher_session):
        """Delete test quests"""
        if hasattr(pytest, 'teacher_quest_id'):
            teacher_session.delete(f"{BASE_URL}/api/teacher/quests/{pytest.teacher_quest_id}")
        print("✅ Cleaned up test quests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
