"""
Lending & Borrowing Feature Tests - Final Version
Tests for Parent Dashboard Lending Section and Child Lending Page
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use existing test users
TEST_PARENT_ID = "test_lending_parent_001"
TEST_CHILD_ID = "test_lending_child_001"
TEST_SESSION_PARENT = "test_lending_session_parent_001"
TEST_SESSION_CHILD = "test_lending_session_child_001"


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
    
    def test_get_parents_for_lending(self):
        """Child can get their parents for loan requests"""
        response = requests.get(
            f"{BASE_URL}/api/lending/parents",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        parent_ids = [p["user_id"] for p in data]
        assert TEST_PARENT_ID in parent_ids, f"Test parent should be in list: {data}"
        print(f"✅ Child can get parents: {len(data)} parent(s)")
    
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
        print(f"✅ Loan request created: {data['requests'][0]['request_id']}")
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


class TestLoanResponseActions:
    """Test parent response actions: Accept, Reject, Counter"""
    
    def test_parent_reject_loan(self):
        """Parent can reject a loan request"""
        # Create a new loan request
        return_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/lending/request",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"},
            json={
                "amount": 50,
                "purpose": "Test loan for reject action",
                "return_date": return_date,
                "interest_amount": 2,
                "recipient_ids": [TEST_PARENT_ID]
            }
        )
        assert create_response.status_code == 200
        request_id = create_response.json()["requests"][0]["request_id"]
        
        # Reject the loan
        response = requests.post(
            f"{BASE_URL}/api/lending/requests/{request_id}/respond",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"},
            json={"action": "reject"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rejected" in data["message"].lower()
        print(f"✅ Loan rejection works: {data}")
    
    def test_parent_counter_offer(self):
        """Parent can make a counter offer"""
        # Create a new loan request
        return_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/lending/request",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"},
            json={
                "amount": 75,
                "purpose": "Test loan for counter action",
                "return_date": return_date,
                "interest_amount": 3,
                "recipient_ids": [TEST_PARENT_ID]
            }
        )
        assert create_response.status_code == 200
        request_id = create_response.json()["requests"][0]["request_id"]
        
        # Make counter offer
        counter_return_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/lending/requests/{request_id}/respond",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"},
            json={
                "action": "counter",
                "counter_amount": 50,
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
    
    def test_parent_accept_loan(self):
        """Parent can accept a loan request and money is transferred"""
        # Create a new loan request
        return_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/lending/request",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"},
            json={
                "amount": 25,
                "purpose": "Test loan for accept action",
                "return_date": return_date,
                "interest_amount": 1,
                "recipient_ids": [TEST_PARENT_ID]
            }
        )
        assert create_response.status_code == 200
        request_id = create_response.json()["requests"][0]["request_id"]
        
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
        print(f"✅ Loan acceptance works: loan_id={data['loan']['loan_id']}")


class TestBorrowingLoans:
    """Test borrowing loans endpoint"""
    
    def test_get_borrowing_loans(self):
        """Child can see their borrowed loans"""
        response = requests.get(
            f"{BASE_URL}/api/lending/loans/borrowing",
            headers={"Authorization": f"Bearer {TEST_SESSION_CHILD}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one active loan
        active_loans = [l for l in data if l["status"] == "active"]
        assert len(active_loans) >= 1, f"Should have at least one active loan: {data}"
        # Check that days_until_due is calculated
        for loan in active_loans:
            assert "days_until_due" in loan
            assert "is_overdue" in loan
        print(f"✅ Borrowing loans retrieved: {len(data)} loans, {len(active_loans)} active")


class TestLendingLoans:
    """Test lending loans endpoint"""
    
    def test_get_lending_loans(self):
        """Parent can see their lent loans"""
        response = requests.get(
            f"{BASE_URL}/api/lending/loans/lending",
            headers={"Authorization": f"Bearer {TEST_SESSION_PARENT}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Lending loans retrieved: {len(data)} loans")


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
        print(f"✅ Lending summary: credit_score={data['credit_score']}, borrowing={data['borrowing']}")


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
        print(f"✅ Parent can view child loans: {data['child_name']}, credit_score={data['credit_score']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
