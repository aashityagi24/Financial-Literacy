"""
Teacher Repository Tests - Testing upload and CRUD operations for admin repository feature
Tests file uploads (PNG, JPG, PDF) and repository item management
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"
TEACHER_EMAIL = "atyagi.98@gmail.com"


class TestRepositoryUpload:
    """Test file upload to repository endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and get admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Admin login
        response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.cookies
        yield
        self.session.close()
    
    def test_upload_png_image(self):
        """Test uploading PNG image to repository"""
        # Create a simple PNG file (1x1 pixel)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 pixels
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # RGB, no interlace
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_image.png', io.BytesIO(png_data), 'image/png')}
        
        response = self.session.post(
            f"{BASE_URL}/api/upload/repository",
            files=files
        )
        
        assert response.status_code == 200, f"PNG upload failed: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain url"
        assert data["file_type"] == "image", f"Expected file_type 'image', got: {data.get('file_type')}"
        assert data["url"].startswith("/api/uploads/repository/"), f"URL format incorrect: {data['url']}"
        assert data["url"].endswith(".png"), f"Filename should end with .png: {data['url']}"
        print(f"✅ PNG upload successful: {data['url']}")
    
    def test_upload_jpg_image(self):
        """Test uploading JPG image to repository"""
        # Minimal valid JPEG (1x1 pixel white)
        jpg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
            0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
            0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
            0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
            0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
            0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
            0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
            0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
            0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
            0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
            0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
            0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
            0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
            0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
            0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
            0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
            0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
            0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
            0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
            0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
            0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
            0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
            0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
            0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
            0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
            0xFB, 0xD5, 0x1B, 0x19, 0x08, 0xE5, 0x7F, 0xFF,
            0xD9
        ])
        
        files = {'file': ('test_image.jpg', io.BytesIO(jpg_data), 'image/jpeg')}
        
        response = self.session.post(
            f"{BASE_URL}/api/upload/repository",
            files=files
        )
        
        assert response.status_code == 200, f"JPG upload failed: {response.text}"
        data = response.json()
        assert data["file_type"] == "image", f"Expected file_type 'image', got: {data.get('file_type')}"
        assert ".jpg" in data["url"] or ".jpeg" in data["url"], f"Filename should end with .jpg: {data['url']}"
        print(f"✅ JPG upload successful: {data['url']}")
    
    def test_upload_pdf_file(self):
        """Test uploading PDF file to repository"""
        # Minimal valid PDF
        pdf_data = b"""%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
163
%%EOF"""
        
        files = {'file': ('test_document.pdf', io.BytesIO(pdf_data), 'application/pdf')}
        
        response = self.session.post(
            f"{BASE_URL}/api/upload/repository",
            files=files
        )
        
        assert response.status_code == 200, f"PDF upload failed: {response.text}"
        data = response.json()
        assert data["file_type"] == "pdf", f"Expected file_type 'pdf', got: {data.get('file_type')}"
        assert data["url"].endswith(".pdf"), f"Filename should end with .pdf: {data['url']}"
        print(f"✅ PDF upload successful: {data['url']}")
    
    def test_upload_invalid_file_type(self):
        """Test that invalid file types are rejected"""
        # Try uploading a text file
        files = {'file': ('test.txt', io.BytesIO(b'Hello world'), 'text/plain')}
        
        response = self.session.post(
            f"{BASE_URL}/api/upload/repository",
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got: {response.status_code}"
        print("✅ Invalid file type rejected correctly")
    
    def test_uploaded_file_accessible(self):
        """Test that uploaded file can be accessed"""
        # Upload a PNG first
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('access_test.png', io.BytesIO(png_data), 'image/png')}
        
        upload_response = self.session.post(
            f"{BASE_URL}/api/upload/repository",
            files=files
        )
        assert upload_response.status_code == 200
        
        file_url = upload_response.json()["url"]
        
        # Try to access the file
        access_response = self.session.get(f"{BASE_URL}{file_url}")
        assert access_response.status_code == 200, f"File not accessible at {file_url}"
        print(f"✅ Uploaded file accessible: {file_url}")


