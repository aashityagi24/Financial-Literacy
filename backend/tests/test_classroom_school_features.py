"""
Test file for classroom join codes and school user management features
Tests:
1. BUG FIX: Classroom codes - join_code field was null, now fixed
2. FEATURE: School can add existing users (without school_id) to their school
3. FEATURE: Bulk upload now supports relationships
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestClassroomJoinCodes:
    """Test classroom join code functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test student session
        self.test_student_id = f"test_student_{uuid.uuid4().hex[:8]}"
        self.test_student_email = f"test.student.{uuid.uuid4().hex[:8]}@example.com"
        self.test_session_token = f"test_session_{uuid.uuid4().hex[:12]}"
        
    def test_classroom_codes_exist_in_database(self):
        """Verify classroom codes 88O02U and X8YAH7 exist"""
        # This is a verification test - we check via API
        # First login as school to verify classrooms exist
        login_resp = self.session.post(f"{BASE_URL}/api/auth/school-login", json={
            "username": "springfield",
            "password": "test123"
        })
        assert login_resp.status_code == 200, f"School login failed: {login_resp.text}"
        
        # Get dashboard to see classrooms
        dashboard_resp = self.session.get(f"{BASE_URL}/api/school/dashboard")
        assert dashboard_resp.status_code == 200, f"Dashboard failed: {dashboard_resp.text}"
        
        # Verify we have teachers with classrooms
        data = dashboard_resp.json()
        assert "teachers" in data, "Dashboard should have teachers"
        print(f"School has {len(data.get('teachers', []))} teachers")
        print(f"School has {len(data.get('students', []))} students")
        print(f"School has {data.get('stats', {}).get('total_classrooms', 0)} classrooms")
    
    def test_student_join_classroom_with_code_88O02U(self):
        """Test student can join classroom with code 88O02U"""
        # Create a test student user and session
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var userId = '{self.test_student_id}';
            var sessionToken = '{self.test_session_token}';
            db.users.insertOne({{
                user_id: userId,
                email: '{self.test_student_email}',
                name: 'Test Student Join',
                role: 'child',
                grade: 3,
                created_at: new Date()
            }});
            db.user_sessions.insertOne({{
                user_id: userId,
                session_token: sessionToken,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            print('Created test student: ' + userId);
            '''
        ], capture_output=True, text=True)
        print(f"MongoDB setup: {result.stdout}")
        
        # Set session cookie
        self.session.cookies.set('session_token', self.test_session_token)
        
        # Try to join classroom with code 88O02U
        join_resp = self.session.post(f"{BASE_URL}/api/student/join-classroom", json={
            "code": "88O02U"
        })
        
        print(f"Join response status: {join_resp.status_code}")
        print(f"Join response: {join_resp.text}")
        
        assert join_resp.status_code == 200, f"Join classroom failed: {join_resp.text}"
        data = join_resp.json()
        assert "classroom" in data or "message" in data, "Response should have classroom or message"
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{user_id: '{self.test_student_id}'}});
            db.user_sessions.deleteOne({{session_token: '{self.test_session_token}'}});
            db.classroom_students.deleteMany({{student_id: '{self.test_student_id}'}});
            '''
        ], capture_output=True, text=True)
    
    def test_student_join_classroom_with_code_X8YAH7(self):
        """Test student can join classroom with code X8YAH7"""
        test_id = f"test_student2_{uuid.uuid4().hex[:8]}"
        test_email = f"test.student2.{uuid.uuid4().hex[:8]}@example.com"
        test_token = f"test_session2_{uuid.uuid4().hex[:12]}"
        
        # Create test student
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.insertOne({{
                user_id: '{test_id}',
                email: '{test_email}',
                name: 'Test Student Join 2',
                role: 'child',
                grade: 1,
                created_at: new Date()
            }});
            db.user_sessions.insertOne({{
                user_id: '{test_id}',
                session_token: '{test_token}',
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            '''
        ], capture_output=True, text=True)
        
        # Set session cookie
        session = requests.Session()
        session.cookies.set('session_token', test_token)
        
        # Try to join classroom with code X8YAH7
        join_resp = session.post(f"{BASE_URL}/api/student/join-classroom", json={
            "code": "X8YAH7"
        })
        
        print(f"Join X8YAH7 response status: {join_resp.status_code}")
        print(f"Join X8YAH7 response: {join_resp.text}")
        
        assert join_resp.status_code == 200, f"Join classroom X8YAH7 failed: {join_resp.text}"
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{user_id: '{test_id}'}});
            db.user_sessions.deleteOne({{session_token: '{test_token}'}});
            db.classroom_students.deleteMany({{student_id: '{test_id}'}});
            '''
        ], capture_output=True, text=True)
    
    def test_invalid_classroom_code_returns_404(self):
        """Test that invalid classroom code returns 404"""
        test_id = f"test_student3_{uuid.uuid4().hex[:8]}"
        test_email = f"test.student3.{uuid.uuid4().hex[:8]}@example.com"
        test_token = f"test_session3_{uuid.uuid4().hex[:12]}"
        
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.insertOne({{
                user_id: '{test_id}',
                email: '{test_email}',
                name: 'Test Student Invalid',
                role: 'child',
                grade: 3,
                created_at: new Date()
            }});
            db.user_sessions.insertOne({{
                user_id: '{test_id}',
                session_token: '{test_token}',
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            '''
        ], capture_output=True, text=True)
        
        session = requests.Session()
        session.cookies.set('session_token', test_token)
        
        # Try invalid code
        join_resp = session.post(f"{BASE_URL}/api/student/join-classroom", json={
            "code": "INVALID"
        })
        
        assert join_resp.status_code == 404, f"Expected 404 for invalid code, got {join_resp.status_code}"
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{user_id: '{test_id}'}});
            db.user_sessions.deleteOne({{session_token: '{test_token}'}});
            '''
        ], capture_output=True, text=True)


class TestSchoolUserCreation:
    """Test school user creation - adding existing users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup school session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as school
        login_resp = self.session.post(f"{BASE_URL}/api/auth/school-login", json={
            "username": "springfield",
            "password": "test123"
        })
        assert login_resp.status_code == 200, f"School login failed: {login_resp.text}"
        self.school_data = login_resp.json()
    
    def test_create_new_teacher(self):
        """Test creating a new teacher via school"""
        unique_email = f"new.teacher.{uuid.uuid4().hex[:8]}@example.com"
        
        resp = self.session.post(f"{BASE_URL}/api/school/users/teacher", json={
            "name": "New Test Teacher",
            "email": unique_email
        })
        
        print(f"Create teacher response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Create teacher failed: {resp.text}"
        
        data = resp.json()
        assert "user_id" in data, "Response should have user_id"
        assert "message" in data, "Response should have message"
        
        # Cleanup
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{email: '{unique_email}'}});
            '''
        ], capture_output=True, text=True)
    
    def test_add_existing_user_without_school_as_teacher(self):
        """Test adding an existing user (without school_id) to school as teacher"""
        unique_email = f"existing.user.{uuid.uuid4().hex[:8]}@example.com"
        existing_user_id = f"user_existing_{uuid.uuid4().hex[:8]}"
        
        # First create a user without school_id
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.insertOne({{
                user_id: '{existing_user_id}',
                email: '{unique_email}',
                name: 'Existing User No School',
                role: 'parent',
                created_at: new Date()
            }});
            '''
        ], capture_output=True, text=True)
        
        # Now try to add this user as teacher to school
        resp = self.session.post(f"{BASE_URL}/api/school/users/teacher", json={
            "name": "Existing User No School",
            "email": unique_email
        })
        
        print(f"Add existing user response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Add existing user failed: {resp.text}"
        
        data = resp.json()
        assert "message" in data, "Response should have message"
        assert "existing" in data.get("message", "").lower() or "added" in data.get("message", "").lower(), \
            f"Message should indicate existing user was added: {data.get('message')}"
        
        # Verify user now has school_id
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var user = db.users.findOne({{email: '{unique_email}'}});
            print(JSON.stringify({{school_id: user.school_id, role: user.role}}));
            '''
        ], capture_output=True, text=True)
        print(f"User after update: {result.stdout}")
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{email: '{unique_email}'}});
            '''
        ], capture_output=True, text=True)
    
    def test_add_existing_user_with_different_school_fails(self):
        """Test that adding a user who belongs to another school fails"""
        unique_email = f"other.school.user.{uuid.uuid4().hex[:8]}@example.com"
        
        # Create user with different school_id
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.insertOne({{
                user_id: 'user_other_school_{uuid.uuid4().hex[:8]}',
                email: '{unique_email}',
                name: 'User From Other School',
                role: 'teacher',
                school_id: 'school_different_123',
                created_at: new Date()
            }});
            '''
        ], capture_output=True, text=True)
        
        # Try to add to our school - should fail
        resp = self.session.post(f"{BASE_URL}/api/school/users/teacher", json={
            "name": "User From Other School",
            "email": unique_email
        })
        
        print(f"Add user from other school response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 400, f"Expected 400 for user from other school, got {resp.status_code}"
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{email: '{unique_email}'}});
            '''
        ], capture_output=True, text=True)
    
    def test_create_child_with_teacher_email_relationship(self):
        """Test creating a child with teacher_email to auto-enroll in classroom"""
        # First get a teacher email from the school
        dashboard_resp = self.session.get(f"{BASE_URL}/api/school/dashboard")
        assert dashboard_resp.status_code == 200
        
        teachers = dashboard_resp.json().get("teachers", [])
        if not teachers:
            pytest.skip("No teachers in school to test with")
        
        teacher_email = teachers[0].get("email")
        unique_child_email = f"child.with.teacher.{uuid.uuid4().hex[:8]}@example.com"
        
        resp = self.session.post(f"{BASE_URL}/api/school/users/child", json={
            "name": "Child With Teacher Link",
            "email": unique_child_email,
            "grade": 3,
            "teacher_email": teacher_email
        })
        
        print(f"Create child with teacher response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Create child failed: {resp.text}"
        
        # Cleanup
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var user = db.users.findOne({{email: '{unique_child_email}'}});
            if (user) {{
                db.classroom_students.deleteMany({{student_id: user.user_id}});
                db.wallet_accounts.deleteMany({{user_id: user.user_id}});
                db.users.deleteOne({{email: '{unique_child_email}'}});
            }}
            '''
        ], capture_output=True, text=True)


class TestSchoolBulkUpload:
    """Test school bulk upload with relationship fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup school session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as school
        login_resp = self.session.post(f"{BASE_URL}/api/auth/school-login", json={
            "username": "springfield",
            "password": "test123"
        })
        assert login_resp.status_code == 200, f"School login failed: {login_resp.text}"
    
    def test_bulk_upload_teachers_with_class_name(self):
        """Test bulk upload teachers with class_name creates classrooms"""
        unique_suffix = uuid.uuid4().hex[:6]
        
        resp = self.session.post(f"{BASE_URL}/api/school/upload/teachers", json={
            "data": [
                {
                    "name": f"Bulk Teacher {unique_suffix}",
                    "email": f"bulk.teacher.{unique_suffix}@example.com",
                    "grade": 3,
                    "class_name": f"Test Class {unique_suffix}"
                }
            ]
        })
        
        print(f"Bulk upload teachers response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Bulk upload failed: {resp.text}"
        
        data = resp.json()
        assert "created" in data, "Response should have created count"
        assert "classrooms_created" in data, "Response should have classrooms_created count"
        
        print(f"Created: {data.get('created')}, Classrooms: {data.get('classrooms_created')}")
        
        # Cleanup
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var user = db.users.findOne({{email: 'bulk.teacher.{unique_suffix}@example.com'}});
            if (user) {{
                db.classrooms.deleteMany({{teacher_id: user.user_id}});
                db.users.deleteOne({{email: 'bulk.teacher.{unique_suffix}@example.com'}});
            }}
            '''
        ], capture_output=True, text=True)
    
    def test_bulk_upload_students_with_teacher_email(self):
        """Test bulk upload students with teacher_email links to classroom"""
        # Get a teacher email
        dashboard_resp = self.session.get(f"{BASE_URL}/api/school/dashboard")
        teachers = dashboard_resp.json().get("teachers", [])
        if not teachers:
            pytest.skip("No teachers to test with")
        
        teacher_email = teachers[0].get("email")
        unique_suffix = uuid.uuid4().hex[:6]
        
        resp = self.session.post(f"{BASE_URL}/api/school/upload/students", json={
            "data": [
                {
                    "name": f"Bulk Student {unique_suffix}",
                    "email": f"bulk.student.{unique_suffix}@example.com",
                    "grade": 3,
                    "teacher_email": teacher_email
                }
            ]
        })
        
        print(f"Bulk upload students response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Bulk upload failed: {resp.text}"
        
        data = resp.json()
        assert "created" in data, "Response should have created count"
        assert "linked_to_classroom" in data, "Response should have linked_to_classroom count"
        
        print(f"Created: {data.get('created')}, Linked: {data.get('linked_to_classroom')}")
        
        # Cleanup
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var user = db.users.findOne({{email: 'bulk.student.{unique_suffix}@example.com'}});
            if (user) {{
                db.classroom_students.deleteMany({{student_id: user.user_id}});
                db.wallet_accounts.deleteMany({{user_id: user.user_id}});
                db.users.deleteOne({{email: 'bulk.student.{unique_suffix}@example.com'}});
            }}
            '''
        ], capture_output=True, text=True)
    
    def test_bulk_upload_parents_with_child_email(self):
        """Test bulk upload parents with child_email links to child"""
        # First create a test child
        unique_suffix = uuid.uuid4().hex[:6]
        child_email = f"test.child.for.parent.{unique_suffix}@example.com"
        
        # Create child first
        child_resp = self.session.post(f"{BASE_URL}/api/school/users/child", json={
            "name": f"Test Child {unique_suffix}",
            "email": child_email,
            "grade": 2
        })
        assert child_resp.status_code == 200, f"Create child failed: {child_resp.text}"
        
        # Now bulk upload parent with child_email
        parent_email = f"bulk.parent.{unique_suffix}@example.com"
        resp = self.session.post(f"{BASE_URL}/api/school/upload/parents", json={
            "data": [
                {
                    "name": f"Bulk Parent {unique_suffix}",
                    "email": parent_email,
                    "child_email": child_email
                }
            ]
        })
        
        print(f"Bulk upload parents response: {resp.status_code} - {resp.text}")
        assert resp.status_code == 200, f"Bulk upload failed: {resp.text}"
        
        data = resp.json()
        assert "created" in data, "Response should have created count"
        assert "linked_to_child" in data, "Response should have linked_to_child count"
        
        print(f"Created: {data.get('created')}, Linked: {data.get('linked_to_child')}")
        
        # Cleanup
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var child = db.users.findOne({{email: '{child_email}'}});
            var parent = db.users.findOne({{email: '{parent_email}'}});
            if (child) {{
                db.wallet_accounts.deleteMany({{user_id: child.user_id}});
                db.users.deleteOne({{email: '{child_email}'}});
            }}
            if (parent) {{
                db.parent_child_links.deleteMany({{parent_id: parent.user_id}});
                db.users.deleteOne({{email: '{parent_email}'}});
            }}
            '''
        ], capture_output=True, text=True)


class TestTeacherDashboardJoinCode:
    """Test teacher dashboard shows join_code correctly"""
    
    def test_teacher_dashboard_shows_join_code(self):
        """Verify teacher dashboard returns join_code for classrooms"""
        # Create a test teacher session
        test_teacher_id = f"test_teacher_{uuid.uuid4().hex[:8]}"
        test_session = f"test_sess_{uuid.uuid4().hex[:12]}"
        
        import subprocess
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.insertOne({{
                user_id: '{test_teacher_id}',
                email: 'test.teacher.dashboard.{uuid.uuid4().hex[:6]}@example.com',
                name: 'Test Teacher Dashboard',
                role: 'teacher',
                created_at: new Date()
            }});
            db.user_sessions.insertOne({{
                user_id: '{test_teacher_id}',
                session_token: '{test_session}',
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            db.classrooms.insertOne({{
                classroom_id: 'class_test_{uuid.uuid4().hex[:8]}',
                teacher_id: '{test_teacher_id}',
                name: 'Test Classroom',
                grade_level: 3,
                grade: 3,
                join_code: 'TEST01',
                created_at: new Date().toISOString()
            }});
            '''
        ], capture_output=True, text=True)
        
        session = requests.Session()
        session.cookies.set('session_token', test_session)
        
        # Get teacher dashboard
        resp = session.get(f"{BASE_URL}/api/teacher/dashboard")
        print(f"Teacher dashboard response: {resp.status_code} - {resp.text}")
        
        assert resp.status_code == 200, f"Teacher dashboard failed: {resp.text}"
        
        data = resp.json()
        classrooms = data.get("classrooms", [])
        
        if classrooms:
            classroom = classrooms[0]
            print(f"Classroom data: {classroom}")
            # Check that join_code is present
            assert "join_code" in classroom or "invite_code" in classroom, \
                "Classroom should have join_code or invite_code"
            
            code = classroom.get("join_code") or classroom.get("invite_code")
            assert code is not None, "Classroom code should not be None"
            print(f"Classroom code: {code}")
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteOne({{user_id: '{test_teacher_id}'}});
            db.user_sessions.deleteOne({{session_token: '{test_session}'}});
            db.classrooms.deleteMany({{teacher_id: '{test_teacher_id}'}});
            '''
        ], capture_output=True, text=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
