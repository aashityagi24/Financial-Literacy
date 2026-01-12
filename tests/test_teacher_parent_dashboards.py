"""
Backend API tests for Teacher and Parent Dashboard features
Tests: Teacher Dashboard, Parent Dashboard, Classroom management, Chores, Allowances, Savings Goals
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session tokens (created via mongosh)
TEACHER_SESSION = "test_teacher_session_1768221526944"
TEACHER_USER_ID = "test-teacher-1768221526944"
PARENT_SESSION = "test_parent_session_1768221527012"
PARENT_USER_ID = "test-parent-1768221527012"
CHILD_SESSION = "test_child_session_1768221527018"
CHILD_USER_ID = "test-child-1768221527018"
CHILD_EMAIL = "test.child.1768221527018@example.com"


@pytest.fixture
def teacher_client():
    """Session with teacher auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEACHER_SESSION}"
    })
    return session


@pytest.fixture
def parent_client():
    """Session with parent auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {PARENT_SESSION}"
    })
    return session


@pytest.fixture
def child_client():
    """Session with child auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CHILD_SESSION}"
    })
    return session


@pytest.fixture
def unauthenticated_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ============== TEACHER DASHBOARD TESTS ==============

class TestTeacherAccessControl:
    """Test that only teachers can access teacher endpoints"""
    
    def test_teacher_dashboard_requires_auth(self, unauthenticated_client):
        """Unauthenticated users cannot access teacher dashboard"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/teacher/dashboard")
        assert response.status_code == 401
        print("✅ Teacher dashboard requires authentication")
    
    def test_teacher_dashboard_requires_teacher_role(self, child_client):
        """Non-teacher users cannot access teacher dashboard"""
        response = child_client.get(f"{BASE_URL}/api/teacher/dashboard")
        assert response.status_code == 403
        print("✅ Teacher dashboard requires teacher role")
    
    def test_teacher_can_access_dashboard(self, teacher_client):
        """Teachers can access their dashboard"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "classrooms" in data
        assert "total_students" in data
        print(f"✅ Teacher dashboard accessible - {len(data['classrooms'])} classrooms, {data['total_students']} students")


class TestTeacherClassroomManagement:
    """Test classroom CRUD operations"""
    
    def test_create_classroom(self, teacher_client):
        """Teacher can create a classroom"""
        payload = {
            "name": "TEST_Math Class 3A",
            "description": "Third grade math class",
            "grade_level": 3
        }
        response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "classroom" in data
        assert data["classroom"]["name"] == payload["name"]
        assert "invite_code" in data["classroom"]
        assert len(data["classroom"]["invite_code"]) == 6
        print(f"✅ Classroom created with invite code: {data['classroom']['invite_code']}")
        return data["classroom"]
    
    def test_get_classrooms(self, teacher_client):
        """Teacher can view their classrooms"""
        response = teacher_client.get(f"{BASE_URL}/api/teacher/classrooms")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} classrooms")
    
    def test_get_classroom_details(self, teacher_client):
        """Teacher can view classroom details"""
        # First create a classroom
        create_response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": "TEST_Science Class",
            "grade_level": 4
        })
        classroom = create_response.json()["classroom"]
        
        # Get details
        response = teacher_client.get(f"{BASE_URL}/api/teacher/classrooms/{classroom['classroom_id']}")
        assert response.status_code == 200
        data = response.json()
        assert "classroom" in data
        assert "students" in data
        assert "challenges" in data
        print(f"✅ Classroom details retrieved - {len(data['students'])} students, {len(data['challenges'])} challenges")
    
    def test_delete_classroom(self, teacher_client):
        """Teacher can delete a classroom"""
        # Create classroom
        create_response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": "TEST_To Delete",
            "grade_level": 2
        })
        classroom = create_response.json()["classroom"]
        
        # Delete it
        response = teacher_client.delete(f"{BASE_URL}/api/teacher/classrooms/{classroom['classroom_id']}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = teacher_client.get(f"{BASE_URL}/api/teacher/classrooms/{classroom['classroom_id']}")
        assert get_response.status_code == 404
        print("✅ Classroom deleted successfully")


class TestTeacherRewardsAndChallenges:
    """Test reward and challenge functionality"""
    
    def test_create_challenge(self, teacher_client):
        """Teacher can create a challenge for classroom"""
        # Create classroom first
        create_response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": "TEST_Challenge Class",
            "grade_level": 3
        })
        classroom = create_response.json()["classroom"]
        
        # Create challenge
        challenge_payload = {
            "title": "TEST_Save $10 Challenge",
            "description": "Save $10 in your savings account",
            "reward_amount": 25
        }
        response = teacher_client.post(
            f"{BASE_URL}/api/teacher/classrooms/{classroom['classroom_id']}/challenges",
            json=challenge_payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "challenge_id" in data
        print(f"✅ Challenge created: {challenge_payload['title']}")
    
    def test_delete_challenge(self, teacher_client):
        """Teacher can delete a challenge"""
        # Create classroom and challenge
        create_response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": "TEST_Delete Challenge Class",
            "grade_level": 3
        })
        classroom = create_response.json()["classroom"]
        
        challenge_response = teacher_client.post(
            f"{BASE_URL}/api/teacher/classrooms/{classroom['classroom_id']}/challenges",
            json={"title": "TEST_To Delete", "description": "Test", "reward_amount": 10}
        )
        challenge_id = challenge_response.json()["challenge_id"]
        
        # Delete challenge
        response = teacher_client.delete(f"{BASE_URL}/api/teacher/challenges/{challenge_id}")
        assert response.status_code == 200
        print("✅ Challenge deleted successfully")


