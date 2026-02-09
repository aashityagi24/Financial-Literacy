"""
Lending & Borrowing Feature Tests
Tests for Parent Dashboard Lending Section and Child Lending Page
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_PARENT_ID = f"test_parent_{uuid.uuid4().hex[:8]}"
TEST_CHILD_ID = f"test_child_{uuid.uuid4().hex[:8]}"
TEST_SESSION_PARENT = f"test_session_parent_{uuid.uuid4().hex[:12]}"
TEST_SESSION_CHILD = f"test_session_child_{uuid.uuid4().hex[:12]}"


class TestLendingSetup:
    """Setup test users for lending tests"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_test_users(self):
        """Create test parent and child users with sessions"""
        import subprocess
        
        # Create test users in MongoDB
        mongo_script = f'''
        use('test_database');
        
        // Create test parent
        db.users.deleteMany({{user_id: {{$regex: /^test_parent_/}}}});
        db.users.deleteMany({{user_id: {{$regex: /^test_child_lending/}}}});
        db.user_sessions.deleteMany({{session_token: {{$regex: /^test_session_/}}}});
        db.loan_requests.deleteMany({{borrower_id: {{$regex: /^test_child_lending/}}}});
        db.loans.deleteMany({{borrower_id: {{$regex: /^test_child_lending/}}}});
        
        db.users.insertOne({{
            user_id: "{TEST_PARENT_ID}",
            email: "test_lending_parent@example.com",
            name: "Test Lending Parent",
            role: "parent",
            grade: 0,
            created_at: new Date()
        }});
        
        // Create test child (grade 4 for lending eligibility)
        db.users.insertOne({{
            user_id: "{TEST_CHILD_ID}",
            email: "test_lending_child@example.com",
            name: "Test Lending Child",
            role: "child",
            grade: 4,
            parent_id: "{TEST_PARENT_ID}",
            created_at: new Date()
        }});
        
        // Create sessions
        db.user_sessions.insertOne({{
            user_id: "{TEST_PARENT_ID}",
            session_token: "{TEST_SESSION_PARENT}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        
        db.user_sessions.insertOne({{
            user_id: "{TEST_CHILD_ID}",
            session_token: "{TEST_SESSION_CHILD}",
            expires_at: new Date(Date.now() + 7*24*60*60*1000),
            created_at: new Date()
        }});
        
        // Create wallet accounts for both
        db.wallet_accounts.deleteMany({{user_id: {{$in: ["{TEST_PARENT_ID}", "{TEST_CHILD_ID}"]}}}});
        db.wallet_accounts.insertOne({{
            account_id: "wallet_parent_test",
            user_id: "{TEST_PARENT_ID}",
            account_type: "spending",
            balance: 5000,
            created_at: new Date()
        }});
        db.wallet_accounts.insertOne({{
            account_id: "wallet_child_test",
            user_id: "{TEST_CHILD_ID}",
            account_type: "spending",
            balance: 100,
            created_at: new Date()
        }});
        
        print("Test users created successfully");
        '''
        
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval', mongo_script],
            capture_output=True, text=True
        )
        print(f"Setup output: {result.stdout}")
        if result.returncode != 0:
            print(f"Setup error: {result.stderr}")
        
        yield
        
        # Cleanup after tests
        cleanup_script = f'''
        use('test_database');
        db.users.deleteMany({{user_id: {{$in: ["{TEST_PARENT_ID}", "{TEST_CHILD_ID}"]}}}});
        db.user_sessions.deleteMany({{session_token: {{$in: ["{TEST_SESSION_PARENT}", "{TEST_SESSION_CHILD}"]}}}});
        db.wallet_accounts.deleteMany({{user_id: {{$in: ["{TEST_PARENT_ID}", "{TEST_CHILD_ID}"]}}}});
        db.loan_requests.deleteMany({{borrower_id: "{TEST_CHILD_ID}"}});
        db.loans.deleteMany({{borrower_id: "{TEST_CHILD_ID}"}});
        print("Test data cleaned up");
        '''
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)


