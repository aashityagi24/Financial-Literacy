"""
Test single classroom constraint and quest display bug fixes
- FEATURE: Single classroom constraint - Child can only join one classroom
- BUG FIX: Quest display - questions, images, rewards now show properly
- BUG FIX: Quests with questions now have default 5 points per question if not set
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
FRESH_CHILD_SESSION = "fresh_sess_186215f9b9d04d718e0c54520e48525e"
CLASSROOM_CODE_3A = "88O02U"  # Class 3-A (already enrolled)
CLASSROOM_CODE_1C = "X8YAH7"  # Class 1-C (second classroom)


class TestSingleClassroomConstraint:
    """Test that a child can only be in one classroom"""
    
    def test_child_already_enrolled_in_classroom(self):
        """Verify child is already enrolled in Class 3-A"""
        response = requests.get(
            f"{BASE_URL}/api/student/classrooms",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        assert response.status_code == 200
        classrooms = response.json()
        assert len(classrooms) >= 1, "Child should be enrolled in at least one classroom"
        
        # Verify enrolled in Class 3-A
        class_names = [c.get("name", "") for c in classrooms]
        assert any("3" in name for name in class_names), f"Child should be in Class 3-A, got: {class_names}"
        print(f"✅ Child is enrolled in: {class_names}")
    
    def test_join_second_classroom_fails_with_400(self):
        """FEATURE: Trying to join a second classroom should return 400 error"""
        response = requests.post(
            f"{BASE_URL}/api/student/join-classroom",
            headers={
                "Authorization": f"Bearer {FRESH_CHILD_SESSION}",
                "Content-Type": "application/json"
            },
            json={"code": CLASSROOM_CODE_1C}
        )
        
        # Should fail with 400 status code
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        # Verify error message mentions single classroom constraint
        data = response.json()
        assert "detail" in data
        assert "already enrolled" in data["detail"].lower() or "only" in data["detail"].lower()
        assert "one classroom" in data["detail"].lower() or "Class 3" in data["detail"]
        print(f"✅ Single classroom constraint working: {data['detail']}")
    
    def test_join_same_classroom_returns_already_enrolled(self):
        """Joining the same classroom should return 'Already enrolled' message"""
        response = requests.post(
            f"{BASE_URL}/api/student/join-classroom",
            headers={
                "Authorization": f"Bearer {FRESH_CHILD_SESSION}",
                "Content-Type": "application/json"
            },
            json={"code": CLASSROOM_CODE_3A}
        )
        
        # Should succeed with 200 but indicate already enrolled
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "already enrolled" in data.get("message", "").lower()
        print(f"✅ Already enrolled message: {data.get('message')}")
    
    def test_invalid_classroom_code_returns_404(self):
        """Invalid classroom code should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/student/join-classroom",
            headers={
                "Authorization": f"Bearer {FRESH_CHILD_SESSION}",
                "Content-Type": "application/json"
            },
            json={"code": "INVALID123"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid classroom code returns 404")


class TestQuestDisplayBugFix:
    """Test quest display bug fixes - questions, images, rewards showing properly"""
    
    def test_get_child_quests_returns_data(self):
        """GET /api/child/quests-new should return quests"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        quests = response.json()
        assert isinstance(quests, list), "Response should be a list"
        print(f"✅ Got {len(quests)} quests")
    
    def test_quests_have_total_points(self):
        """All quests should have total_points field"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        for quest in quests:
            # Every quest should have total_points or reward_amount
            has_points = quest.get("total_points") is not None or quest.get("reward_amount") is not None
            assert has_points, f"Quest {quest.get('title')} missing total_points/reward_amount"
        
        print(f"✅ All {len(quests)} quests have total_points or reward_amount")
    
    def test_needs_quest_has_correct_total_points(self):
        """BUG FIX: 'Needs' quest should have total_points=5 (1 question x 5 points)"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        # Find the "Needs" quest
        needs_quest = None
        for quest in quests:
            if quest.get("title", "").lower() == "needs":
                needs_quest = quest
                break
        
        if needs_quest:
            # Verify total_points is calculated correctly
            total_points = needs_quest.get("total_points", 0)
            questions = needs_quest.get("questions", [])
            
            assert total_points > 0, f"Needs quest should have total_points > 0, got {total_points}"
            
            # If questions exist, verify points calculation
            if questions:
                expected_points = sum(q.get("points", 5) for q in questions)
                assert total_points == expected_points, f"Expected {expected_points} points, got {total_points}"
                print(f"✅ Needs quest has correct total_points: {total_points} ({len(questions)} questions)")
            else:
                print(f"✅ Needs quest has total_points: {total_points}")
        else:
            pytest.skip("Needs quest not found in available quests")
    
    def test_quests_with_questions_have_default_points(self):
        """BUG FIX: Questions should have default 5 points if not set"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        quests_with_questions = [q for q in quests if q.get("questions") and len(q.get("questions", [])) > 0]
        
        for quest in quests_with_questions:
            questions = quest.get("questions", [])
            total_points = quest.get("total_points", 0)
            
            # Calculate expected points (each question should have points >= 0)
            question_points = sum(q.get("points", 0) for q in questions)
            
            # If questions have 0 points, total_points should be calculated with default 5 per question
            if question_points == 0:
                expected_default = len(questions) * 5
                assert total_points >= expected_default, f"Quest '{quest.get('title')}' should have at least {expected_default} points"
            else:
                assert total_points >= question_points, f"Quest '{quest.get('title')}' total_points should be >= question points"
            
            print(f"✅ Quest '{quest.get('title')}' has {len(questions)} questions, total_points={total_points}")
        
        if not quests_with_questions:
            print("⚠️ No quests with questions found to test default points")
    
    def test_quest_questions_have_required_fields(self):
        """Questions should have required fields: question_text, question_type, points"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        quests_with_questions = [q for q in quests if q.get("questions") and len(q.get("questions", [])) > 0]
        
        for quest in quests_with_questions:
            for question in quest.get("questions", []):
                assert "question_text" in question, f"Question missing question_text in quest '{quest.get('title')}'"
                assert "question_type" in question, f"Question missing question_type in quest '{quest.get('title')}'"
                assert "points" in question, f"Question missing points in quest '{quest.get('title')}'"
                assert question.get("points", 0) >= 0, f"Question points should be >= 0"
        
        print(f"✅ All questions in {len(quests_with_questions)} quests have required fields")
    
    def test_quest_user_status_field(self):
        """Quests should have user_status field (available/completed)"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        for quest in quests:
            assert "user_status" in quest, f"Quest '{quest.get('title')}' missing user_status"
            assert quest["user_status"] in ["available", "completed", "pending"], f"Invalid user_status: {quest['user_status']}"
        
        print(f"✅ All {len(quests)} quests have valid user_status")


class TestQuestCreationDefaultPoints:
    """Test that new quests get default points for questions"""
    
    def test_admin_quest_creation_with_default_points(self):
        """Admin quest creation should set default 5 points per question if not specified"""
        # This test verifies the backend logic by checking existing quests
        # The actual creation is tested via admin endpoints
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {FRESH_CHILD_SESSION}"}
        )
        
        assert response.status_code == 200
        quests = response.json()
        
        admin_quests = [q for q in quests if q.get("creator_type") == "admin"]
        
        for quest in admin_quests:
            questions = quest.get("questions", [])
            if questions:
                for q in questions:
                    points = q.get("points", 0)
                    # Points should be set (either explicitly or default 5)
                    assert points > 0, f"Question in '{quest.get('title')}' should have points > 0"
        
        print(f"✅ Verified {len(admin_quests)} admin quests have proper question points")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