class TestAdminRepository:
    """Test admin repository CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and get admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Admin login
        response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        yield
        self.session.close()
    
    def test_get_repository_items(self):
        """Test getting repository items list"""
        response = self.session.get(f"{BASE_URL}/api/admin/repository")
        
        assert response.status_code == 200, f"Get repository failed: {response.text}"
        data = response.json()
        assert "items" in data, "Response should contain 'items' array"
        assert "topics" in data, "Response should contain 'topics' array"
        assert "total" in data, "Response should contain 'total' count"
        print(f"✅ Get repository items successful: {data['total']} items, {len(data['topics'])} topics")
    
    def test_get_repository_with_filter(self):
        """Test getting repository items with filters"""
        response = self.session.get(f"{BASE_URL}/api/admin/repository?file_type=image")
        
        assert response.status_code == 200, f"Get filtered repository failed: {response.text}"
        data = response.json()
        # Verify all returned items are images
        for item in data.get("items", []):
            if "file_type" in item:
                assert item["file_type"] == "image", f"Filter not working: got {item['file_type']}"
        print(f"✅ Filtered repository query successful: {len(data.get('items', []))} image items")
    
    def test_create_and_delete_repository_item(self):
        """Test full CRUD - create then delete repository item"""
        # First upload a file
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_crud.png', io.BytesIO(png_data), 'image/png')}
        upload_response = self.session.post(f"{BASE_URL}/api/upload/repository", files=files)
        assert upload_response.status_code == 200
        file_url = upload_response.json()["url"]
        
        # Get topics to use valid topic_id
        repo_response = self.session.get(f"{BASE_URL}/api/admin/repository")
        topics = repo_response.json().get("topics", [])
        
        if not topics:
            pytest.skip("No topics available for testing")
        
        topic_id = topics[0]["topic_id"]
        
        # Get subtopics
        subtopics_response = self.session.get(f"{BASE_URL}/api/admin/repository/subtopics/{topic_id}")
        subtopics = subtopics_response.json().get("subtopics", [])
        subtopic_id = subtopics[0]["topic_id"] if subtopics else topic_id
        
        # Create repository item
        item_data = {
            "title": "TEST_CRUD_Item",
            "description": "Test item for CRUD operations",
            "file_url": file_url,
            "file_type": "image",
            "topic_id": topic_id,
            "subtopic_id": subtopic_id,
            "min_grade": 0,
            "max_grade": 5,
            "tags": ["test", "crud"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/repository",
            json=item_data
        )
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        created_item = create_response.json().get("item", {})
        assert "item_id" in created_item, "Created item should have item_id"
        assert created_item["title"] == "TEST_CRUD_Item", "Title mismatch"
        item_id = created_item["item_id"]
        print(f"✅ Repository item created: {item_id}")
        
        # Verify item in list
        list_response = self.session.get(f"{BASE_URL}/api/admin/repository")
        items = list_response.json().get("items", [])
        found = any(item.get("item_id") == item_id for item in items)
        assert found, "Created item not found in list"
        print(f"✅ Created item verified in repository list")
        
        # Delete the item
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/repository/{item_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✅ Repository item deleted: {item_id}")
        
        # Verify deletion
        list_after_delete = self.session.get(f"{BASE_URL}/api/admin/repository")
        items_after = list_after_delete.json().get("items", [])
        not_found = not any(item.get("item_id") == item_id for item in items_after)
        assert not_found, "Deleted item still found in list"
        print(f"✅ Deletion verified - item no longer in list")
    
    def test_update_repository_item(self):
        """Test updating a repository item"""
        # First create an item
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_update.png', io.BytesIO(png_data), 'image/png')}
        upload_response = self.session.post(f"{BASE_URL}/api/upload/repository", files=files)
        file_url = upload_response.json()["url"]
        
        # Get topics
        repo_response = self.session.get(f"{BASE_URL}/api/admin/repository")
        topics = repo_response.json().get("topics", [])
        
        if not topics:
            pytest.skip("No topics available for testing")
        
        topic_id = topics[0]["topic_id"]
        subtopics_response = self.session.get(f"{BASE_URL}/api/admin/repository/subtopics/{topic_id}")
        subtopics = subtopics_response.json().get("subtopics", [])
        subtopic_id = subtopics[0]["topic_id"] if subtopics else topic_id
        
        # Create item
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/repository",
            json={
                "title": "TEST_Update_Item",
                "file_url": file_url,
                "file_type": "image",
                "topic_id": topic_id,
                "subtopic_id": subtopic_id,
                "min_grade": 0,
                "max_grade": 3
            }
        )
        item_id = create_response.json().get("item", {}).get("item_id")
        
        # Update item
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/repository/{item_id}",
            json={
                "title": "TEST_Updated_Title",
                "description": "Updated description",
                "max_grade": 5
            }
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"✅ Repository item updated: {item_id}")
        
        # Clean up
        self.session.delete(f"{BASE_URL}/api/admin/repository/{item_id}")


class TestTeacherRepository:
    """Test teacher access to repository"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with admin login (to test teacher access via admin role)"""
        self.session = requests.Session()
        
        # Admin login (admin can also access teacher routes)
        response = self.session.post(f"{BASE_URL}/api/auth/admin-login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        yield
        self.session.close()
    
    def test_teacher_get_repository(self):
        """Test teacher endpoint for getting repository items"""
        response = self.session.get(f"{BASE_URL}/api/teacher/repository")
        
        assert response.status_code == 200, f"Teacher repository access failed: {response.text}"
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        assert "topics" in data, "Response should contain 'topics'"
        
        # Verify only active items are returned (teacher shouldn't see inactive items)
        for item in data.get("items", []):
            assert item.get("is_active", True) == True, "Teacher should only see active items"
        
        print(f"✅ Teacher repository access successful: {len(data.get('items', []))} items")
    
    def test_teacher_get_subtopics(self):
        """Test teacher can get subtopics for filtering"""
        # First get topics
        repo_response = self.session.get(f"{BASE_URL}/api/teacher/repository")
        topics = repo_response.json().get("topics", [])
        
        if not topics:
            pytest.skip("No topics available for testing")
        
        topic_id = topics[0]["topic_id"]
        
        response = self.session.get(f"{BASE_URL}/api/teacher/repository/subtopics/{topic_id}")
        
        assert response.status_code == 200, f"Teacher subtopics access failed: {response.text}"
        data = response.json()
        assert "subtopics" in data, "Response should contain 'subtopics'"
        print(f"✅ Teacher subtopics access successful: {len(data.get('subtopics', []))} subtopics")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
