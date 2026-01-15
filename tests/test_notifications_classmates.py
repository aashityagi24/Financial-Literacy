"""
Test suite for Notification Center and Classmates/Gifting features
Tests:
- GET /api/notifications - returns notifications for user
- POST /api/notifications/mark-read - marks all as read
- DELETE /api/notifications/{id} - deletes notification
- GET /api/child/classmates - returns classmates with balances, lessons, savings goals
- POST /api/child/gift-money - sends gift from giving jar to classmate
- POST /api/child/request-gift - creates gift request
- POST /api/child/gift-requests/{id}/respond - accept or decline gift request
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data tracking
TEST_DATA = {
    "child1_session": None,
    "child1_user_id": None,
    "child2_session": None,
    "child2_user_id": None,
    "teacher_session": None,
    "teacher_user_id": None,
    "classroom_id": None,
    "notification_id": None,
    "gift_request_id": None
}


class TestNotificationEndpoints:
    """Test notification CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, child_session):
        """Setup for notification tests"""
        self.client = api_client
        self.session = child_session
        self.client.headers.update({"Authorization": f"Bearer {self.session}"})
    
    def test_get_notifications_empty(self, api_client, child_session):
        """Test getting notifications when none exist"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.get(f"{BASE_URL}/api/notifications")
        
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        print(f"✅ GET /api/notifications - returned {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_mark_notifications_read(self, api_client, child_session):
        """Test marking all notifications as read"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.post(f"{BASE_URL}/api/notifications/mark-read")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ POST /api/notifications/mark-read - {data['message']}")
    
    def test_delete_notification_not_found(self, api_client, child_session):
        """Test deleting non-existent notification returns 404"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.delete(f"{BASE_URL}/api/notifications/notif_nonexistent123")
        
        assert response.status_code == 404
        print("✅ DELETE /api/notifications/{id} - returns 404 for non-existent notification")


class TestClassmatesEndpoint:
    """Test classmates listing endpoint"""
    
    def test_get_classmates_no_classroom(self, api_client, child_session):
        """Test getting classmates when not in a classroom"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.get(f"{BASE_URL}/api/child/classmates")
        
        assert response.status_code == 200
        data = response.json()
        assert "classmates" in data
        assert "classroom" in data
        print(f"✅ GET /api/child/classmates - returned {len(data['classmates'])} classmates")
    
    def test_get_classmates_requires_child_role(self, api_client, teacher_session):
        """Test that only children can view classmates"""
        api_client.headers.update({"Authorization": f"Bearer {teacher_session}"})
        response = api_client.get(f"{BASE_URL}/api/child/classmates")
        
        assert response.status_code == 400
        print("✅ GET /api/child/classmates - correctly rejects non-child users")


class TestGiftMoneyEndpoint:
    """Test gift money functionality"""
    
    def test_gift_money_requires_child_role(self, api_client, teacher_session):
        """Test that only children can send gifts"""
        api_client.headers.update({"Authorization": f"Bearer {teacher_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/gift-money", json={
            "recipient_id": "some_user_id",
            "amount": 10,
            "message": "Test gift"
        })
        
        assert response.status_code == 400
        print("✅ POST /api/child/gift-money - correctly rejects non-child users")
    
    def test_gift_money_invalid_amount(self, api_client, child_session):
        """Test that negative/zero amounts are rejected"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/gift-money", json={
            "recipient_id": "some_user_id",
            "amount": 0,
            "message": "Test gift"
        })
        
        assert response.status_code == 400
        print("✅ POST /api/child/gift-money - correctly rejects zero/negative amounts")
    
    def test_gift_money_recipient_not_found(self, api_client, child_session_with_giving):
        """Test gift to non-existent recipient"""
        session, user_id = child_session_with_giving
        api_client.headers.update({"Authorization": f"Bearer {session}"})
        response = api_client.post(f"{BASE_URL}/api/child/gift-money", json={
            "recipient_id": "nonexistent_user_123",
            "amount": 5,
            "message": "Test gift"
        })
        
        assert response.status_code == 404
        print("✅ POST /api/child/gift-money - returns 404 for non-existent recipient")


class TestGiftRequestEndpoint:
    """Test gift request functionality"""
    
    def test_request_gift_requires_child_role(self, api_client, teacher_session):
        """Test that only children can request gifts"""
        api_client.headers.update({"Authorization": f"Bearer {teacher_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/request-gift", json={
            "recipient_id": "some_user_id",
            "amount": 10,
            "reason": "Test request"
        })
        
        assert response.status_code == 400
        print("✅ POST /api/child/request-gift - correctly rejects non-child users")
    
    def test_request_gift_invalid_amount(self, api_client, child_session):
        """Test that negative/zero amounts are rejected"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/request-gift", json={
            "recipient_id": "some_user_id",
            "amount": -5,
            "reason": "Test request"
        })
        
        assert response.status_code == 400
        print("✅ POST /api/child/request-gift - correctly rejects negative amounts")
    
    def test_request_gift_recipient_not_found(self, api_client, child_session):
        """Test request to non-existent recipient"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/request-gift", json={
            "recipient_id": "nonexistent_user_123",
            "amount": 10,
            "reason": "Test request"
        })
        
        assert response.status_code == 404
        print("✅ POST /api/child/request-gift - returns 404 for non-existent recipient")
    
    def test_get_gift_requests(self, api_client, child_session):
        """Test getting gift requests"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.get(f"{BASE_URL}/api/child/gift-requests")
        
        assert response.status_code == 200
        data = response.json()
        assert "received" in data
        assert "sent" in data
        print(f"✅ GET /api/child/gift-requests - received: {len(data['received'])}, sent: {len(data['sent'])}")
    
    def test_respond_gift_request_not_found(self, api_client, child_session):
        """Test responding to non-existent gift request"""
        api_client.headers.update({"Authorization": f"Bearer {child_session}"})
        response = api_client.post(f"{BASE_URL}/api/child/gift-requests/giftreq_nonexistent/respond", json={
            "action": "accept"
        })
        
        assert response.status_code == 404
        print("✅ POST /api/child/gift-requests/{id}/respond - returns 404 for non-existent request")


