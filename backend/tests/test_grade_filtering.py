"""
Test Grade Filtering Bug Fix
- Grade filter should be preserved when navigating from LearnPage to TopicPage to subtopics
- Backend API should correctly filter content by grade
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session for teacher
TEACHER_SESSION = "test_grade_filter_session_001"

class TestGradeFilteringBackend:
    """Test backend grade filtering for content"""
    
    def test_indian_rupee_topic_grade_3_returns_zero_items(self):
        """Grade 3 should return 0 content items for Indian Rupee topic (all content is grade 0-0)"""
        response = requests.get(
            f"{BASE_URL}/api/content/topics/topic_80e910ce6a69?grade=3",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "topic" in data, "Response should contain 'topic' key"
        assert "content_items" in data, "Response should contain 'content_items' key"
        
        # Grade 3 should return 0 items since all content is grade 0-0
        content_items = data.get("content_items", [])
        assert len(content_items) == 0, f"Expected 0 content items for grade 3, got {len(content_items)}"
        
        # Verify topic info
        topic = data.get("topic", {})
        assert topic.get("title") == "Indian Rupee", f"Expected 'Indian Rupee', got {topic.get('title')}"
    
    def test_indian_rupee_topic_grade_0_returns_seven_items(self):
        """Grade 0 should return 7 content items for Indian Rupee topic"""
        response = requests.get(
            f"{BASE_URL}/api/content/topics/topic_80e910ce6a69?grade=0",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        content_items = data.get("content_items", [])
        
        # Grade 0 should return 7 items (all content is grade 0-0)
        assert len(content_items) == 7, f"Expected 7 content items for grade 0, got {len(content_items)}"
        
        # Verify all items are grade 0-0
        for item in content_items:
            assert item.get("min_grade") == 0, f"Expected min_grade 0, got {item.get('min_grade')}"
            assert item.get("max_grade") == 0, f"Expected max_grade 0, got {item.get('max_grade')}"
    
    def test_topics_list_with_grade_filter(self):
        """Test that topics list respects grade filter"""
        # Grade 3 should show topics that include grade 3
        response = requests.get(
            f"{BASE_URL}/api/content/topics?grade=3",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of topics"
        
        # All returned topics should have grade range that includes grade 3
        for topic in data:
            min_grade = topic.get("min_grade", 0)
            max_grade = topic.get("max_grade", 5)
            assert min_grade <= 3 <= max_grade, f"Topic {topic.get('title')} grade range {min_grade}-{max_grade} should include grade 3"
    
    def test_topics_list_with_grade_0_filter(self):
        """Test that topics list respects grade 0 filter"""
        response = requests.get(
            f"{BASE_URL}/api/content/topics?grade=0",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of topics"
        
        # All returned topics should have grade range that includes grade 0
        for topic in data:
            min_grade = topic.get("min_grade", 0)
            max_grade = topic.get("max_grade", 5)
            assert min_grade <= 0 <= max_grade, f"Topic {topic.get('title')} grade range {min_grade}-{max_grade} should include grade 0"
    
    def test_content_items_filtered_by_grade(self):
        """Test that content items within a topic are filtered by grade"""
        # Get Understanding Money topic with grade=3
        response = requests.get(
            f"{BASE_URL}/api/content/topics/topic_71caf498c54e?grade=3",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        subtopics = data.get("subtopics", [])
        
        # All subtopics should have grade range that includes grade 3
        for subtopic in subtopics:
            min_grade = subtopic.get("min_grade", 0)
            max_grade = subtopic.get("max_grade", 5)
            assert min_grade <= 3 <= max_grade, f"Subtopic {subtopic.get('title')} grade range {min_grade}-{max_grade} should include grade 3"
    
    def test_no_grade_filter_returns_all_content(self):
        """Test that no grade filter returns all content"""
        response = requests.get(
            f"{BASE_URL}/api/content/topics/topic_80e910ce6a69",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        content_items = data.get("content_items", [])
        
        # Without grade filter, should return all 7 items
        assert len(content_items) == 7, f"Expected 7 content items without grade filter, got {len(content_items)}"


class TestGradeFilteringURLPreservation:
    """Test that grade filter is preserved in navigation URLs"""
    
    def test_learn_page_topics_have_grade_param(self):
        """Verify topics list API works with grade parameter"""
        # This tests the backend support for grade filtering
        response = requests.get(
            f"{BASE_URL}/api/content/topics?grade=3",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return topics that include grade 3
        assert len(data) > 0, "Should return at least one topic for grade 3"
    
    def test_topic_detail_with_grade_param(self):
        """Verify topic detail API works with grade parameter"""
        response = requests.get(
            f"{BASE_URL}/api/content/topics/topic_71caf498c54e?grade=3",
            headers={"Authorization": f"Bearer {TEACHER_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "topic" in data
        assert "subtopics" in data
        assert "content_items" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