# ============== PARENT DASHBOARD TESTS ==============

class TestParentAccessControl:
    """Test that only parents can access parent endpoints"""
    
    def test_parent_dashboard_requires_auth(self, unauthenticated_client):
        """Unauthenticated users cannot access parent dashboard"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/parent/dashboard")
        assert response.status_code == 401
        print("✅ Parent dashboard requires authentication")
    
    def test_parent_dashboard_requires_parent_role(self, child_client):
        """Non-parent users cannot access parent dashboard"""
        response = child_client.get(f"{BASE_URL}/api/parent/dashboard")
        assert response.status_code == 403
        print("✅ Parent dashboard requires parent role")
    
    def test_parent_can_access_dashboard(self, parent_client):
        """Parents can access their dashboard"""
        response = parent_client.get(f"{BASE_URL}/api/parent/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "children" in data
        assert "pending_links" in data
        print(f"✅ Parent dashboard accessible - {len(data['children'])} children linked")


class TestParentChildLinking:
    """Test parent-child account linking"""
    
    def test_link_child_account(self, parent_client):
        """Parent can link a child account"""
        response = parent_client.post(f"{BASE_URL}/api/parent/link-child", json={
            "child_email": CHILD_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Child linked: {data['message']}")
    
    def test_link_nonexistent_child(self, parent_client):
        """Linking non-existent child returns 404"""
        response = parent_client.post(f"{BASE_URL}/api/parent/link-child", json={
            "child_email": "nonexistent@example.com"
        })
        assert response.status_code == 404
        print("✅ Non-existent child returns 404")
    
    def test_get_children(self, parent_client):
        """Parent can get list of linked children"""
        response = parent_client.get(f"{BASE_URL}/api/parent/children")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} linked children")


class TestParentChores:
    """Test chore management"""
    
    def test_create_chore(self, parent_client):
        """Parent can create a chore for child"""
        # First ensure child is linked
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        
        payload = {
            "child_id": CHILD_USER_ID,
            "title": "TEST_Clean Room",
            "description": "Clean and organize your room",
            "reward_amount": 5,
            "frequency": "once"
        }
        response = parent_client.post(f"{BASE_URL}/api/parent/chores", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "chore_id" in data
        print(f"✅ Chore created: {payload['title']}")
        return data["chore_id"]
    
    def test_get_chores(self, parent_client):
        """Parent can view all chores"""
        response = parent_client.get(f"{BASE_URL}/api/parent/chores")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} chores")
    
    def test_delete_chore(self, parent_client):
        """Parent can delete a chore"""
        # Create chore first
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        create_response = parent_client.post(f"{BASE_URL}/api/parent/chores", json={
            "child_id": CHILD_USER_ID,
            "title": "TEST_To Delete Chore",
            "reward_amount": 3,
            "frequency": "once"
        })
        chore_id = create_response.json()["chore_id"]
        
        # Delete it
        response = parent_client.delete(f"{BASE_URL}/api/parent/chores/{chore_id}")
        assert response.status_code == 200
        print("✅ Chore deleted successfully")


class TestParentAllowance:
    """Test allowance management"""
    
    def test_set_allowance(self, parent_client):
        """Parent can set up allowance for child"""
        # Ensure child is linked
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        
        payload = {
            "child_id": CHILD_USER_ID,
            "amount": 10,
            "frequency": "weekly"
        }
        response = parent_client.post(f"{BASE_URL}/api/parent/allowance", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Allowance set: ${payload['amount']} {payload['frequency']}")
    
    def test_get_allowances(self, parent_client):
        """Parent can view allowances"""
        response = parent_client.get(f"{BASE_URL}/api/parent/allowances")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} allowances")


class TestParentSavingsGoals:
    """Test savings goal management"""
    
    def test_create_savings_goal(self, parent_client):
        """Parent can create savings goal for child"""
        # Ensure child is linked
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        
        payload = {
            "child_id": CHILD_USER_ID,
            "title": "TEST_New Bike",
            "target_amount": 100
        }
        response = parent_client.post(f"{BASE_URL}/api/parent/savings-goals", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "goal_id" in data
        print(f"✅ Savings goal created: {payload['title']} - ${payload['target_amount']}")
    
    def test_get_savings_goals(self, parent_client):
        """Parent can view savings goals"""
        response = parent_client.get(f"{BASE_URL}/api/parent/savings-goals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} savings goals")


class TestParentChildProgress:
    """Test viewing child progress"""
    
    def test_view_child_progress(self, parent_client):
        """Parent can view child's progress"""
        # Ensure child is linked
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        
        response = parent_client.get(f"{BASE_URL}/api/parent/children/{CHILD_USER_ID}/progress")
        assert response.status_code == 200
        data = response.json()
        assert "child" in data
        assert "wallet" in data
        assert "topic_progress" in data
        assert "transactions" in data
        print(f"✅ Child progress retrieved - streak: {data.get('streak', 0)}")