class TestIntegratedGiftingFlow:
    """Test complete gifting flow between two children"""
    
    def test_complete_gift_flow(self, api_client, two_children_in_classroom):
        """Test complete flow: child1 sends gift to child2, notification created"""
        child1_session, child1_id, child2_session, child2_id, classroom_id = two_children_in_classroom
        
        # Step 1: Child1 sends gift to Child2
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        gift_response = api_client.post(f"{BASE_URL}/api/child/gift-money", json={
            "recipient_id": child2_id,
            "amount": 5,
            "message": "Here's a gift for you!"
        })
        
        assert gift_response.status_code == 200
        print(f"✅ Child1 sent gift to Child2: {gift_response.json()}")
        
        # Step 2: Child2 checks notifications
        api_client.headers.update({"Authorization": f"Bearer {child2_session}"})
        notif_response = api_client.get(f"{BASE_URL}/api/notifications")
        
        assert notif_response.status_code == 200
        notifications = notif_response.json()["notifications"]
        
        # Find gift notification
        gift_notif = next((n for n in notifications if n["notification_type"] == "gift_received"), None)
        assert gift_notif is not None, "Gift notification should be created"
        assert gift_notif["amount"] == 5
        print(f"✅ Child2 received gift notification: {gift_notif['title']}")
        
        # Step 3: Child2 marks notifications as read
        mark_response = api_client.post(f"{BASE_URL}/api/notifications/mark-read")
        assert mark_response.status_code == 200
        print("✅ Child2 marked notifications as read")
        
        # Step 4: Verify unread count is 0
        notif_response2 = api_client.get(f"{BASE_URL}/api/notifications")
        assert notif_response2.json()["unread_count"] == 0
        print("✅ Unread count is now 0")
        
        # Step 5: Delete the notification
        if gift_notif:
            delete_response = api_client.delete(f"{BASE_URL}/api/notifications/{gift_notif['notification_id']}")
            assert delete_response.status_code == 200
            print("✅ Notification deleted successfully")
    
    def test_complete_gift_request_flow(self, api_client, two_children_in_classroom):
        """Test complete flow: child1 requests gift from child2, child2 accepts"""
        child1_session, child1_id, child2_session, child2_id, classroom_id = two_children_in_classroom
        
        # Step 1: Child1 requests gift from Child2
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        request_response = api_client.post(f"{BASE_URL}/api/child/request-gift", json={
            "recipient_id": child2_id,
            "amount": 3,
            "reason": "I need help with my savings goal!"
        })
        
        assert request_response.status_code == 200
        request_id = request_response.json()["request_id"]
        print(f"✅ Child1 created gift request: {request_id}")
        
        # Step 2: Child2 checks notifications
        api_client.headers.update({"Authorization": f"Bearer {child2_session}"})
        notif_response = api_client.get(f"{BASE_URL}/api/notifications")
        
        notifications = notif_response.json()["notifications"]
        gift_request_notif = next((n for n in notifications if n["notification_type"] == "gift_request"), None)
        assert gift_request_notif is not None, "Gift request notification should be created"
        assert gift_request_notif["related_id"] == request_id
        print(f"✅ Child2 received gift request notification: {gift_request_notif['title']}")
        
        # Step 3: Child2 accepts the request
        accept_response = api_client.post(f"{BASE_URL}/api/child/gift-requests/{request_id}/respond", json={
            "action": "accept"
        })
        
        assert accept_response.status_code == 200
        print(f"✅ Child2 accepted gift request: {accept_response.json()}")
        
        # Step 4: Child1 checks for acceptance notification
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        notif_response2 = api_client.get(f"{BASE_URL}/api/notifications")
        
        notifications2 = notif_response2.json()["notifications"]
        acceptance_notif = next((n for n in notifications2 if n["notification_type"] == "gift_received" and "accepted" in n.get("title", "").lower()), None)
        assert acceptance_notif is not None, "Acceptance notification should be created"
        print(f"✅ Child1 received acceptance notification: {acceptance_notif['title']}")
    
    def test_gift_request_decline_flow(self, api_client, two_children_in_classroom):
        """Test flow: child1 requests gift from child2, child2 declines"""
        child1_session, child1_id, child2_session, child2_id, classroom_id = two_children_in_classroom
        
        # Step 1: Child1 requests gift from Child2
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        request_response = api_client.post(f"{BASE_URL}/api/child/request-gift", json={
            "recipient_id": child2_id,
            "amount": 10,
            "reason": "Please help!"
        })
        
        assert request_response.status_code == 200
        request_id = request_response.json()["request_id"]
        print(f"✅ Child1 created gift request: {request_id}")
        
        # Step 2: Child2 declines the request
        api_client.headers.update({"Authorization": f"Bearer {child2_session}"})
        decline_response = api_client.post(f"{BASE_URL}/api/child/gift-requests/{request_id}/respond", json={
            "action": "decline"
        })
        
        assert decline_response.status_code == 200
        print(f"✅ Child2 declined gift request: {decline_response.json()}")
        
        # Step 3: Child1 checks for decline notification
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        notif_response = api_client.get(f"{BASE_URL}/api/notifications")
        
        notifications = notif_response.json()["notifications"]
        decline_notif = next((n for n in notifications if n["notification_type"] == "gift_request_declined"), None)
        assert decline_notif is not None, "Decline notification should be created"
        print(f"✅ Child1 received decline notification: {decline_notif['title']}")


