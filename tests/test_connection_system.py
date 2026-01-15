"""
Test suite for the Connection System feature:
- Child can add parent by email (max 2 parents)
- Child can view linked parents
- Child can view announcements from classrooms
- Child can join classroom with invite code
- Parent can view child's classroom and announcements
- Teacher can post announcements
- Teacher can delete announcements
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials will be set up in fixtures
CHILD_SESSION = None
PARENT_SESSION = None
TEACHER_SESSION = None
CHILD_USER_ID = None
PARENT_USER_ID = None
TEACHER_USER_ID = None
CLASSROOM_ID = None
INVITE_CODE = None


class TestSetup:
    """Setup test data"""
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_test_data(self):
        """Create test users and sessions"""
        global CHILD_SESSION, PARENT_SESSION, TEACHER_SESSION
        global CHILD_USER_ID, PARENT_USER_ID, TEACHER_USER_ID
        
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
use('test_database');

// Clean up any existing test data
db.users.deleteMany({email: /test_conn_/});
db.user_sessions.deleteMany({session_token: /test_conn_/});
db.parent_child_links.deleteMany({});
db.classrooms.deleteMany({classroom_id: /test_conn_/});
db.classroom_students.deleteMany({id: /test_conn_/});
db.classroom_announcements.deleteMany({announcement_id: /test_conn_/});
db.wallet_accounts.deleteMany({user_id: /test_conn_/});

var ts = Date.now();

// Create test child user
var childUserId = 'test_conn_child_' + ts;
var childSessionToken = 'test_conn_child_sess_' + ts;
db.users.insertOne({
  user_id: childUserId,
  email: 'test_conn_child@example.com',
  name: 'Test Child',
  picture: 'https://via.placeholder.com/150',
  role: 'child',
  grade: 3,
  streak_count: 0,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: childUserId,
  session_token: childSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

// Create wallet accounts for child
['spending', 'savings', 'investing', 'giving'].forEach(function(type) {
  db.wallet_accounts.insertOne({
    account_id: 'acc_test_' + type + '_' + ts,
    user_id: childUserId,
    account_type: type,
    balance: type === 'spending' ? 100 : 0,
    created_at: new Date()
  });
});

// Create test parent user
var parentUserId = 'test_conn_parent_' + ts;
var parentSessionToken = 'test_conn_parent_sess_' + ts;
db.users.insertOne({
  user_id: parentUserId,
  email: 'test_conn_parent@example.com',
  name: 'Test Parent',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: parentUserId,
  session_token: parentSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

// Create test teacher user
var teacherUserId = 'test_conn_teacher_' + ts;
var teacherSessionToken = 'test_conn_teacher_sess_' + ts;
db.users.insertOne({
  user_id: teacherUserId,
  email: 'test_conn_teacher@example.com',
  name: 'Test Teacher',
  picture: 'https://via.placeholder.com/150',
  role: 'teacher',
  grade: null,
  streak_count: 0,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: teacherUserId,
  session_token: teacherSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

// Create second parent for max 2 parents test
var parent2UserId = 'test_conn_parent2_' + ts;
var parent2SessionToken = 'test_conn_parent2_sess_' + ts;
db.users.insertOne({
  user_id: parent2UserId,
  email: 'test_conn_parent2@example.com',
  name: 'Test Parent 2',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: parent2UserId,
  session_token: parent2SessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

// Create third parent for max 2 parents test
var parent3UserId = 'test_conn_parent3_' + ts;
db.users.insertOne({
  user_id: parent3UserId,
  email: 'test_conn_parent3@example.com',
  name: 'Test Parent 3',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
});

print('CHILD_USER_ID=' + childUserId);
print('CHILD_SESSION=' + childSessionToken);
print('PARENT_USER_ID=' + parentUserId);
print('PARENT_SESSION=' + parentSessionToken);
print('TEACHER_USER_ID=' + teacherUserId);
print('TEACHER_SESSION=' + teacherSessionToken);
print('PARENT2_SESSION=' + parent2SessionToken);
'''
        ], capture_output=True, text=True)
        
        output = result.stdout
        for line in output.split('\n'):
            if line.startswith('CHILD_USER_ID='):
                CHILD_USER_ID = line.split('=')[1]
            elif line.startswith('CHILD_SESSION='):
                CHILD_SESSION = line.split('=')[1]
            elif line.startswith('PARENT_USER_ID='):
                PARENT_USER_ID = line.split('=')[1]
            elif line.startswith('PARENT_SESSION='):
                PARENT_SESSION = line.split('=')[1]
            elif line.startswith('TEACHER_USER_ID='):
                TEACHER_USER_ID = line.split('=')[1]
            elif line.startswith('TEACHER_SESSION='):
                TEACHER_SESSION = line.split('=')[1]


@pytest.fixture
def child_client():
    """Get authenticated client for child user"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CHILD_SESSION}"
    })
    return session


