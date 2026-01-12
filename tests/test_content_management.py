"""
Test suite for Hierarchical Content Management System
Tests: Topics, Subtopics, Content Items (lessons, worksheets, activities), File Uploads, Reordering
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"

class TestAdminContentManagement:
    """Test admin content management features"""
    
    session_token = None
    created_topic_id = None
    created_subtopic_id = None
    created_content_ids = []
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin before each test class"""
        if not TestAdminContentManagement.session_token:
            response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            assert response.status_code == 200, f"Admin login failed: {response.text}"
            data = response.json()
            TestAdminContentManagement.session_token = data.get("session_token")
            assert TestAdminContentManagement.session_token, "No session token returned"
        yield
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestAdminContentManagement.session_token}",
            "Content-Type": "application/json"
        }
    
    # ============== TOPIC CRUD TESTS ==============
    
    def test_01_create_topic(self):
        """Test creating a new parent topic"""
        response = requests.post(f"{BASE_URL}/api/admin/content/topics", 
            headers=self.get_headers(),
            json={
                "title": "TEST_Financial Basics",
                "description": "Learn the basics of money management",
                "order": 0,
                "min_grade": 0,
                "max_grade": 5
            }
        )
        assert response.status_code == 200, f"Create topic failed: {response.text}"
        data = response.json()
        assert "topic" in data
        assert data["topic"]["title"] == "TEST_Financial Basics"
        TestAdminContentManagement.created_topic_id = data["topic"]["topic_id"]
        print(f"✅ Created topic: {TestAdminContentManagement.created_topic_id}")
    
    def test_02_create_subtopic(self):
        """Test creating a subtopic under parent topic"""
        assert TestAdminContentManagement.created_topic_id, "Parent topic not created"
        
        response = requests.post(f"{BASE_URL}/api/admin/content/topics", 
            headers=self.get_headers(),
            json={
                "title": "TEST_What is Money?",
                "description": "Understanding the concept of money",
                "parent_id": TestAdminContentManagement.created_topic_id,
                "order": 0,
                "min_grade": 0,
                "max_grade": 5
            }
        )
        assert response.status_code == 200, f"Create subtopic failed: {response.text}"
        data = response.json()
        assert data["topic"]["parent_id"] == TestAdminContentManagement.created_topic_id
        TestAdminContentManagement.created_subtopic_id = data["topic"]["topic_id"]
        print(f"✅ Created subtopic: {TestAdminContentManagement.created_subtopic_id}")
    
    def test_03_get_all_topics(self):
        """Test getting all topics with hierarchy"""
        response = requests.get(f"{BASE_URL}/api/admin/content/topics", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get topics failed: {response.text}"
        topics = response.json()
        assert isinstance(topics, list)
        
        # Find our created topic
        our_topic = next((t for t in topics if t["topic_id"] == TestAdminContentManagement.created_topic_id), None)
        assert our_topic, "Created topic not found in list"
        assert "subtopics" in our_topic
        print(f"✅ Retrieved {len(topics)} topics")
    
    def test_04_edit_topic(self):
        """Test editing topic title and description"""
        assert TestAdminContentManagement.created_topic_id, "Topic not created"
        
        response = requests.put(
            f"{BASE_URL}/api/admin/content/topics/{TestAdminContentManagement.created_topic_id}", 
            headers=self.get_headers(),
            json={
                "title": "TEST_Financial Basics Updated",
                "description": "Updated description for money management"
            }
        )
        assert response.status_code == 200, f"Update topic failed: {response.text}"
        data = response.json()
        assert data["topic"]["title"] == "TEST_Financial Basics Updated"
        print("✅ Topic updated successfully")
    
    # ============== CONTENT ITEM CRUD TESTS ==============
    
    def test_05_create_lesson_content(self):
        """Test creating a lesson content item"""
        assert TestAdminContentManagement.created_subtopic_id, "Subtopic not created"
        
        response = requests.post(f"{BASE_URL}/api/admin/content/items", 
            headers=self.get_headers(),
            json={
                "topic_id": TestAdminContentManagement.created_subtopic_id,
                "title": "TEST_Introduction to Money",
                "description": "Learn what money is and why we use it",
                "content_type": "lesson",
                "order": 0,
                "min_grade": 0,
                "max_grade": 5,
                "reward_coins": 5,
                "content_data": {
                    "lesson_type": "story",
                    "content": "# What is Money?\n\nMoney is something we use to buy things...",
                    "duration_minutes": 5
                }
            }
        )
        assert response.status_code == 200, f"Create lesson failed: {response.text}"
        data = response.json()
        assert data["content"]["content_type"] == "lesson"
        TestAdminContentManagement.created_content_ids.append(data["content"]["content_id"])
        print(f"✅ Created lesson: {data['content']['content_id']}")
    
    def test_06_create_worksheet_content(self):
        """Test creating a worksheet content item"""
        assert TestAdminContentManagement.created_subtopic_id, "Subtopic not created"
        
        response = requests.post(f"{BASE_URL}/api/admin/content/items", 
            headers=self.get_headers(),
            json={
                "topic_id": TestAdminContentManagement.created_subtopic_id,
                "title": "TEST_Money Counting Worksheet",
                "description": "Practice counting coins and bills",
                "content_type": "worksheet",
                "order": 1,
                "min_grade": 0,
                "max_grade": 3,
                "reward_coins": 10,
                "content_data": {
                    "instructions": "Count the coins in each row and write the total",
                    "pdf_url": ""  # Would be set after upload
                }
            }
        )
        assert response.status_code == 200, f"Create worksheet failed: {response.text}"
        data = response.json()
        assert data["content"]["content_type"] == "worksheet"
        TestAdminContentManagement.created_content_ids.append(data["content"]["content_id"])
        print(f"✅ Created worksheet: {data['content']['content_id']}")
    
    def test_07_create_activity_content(self):
        """Test creating an activity content item"""
        assert TestAdminContentManagement.created_subtopic_id, "Subtopic not created"
        
        response = requests.post(f"{BASE_URL}/api/admin/content/items", 
            headers=self.get_headers(),
            json={
                "topic_id": TestAdminContentManagement.created_subtopic_id,
                "title": "TEST_Money Sorting Game",
                "description": "Interactive game to sort coins by value",
                "content_type": "activity",
                "order": 2,
                "min_grade": 0,
                "max_grade": 5,
                "reward_coins": 15,
                "content_data": {
                    "activity_type": "game",
                    "instructions": "Drag and drop coins into the correct value buckets",
                    "html_url": ""  # Would be set after upload
                }
            }
        )
        assert response.status_code == 200, f"Create activity failed: {response.text}"
        data = response.json()
        assert data["content"]["content_type"] == "activity"
        TestAdminContentManagement.created_content_ids.append(data["content"]["content_id"])
        print(f"✅ Created activity: {data['content']['content_id']}")
    
    def test_08_get_content_items(self):
        """Test getting content items for a topic"""
        assert TestAdminContentManagement.created_subtopic_id, "Subtopic not created"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/content/items?topic_id={TestAdminContentManagement.created_subtopic_id}", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get content items failed: {response.text}"
        items = response.json()
        assert isinstance(items, list)
        assert len(items) >= 3, f"Expected at least 3 items, got {len(items)}"
        print(f"✅ Retrieved {len(items)} content items")
    
    def test_09_edit_content_item(self):
        """Test editing a content item"""
        assert len(TestAdminContentManagement.created_content_ids) > 0, "No content items created"
        
        content_id = TestAdminContentManagement.created_content_ids[0]
        response = requests.put(
            f"{BASE_URL}/api/admin/content/items/{content_id}", 
            headers=self.get_headers(),
            json={
                "title": "TEST_Introduction to Money - Updated",
                "reward_coins": 8
            }
        )
        assert response.status_code == 200, f"Update content failed: {response.text}"
        data = response.json()
        assert data["content"]["title"] == "TEST_Introduction to Money - Updated"
        assert data["content"]["reward_coins"] == 8
        print("✅ Content item updated successfully")
    
    # ============== REORDER TESTS ==============
    
    def test_10_reorder_content_items(self):
        """Test reordering content items"""
        assert len(TestAdminContentManagement.created_content_ids) >= 2, "Need at least 2 content items"
        
        # Reverse the order
        reorder_data = [
            {"id": TestAdminContentManagement.created_content_ids[0], "order": 2},
            {"id": TestAdminContentManagement.created_content_ids[1], "order": 0},
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/content/items/reorder", 
            headers=self.get_headers(),
            json={"items": reorder_data}
        )
        assert response.status_code == 200, f"Reorder failed: {response.text}"
        print("✅ Content items reordered successfully")
    
    # ============== USER-FACING CONTENT TESTS ==============
    
    def test_11_user_get_topics(self):
        """Test user-facing topics endpoint"""
        response = requests.get(f"{BASE_URL}/api/content/topics", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get user topics failed: {response.text}"
        topics = response.json()
        assert isinstance(topics, list)
        print(f"✅ User can see {len(topics)} topics")
    
    def test_12_user_get_topic_detail(self):
        """Test user-facing topic detail endpoint"""
        assert TestAdminContentManagement.created_subtopic_id, "Subtopic not created"
        
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{TestAdminContentManagement.created_subtopic_id}", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get topic detail failed: {response.text}"
        data = response.json()
        assert "content_items" in data
        assert len(data["content_items"]) >= 3
        print(f"✅ Topic detail shows {len(data['content_items'])} content items")
    
    # ============== CONTENT COMPLETION TEST ==============
    
    def test_13_complete_content_item(self):
        """Test completing a content item and earning coins"""
        assert len(TestAdminContentManagement.created_content_ids) > 0, "No content items created"
        
        content_id = TestAdminContentManagement.created_content_ids[0]
        response = requests.post(
            f"{BASE_URL}/api/content/items/{content_id}/complete", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Complete content failed: {response.text}"
        data = response.json()
        assert "reward" in data
        print(f"✅ Content completed, earned {data['reward']} coins")
    
    def test_14_complete_content_item_duplicate(self):
        """Test that completing same content again returns 0 reward"""
        assert len(TestAdminContentManagement.created_content_ids) > 0, "No content items created"
        
        content_id = TestAdminContentManagement.created_content_ids[0]
        response = requests.post(
            f"{BASE_URL}/api/content/items/{content_id}/complete", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Complete content failed: {response.text}"
        data = response.json()
        assert data["reward"] == 0, "Should not earn coins for duplicate completion"
        print("✅ Duplicate completion returns 0 reward")
    
    # ============== CLEANUP TESTS ==============
    
    def test_15_delete_content_item(self):
        """Test deleting a content item"""
        assert len(TestAdminContentManagement.created_content_ids) > 0, "No content items created"
        
        # Delete the last created content item
        content_id = TestAdminContentManagement.created_content_ids.pop()
        response = requests.delete(
            f"{BASE_URL}/api/admin/content/items/{content_id}", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Delete content failed: {response.text}"
        print(f"✅ Content item {content_id} deleted")
    
    def test_16_delete_topic_cascade(self):
        """Test deleting a topic cascades to subtopics and content"""
        assert TestAdminContentManagement.created_topic_id, "Topic not created"
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/content/topics/{TestAdminContentManagement.created_topic_id}", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Delete topic failed: {response.text}"
        
        # Verify subtopic is also deleted
        response = requests.get(
            f"{BASE_URL}/api/content/topics/{TestAdminContentManagement.created_subtopic_id}", 
            headers=self.get_headers()
        )
        assert response.status_code == 404, "Subtopic should be deleted with parent"
        print("✅ Topic and all associated content deleted")


class TestExistingContent:
    """Test existing content from main agent's setup"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        if not TestExistingContent.session_token:
            response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            assert response.status_code == 200
            TestExistingContent.session_token = response.json().get("session_token")
        yield
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestExistingContent.session_token}",
            "Content-Type": "application/json"
        }
    
    def test_existing_topic_money_basics(self):
        """Test existing 'Money Basics' topic"""
        response = requests.get(f"{BASE_URL}/api/content/topics/topic_7312cb99f546", 
            headers=self.get_headers()
        )
        # May or may not exist depending on test data
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found existing topic: {data.get('title', 'Unknown')}")
        else:
            print("ℹ️ Existing topic not found (may have been cleaned up)")
    
    def test_existing_subtopic_what_is_money(self):
        """Test existing 'What is Money?' subtopic"""
        response = requests.get(f"{BASE_URL}/api/content/topics/topic_51d6ffcffc3d", 
            headers=self.get_headers()
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found existing subtopic: {data.get('title', 'Unknown')}")
            if data.get("content_items"):
                print(f"   Contains {len(data['content_items'])} content items")
        else:
            print("ℹ️ Existing subtopic not found")


class TestFileUploadEndpoints:
    """Test file upload endpoints (without actual files)"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        if not TestFileUploadEndpoints.session_token:
            response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            assert response.status_code == 200
            TestFileUploadEndpoints.session_token = response.json().get("session_token")
        yield
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestFileUploadEndpoints.session_token}"
        }
    
    def test_thumbnail_upload_endpoint_exists(self):
        """Test that thumbnail upload endpoint exists"""
        # Send empty request to check endpoint exists
        response = requests.post(f"{BASE_URL}/api/upload/thumbnail", 
            headers=self.get_headers()
        )
        # Should return 422 (validation error) not 404
        assert response.status_code in [422, 400], f"Unexpected status: {response.status_code}"
        print("✅ Thumbnail upload endpoint exists")
    
    def test_pdf_upload_endpoint_exists(self):
        """Test that PDF upload endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/upload/pdf", 
            headers=self.get_headers()
        )
        assert response.status_code in [422, 400], f"Unexpected status: {response.status_code}"
        print("✅ PDF upload endpoint exists")
    
    def test_activity_upload_endpoint_exists(self):
        """Test that activity upload endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/upload/activity", 
            headers=self.get_headers()
        )
        assert response.status_code in [422, 400], f"Unexpected status: {response.status_code}"
        print("✅ Activity upload endpoint exists")


class TestUserLearnPage:
    """Test user-facing learn page APIs"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin (has access to all content)"""
        if not TestUserLearnPage.session_token:
            response = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            assert response.status_code == 200
            TestUserLearnPage.session_token = response.json().get("session_token")
        yield
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestUserLearnPage.session_token}",
            "Content-Type": "application/json"
        }
    
    def test_learn_topics_endpoint(self):
        """Test legacy learn topics endpoint"""
        response = requests.get(f"{BASE_URL}/api/learn/topics", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get learn topics failed: {response.text}"
        topics = response.json()
        assert isinstance(topics, list)
        print(f"✅ Legacy learn topics: {len(topics)} topics")
    
    def test_learn_books_endpoint(self):
        """Test books endpoint"""
        response = requests.get(f"{BASE_URL}/api/learn/books", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get books failed: {response.text}"
        books = response.json()
        assert isinstance(books, list)
        print(f"✅ Books endpoint: {len(books)} books")
    
    def test_learn_activities_endpoint(self):
        """Test activities endpoint"""
        response = requests.get(f"{BASE_URL}/api/learn/activities", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get activities failed: {response.text}"
        activities = response.json()
        assert isinstance(activities, list)
        print(f"✅ Activities endpoint: {len(activities)} activities")
    
    def test_learn_progress_endpoint(self):
        """Test learning progress endpoint"""
        response = requests.get(f"{BASE_URL}/api/learn/progress", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get progress failed: {response.text}"
        progress = response.json()
        assert "lessons" in progress
        print(f"✅ Progress endpoint working")
    
    def test_content_topics_endpoint(self):
        """Test new hierarchical content topics endpoint"""
        response = requests.get(f"{BASE_URL}/api/content/topics", 
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Get content topics failed: {response.text}"
        topics = response.json()
        assert isinstance(topics, list)
        
        # Check hierarchy structure
        for topic in topics:
            assert "topic_id" in topic
            assert "title" in topic
            if "subtopics" in topic:
                assert isinstance(topic["subtopics"], list)
        
        print(f"✅ Hierarchical content topics: {len(topics)} parent topics")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