class TestClassmatesWithClassroom:
    """Test classmates endpoint with actual classroom setup"""
    
    def test_classmates_shows_peer_info(self, api_client, two_children_in_classroom):
        """Test that classmates endpoint returns peer info correctly"""
        child1_session, child1_id, child2_session, child2_id, classroom_id = two_children_in_classroom
        
        # Child1 gets classmates
        api_client.headers.update({"Authorization": f"Bearer {child1_session}"})
        response = api_client.get(f"{BASE_URL}/api/child/classmates")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["classroom"] is not None
        assert len(data["classmates"]) >= 1
        
        # Find child2 in classmates
        child2_info = next((c for c in data["classmates"] if c["user_id"] == child2_id), None)
        assert child2_info is not None, "Child2 should appear in Child1's classmates"
        
        # Verify classmate info structure
        assert "name" in child2_info
        assert "total_balance" in child2_info
        assert "lessons_completed" in child2_info
        assert "streak_count" in child2_info
        assert "savings_goals" in child2_info
        
        print(f"✅ Classmates endpoint returns peer info correctly")
        print(f"   - Classmate: {child2_info['name']}")
        print(f"   - Balance: ₹{child2_info['total_balance']}")
        print(f"   - Lessons: {child2_info['lessons_completed']}")
        print(f"   - Streak: {child2_info['streak_count']}")
        print(f"   - Savings goals: {len(child2_info['savings_goals'])}")


