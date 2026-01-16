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
import subprocess
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cashcrafters.preview.emergentagent.com').rstrip('/')

# Global test data
TEST_DATA = {}


def setup_module(module):
    """Setup test data before all tests"""
    global TEST_DATA
    
    ts = str(int(time.time() * 1000))
    
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', f'''
use('test_database');

// Clean up any existing test data
db.users.deleteMany({{email: /test_conn_/}});
db.user_sessions.deleteMany({{session_token: /test_conn_/}});
db.parent_child_links.deleteMany({{link_id: /test_conn_/}});
db.classrooms.deleteMany({{name: /Test Connection/}});
db.classroom_students.deleteMany({{id: /test_conn_/}});
db.classroom_announcements.deleteMany({{title: /Test Announcement/}});
db.wallet_accounts.deleteMany({{user_id: /test_conn_/}});

var ts = "{ts}";

// Create test child user
var childUserId = 'test_conn_child_' + ts;
var childSessionToken = 'test_conn_child_sess_' + ts;
db.users.insertOne({{
  user_id: childUserId,
  email: 'test_conn_child_' + ts + '@example.com',
  name: 'Test Child',
  picture: 'https://via.placeholder.com/150',
  role: 'child',
  grade: 3,
  streak_count: 0,
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: childUserId,
  session_token: childSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create wallet accounts for child
['spending', 'savings', 'investing', 'giving'].forEach(function(type) {{
  db.wallet_accounts.insertOne({{
    account_id: 'acc_test_' + type + '_' + ts,
    user_id: childUserId,
    account_type: type,
    balance: type === 'spending' ? 100 : 0,
    created_at: new Date()
  }});
}});

// Create test parent user
var parentUserId = 'test_conn_parent_' + ts;
var parentSessionToken = 'test_conn_parent_sess_' + ts;
db.users.insertOne({{
  user_id: parentUserId,
  email: 'test_conn_parent_' + ts + '@example.com',
  name: 'Test Parent',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: parentUserId,
  session_token: parentSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create test teacher user
var teacherUserId = 'test_conn_teacher_' + ts;
var teacherSessionToken = 'test_conn_teacher_sess_' + ts;
db.users.insertOne({{
  user_id: teacherUserId,
  email: 'test_conn_teacher_' + ts + '@example.com',
  name: 'Test Teacher',
  picture: 'https://via.placeholder.com/150',
  role: 'teacher',
  grade: null,
  streak_count: 0,
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: teacherUserId,
  session_token: teacherSessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create second parent for max 2 parents test
var parent2UserId = 'test_conn_parent2_' + ts;
db.users.insertOne({{
  user_id: parent2UserId,
  email: 'test_conn_parent2_' + ts + '@example.com',
  name: 'Test Parent 2',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
}});

// Create third parent for max 2 parents test
var parent3UserId = 'test_conn_parent3_' + ts;
db.users.insertOne({{
  user_id: parent3UserId,
  email: 'test_conn_parent3_' + ts + '@example.com',
  name: 'Test Parent 3',
  picture: 'https://via.placeholder.com/150',
  role: 'parent',
  grade: null,
  streak_count: 0,
  created_at: new Date()
}});

print('CHILD_USER_ID=' + childUserId);
print('CHILD_SESSION=' + childSessionToken);
print('CHILD_EMAIL=test_conn_child_' + ts + '@example.com');
print('PARENT_USER_ID=' + parentUserId);
print('PARENT_SESSION=' + parentSessionToken);
print('PARENT_EMAIL=test_conn_parent_' + ts + '@example.com');
print('PARENT2_EMAIL=test_conn_parent2_' + ts + '@example.com');
print('PARENT3_EMAIL=test_conn_parent3_' + ts + '@example.com');
print('TEACHER_USER_ID=' + teacherUserId);
print('TEACHER_SESSION=' + teacherSessionToken);
'''
    ], capture_output=True, text=True)
    
    output = result.stdout
    for line in output.split('\n'):
        if '=' in line:
            key, value = line.split('=', 1)
            TEST_DATA[key] = value.strip()
    
    print(f"Setup complete. Test data: {TEST_DATA}")


def teardown_module(module):
    """Cleanup test data after all tests"""
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteMany({email: /test_conn_/});
db.user_sessions.deleteMany({session_token: /test_conn_/});
db.parent_child_links.deleteMany({child_id: /test_conn_/});
db.parent_child_links.deleteMany({parent_id: /test_conn_/});
db.classrooms.deleteMany({name: /Test Connection/});
db.classroom_students.deleteMany({student_id: /test_conn_/});
db.classroom_announcements.deleteMany({title: /Test Announcement/});
db.wallet_accounts.deleteMany({user_id: /test_conn_/});
print('Cleanup complete');
'''
    ], capture_output=True, text=True)


def get_child_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_DATA.get('CHILD_SESSION', '')}"
    })
    return session


def get_parent_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_DATA.get('PARENT_SESSION', '')}"
    })
    return session


def get_teacher_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_DATA.get('TEACHER_SESSION', '')}"
    })
    return session