class TestParentGiveMoney:
    """Test giving money to child"""
    
    def test_give_money_to_child(self, parent_client):
        """Parent can give money to child"""
        # Ensure child is linked
        parent_client.post(f"{BASE_URL}/api/parent/link-child", json={"child_email": CHILD_EMAIL})
        
        payload = {
            "child_id": CHILD_USER_ID,
            "amount": 20,
            "reason": "TEST_Birthday gift"
        }
        response = parent_client.post(f"{BASE_URL}/api/parent/give-money", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Gave ${payload['amount']} to child")


# ============== CHILD CHORE TESTS ==============

class TestChildChores:
    """Test child chore functionality"""
    
    def test_child_can_view_chores(self, child_client):
        """Child can view their assigned chores"""
        response = child_client.get(f"{BASE_URL}/api/child/chores")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Child can view {len(data)} chores")
    
    def test_child_can_view_savings_goals(self, child_client):
        """Child can view their savings goals"""
        response = child_client.get(f"{BASE_URL}/api/child/savings-goals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Child can view {len(data)} savings goals")


# ============== STUDENT CLASSROOM TESTS ==============

class TestStudentClassroom:
    """Test student classroom functionality"""
    
    def test_student_can_view_classrooms(self, child_client):
        """Student can view their classrooms"""
        response = child_client.get(f"{BASE_URL}/api/student/classrooms")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Student can view {len(data)} classrooms")
    
    def test_student_can_view_challenges(self, child_client):
        """Student can view available challenges"""
        response = child_client.get(f"{BASE_URL}/api/student/challenges")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Student can view {len(data)} challenges")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