# ============== FIXTURES ==============

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def child_session(api_client):
    """Create a test child user and return session token"""
    import subprocess
    import json
    
    timestamp = int(datetime.now().timestamp() * 1000)
    user_id = f"test_child_{timestamp}"
    session_token = f"test_session_{timestamp}"
    email = f"test.child.{timestamp}@example.com"
    
    # Create user and session in MongoDB
    mongo_script = f'''
    use('test_database');
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "{email}",
        name: "Test Child {timestamp}",
        picture: "https://via.placeholder.com/150",
        role: "child",
        grade: 3,
        streak_count: 0,
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    // Create wallet accounts
    ["spending", "savings", "investing", "giving"].forEach(function(type) {{
        db.wallet_accounts.insertOne({{
            account_id: "acc_" + Math.random().toString(36).substr(2, 12),
            user_id: "{user_id}",
            account_type: type,
            balance: type === "spending" ? 100 : 0,
            created_at: new Date()
        }});
    }});
    '''
    
    subprocess.run(["mongosh", "--quiet", "--eval", mongo_script], capture_output=True)
    
    TEST_DATA["child1_session"] = session_token
    TEST_DATA["child1_user_id"] = user_id
    
    yield session_token
    
    # Cleanup
    cleanup_script = f'''
    use('test_database');
    db.users.deleteOne({{ user_id: "{user_id}" }});
    db.user_sessions.deleteOne({{ session_token: "{session_token}" }});
    db.wallet_accounts.deleteMany({{ user_id: "{user_id}" }});
    db.notifications.deleteMany({{ user_id: "{user_id}" }});
    '''
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup_script], capture_output=True)


@pytest.fixture
def child_session_with_giving(api_client):
    """Create a test child user with giving balance and return session token and user_id"""
    import subprocess
    
    timestamp = int(datetime.now().timestamp() * 1000)
    user_id = f"test_child_giving_{timestamp}"
    session_token = f"test_session_giving_{timestamp}"
    email = f"test.child.giving.{timestamp}@example.com"
    
    mongo_script = f'''
    use('test_database');
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "{email}",
        name: "Test Child Giving {timestamp}",
        picture: "https://via.placeholder.com/150",
        role: "child",
        grade: 3,
        streak_count: 0,
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    ["spending", "savings", "investing", "giving"].forEach(function(type) {{
        db.wallet_accounts.insertOne({{
            account_id: "acc_" + Math.random().toString(36).substr(2, 12),
            user_id: "{user_id}",
            account_type: type,
            balance: type === "giving" ? 50 : (type === "spending" ? 100 : 0),
            created_at: new Date()
        }});
    }});
    '''
    
    subprocess.run(["mongosh", "--quiet", "--eval", mongo_script], capture_output=True)
    
    yield (session_token, user_id)
    
    cleanup_script = f'''
    use('test_database');
    db.users.deleteOne({{ user_id: "{user_id}" }});
    db.user_sessions.deleteOne({{ session_token: "{session_token}" }});
    db.wallet_accounts.deleteMany({{ user_id: "{user_id}" }});
    db.notifications.deleteMany({{ user_id: "{user_id}" }});
    '''
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup_script], capture_output=True)


@pytest.fixture
def teacher_session(api_client):
    """Create a test teacher user and return session token"""
    import subprocess
    
    timestamp = int(datetime.now().timestamp() * 1000)
    user_id = f"test_teacher_{timestamp}"
    session_token = f"test_teacher_session_{timestamp}"
    email = f"test.teacher.{timestamp}@example.com"
    
    mongo_script = f'''
    use('test_database');
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "{email}",
        name: "Test Teacher {timestamp}",
        picture: "https://via.placeholder.com/150",
        role: "teacher",
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    '''
    
    subprocess.run(["mongosh", "--quiet", "--eval", mongo_script], capture_output=True)
    
    TEST_DATA["teacher_session"] = session_token
    TEST_DATA["teacher_user_id"] = user_id
    
    yield session_token
    
    cleanup_script = f'''
    use('test_database');
    db.users.deleteOne({{ user_id: "{user_id}" }});
    db.user_sessions.deleteOne({{ session_token: "{session_token}" }});
    '''
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup_script], capture_output=True)


