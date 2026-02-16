"""
Test suite for Glossary/Word Bank API endpoints
Tests CRUD operations for glossary words (admin) and public read access
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from test setup
ADMIN_SESSION_TOKEN = "admin_sess_aa2b0f50a7a24324aebb225fdca6e523"

# Test word prefix for cleanup
TEST_PREFIX = "TEST_GLOSSARY_"


@pytest.fixture(scope="module")
def admin_client():
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def unauthenticated_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestGlossaryPublicEndpoints:
    """Test public glossary endpoints (require authentication but not admin)"""
    
    def test_get_glossary_words_authenticated(self, admin_client):
        """GET /api/glossary/words - List all words with auth"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/words")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "words" in data
        assert "total" in data
        assert "letters" in data
        assert "categories" in data
        assert isinstance(data["words"], list)
        assert data["total"] >= 2  # Budget and Savings exist
        
    def test_get_glossary_words_unauthenticated(self, unauthenticated_client):
        """GET /api/glossary/words - Should fail without auth"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/glossary/words")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_get_glossary_words_search(self, admin_client):
        """GET /api/glossary/words?search=budget - Search filter"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/words?search=budget")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["words"]) >= 1
        # Verify search matches term
        found_budget = any(w["term"].lower() == "budget" for w in data["words"])
        assert found_budget, "Budget word should be found in search results"
        
    def test_get_glossary_words_letter_filter(self, admin_client):
        """GET /api/glossary/words?letter=B - Letter filter"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/words?letter=B")
        assert response.status_code == 200
        
        data = response.json()
        # All words should start with B
        for word in data["words"]:
            assert word["term"][0].upper() == "B", f"Word {word['term']} doesn't start with B"
            
    def test_get_glossary_words_category_filter(self, admin_client):
        """GET /api/glossary/words?category=saving - Category filter"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/words?category=saving")
        assert response.status_code == 200
        
        data = response.json()
        # All words should have saving category
        for word in data["words"]:
            assert word["category"] == "saving", f"Word {word['term']} has category {word['category']}"
            
    def test_get_single_word(self, admin_client):
        """GET /api/glossary/words/{word_id} - Get single word"""
        # First get list to find a word_id
        list_response = admin_client.get(f"{BASE_URL}/api/glossary/words")
        assert list_response.status_code == 200
        words = list_response.json()["words"]
        assert len(words) > 0
        
        word_id = words[0]["word_id"]
        response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert response.status_code == 200
        
        word = response.json()
        assert word["word_id"] == word_id
        assert "term" in word
        assert "meaning" in word
        
    def test_get_single_word_not_found(self, admin_client):
        """GET /api/glossary/words/{word_id} - 404 for non-existent word"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/words/word_nonexistent123")
        assert response.status_code == 404
        
    def test_get_word_of_day(self, admin_client):
        """GET /api/glossary/word-of-day - Get random word of the day"""
        response = admin_client.get(f"{BASE_URL}/api/glossary/word-of-day")
        assert response.status_code == 200
        
        word = response.json()
        if word:  # May be null if no words exist
            assert "term" in word
            assert "meaning" in word
            assert "word_id" in word


class TestGlossaryAdminEndpoints:
    """Test admin-only glossary endpoints"""
    
    def test_admin_get_all_words(self, admin_client):
        """GET /api/admin/glossary/words - Admin list all words"""
        response = admin_client.get(f"{BASE_URL}/api/admin/glossary/words")
        assert response.status_code == 200
        
        data = response.json()
        assert "words" in data
        assert "total" in data
        assert "categories" in data
        
    def test_admin_create_word(self, admin_client):
        """POST /api/admin/glossary/words - Create new word"""
        unique_term = f"{TEST_PREFIX}Interest_{uuid.uuid4().hex[:6]}"
        payload = {
            "term": unique_term,
            "meaning": "Money earned from savings or investments",
            "description": "When you put money in a bank, the bank pays you extra money called interest.",
            "examples": ["If you save $100, the bank might give you $2 interest."],
            "category": "saving",
            "min_grade": 1,
            "max_grade": 5
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "word_id" in data
        assert data["message"] == "Word created"
        
        # Verify word was created by fetching it
        word_id = data["word_id"]
        get_response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert get_response.status_code == 200
        
        created_word = get_response.json()
        assert created_word["term"] == unique_term
        assert created_word["meaning"] == payload["meaning"]
        assert created_word["category"] == "saving"
        assert created_word["min_grade"] == 1
        assert created_word["max_grade"] == 5
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word_id}")
        
    def test_admin_create_word_missing_term(self, admin_client):
        """POST /api/admin/glossary/words - Fail without term"""
        payload = {
            "meaning": "Some meaning",
            "category": "general"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=payload)
        assert response.status_code == 400
        assert "Term is required" in response.json()["detail"]
        
    def test_admin_create_duplicate_word(self, admin_client):
        """POST /api/admin/glossary/words - Fail on duplicate term"""
        # Try to create a word with existing term "Budget"
        payload = {
            "term": "Budget",
            "meaning": "Duplicate test",
            "category": "general"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=payload)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
        
    def test_admin_update_word(self, admin_client):
        """PUT /api/admin/glossary/words/{word_id} - Update word"""
        # First create a word to update
        unique_term = f"{TEST_PREFIX}UpdateTest_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "term": unique_term,
            "meaning": "Original meaning",
            "category": "general"
        }
        
        create_response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=create_payload)
        assert create_response.status_code == 200
        word_id = create_response.json()["word_id"]
        
        # Update the word
        update_payload = {
            "meaning": "Updated meaning",
            "category": "saving",
            "min_grade": 2,
            "max_grade": 4
        }
        
        update_response = admin_client.put(f"{BASE_URL}/api/admin/glossary/words/{word_id}", json=update_payload)
        assert update_response.status_code == 200
        assert update_response.json()["message"] == "Word updated"
        
        # Verify update
        get_response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert get_response.status_code == 200
        
        updated_word = get_response.json()
        assert updated_word["meaning"] == "Updated meaning"
        assert updated_word["category"] == "saving"
        assert updated_word["min_grade"] == 2
        assert updated_word["max_grade"] == 4
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word_id}")
        
    def test_admin_update_word_not_found(self, admin_client):
        """PUT /api/admin/glossary/words/{word_id} - 404 for non-existent"""
        update_payload = {"meaning": "Test"}
        response = admin_client.put(f"{BASE_URL}/api/admin/glossary/words/word_nonexistent123", json=update_payload)
        assert response.status_code == 404
        
    def test_admin_delete_word(self, admin_client):
        """DELETE /api/admin/glossary/words/{word_id} - Delete word"""
        # First create a word to delete
        unique_term = f"{TEST_PREFIX}DeleteTest_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "term": unique_term,
            "meaning": "To be deleted",
            "category": "general"
        }
        
        create_response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=create_payload)
        assert create_response.status_code == 200
        word_id = create_response.json()["word_id"]
        
        # Delete the word
        delete_response = admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Word deleted"
        
        # Verify deletion
        get_response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert get_response.status_code == 404
        
    def test_admin_delete_word_not_found(self, admin_client):
        """DELETE /api/admin/glossary/words/{word_id} - 404 for non-existent"""
        response = admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/word_nonexistent123")
        assert response.status_code == 404


class TestGlossaryAdminAuth:
    """Test that admin endpoints require admin role"""
    
    def test_admin_endpoints_require_auth(self, unauthenticated_client):
        """Admin endpoints should fail without auth"""
        # GET admin words
        response = unauthenticated_client.get(f"{BASE_URL}/api/admin/glossary/words")
        assert response.status_code == 401
        
        # POST create word
        response = unauthenticated_client.post(f"{BASE_URL}/api/admin/glossary/words", json={"term": "Test"})
        assert response.status_code == 401
        
        # PUT update word
        response = unauthenticated_client.put(f"{BASE_URL}/api/admin/glossary/words/word_123", json={"meaning": "Test"})
        assert response.status_code == 401
        
        # DELETE word
        response = unauthenticated_client.delete(f"{BASE_URL}/api/admin/glossary/words/word_123")
        assert response.status_code == 401


class TestGlossaryDataIntegrity:
    """Test data integrity and edge cases"""
    
    def test_word_first_letter_auto_set(self, admin_client):
        """Verify first_letter is automatically set from term"""
        unique_term = f"{TEST_PREFIX}Zebra_{uuid.uuid4().hex[:6]}"
        payload = {
            "term": unique_term,
            "meaning": "Test meaning",
            "category": "general"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=payload)
        assert response.status_code == 200
        word_id = response.json()["word_id"]
        
        # Verify first_letter
        get_response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert get_response.status_code == 200
        assert get_response.json()["first_letter"] == "T"  # TEST_GLOSSARY_ starts with T
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word_id}")
        
    def test_word_timestamps(self, admin_client):
        """Verify created_at and updated_at timestamps"""
        unique_term = f"{TEST_PREFIX}Timestamp_{uuid.uuid4().hex[:6]}"
        payload = {
            "term": unique_term,
            "meaning": "Test meaning",
            "category": "general"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/glossary/words", json=payload)
        assert response.status_code == 200
        word_id = response.json()["word_id"]
        
        # Verify timestamps exist
        get_response = admin_client.get(f"{BASE_URL}/api/glossary/words/{word_id}")
        assert get_response.status_code == 200
        word = get_response.json()
        assert "created_at" in word
        assert "updated_at" in word
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word_id}")


# Cleanup fixture to remove test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(admin_client):
    """Cleanup TEST_GLOSSARY_ prefixed words after tests"""
    yield
    # Cleanup after tests
    try:
        response = admin_client.get(f"{BASE_URL}/api/admin/glossary/words?limit=200")
        if response.status_code == 200:
            words = response.json().get("words", [])
            for word in words:
                if word.get("term", "").startswith(TEST_PREFIX):
                    admin_client.delete(f"{BASE_URL}/api/admin/glossary/words/{word['word_id']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