class TestLendingEligibility:
    """Test lending eligibility endpoint"""
    
    def test_child_grade4_eligible(self):
        """Child in grade 4 should be eligible for lending"""
        response = requests.get(
            f"{BASE_URL}/api/lending/eligibility",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["eligible"] == True, f"Grade 4 child should be eligible: {data}"
        assert data["grade"] == 4
        print(f"✅ Child eligibility check passed: {data}")
    
    def test_lending_limits(self):
        """Test lending limits endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/lending/limits",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "max_loan_parent" in data
        assert "max_loan_classmate" in data
        assert data["max_loan_parent"] == 2000
        assert data["max_loan_classmate"] == 500
        print(f"✅ Lending limits check passed: {data}")


class TestCreditScore:
    """Test credit score endpoints"""
    
    def test_get_credit_score(self):
        """Test getting credit score for a user"""
        response = requests.get(
            f"{BASE_URL}/api/lending/credit-score",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "score" in data
        assert "rating" in data
        # New users should have default score of 70
        assert data["score"] == 70, f"Expected default score 70, got {data['score']}"
        print(f"✅ Credit score check passed: {data}")


class TestLoanRequestFlow:
    """Test the complete loan request flow"""
    
    def test_create_loan_request_to_parent(self):
        """Child creates a loan request to parent"""
        return_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/lending/request",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"},
            json={
                "amount": 100,
                "purpose": "Test loan for buying a book",
                "return_date": return_date,
                "interest_amount": 5,
                "recipient_ids": [TEST_PARENT_ID]
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "request_group_id" in data
        assert len(data["requests"]) == 1
        assert data["requests"][0]["lender_id"] == TEST_PARENT_ID
        assert data["requests"][0]["status"] == "pending"
        print(f"✅ Loan request created: {data}")
        return data["requests"][0]["request_id"]
    
    def test_get_sent_requests(self):
        """Child can see their sent loan requests"""
        response = requests.get(
            f"{BASE_URL}/api/lending/requests/sent",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Sent requests retrieved: {len(data)} request groups")
        return data
    
    def test_parent_receives_loan_request(self):
        """Parent can see received loan requests"""
        response = requests.get(
            f"{BASE_URL}/api/lending/requests/received",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one pending request from child
        pending = [r for r in data if r["status"] == "pending" and r["borrower_id"] == TEST_CHILD_ID]
        assert len(pending) >= 1, f"Parent should see pending request from child: {data}"
        print(f"✅ Parent received requests: {len(data)} requests, {len(pending)} pending from test child")
        return pending[0] if pending else None


class TestLoanResponseActions:
    """Test parent response actions: Accept, Reject, Counter"""
    
    @pytest.fixture
    def create_loan_request(self):
        """Create a fresh loan request for testing"""
        return_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/lending/request",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"},
            json={
                "amount": 50,
                "purpose": "Test loan for response testing",
                "return_date": return_date,
                "interest_amount": 2,
                "recipient_ids": [TEST_PARENT_ID]
            }
        )
        assert response.status_code == 200
        return response.json()["requests"][0]["request_id"]
    
    def test_parent_reject_loan(self, create_loan_request):
        """Parent can reject a loan request"""
        request_id = create_loan_request
        
        response = requests.post(
            f"{BASE_URL}/api/lending/requests/{request_id}/respond",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"},
            json={"action": "reject"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rejected" in data["message"].lower()
        print(f"✅ Loan rejection works: {data}")
    
    def test_parent_counter_offer(self, create_loan_request):
        """Parent can make a counter offer"""
        request_id = create_loan_request
        
        counter_return_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/lending/requests/{request_id}/respond",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"},
            json={
                "action": "counter",
                "counter_amount": 40,
                "counter_interest": 5,
                "counter_return_date": counter_return_date,
                "message": "I can lend you less but with more time"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "counter" in data["message"].lower()
        assert "counter_offer" in data
        print(f"✅ Counter offer works: {data}")
    
    def test_parent_accept_loan(self, create_loan_request):
        """Parent can accept a loan request and money is transferred"""
        request_id = create_loan_request
        
        # Get initial balances
        parent_wallet_before = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"}
        ).json()
        
        child_wallet_before = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        ).json()
        
        # Accept the loan
        response = requests.post(
            f"{BASE_URL}/api/lending/requests/{request_id}/respond",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"},
            json={"action": "accept"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "loan" in data
        assert data["loan"]["status"] == "active"
        print(f"✅ Loan acceptance works: {data}")
        
        # Verify money was transferred
        parent_wallet_after = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"}
        ).json()
        
        child_wallet_after = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        ).json()
        
        # Check balance changes (50 was the loan amount)
        print(f"Parent balance: {parent_wallet_before} -> {parent_wallet_after}")
        print(f"Child balance: {child_wallet_before} -> {child_wallet_after}")


class TestLendingSummary:
    """Test lending summary endpoint"""
    
    def test_get_lending_summary(self):
        """Test getting lending summary for a user"""
        response = requests.get(
            f"{BASE_URL}/api/lending/summary",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "credit_score" in data
        assert "borrowing" in data
        assert "lending" in data
        print(f"✅ Lending summary: {data}")


class TestParentChildLoansView:
    """Test parent viewing child's loan activity"""
    
    def test_parent_view_child_loans(self):
        """Parent can view their child's loan activity"""
        response = requests.get(
            f"{BASE_URL}/api/lending/parent/child-loans/{TEST_CHILD_ID}",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "child_name" in data
        assert "credit_score" in data
        assert "borrowed_loans" in data
        assert "lent_loans" in data
        assert "summary" in data
        print(f"✅ Parent can view child loans: {data}")


class TestGetParentsForLending:
    """Test getting parents for lending"""
    
    def test_child_get_parents(self):
        """Child can get their parents for loan requests"""
        response = requests.get(
            f"{BASE_URL}/api/lending/parents",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should include the test parent
        parent_ids = [p["user_id"] for p in data]
        assert TEST_PARENT_ID in parent_ids, f"Test parent should be in list: {data}"
        print(f"✅ Child can get parents: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