@pytest.fixture
def two_children_in_classroom(api_client):
    """Create two children in the same classroom with giving balance"""
    import subprocess
    
    timestamp = int(datetime.now().timestamp() * 1000)
    
    # Child 1
    child1_id = f"test_child1_{timestamp}"
    child1_session = f"test_session_child1_{timestamp}"
    child1_email = f"test.child1.{timestamp}@example.com"
    
    # Child 2
    child2_id = f"test_child2_{timestamp}"
    child2_session = f"test_session_child2_{timestamp}"
    child2_email = f"test.child2.{timestamp}@example.com"
    
    # Teacher
    teacher_id = f"test_teacher_class_{timestamp}"
    teacher_session = f"test_teacher_session_class_{timestamp}"
    
    # Classroom
    classroom_id = f"classroom_{timestamp}"
    invite_code = f"INV{timestamp % 100000}"
    
    mongo_script = f'''
    use('test_database');
    
    // Create teacher
    db.users.insertOne({{
        user_id: "{teacher_id}",
        email: "test.teacher.class.{timestamp}@example.com",
        name: "Test Teacher Class",
        role: "teacher",
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{teacher_id}",
        session_token: "{teacher_session}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    
    // Create classroom
    db.classrooms.insertOne({{
        classroom_id: "{classroom_id}",
        teacher_id: "{teacher_id}",
        name: "Test Classroom {timestamp}",
        grade_level: 3,
        invite_code: "{invite_code}",
        created_at: new Date()
    }});
    
    // Create child 1
    db.users.insertOne({{
        user_id: "{child1_id}",
        email: "{child1_email}",
        name: "Test Child One",
        picture: "https://via.placeholder.com/150",
        role: "child",
        grade: 3,
        streak_count: 5,
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{child1_id}",
        session_token: "{child1_session}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    ["spending", "savings", "investing", "giving"].forEach(function(type) {{
        db.wallet_accounts.insertOne({{
            account_id: "acc_c1_" + type + "_{timestamp}",
            user_id: "{child1_id}",
            account_type: type,
            balance: type === "giving" ? 50 : (type === "spending" ? 100 : 0),
            created_at: new Date()
        }});
    }});
    db.classroom_students.insertOne({{
        id: "cs1_{timestamp}",
        classroom_id: "{classroom_id}",
        student_id: "{child1_id}",
        joined_at: new Date()
    }});
    
    // Create child 2
    db.users.insertOne({{
        user_id: "{child2_id}",
        email: "{child2_email}",
        name: "Test Child Two",
        picture: "https://via.placeholder.com/150",
        role: "child",
        grade: 3,
        streak_count: 3,
        created_at: new Date()
    }});
    db.user_sessions.insertOne({{
        user_id: "{child2_id}",
        session_token: "{child2_session}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    ["spending", "savings", "investing", "giving"].forEach(function(type) {{
        db.wallet_accounts.insertOne({{
            account_id: "acc_c2_" + type + "_{timestamp}",
            user_id: "{child2_id}",
            account_type: type,
            balance: type === "giving" ? 50 : (type === "spending" ? 100 : 0),
            created_at: new Date()
        }});
    }});
    db.classroom_students.insertOne({{
        id: "cs2_{timestamp}",
        classroom_id: "{classroom_id}",
        student_id: "{child2_id}",
        joined_at: new Date()
    }});
    
    // Add a savings goal for child2
    db.savings_goals.insertOne({{
        goal_id: "goal_{timestamp}",
        user_id: "{child2_id}",
        child_id: "{child2_id}",
        title: "New Bicycle",
        target_amount: 500,
        current_amount: 100,
        completed: false,
        created_at: new Date()
    }});
    '''
    
    subprocess.run(["mongosh", "--quiet", "--eval", mongo_script], capture_output=True)
    
    yield (child1_session, child1_id, child2_session, child2_id, classroom_id)
    
    # Cleanup
    cleanup_script = f'''
    use('test_database');
    db.users.deleteMany({{ user_id: {{ $in: ["{child1_id}", "{child2_id}", "{teacher_id}"] }} }});
    db.user_sessions.deleteMany({{ session_token: {{ $in: ["{child1_session}", "{child2_session}", "{teacher_session}"] }} }});
    db.wallet_accounts.deleteMany({{ user_id: {{ $in: ["{child1_id}", "{child2_id}"] }} }});
    db.classrooms.deleteOne({{ classroom_id: "{classroom_id}" }});
    db.classroom_students.deleteMany({{ classroom_id: "{classroom_id}" }});
    db.notifications.deleteMany({{ user_id: {{ $in: ["{child1_id}", "{child2_id}"] }} }});
    db.gift_requests.deleteMany({{ $or: [{{ requester_id: "{child1_id}" }}, {{ recipient_id: "{child1_id}" }}, {{ requester_id: "{child2_id}" }}, {{ recipient_id: "{child2_id}" }}] }});
    db.transactions.deleteMany({{ user_id: {{ $in: ["{child1_id}", "{child2_id}"] }} }});
    db.savings_goals.deleteOne({{ goal_id: "goal_{timestamp}" }});
    '''
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup_script], capture_output=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
