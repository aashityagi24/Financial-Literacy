"""
Test Shopping List Bug Fix - Iteration 45
Tests the fix for parent shopping list feature:
1. POST /api/parent/shopping-list - saves item with full details from store
2. GET /api/parent/shopping-list - returns items grouped by child_id
3. DELETE /api/parent/shopping-list/{list_id} - removes item
4. POST /api/parent/shopping-list/create-chore - creates chore in new_quests collection
5. Child can see chores via GET /api/child/quests-new
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
PARENT_SESSION = "parent_sess_7c07b59f98264ceda978"
CHILD_SESSION = "test_sess_607235502edf45a6b4f7f0191a9fd1c0"
PARENT_USER_ID = "user_22d32d6b6d43"
CHILD_USER_ID = "user_cd3928036bf4"
TEST_STORE_ITEM_ID = "item_2d7c7783cf53"  # Carrots - price 50.0


class TestShoppingListBugFix:
    """Test suite for shopping list bug fix verification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.parent_headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={PARENT_SESSION}"
        }
        self.child_headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={CHILD_SESSION}"
        }
        self.created_list_ids = []
        self.created_chore_ids = []
        yield
        # Cleanup after tests
        self._cleanup()
    
    def _cleanup(self):
        """Clean up test data"""
        for list_id in self.created_list_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/parent/shopping-list/{list_id}",
                    headers=self.parent_headers
                )
            except:
                pass
    
    # ============== TEST 1: POST /api/parent/shopping-list ==============
    def test_add_item_to_shopping_list_saves_full_details(self):
        """
        BUG FIX TEST: POST should save item_name, item_price, image_url from store
        Previously: Only saved item_id, other fields were None
        """
        response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 2
            },
            headers=self.parent_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response contains list_id
        assert "list_id" in data, "Response should contain list_id"
        assert data["list_id"].startswith("shoplist_"), "list_id should have correct prefix"
        
        self.created_list_ids.append(data["list_id"])
        print(f"✅ POST /api/parent/shopping-list - Item added with list_id: {data['list_id']}")
    
    # ============== TEST 2: GET /api/parent/shopping-list ==============
    def test_get_shopping_list_returns_grouped_structure(self):
        """
        BUG FIX TEST: GET should return items grouped by child_id as [{child_id, items: [...]}]
        Previously: Returned wrong data structure
        """
        # First add an item
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        assert add_response.status_code == 200
        list_id = add_response.json()["list_id"]
        self.created_list_ids.append(list_id)
        
        # Now get the shopping list
        response = requests.get(
            f"{BASE_URL}/api/parent/shopping-list",
            headers=self.parent_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response is a list
        assert isinstance(data, list), f"Response should be a list, got {type(data)}"
        
        # Find the child's items
        child_data = None
        for entry in data:
            if entry.get("child_id") == CHILD_USER_ID:
                child_data = entry
                break
        
        assert child_data is not None, f"Should find items for child {CHILD_USER_ID}"
        assert "items" in child_data, "Entry should have 'items' key"
        assert isinstance(child_data["items"], list), "items should be a list"
        
        # Find our test item
        test_item = None
        for item in child_data["items"]:
            if item.get("list_id") == list_id:
                test_item = item
                break
        
        assert test_item is not None, f"Should find item with list_id {list_id}"
        
        # BUG FIX VERIFICATION: Check that item has full details (not None)
        assert test_item.get("item_name") is not None, "item_name should NOT be None (bug fix)"
        assert test_item.get("item_name") == "Carrots", f"item_name should be 'Carrots', got {test_item.get('item_name')}"
        assert test_item.get("item_price") is not None, "item_price should NOT be None (bug fix)"
        assert test_item.get("item_price") == 50, f"item_price should be 50, got {test_item.get('item_price')}"
        assert test_item.get("image_url") is not None, "image_url should NOT be None (bug fix)"
        assert test_item.get("quantity") == 1, f"quantity should be 1, got {test_item.get('quantity')}"
        
        print(f"✅ GET /api/parent/shopping-list - Returns grouped structure with full item details")
        print(f"   item_name: {test_item.get('item_name')}")
        print(f"   item_price: {test_item.get('item_price')}")
        print(f"   image_url: {test_item.get('image_url')}")
    
    # ============== TEST 3: DELETE /api/parent/shopping-list/{list_id} ==============
    def test_delete_shopping_list_item(self):
        """Test DELETE removes item from shopping list"""
        # First add an item
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        assert add_response.status_code == 200
        list_id = add_response.json()["list_id"]
        
        # Delete the item
        delete_response = requests.delete(
            f"{BASE_URL}/api/parent/shopping-list/{list_id}",
            headers=self.parent_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify item is deleted by checking GET
        get_response = requests.get(
            f"{BASE_URL}/api/parent/shopping-list",
            headers=self.parent_headers
        )
        data = get_response.json()
        
        # Check item is not in the list
        for entry in data:
            if entry.get("child_id") == CHILD_USER_ID:
                for item in entry.get("items", []):
                    assert item.get("list_id") != list_id, f"Item {list_id} should be deleted"
        
        print(f"✅ DELETE /api/parent/shopping-list/{list_id} - Item removed successfully")
    
    # ============== TEST 4: POST /api/parent/shopping-list/create-chore ==============
    def test_create_chore_from_shopping_list_saves_to_new_quests(self):
        """
        BUG FIX TEST: create-chore should save to new_quests collection (not parent_chores)
        so that children can see the chore via GET /api/child/quests-new
        """
        # First add an item to shopping list
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        assert add_response.status_code == 200
        list_id = add_response.json()["list_id"]
        self.created_list_ids.append(list_id)
        
        # Create chore from shopping list
        chore_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list/create-chore",
            json={
                "child_id": CHILD_USER_ID,
                "list_item_ids": [list_id],
                "title": "TEST_Shopping Chore - Buy Carrots",
                "description": "Test chore from shopping list",
                "reward_amount": 25
            },
            headers=self.parent_headers
        )
        
        assert chore_response.status_code == 200, f"Expected 200, got {chore_response.status_code}: {chore_response.text}"
        chore_data = chore_response.json()
        
        assert "chore_id" in chore_data, "Response should contain chore_id"
        assert chore_data["chore_id"].startswith("chore_"), "chore_id should have correct prefix"
        assert chore_data.get("total_reward") == 25, f"total_reward should be 25, got {chore_data.get('total_reward')}"
        
        self.created_chore_ids.append(chore_data["chore_id"])
        print(f"✅ POST /api/parent/shopping-list/create-chore - Chore created: {chore_data['chore_id']}")
        
        return chore_data["chore_id"]
    
    # ============== TEST 5: Child can see chore via GET /api/child/quests-new ==============
    def test_child_can_see_shopping_chore_in_quests(self):
        """
        BUG FIX TEST: Child should see chores created from shopping list
        Previously: Chores were saved to parent_chores collection, not visible to child
        Now: Chores are saved to new_quests collection with child_id
        """
        # First create a chore from shopping list
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        assert add_response.status_code == 200
        list_id = add_response.json()["list_id"]
        self.created_list_ids.append(list_id)
        
        # Create chore
        chore_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list/create-chore",
            json={
                "child_id": CHILD_USER_ID,
                "list_item_ids": [list_id],
                "title": "TEST_Child Visible Shopping Chore",
                "description": "This chore should be visible to child",
                "reward_amount": 30
            },
            headers=self.parent_headers
        )
        assert chore_response.status_code == 200
        chore_id = chore_response.json()["chore_id"]
        self.created_chore_ids.append(chore_id)
        
        # Now check if child can see the chore
        child_quests_response = requests.get(
            f"{BASE_URL}/api/child/quests-new?source=parent",
            headers=self.child_headers
        )
        
        assert child_quests_response.status_code == 200, f"Expected 200, got {child_quests_response.status_code}"
        quests = child_quests_response.json()
        
        # Find our test chore
        found_chore = None
        for quest in quests:
            quest_id = quest.get("quest_id") or quest.get("chore_id")
            if quest_id == chore_id:
                found_chore = quest
                break
        
        assert found_chore is not None, f"Child should see chore {chore_id} in quests-new (BUG FIX)"
        assert found_chore.get("title") == "TEST_Child Visible Shopping Chore"
        assert found_chore.get("from_shopping_list") == True, "Chore should be marked as from_shopping_list"
        assert found_chore.get("creator_type") == "parent"
        
        print(f"✅ GET /api/child/quests-new - Child can see shopping chore: {chore_id}")
        print(f"   title: {found_chore.get('title')}")
        print(f"   reward_amount: {found_chore.get('reward_amount')}")
        print(f"   from_shopping_list: {found_chore.get('from_shopping_list')}")
    
    # ============== TEST 6: Verify shopping list item status updates ==============
    def test_shopping_list_item_status_updates_after_chore_creation(self):
        """Test that shopping list items are marked as 'assigned' after chore creation"""
        # Add item
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        assert add_response.status_code == 200
        list_id = add_response.json()["list_id"]
        self.created_list_ids.append(list_id)
        
        # Create chore
        chore_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list/create-chore",
            json={
                "child_id": CHILD_USER_ID,
                "list_item_ids": [list_id],
                "title": "TEST_Status Update Chore",
                "description": "Test status update",
                "reward_amount": 20
            },
            headers=self.parent_headers
        )
        assert chore_response.status_code == 200
        chore_id = chore_response.json()["chore_id"]
        self.created_chore_ids.append(chore_id)
        
        # Get shopping list and check status
        get_response = requests.get(
            f"{BASE_URL}/api/parent/shopping-list",
            headers=self.parent_headers
        )
        data = get_response.json()
        
        # Find the item
        for entry in data:
            if entry.get("child_id") == CHILD_USER_ID:
                for item in entry.get("items", []):
                    if item.get("list_id") == list_id:
                        assert item.get("status") == "assigned", f"Item status should be 'assigned', got {item.get('status')}"
                        assert item.get("chore_id") == chore_id, f"Item should have chore_id {chore_id}"
                        print(f"✅ Shopping list item status updated to 'assigned' with chore_id")
                        return
        
        pytest.fail(f"Could not find item {list_id} in shopping list")
    
    # ============== TEST 7: Validation - missing required fields ==============
    def test_create_chore_requires_title(self):
        """Test that create-chore requires title"""
        add_response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": TEST_STORE_ITEM_ID,
                "quantity": 1
            },
            headers=self.parent_headers
        )
        list_id = add_response.json()["list_id"]
        self.created_list_ids.append(list_id)
        
        # Try to create chore without title
        response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list/create-chore",
            json={
                "child_id": CHILD_USER_ID,
                "list_item_ids": [list_id],
                "reward_amount": 10
            },
            headers=self.parent_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for missing title, got {response.status_code}"
        print("✅ Validation: create-chore requires title")
    
    def test_create_chore_requires_list_items(self):
        """Test that create-chore requires at least one list item"""
        response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list/create-chore",
            json={
                "child_id": CHILD_USER_ID,
                "list_item_ids": [],
                "title": "Test Chore",
                "reward_amount": 10
            },
            headers=self.parent_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for empty list_item_ids, got {response.status_code}"
        print("✅ Validation: create-chore requires at least one list item")
    
    def test_add_item_requires_child_id_and_item_id(self):
        """Test that adding item requires child_id and item_id"""
        # Missing child_id
        response1 = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={"item_id": TEST_STORE_ITEM_ID},
            headers=self.parent_headers
        )
        assert response1.status_code == 400, f"Expected 400 for missing child_id, got {response1.status_code}"
        
        # Missing item_id
        response2 = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={"child_id": CHILD_USER_ID},
            headers=self.parent_headers
        )
        assert response2.status_code == 400, f"Expected 400 for missing item_id, got {response2.status_code}"
        
        print("✅ Validation: add item requires child_id and item_id")
    
    def test_add_item_validates_store_item_exists(self):
        """Test that adding item validates store item exists"""
        response = requests.post(
            f"{BASE_URL}/api/parent/shopping-list",
            json={
                "child_id": CHILD_USER_ID,
                "item_id": "nonexistent_item_id",
                "quantity": 1
            },
            headers=self.parent_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent item, got {response.status_code}"
        print("✅ Validation: add item validates store item exists")


class TestShoppingListAuthentication:
    """Test authentication requirements for shopping list endpoints"""
    
    def test_shopping_list_requires_parent_auth(self):
        """Test that shopping list endpoints require parent authentication"""
        # No auth header
        response = requests.get(f"{BASE_URL}/api/parent/shopping-list")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✅ Shopping list requires authentication")
    
    def test_child_cannot_access_parent_shopping_list(self):
        """Test that child cannot access parent shopping list endpoints"""
        child_headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={CHILD_SESSION}"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/parent/shopping-list",
            headers=child_headers
        )
        
        # Should return 403 (forbidden) for child trying to access parent endpoint
        assert response.status_code == 403, f"Expected 403 for child access, got {response.status_code}"
        print("✅ Child cannot access parent shopping list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