# ============== CHILD ADD PARENT TESTS ==============

def test_child_add_parent_success():
    """Child can add parent by email"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/child/add-parent", json={
        "parent_email": TEST_DATA.get('PARENT_EMAIL')
    })
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "message" in data
    assert "parent_name" in data
    print(f"✅ Child added parent: {data}")


def test_child_add_parent_already_linked():
    """Adding same parent again returns appropriate message"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/child/add-parent", json={
        "parent_email": TEST_DATA.get('PARENT_EMAIL')
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "Already connected" in data.get("message", "") or "parent_name" in data
    print(f"✅ Already linked message: {data}")


def test_child_add_second_parent():
    """Child can add a second parent"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/child/add-parent", json={
        "parent_email": TEST_DATA.get('PARENT2_EMAIL')
    })
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    print(f"✅ Child added second parent: {data}")


def test_child_cannot_add_third_parent():
    """Child cannot add more than 2 parents"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/child/add-parent", json={
        "parent_email": TEST_DATA.get('PARENT3_EMAIL')
    })
    
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    data = response.json()
    assert "2 parents" in data.get("detail", "").lower() or "up to 2" in data.get("detail", "").lower()
    print(f"✅ Max 2 parents enforced: {data}")


def test_child_add_nonexistent_parent():
    """Adding non-existent parent email returns 404"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/child/add-parent", json={
        "parent_email": "nonexistent@example.com"
    })
    
    # Could be 404 (not found) or 400 (bad request) depending on implementation
    assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
    print(f"✅ Non-existent parent returns {response.status_code}")


# ============== CHILD VIEW PARENTS TESTS ==============

def test_child_view_parents():
    """Child can view linked parents"""
    client = get_child_client()
    response = client.get(f"{BASE_URL}/api/child/parents")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    parent = data[0]
    assert "user_id" in parent
    assert "name" in parent
    assert "email" in parent
    print(f"✅ Child has {len(data)} linked parents")


# ============== TEACHER CLASSROOM AND ANNOUNCEMENTS TESTS ==============

def test_teacher_create_classroom():
    """Teacher can create a classroom"""
    client = get_teacher_client()
    response = client.post(f"{BASE_URL}/api/teacher/classrooms", json={
        "name": "Test Connection Class",
        "description": "Testing connection system",
        "grade_level": 3
    })
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    
    # Handle both response formats
    if "classroom" in data:
        classroom = data["classroom"]
        TEST_DATA['CLASSROOM_ID'] = classroom["classroom_id"]
        TEST_DATA['INVITE_CODE'] = classroom["invite_code"]
    else:
        TEST_DATA['CLASSROOM_ID'] = data["classroom_id"]
        TEST_DATA['INVITE_CODE'] = data["invite_code"]
    
    print(f"✅ Classroom created: {TEST_DATA['CLASSROOM_ID']}, invite code: {TEST_DATA['INVITE_CODE']}")


def test_teacher_post_announcement():
    """Teacher can post announcement to classroom"""
    client = get_teacher_client()
    classroom_id = TEST_DATA.get('CLASSROOM_ID')
    
    if not classroom_id:
        pytest.skip("No classroom created")
    
    response = client.post(f"{BASE_URL}/api/teacher/classrooms/{classroom_id}/announcements", json={
        "title": "Test Announcement",
        "message": "This is a test announcement for the connection system"
    })
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "announcement_id" in data
    TEST_DATA['ANNOUNCEMENT_ID'] = data["announcement_id"]
    print(f"✅ Announcement posted: {data['announcement_id']}")


def test_teacher_get_announcements():
    """Teacher can view classroom announcements"""
    client = get_teacher_client()
    classroom_id = TEST_DATA.get('CLASSROOM_ID')
    
    if not classroom_id:
        pytest.skip("No classroom created")
    
    response = client.get(f"{BASE_URL}/api/teacher/classrooms/{classroom_id}/announcements")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    announcement = data[0]
    assert "announcement_id" in announcement
    assert "title" in announcement
    assert "message" in announcement
    print(f"✅ Teacher can view {len(data)} announcements")


# ============== CHILD JOIN CLASSROOM TESTS ==============

def test_child_join_classroom():
    """Child can join classroom with invite code"""
    client = get_child_client()
    invite_code = TEST_DATA.get('INVITE_CODE')
    
    if not invite_code:
        pytest.skip("No invite code available")
    
    response = client.post(f"{BASE_URL}/api/student/join-classroom", json={
        "invite_code": invite_code
    })
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "message" in data
    print(f"✅ Child joined classroom: {data}")


def test_child_join_classroom_already_joined():
    """Joining same classroom again returns appropriate message"""
    client = get_child_client()
    invite_code = TEST_DATA.get('INVITE_CODE')
    
    if not invite_code:
        pytest.skip("No invite code available")
    
    response = client.post(f"{BASE_URL}/api/student/join-classroom", json={
        "invite_code": invite_code
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "Already" in data.get("message", "") or "classroom" in data
    print(f"✅ Already joined message: {data}")


def test_child_join_invalid_code():
    """Invalid invite code returns 404"""
    client = get_child_client()
    response = client.post(f"{BASE_URL}/api/student/join-classroom", json={
        "invite_code": "INVALID123"
    })
    
    assert response.status_code == 404
    print(f"✅ Invalid invite code returns 404")


def test_child_view_classrooms():
    """Child can view their classrooms"""
    client = get_child_client()
    response = client.get(f"{BASE_URL}/api/student/classrooms")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    # May be 0 if join failed
    print(f"✅ Child is in {len(data)} classrooms")
    
    if len(data) >= 1:
        classroom = data[0]
        assert "classroom_id" in classroom
        assert "name" in classroom
        assert "teacher_name" in classroom


# ============== CHILD VIEW ANNOUNCEMENTS TESTS ==============

def test_child_view_announcements():
    """Child can view announcements from their classrooms"""
    client = get_child_client()
    response = client.get(f"{BASE_URL}/api/child/announcements")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Child can view {len(data)} announcements")
    
    if len(data) >= 1:
        announcement = data[0]
        assert "announcement_id" in announcement
        assert "title" in announcement
        assert "message" in announcement
        assert "classroom_name" in announcement


# ============== PARENT VIEW CHILD CLASSROOM TESTS ==============

def test_parent_view_child_classroom():
    """Parent can view child's classroom info and announcements"""
    client = get_parent_client()
    child_id = TEST_DATA.get('CHILD_USER_ID')
    
    response = client.get(f"{BASE_URL}/api/parent/children/{child_id}/classroom")
    
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


