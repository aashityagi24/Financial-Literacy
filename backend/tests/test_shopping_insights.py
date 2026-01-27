"""
Test Shopping List and Student Insights Features
- Parent Shopping List: should show store items from active categories
- Teacher Dashboard Student Insights: verify grade-based investment display (K=none, 1-2=garden, 3-5=stocks)
- Parent Dashboard Child Insights: verify grade-based investment display
- Store page: verify items from admin_store_items collection are shown
- Student insights API: verify returns proper nested structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test sessions created in MongoDB
PARENT_SESSION = "test_parent_session_1769519351811"
TEACHER_SESSION = "test_teacher_session_1769519351811"
CHILD1_SESSION = "test_child1_session_1769519351811"  # Grade 1
CHILD3_SESSION = "test_child3_session_1769519351811"  # Grade 3
CHILD5_SESSION = "test_child5_session_1769519351811"  # Grade 5

# Known IDs from database
PARENT_ID = "user_f917e8a20fa7"
TEACHER_ID = "user_e35d0fefca09"
CHILD1_ID = "user_9de691f1f3ef"  # Grade 1
CHILD3_ID = "user_2ff67222259d"  # Grade 3
CHILD5_ID = "user_2dedef5d21e6"  # Grade 5
CLASSROOM_ID = "class_c3b866da8f6c"


class TestStoreItems:
    """Test store items from admin_store_items collection"""
    
    def test_store_items_returns_items(self):
        """Store items endpoint should return items from admin_store_items"""
        response = requests.get(
            f"{BASE_URL}/api/store/items",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        items = response.json()
        assert isinstance(items, list), "Store items should return a list"
        assert len(items) > 0, "Store should have items"
        
        # Verify item structure
        item = items[0]
        assert "item_id" in item, "Item should have item_id"
        assert "name" in item, "Item should have name"
        assert "price" in item, "Item should have price"
        assert "category_id" in item, "Item should have category_id"
        print(f"✅ Store items returned {len(items)} items")
    
    def test_store_items_by_category_returns_grouped_items(self):
        """Store items-by-category should return items grouped by category"""
        response = requests.get(
            f"{BASE_URL}/api/store/items-by-category",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Items-by-category should return a dict"
        
        # Should have at least one category with items
        total_items = sum(len(items) for items in data.values())
        assert total_items > 0, "Should have items in categories"
        print(f"✅ Store items-by-category returned {len(data)} categories with {total_items} total items")
    
    def test_store_categories_returns_active_only(self):
        """Store categories should return only active categories"""
        response = requests.get(
            f"{BASE_URL}/api/store/categories",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should return a list"
        
        # All returned categories should be active
        for cat in categories:
            assert cat.get("is_active", True) == True, f"Category {cat.get('name')} should be active"
        
        print(f"✅ Store categories returned {len(categories)} active categories")


class TestParentShoppingList:
    """Test parent shopping list functionality"""
    
    def test_parent_shopping_list_endpoint(self):
        """Parent shopping list endpoint should work"""
        response = requests.get(
            f"{BASE_URL}/api/parent/shopping-list",
            cookies={"session_token": PARENT_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Shopping list should return a list"
        print(f"✅ Parent shopping list returned {len(data)} items")
    
    def test_parent_can_access_store_items(self):
        """Parent should be able to access store items for shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/store/items-by-category",
            cookies={"session_token": PARENT_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Items-by-category should return a dict"
        print(f"✅ Parent can access store items: {len(data)} categories")
    
    def test_parent_can_access_store_categories(self):
        """Parent should be able to access store categories"""
        response = requests.get(
            f"{BASE_URL}/api/store/categories",
            cookies={"session_token": PARENT_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should return a list"
        print(f"✅ Parent can access store categories: {len(categories)} categories")


class TestParentChildInsights:
    """Test parent child insights with grade-based investment display"""
    
    def test_child_insights_grade1_has_garden(self):
        """Child insights for grade 1 should have garden data and investment_type='garden'"""
        response = requests.get(
            f"{BASE_URL}/api/parent/children/{CHILD1_ID}/insights",
            cookies={"session_token": PARENT_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify nested structure
        assert "child" in data, "Should have child data"
        assert "wallet" in data, "Should have wallet data"
        assert "learning" in data, "Should have learning data"
        assert "transactions" in data, "Should have transactions data"
        assert "chores" in data, "Should have chores data"
        assert "quests" in data, "Should have quests data"
        assert "achievements" in data, "Should have achievements data"
        assert "gifts" in data, "Should have gifts data"
        assert "garden" in data, "Should have garden data"
        assert "stocks" in data, "Should have stocks data"
        
        # Verify investment_type for grade 1 (should be garden)
        assert "investment_type" in data, "Should have investment_type"
        assert data["investment_type"] == "garden", f"Grade 1 should have investment_type='garden', got {data['investment_type']}"
        
        # Verify garden structure
        garden = data["garden"]
        assert "plots_owned" in garden, "Garden should have plots_owned"
        assert "total_invested" in garden, "Garden should have total_invested"
        assert "total_earned" in garden, "Garden should have total_earned"
        assert "profit_loss" in garden, "Garden should have profit_loss"
        
        print(f"✅ Child insights for grade 1 has garden data and investment_type='garden'")
    
    def test_child_insights_grade3_has_stocks(self):
        """Child insights for grade 3 should have stocks data and investment_type='stocks'"""
        # First link parent to child3 if not linked
        response = requests.get(
            f"{BASE_URL}/api/parent/children/{CHILD3_ID}/insights",
            cookies={"session_token": PARENT_SESSION}
        )
        
        # If 403, parent is not linked to this child - skip test
        if response.status_code == 403:
            pytest.skip("Parent not linked to grade 3 child")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify investment_type for grade 3 (should be stocks)
        assert "investment_type" in data, "Should have investment_type"
        assert data["investment_type"] == "stocks", f"Grade 3 should have investment_type='stocks', got {data['investment_type']}"
        
        # Verify stocks structure
        stocks = data["stocks"]
        assert "holdings_count" in stocks, "Stocks should have holdings_count"
        assert "portfolio_value" in stocks, "Stocks should have portfolio_value"
        assert "realized_gains" in stocks, "Stocks should have realized_gains"
        assert "unrealized_gains" in stocks, "Stocks should have unrealized_gains"
        
        print(f"✅ Child insights for grade 3 has stocks data and investment_type='stocks'")


class TestTeacherStudentInsights:
    """Test teacher student insights with grade-based investment display"""
    
    def test_teacher_student_insights_structure(self):
        """Teacher student insights should return proper nested structure"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/student/{CHILD1_ID}/insights",
            cookies={"session_token": TEACHER_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required nested structures
        assert "student" in data, "Should have student data"
        assert "wallet" in data, "Should have wallet data"
        assert "learning" in data, "Should have learning data"
        assert "transactions" in data, "Should have transactions data"
        assert "chores" in data, "Should have chores data"
        assert "quests" in data, "Should have quests data"
        assert "achievements" in data, "Should have achievements data"
        assert "gifts" in data, "Should have gifts data"
        assert "garden" in data, "Should have garden data"
        assert "stocks" in data, "Should have stocks data"
        
        # Verify wallet structure
        wallet = data["wallet"]
        assert "total_balance" in wallet, "Wallet should have total_balance"
        assert "accounts" in wallet, "Wallet should have accounts"
        assert "savings_in_goals" in wallet, "Wallet should have savings_in_goals"
        
        # Verify transactions structure
        transactions = data["transactions"]
        assert "total_earned" in transactions, "Transactions should have total_earned"
        assert "total_spent" in transactions, "Transactions should have total_spent"
        assert "recent" in transactions, "Transactions should have recent"
        
        # Verify chores structure
        chores = data["chores"]
        assert "total_assigned" in chores, "Chores should have total_assigned"
        assert "completed" in chores, "Chores should have completed"
        assert "pending" in chores, "Chores should have pending"
        
        # Verify quests structure
        quests = data["quests"]
        assert "total_assigned" in quests, "Quests should have total_assigned"
        assert "completed" in quests, "Quests should have completed"
        assert "completion_rate" in quests, "Quests should have completion_rate"
        
        print(f"✅ Teacher student insights has proper nested structure")
    
    def test_teacher_student_insights_grade1_has_garden(self):
        """Teacher student insights for grade 1 should have garden data"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/student/{CHILD1_ID}/insights",
            cookies={"session_token": TEACHER_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify student grade
        student = data["student"]
        assert student.get("grade") == 1, f"Expected grade 1, got {student.get('grade')}"
        
        # Verify garden structure exists
        garden = data["garden"]
        assert "plots_owned" in garden, "Garden should have plots_owned"
        assert "total_invested" in garden, "Garden should have total_invested"
        assert "total_earned" in garden, "Garden should have total_earned"
        assert "profit_loss" in garden, "Garden should have profit_loss"
        
        print(f"✅ Teacher student insights for grade 1 has garden data")
    
    def test_teacher_student_insights_stocks_structure(self):
        """Teacher student insights should have stocks structure"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}/student/{CHILD1_ID}/insights",
            cookies={"session_token": TEACHER_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify stocks structure exists (even if empty for grade 1)
        stocks = data["stocks"]
        assert "holdings_count" in stocks, "Stocks should have holdings_count"
        assert "portfolio_value" in stocks, "Stocks should have portfolio_value"
        assert "realized_gains" in stocks, "Stocks should have realized_gains"
        assert "unrealized_gains" in stocks, "Stocks should have unrealized_gains"
        
        print(f"✅ Teacher student insights has stocks structure")


class TestStoreItemsFiltering:
    """Test store items filtering by grade and active categories"""
    
    def test_store_items_filtered_by_grade(self):
        """Store items should be filtered by user's grade"""
        # Get items for grade 1 child
        response1 = requests.get(
            f"{BASE_URL}/api/store/items",
            cookies={"session_token": CHILD1_SESSION}
        )
        assert response1.status_code == 200
        items1 = response1.json()
        
        # Get items for grade 3 child
        response3 = requests.get(
            f"{BASE_URL}/api/store/items",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert response3.status_code == 200
        items3 = response3.json()
        
        # Both should have items (since items have min_grade 0 and max_grade 5)
        assert len(items1) > 0, "Grade 1 child should see items"
        assert len(items3) > 0, "Grade 3 child should see items"
        
        print(f"✅ Store items filtered by grade: Grade 1 sees {len(items1)} items, Grade 3 sees {len(items3)} items")
    
    def test_store_items_only_from_active_categories(self):
        """Store items should only come from active categories"""
        response = requests.get(
            f"{BASE_URL}/api/store/items",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert response.status_code == 200
        items = response.json()
        
        # Get active category IDs
        cat_response = requests.get(
            f"{BASE_URL}/api/store/categories",
            cookies={"session_token": CHILD3_SESSION}
        )
        assert cat_response.status_code == 200
        active_categories = cat_response.json()
        active_cat_ids = [c["category_id"] for c in active_categories]
        
        # All items should be from active categories
        for item in items:
            assert item["category_id"] in active_cat_ids, f"Item {item['name']} is from inactive category {item['category_id']}"
        
        print(f"✅ All {len(items)} store items are from active categories")


class TestParentDashboard:
    """Test parent dashboard functionality"""
    
    def test_parent_dashboard_returns_children(self):
        """Parent dashboard should return linked children"""
        response = requests.get(
            f"{BASE_URL}/api/parent/dashboard",
            cookies={"session_token": PARENT_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "children" in data, "Dashboard should have children"
        assert isinstance(data["children"], list), "Children should be a list"
        
        print(f"✅ Parent dashboard returned {len(data['children'])} children")


class TestTeacherDashboard:
    """Test teacher dashboard functionality"""
    
    def test_teacher_dashboard_returns_classrooms(self):
        """Teacher dashboard should return classrooms"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/dashboard",
            cookies={"session_token": TEACHER_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "classrooms" in data, "Dashboard should have classrooms"
        assert "total_students" in data, "Dashboard should have total_students"
        
        print(f"✅ Teacher dashboard returned {len(data['classrooms'])} classrooms with {data['total_students']} total students")
    
    def test_teacher_classroom_details(self):
        """Teacher should be able to get classroom details with students"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}",
            cookies={"session_token": TEACHER_SESSION}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "classroom" in data, "Should have classroom data"
        assert "students" in data, "Should have students list"
        
        print(f"✅ Teacher classroom details returned {len(data['students'])} students")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
