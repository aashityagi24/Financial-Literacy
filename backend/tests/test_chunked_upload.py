"""
Test Chunked Upload Feature
Tests the chunked upload flow (init/part/complete) and direct upload endpoints.
Also verifies static file serving at /api/uploads/{subdir}/{filename}
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChunkedUploadFlow:
    """Tests for chunked upload endpoints (init/part/complete)"""
    
    def test_chunked_init(self):
        """Test /api/upload/chunked/init - initialize upload session"""
        form_data = {
            'filename': 'test_video.mp4',
            'dest_type': 'video',
            'total_chunks': '3'
        }
        response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=form_data)
        assert response.status_code == 200
        data = response.json()
        assert 'upload_id' in data
        assert data['filename'] == 'test_video.mp4'
        assert data['dest_type'] == 'video'
        print(f"Init success - upload_id: {data['upload_id']}")
    
    def test_chunked_full_flow_small_file(self):
        """Test complete chunked upload flow with 2 chunks"""
        # Step 1: Init
        init_data = {
            'filename': 'test_upload.png',
            'dest_type': 'image',
            'total_chunks': '2'
        }
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        assert init_response.status_code == 200
        upload_id = init_response.json()['upload_id']
        print(f"Chunked init success: upload_id={upload_id}")
        
        # Step 2: Upload chunks (simulate 2 chunks of fake image data)
        chunk1 = b'\x89PNG\r\n\x1a\n' + b'A' * 1000  # Fake PNG header + data
        chunk2 = b'B' * 1000
        
        # Upload chunk 0
        files = {'file': ('chunk_0', io.BytesIO(chunk1), 'application/octet-stream')}
        part_data = {'upload_id': upload_id, 'chunk_index': '0'}
        part_response = requests.post(f"{BASE_URL}/api/upload/chunked/part", data=part_data, files=files)
        assert part_response.status_code == 200
        assert part_response.json()['chunk_index'] == 0
        print(f"Chunk 0 uploaded: {part_response.json()['received']} bytes")
        
        # Upload chunk 1
        files = {'file': ('chunk_1', io.BytesIO(chunk2), 'application/octet-stream')}
        part_data = {'upload_id': upload_id, 'chunk_index': '1'}
        part_response = requests.post(f"{BASE_URL}/api/upload/chunked/part", data=part_data, files=files)
        assert part_response.status_code == 200
        assert part_response.json()['chunk_index'] == 1
        print(f"Chunk 1 uploaded: {part_response.json()['received']} bytes")
        
        # Step 3: Complete
        complete_data = {
            'upload_id': upload_id,
            'filename': 'test_upload.png',
            'dest_type': 'image',
            'total_chunks': '2'
        }
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data=complete_data)
        assert complete_response.status_code == 200
        result = complete_response.json()
        assert 'url' in result
        assert result['url'].startswith('/api/uploads/glossary/')
        print(f"Complete success - URL: {result['url']}")
        
        # Step 4: Verify file is accessible
        file_response = requests.get(f"{BASE_URL}{result['url']}")
        assert file_response.status_code == 200
        print(f"File accessible - size: {len(file_response.content)} bytes")
    
    def test_chunked_upload_video_dest(self):
        """Test chunked upload with video destination type"""
        # Init
        init_data = {'filename': 'test.mp4', 'dest_type': 'video', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        assert init_response.status_code == 200
        upload_id = init_response.json()['upload_id']
        
        # Upload single chunk
        chunk = b'FAKE_VIDEO_DATA' * 100
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        part_data = {'upload_id': upload_id, 'chunk_index': '0'}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data=part_data, files=files)
        
        # Complete
        complete_data = {'upload_id': upload_id, 'filename': 'test.mp4', 'dest_type': 'video', 'total_chunks': '1'}
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data=complete_data)
        assert complete_response.status_code == 200
        result = complete_response.json()
        assert '/api/uploads/videos/' in result['url']
        print(f"Video chunked upload success: {result['url']}")
    
    def test_chunked_upload_thumbnail_dest(self):
        """Test chunked upload with thumbnail destination type"""
        init_data = {'filename': 'thumb.jpg', 'dest_type': 'thumbnail', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        upload_id = init_response.json()['upload_id']
        
        chunk = b'\xFF\xD8\xFF' + b'JPGDATA' * 100  # Fake JPEG header
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data={'upload_id': upload_id, 'chunk_index': '0'}, files=files)
        
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data={
            'upload_id': upload_id, 'filename': 'thumb.jpg', 'dest_type': 'thumbnail', 'total_chunks': '1'
        })
        assert complete_response.status_code == 200
        assert '/api/uploads/thumbnails/' in complete_response.json()['url']
        print(f"Thumbnail chunked upload success: {complete_response.json()['url']}")
    
    def test_chunked_upload_badge_dest(self):
        """Test chunked upload with badge destination type"""
        init_data = {'filename': 'badge.png', 'dest_type': 'badge', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        upload_id = init_response.json()['upload_id']
        
        chunk = b'\x89PNG' + b'BADGEDATA' * 100
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data={'upload_id': upload_id, 'chunk_index': '0'}, files=files)
        
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data={
            'upload_id': upload_id, 'filename': 'badge.png', 'dest_type': 'badge', 'total_chunks': '1'
        })
        assert complete_response.status_code == 200
        assert '/api/uploads/badges/' in complete_response.json()['url']
        print(f"Badge chunked upload success: {complete_response.json()['url']}")
    
    def test_chunked_upload_store_dest(self):
        """Test chunked upload with store destination type"""
        init_data = {'filename': 'store_item.png', 'dest_type': 'store', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        upload_id = init_response.json()['upload_id']
        
        chunk = b'\x89PNG' + b'STOREDATA' * 100
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data={'upload_id': upload_id, 'chunk_index': '0'}, files=files)
        
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data={
            'upload_id': upload_id, 'filename': 'store_item.png', 'dest_type': 'store', 'total_chunks': '1'
        })
        assert complete_response.status_code == 200
        assert '/api/uploads/store/' in complete_response.json()['url']
        print(f"Store chunked upload success: {complete_response.json()['url']}")
    
    def test_chunked_upload_investment_dest(self):
        """Test chunked upload with investment destination type"""
        init_data = {'filename': 'invest.png', 'dest_type': 'investment', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        upload_id = init_response.json()['upload_id']
        
        chunk = b'\x89PNG' + b'INVESTDATA' * 100
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data={'upload_id': upload_id, 'chunk_index': '0'}, files=files)
        
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data={
            'upload_id': upload_id, 'filename': 'invest.png', 'dest_type': 'investment', 'total_chunks': '1'
        })
        assert complete_response.status_code == 200
        assert '/api/uploads/investments/' in complete_response.json()['url']
        print(f"Investment chunked upload success: {complete_response.json()['url']}")
    
    def test_chunked_upload_goal_dest(self):
        """Test chunked upload with goal destination type (should go to thumbnails)"""
        init_data = {'filename': 'goal.jpg', 'dest_type': 'goal', 'total_chunks': '1'}
        init_response = requests.post(f"{BASE_URL}/api/upload/chunked/init", data=init_data)
        upload_id = init_response.json()['upload_id']
        
        chunk = b'\xFF\xD8\xFF' + b'GOALDATA' * 100
        files = {'file': ('chunk_0', io.BytesIO(chunk), 'application/octet-stream')}
        requests.post(f"{BASE_URL}/api/upload/chunked/part", data={'upload_id': upload_id, 'chunk_index': '0'}, files=files)
        
        complete_response = requests.post(f"{BASE_URL}/api/upload/chunked/complete", data={
            'upload_id': upload_id, 'filename': 'goal.jpg', 'dest_type': 'goal', 'total_chunks': '1'
        })
        assert complete_response.status_code == 200
        # Goal type should go to thumbnails directory
        assert '/api/uploads/thumbnails/' in complete_response.json()['url']
        print(f"Goal chunked upload success (uses thumbnails): {complete_response.json()['url']}")
    
    def test_chunked_upload_missing_session(self):
        """Test chunked part upload with invalid session ID"""
        files = {'file': ('chunk_0', io.BytesIO(b'DATA'), 'application/octet-stream')}
        part_data = {'upload_id': 'invalid_session_id', 'chunk_index': '0'}
        response = requests.post(f"{BASE_URL}/api/upload/chunked/part", data=part_data, files=files)
        assert response.status_code == 404
        print("Correctly rejected invalid upload session")


class TestDirectUploadEndpoints:
    """Tests for direct upload endpoints (non-chunked)"""
    
    def test_upload_image_endpoint(self):
        """Test POST /api/upload/image"""
        # Create a minimal valid PNG (1x1 transparent pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/image", files=files)
        assert response.status_code == 200
        data = response.json()
        assert 'url' in data
        assert data['url'].startswith('/api/uploads/glossary/')
        print(f"Direct image upload success: {data['url']}")
        
        # Verify accessibility
        file_response = requests.get(f"{BASE_URL}{data['url']}")
        assert file_response.status_code == 200
    
    def test_upload_store_image_endpoint(self):
        """Test POST /api/upload/store-image"""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        files = {'file': ('store.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/store-image", files=files)
        assert response.status_code == 200
        assert '/api/uploads/store/' in response.json()['url']
        print(f"Store image upload success: {response.json()['url']}")
    
    def test_upload_investment_image_endpoint(self):
        """Test POST /api/upload/investment-image"""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        files = {'file': ('invest.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/investment-image", files=files)
        assert response.status_code == 200
        assert '/api/uploads/investments/' in response.json()['url']
        print(f"Investment image upload success: {response.json()['url']}")
    
    def test_upload_goal_image_endpoint(self):
        """Test POST /api/upload/goal-image"""
        jpg_data = b'\xFF\xD8\xFF\xE0' + b'\x00' * 100  # Fake JPEG
        files = {'file': ('goal.jpg', io.BytesIO(jpg_data), 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/upload/goal-image", files=files)
        assert response.status_code == 200
        assert '/api/uploads/thumbnails/' in response.json()['url']
        print(f"Goal image upload success: {response.json()['url']}")
    
    def test_upload_badge_endpoint(self):
        """Test POST /api/upload/badge"""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        files = {'file': ('badge.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/badge", files=files)
        assert response.status_code == 200
        assert '/api/uploads/badges/' in response.json()['url']
        print(f"Badge upload success: {response.json()['url']}")
    
    def test_upload_thumbnail_endpoint(self):
        """Test POST /api/upload/thumbnail"""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        files = {'file': ('thumb.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/thumbnail", files=files)
        assert response.status_code == 200
        assert '/api/uploads/thumbnails/' in response.json()['url']
        print(f"Thumbnail upload success: {response.json()['url']}")
    
    def test_upload_video_endpoint(self):
        """Test POST /api/upload/video"""
        # Minimal fake video data
        video_data = b'RIFF' + b'\x00' * 100 + b'AVI '
        files = {'file': ('test.mp4', io.BytesIO(video_data), 'video/mp4')}
        response = requests.post(f"{BASE_URL}/api/upload/video", files=files)
        assert response.status_code == 200
        assert '/api/uploads/videos/' in response.json()['url']
        print(f"Video upload success: {response.json()['url']}")
    
    def test_upload_pdf_endpoint(self):
        """Test POST /api/upload/pdf"""
        # Minimal fake PDF
        pdf_data = b'%PDF-1.4\n' + b'\x00' * 100
        files = {'file': ('doc.pdf', io.BytesIO(pdf_data), 'application/pdf')}
        response = requests.post(f"{BASE_URL}/api/upload/pdf", files=files)
        assert response.status_code == 200
        assert '/api/uploads/pdfs/' in response.json()['url']
        print(f"PDF upload success: {response.json()['url']}")


class TestAuthAndAdminEndpoints:
    """Test admin login and protected endpoints"""
    
    def test_admin_login(self):
        """Test POST /api/auth/login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert data['user']['role'] == 'admin'
        assert data['user']['email'] == 'admin@learnersplanet.com'
        print(f"Admin login success - user_id: {data['user'].get('_id') or data['user'].get('id')}")
        return data
    
    def test_teacher_login(self):
        """Test POST /api/auth/login with teacher credentials - skip if no test teacher"""
        # Note: test_teacher_1 may not exist in this environment
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test_teacher_1",
            "password": "testpassword"
        })
        if response.status_code == 401:
            pytest.skip("Test teacher user not found in database - skipping")
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert data['user']['role'] == 'teacher'
        print(f"Teacher login success - username: {data['user']['username']}")


class TestStaticFileServing:
    """Test that uploaded files are accessible via static file serving"""
    
    def test_existing_uploads_accessible(self):
        """Test that existing uploads are served correctly"""
        # Test thumbnail directory exists and serves files
        response = requests.get(f"{BASE_URL}/api/uploads/thumbnails/", allow_redirects=False)
        # Should return either 200 (directory listing) or 404 (no listing but dir exists)
        # The important thing is it doesn't return 500
        assert response.status_code in [200, 403, 404, 307]
        print(f"Thumbnails directory check: {response.status_code}")
    
    def test_upload_and_retrieve_flow(self):
        """Test full flow: upload file, then retrieve it"""
        # Upload an image
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {'file': ('retrieve_test.png', io.BytesIO(png_data), 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/upload/image", files=files)
        assert upload_response.status_code == 200
        url = upload_response.json()['url']
        
        # Retrieve the uploaded file
        get_response = requests.get(f"{BASE_URL}{url}")
        assert get_response.status_code == 200
        assert get_response.headers.get('content-type', '').startswith('image/')
        print(f"Upload and retrieve flow success - URL: {url}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
