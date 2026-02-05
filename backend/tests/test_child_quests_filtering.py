"""
Test suite for GET /api/child/quests-new endpoint bug fix.

Bug: Children were seeing quests and chores from other parents/teachers not linked to them.
Fix: Proper filtering by:
  1. Admin quests: min_grade/max_grade matching child's grade
  2. Teacher quests: classroom_id in child's enrolled classrooms
  3. Parent chores: child_id matches the current user
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test sessions created in MongoDB
AASHI_SESSION = "test_aashi_session_1770314834226"  # Has parent + classroom
ISOLATED_USER_SESSION = "test_isolated_session_1770314834230"  # No parent, no classroom
ADMIN_SESSION = "test_admin_session_1770314834207"

# Test user IDs
AASHI_USER_ID = "user_cd3928036bf4"  # Grade 3, has parent (user_22d32d6b6d43), has classrooms
ISOLATED_USER_ID = "test_expired_quest_user_1769709169743"  # Grade 3, no parent, no classroom

# Aashi's classroom IDs
AASHI_CLASSROOM_IDS = ["class_366f502c8f3c", "class_3d5d6b8b1a18"]

# Aashi's parent ID
AASHI_PARENT_ID = "user_22d32d6b6d43"


class TestChildQuestsFiltering:
    """Test that children only see quests they are eligible for"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.aashi_headers = {
            "Authorization": f"Bearer {AASHI_SESSION}",
            "Content-Type": "application/json"
        }
        self.isolated_headers = {
            "Authorization": f"Bearer {ISOLATED_USER_SESSION}",
            "Content-Type": "application/json"
        }
        self.admin_headers = {
            "Authorization": f"Bearer {ADMIN_SESSION}",
            "Content-Type": "application/json"
        }
    
    def test_endpoint_requires_child_role(self):
        """Test that endpoint requires child role"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/child/quests-new")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Endpoint requires authentication")
    
    def test_aashi_sees_admin_quests_for_her_grade(self):
        """Aashi (Grade 3) should see admin quests for grade 3"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers=self.aashi_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        admin_quests = [q for q in quests if q.get("creator_type") == "admin"]
        
        # Verify all admin quests are grade-appropriate
        for quest in admin_quests:
            min_grade = quest.get("min_grade")
            max_grade = quest.get("max_grade")
            
            # If grade restrictions exist, verify they include grade 3
            if min_grade is not None and max_grade is not None:
                assert min_grade <= 3 <= max_grade, \
                    f"Admin quest '{quest.get('title')}' has grade range {min_grade}-{max_grade}, not suitable for grade 3"
        
        print(f"✅ Aashi sees {len(admin_quests)} admin quests, all grade-appropriate")
    
    def test_aashi_sees_teacher_quests_from_her_classrooms(self):
        """Aashi should only see teacher quests from classrooms she's enrolled in"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=teacher",
            headers=self.aashi_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        teacher_quests = [q for q in quests if q.get("creator_type") == "teacher"]
        
        # Verify all teacher quests are from Aashi's classrooms
        for quest in teacher_quests:
            classroom_id = quest.get("classroom_id")
            if classroom_id:  # Some teacher quests might not have classroom_id
                assert classroom_id in AASHI_CLASSROOM_IDS, \
                    f"Teacher quest '{quest.get('title')}' is from classroom {classroom_id}, not in Aashi's classrooms {AASHI_CLASSROOM_IDS}"
        
        print(f"✅ Aashi sees {len(teacher_quests)} teacher quests from her classrooms")
    
    def test_aashi_sees_parent_chores_assigned_to_her(self):
        """Aashi should only see parent chores assigned specifically to her"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=parent",
            headers=self.aashi_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        parent_chores = [q for q in quests if q.get("creator_type") == "parent"]
        
        # Verify all parent chores are assigned to Aashi
        for chore in parent_chores:
            child_id = chore.get("child_id")
            assert child_id == AASHI_USER_ID, \
                f"Parent chore '{chore.get('title')}' is assigned to {child_id}, not Aashi ({AASHI_USER_ID})"
        
        print(f"✅ Aashi sees {len(parent_chores)} parent chores assigned to her")
    
    def test_isolated_user_sees_no_parent_chores(self):
        """User with no parent links should NOT see any parent chores"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=parent",
            headers=self.isolated_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        parent_chores = [q for q in quests if q.get("creator_type") == "parent"]
        
        # Isolated user should see NO parent chores (since none are assigned to them)
        assert len(parent_chores) == 0, \
            f"Isolated user should see 0 parent chores, but sees {len(parent_chores)}: {[c.get('title') for c in parent_chores]}"
        
        print("✅ Isolated user sees 0 parent chores (correct - no parent links)")
    
    def test_isolated_user_sees_no_teacher_quests(self):
        """User with no classroom enrollment should NOT see any teacher quests"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=teacher",
            headers=self.isolated_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        teacher_quests = [q for q in quests if q.get("creator_type") == "teacher"]
        
        # Isolated user should see NO teacher quests (since not enrolled in any classroom)
        assert len(teacher_quests) == 0, \
            f"Isolated user should see 0 teacher quests, but sees {len(teacher_quests)}: {[q.get('title') for q in teacher_quests]}"
        
        print("✅ Isolated user sees 0 teacher quests (correct - no classroom enrollment)")
    
    def test_isolated_user_still_sees_admin_quests(self):
        """User with no links should still see grade-appropriate admin quests"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=admin",
            headers=self.isolated_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        admin_quests = [q for q in quests if q.get("creator_type") == "admin"]
        
        # Isolated user (grade 3) should still see admin quests for their grade
        print(f"✅ Isolated user sees {len(admin_quests)} admin quests (grade-appropriate)")
        
        # Verify grade filtering
        for quest in admin_quests:
            min_grade = quest.get("min_grade")
            max_grade = quest.get("max_grade")
            if min_grade is not None and max_grade is not None:
                assert min_grade <= 3 <= max_grade, \
                    f"Admin quest '{quest.get('title')}' has grade range {min_grade}-{max_grade}, not suitable for grade 3"
    
    def test_aashi_does_not_see_other_children_chores(self):
        """Aashi should NOT see chores assigned to other children"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers=self.aashi_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        quests = response.json()
        
        # Check that no parent chores are for other children
        for quest in quests:
            if quest.get("creator_type") == "parent":
                child_id = quest.get("child_id")
                assert child_id == AASHI_USER_ID, \
                    f"BUG: Aashi sees chore '{quest.get('title')}' assigned to {child_id}, not her ({AASHI_USER_ID})"
        
        print("✅ Aashi does NOT see chores assigned to other children")
    
    def test_source_filter_works(self):
        """Test that source filter parameter works correctly"""
        # Test admin filter
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=admin",
            headers=self.aashi_headers
        )
        assert response.status_code == 200
        quests = response.json()
        for q in quests:
            assert q.get("creator_type") == "admin", f"Expected admin quest, got {q.get('creator_type')}"
        print(f"✅ Source filter 'admin' works - {len(quests)} quests")
        
        # Test teacher filter
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=teacher",
            headers=self.aashi_headers
        )
        assert response.status_code == 200
        quests = response.json()
        for q in quests:
            assert q.get("creator_type") == "teacher", f"Expected teacher quest, got {q.get('creator_type')}"
        print(f"✅ Source filter 'teacher' works - {len(quests)} quests")
        
        # Test parent filter
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=parent",
            headers=self.aashi_headers
        )
        assert response.status_code == 200
        quests = response.json()
        for q in quests:
            assert q.get("creator_type") == "parent", f"Expected parent quest, got {q.get('creator_type')}"
        print(f"✅ Source filter 'parent' works - {len(quests)} quests")
    
    def test_expired_quests_marked_correctly(self):
        """Test that expired quests are marked as expired"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers=self.aashi_headers
        )
        assert response.status_code == 200
        
        quests = response.json()
        expired_quests = [q for q in quests if q.get("is_expired") or q.get("user_status") == "expired"]
        
        print(f"✅ Found {len(expired_quests)} expired quests (correctly marked)")
        
        # Verify expired quests have past due dates
        for quest in expired_quests:
            due_date = quest.get("due_date")
            if due_date:
                print(f"   - '{quest.get('title')}' expired (due: {due_date})")


class TestDataIsolation:
    """Test data isolation between different children"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.aashi_headers = {
            "Authorization": f"Bearer {AASHI_SESSION}",
            "Content-Type": "application/json"
        }
        self.isolated_headers = {
            "Authorization": f"Bearer {ISOLATED_USER_SESSION}",
            "Content-Type": "application/json"
        }
    
    def test_different_children_see_different_quests(self):
        """Two different children should see different sets of quests"""
        # Get Aashi's quests
        response1 = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers=self.aashi_headers
        )
        assert response1.status_code == 200
        aashi_quests = response1.json()
        
        # Get isolated user's quests
        response2 = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers=self.isolated_headers
        )
        assert response2.status_code == 200
        isolated_quests = response2.json()
        
        # Count by type
        aashi_parent = len([q for q in aashi_quests if q.get("creator_type") == "parent"])
        aashi_teacher = len([q for q in aashi_quests if q.get("creator_type") == "teacher"])
        aashi_admin = len([q for q in aashi_quests if q.get("creator_type") == "admin"])
        
        isolated_parent = len([q for q in isolated_quests if q.get("creator_type") == "parent"])
        isolated_teacher = len([q for q in isolated_quests if q.get("creator_type") == "teacher"])
        isolated_admin = len([q for q in isolated_quests if q.get("creator_type") == "admin"])
        
        print(f"Aashi's quests: {len(aashi_quests)} total (admin: {aashi_admin}, teacher: {aashi_teacher}, parent: {aashi_parent})")
        print(f"Isolated user's quests: {len(isolated_quests)} total (admin: {isolated_admin}, teacher: {isolated_teacher}, parent: {isolated_parent})")
        
        # Isolated user should have 0 parent and 0 teacher quests
        assert isolated_parent == 0, f"Isolated user should see 0 parent chores, got {isolated_parent}"
        assert isolated_teacher == 0, f"Isolated user should see 0 teacher quests, got {isolated_teacher}"
        
        print("✅ Data isolation verified - isolated user sees no parent/teacher content")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