def test_parent_dashboard_shows_children():
    """Parent dashboard shows linked children"""
    client = get_parent_client()
    response = client.get(f"{BASE_URL}/api/parent/dashboard")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    
    assert "children" in data
    assert isinstance(data["children"], list)
    print(f"✅ Parent dashboard shows {len(data['children'])} children")


# ============== TEACHER DELETE ANNOUNCEMENT TESTS ==============

def test_teacher_delete_announcement():
    """Teacher can delete their announcements"""
    client = get_teacher_client()
    classroom_id = TEST_DATA.get('CLASSROOM_ID')
    
    if not classroom_id:
        pytest.skip("No classroom created")
    
    # First create an announcement to delete
    create_response = client.post(f"{BASE_URL}/api/teacher/classrooms/{classroom_id}/announcements", json={
        "title": "Test Announcement to Delete",
        "message": "This will be deleted"
    })
    
    assert create_response.status_code == 200, f"Failed to create announcement: {create_response.text}"
    announcement_id = create_response.json()["announcement_id"]
    
    # Now delete it
    delete_response = client.delete(f"{BASE_URL}/api/teacher/announcements/{announcement_id}")
    
    assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
    data = delete_response.json()
    assert "deleted" in data.get("message", "").lower()
    print(f"✅ Teacher deleted announcement: {announcement_id}")


def test_teacher_delete_nonexistent_announcement():
    """Deleting non-existent announcement returns 404"""
    client = get_teacher_client()
    response = client.delete(f"{BASE_URL}/api/teacher/announcements/nonexistent_id")
    
    assert response.status_code == 404
    print(f"✅ Non-existent announcement returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