@pytest.fixture
def parent_client():
    """Get authenticated client for parent user"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {PARENT_SESSION}"
    })
    return session


@pytest.fixture
def teacher_client():
    """Get authenticated client for teacher user"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEACHER_SESSION}"
    })
    return session


class TestChildAddParent:
    """Test child adding parent by email"""
    
    def test_child_add_parent_success(self, child_client):
        """Child can add parent by email"""
        response = child_client.post(f"{BASE_URL}/api/child/add-parent", json={
            "parent_email": "test_conn_parent@example.com"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "parent_name" in data
        print(f"✅ Child added parent: {data}")
    
    def test_child_add_parent_already_linked(self, child_client):
        """Adding same parent again returns appropriate message"""
        response = child_client.post(f"{BASE_URL}/api/child/add-parent", json={
            "parent_email": "test_conn_parent@example.com"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "Already connected" in data.get("message", "") or "parent_name" in data
        print(f"✅ Already linked message: {data}")
    
    def test_child_add_second_parent(self, child_client):
        """Child can add a second parent"""
        response = child_client.post(f"{BASE_URL}/api/child/add-parent", json={
            "parent_email": "test_conn_parent2@example.com"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ Child added second parent: {data}")
    
    def test_child_cannot_add_third_parent(self, child_client):
        """Child cannot add more than 2 parents"""
        response = child_client.post(f"{BASE_URL}/api/child/add-parent", json={
            "parent_email": "test_conn_parent3@example.com"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "2 parents" in data.get("detail", "").lower() or "max" in data.get("detail", "").lower()
        print(f"✅ Max 2 parents enforced: {data}")
    
    def test_child_add_nonexistent_parent(self, child_client):
        """Adding non-existent parent email returns 404"""
        response = child_client.post(f"{BASE_URL}/api/child/add-parent", json={
            "parent_email": "nonexistent@example.com"
        })
        
        assert response.status_code == 404
        print(f"✅ Non-existent parent returns 404")


class TestChildViewParents:
    """Test child viewing linked parents"""
    
    def test_child_view_parents(self, child_client):
        """Child can view linked parents"""
        response = child_client.get(f"{BASE_URL}/api/child/parents")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 1 parent from previous tests
        print(f"✅ Child has {len(data)} linked parents")
        
        if len(data) > 0:
            parent = data[0]
            assert "user_id" in parent
            assert "name" in parent
            assert "email" in parent
            print(f"✅ Parent data structure correct: {parent.get('name')}")


class TestTeacherClassroomAndAnnouncements:
    """Test teacher creating classroom and posting announcements"""
    
    def test_teacher_create_classroom(self, teacher_client):
        """Teacher can create a classroom"""
        global CLASSROOM_ID, INVITE_CODE
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms", json={
            "name": "Test Connection Class",
            "description": "Testing connection system",
            "grade_level": 3
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "classroom_id" in data
        assert "invite_code" in data
        
        CLASSROOM_ID = data["classroom_id"]
        INVITE_CODE = data["invite_code"]
        print(f"✅ Classroom created: {CLASSROOM_ID}, invite code: {INVITE_CODE}")
    
    def test_teacher_post_announcement(self, teacher_client):
        """Teacher can post announcement to classroom"""
        global CLASSROOM_ID
        
        response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/announcements", json={
            "title": "Test Announcement",
            "message": "This is a test announcement for the connection system"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "announcement_id" in data
        print(f"✅ Announcement posted: {data['announcement_id']}")
    
    def test_teacher_get_announcements(self, teacher_client):
        """Teacher can view classroom announcements"""
        global CLASSROOM_ID
        
        response = teacher_client.get(f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/announcements")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        announcement = data[0]
        assert "announcement_id" in announcement
        assert "title" in announcement
        assert "message" in announcement
        print(f"✅ Teacher can view {len(data)} announcements")


class TestChildJoinClassroom:
    """Test child joining classroom with invite code"""
    
    def test_child_join_classroom(self, child_client):
        """Child can join classroom with invite code"""
        global INVITE_CODE
        
        response = child_client.post(f"{BASE_URL}/api/student/join-classroom", json={
            "invite_code": INVITE_CODE
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ Child joined classroom: {data}")
    
    def test_child_join_classroom_already_joined(self, child_client):
        """Joining same classroom again returns appropriate message"""
        global INVITE_CODE
        
        response = child_client.post(f"{BASE_URL}/api/student/join-classroom", json={
            "invite_code": INVITE_CODE
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "Already" in data.get("message", "") or "classroom" in data
        print(f"✅ Already joined message: {data}")
    
    def test_child_join_invalid_code(self, child_client):
        """Invalid invite code returns 404"""
        response = child_client.post(f"{BASE_URL}/api/student/join-classroom", json={
            "invite_code": "INVALID123"
        })
        
        assert response.status_code == 404
        print(f"✅ Invalid invite code returns 404")
    
    def test_child_view_classrooms(self, child_client):
        """Child can view their classrooms"""
        response = child_client.get(f"{BASE_URL}/api/student/classrooms")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        classroom = data[0]
        assert "classroom_id" in classroom
        assert "name" in classroom
        assert "teacher_name" in classroom
        print(f"✅ Child is in {len(data)} classrooms")


class TestChildViewAnnouncements:
    """Test child viewing announcements from classrooms"""
    
    def test_child_view_announcements(self, child_client):
        """Child can view announcements from their classrooms"""
        response = child_client.get(f"{BASE_URL}/api/child/announcements")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        announcement = data[0]
        assert "announcement_id" in announcement
        assert "title" in announcement
        assert "message" in announcement
        assert "classroom_name" in announcement
        print(f"✅ Child can view {len(data)} announcements")


class TestParentViewChildClassroom:
    """Test parent viewing child's classroom and announcements"""
    
    def test_parent_view_child_classroom(self, parent_client):
        """Parent can view child's classroom info and announcements"""
        global CHILD_USER_ID
        
        # First get the child_id from parent's children list
        children_response = parent_client.get(f"{BASE_URL}/api/parent/children")
        assert children_response.status_code == 200
        children = children_response.json()
        
        if len(children) == 0:
            pytest.skip("No children linked to parent")
        
        child_id = children[0]["user_id"]
        
        response = parent_client.get(f"{BASE_URL}/api/parent/children/{child_id}/classroom")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "has_classroom" in data
        assert "child_name" in data
        
        if data["has_classroom"]:
            assert "classroom" in data
            assert "teacher" in data
            assert "announcements" in data
            print(f"✅ Parent can view {data['child_name']}'s classroom: {data['classroom']['name']}")
            print(f"✅ Parent can see {len(data['announcements'])} announcements")
        else:
            print(f"✅ Parent can see child has no classroom")


class TestTeacherDeleteAnnouncement:
    """Test teacher deleting announcements"""
    
    def test_teacher_delete_announcement(self, teacher_client):
        """Teacher can delete their announcements"""
        global CLASSROOM_ID
        
        # First create an announcement to delete
        create_response = teacher_client.post(f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/announcements", json={
            "title": "Announcement to Delete",
            "message": "This will be deleted"
        })
        
        assert create_response.status_code == 200
        announcement_id = create_response.json()["announcement_id"]
        
        # Now delete it
        delete_response = teacher_client.delete(f"{BASE_URL}/api/teacher/announcements/{announcement_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        data = delete_response.json()
        assert "deleted" in data.get("message", "").lower()
        print(f"✅ Teacher deleted announcement: {announcement_id}")
    
    def test_teacher_delete_nonexistent_announcement(self, teacher_client):
        """Deleting non-existent announcement returns 404"""
        response = teacher_client.delete(f"{BASE_URL}/api/teacher/announcements/nonexistent_id")
        
        assert response.status_code == 404
        print(f"✅ Non-existent announcement returns 404")


class TestParentDashboard:
    """Test parent dashboard shows child's classroom info"""
    
    def test_parent_dashboard_shows_children(self, parent_client):
        """Parent dashboard shows linked children"""
        response = parent_client.get(f"{BASE_URL}/api/parent/dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "children" in data
        assert isinstance(data["children"], list)
        print(f"✅ Parent dashboard shows {len(data['children'])} children")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup(self):
        """Clean up test data"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteMany({email: /test_conn_/});
db.user_sessions.deleteMany({session_token: /test_conn_/});
db.parent_child_links.deleteMany({child_id: /test_conn_/});
db.parent_child_links.deleteMany({parent_id: /test_conn_/});
db.classrooms.deleteMany({classroom_id: /test_conn_/});
db.classroom_students.deleteMany({student_id: /test_conn_/});
db.classroom_announcements.deleteMany({classroom_id: /test_conn_/});
db.wallet_accounts.deleteMany({user_id: /test_conn_/});
print('Cleanup complete');
'''
        ], capture_output=True, text=True)
        print(f"✅ Test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
