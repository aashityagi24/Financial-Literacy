"""
Test suite for My Jobs feature - Family jobs and Payday jobs for children
Tests: Child CRUD, Parent approval/rejection/payment, Admin guidebook management
"""
import pytest
import requests
import os
from datetime import datetime, timezone
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


def make_request(method, url, headers=None, json=None):
    """Helper to make requests with fresh session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    if headers:
        session.headers.update(headers)
    
    if method == "GET":
        return session.get(url, headers=headers, json=json)
    elif method == "POST":
        return session.post(url, headers=headers, json=json)
    elif method == "PUT":
        return session.put(url, headers=headers, json=json)
    elif method == "DELETE":
        return session.delete(url, headers=headers)
    return None


def admin_login():
    """Login as admin and return session token"""
    response = make_request("POST", f"{BASE_URL}/api/auth/admin-login", 
                           json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if response.status_code == 200:
        return response.json().get("session_token")
    return None


def create_test_user(admin_token, name, email, password, role, grade=None):
    """Create a test user via admin API"""
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    response = make_request("POST", f"{BASE_URL}/api/admin/users", 
                           headers=headers,
                           json={"name": name, "email": email, "password": password, "role": role, "grade": grade})
    if response.status_code in [200, 201]:
        return response.json().get("user_id")
    return None


def login_user(identifier, password):
    """Login a user and return session token"""
    response = make_request("POST", f"{BASE_URL}/api/auth/login",
                           json={"identifier": identifier, "password": password})
    if response.status_code == 200:
        return response.json().get("session_token")
    return None


class TestJobsGuidebook:
    """Test Guidebook endpoints"""
    
    def test_get_guidebook_as_admin(self):
        """Test GET /api/jobs/guidebook - Admin can view guidebook"""
        token = admin_login()
        assert token, "Admin login failed"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = make_request("GET", f"{BASE_URL}/api/jobs/guidebook", headers=headers)
        
        assert response.status_code == 200, f"Get guidebook failed: {response.text}"
        data = response.json()
        assert "child_guide" in data or "parent_guide" in data, "Guidebook should have content"
        print(f"✅ GET /api/jobs/guidebook - Admin can view guidebook")
    
    def test_admin_update_guidebook(self):
        """Test PUT /api/admin/jobs/guidebook - Admin updates guidebook"""
        token = admin_login()
        assert token, "Admin login failed"
        
        test_child_guide = f"### Test Child Guide\n\nUpdated at {datetime.now().isoformat()}"
        test_parent_guide = f"### Test Parent Guide\n\nUpdated at {datetime.now().isoformat()}"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = make_request("PUT", f"{BASE_URL}/api/admin/jobs/guidebook",
                               headers=headers,
                               json={"child_guide": test_child_guide, "parent_guide": test_parent_guide})
        
        assert response.status_code == 200, f"Update guidebook failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Guidebook updated", f"Unexpected response: {data}"
        
        # Verify the update
        get_response = make_request("GET", f"{BASE_URL}/api/jobs/guidebook", headers=headers)
        assert get_response.status_code == 200
        guidebook = get_response.json()
        assert "Test Child Guide" in guidebook.get("child_guide", ""), "Child guide not updated"
        print(f"✅ PUT /api/admin/jobs/guidebook - Admin can update guidebook")


class TestChildJobsCRUD:
    """Test Child job creation, retrieval, and deletion"""
    
    @pytest.fixture
    def child_setup(self):
        """Create test child and return token and headers"""
        admin_token = admin_login()
        assert admin_token, "Admin login failed"
        
        suffix = uuid.uuid4().hex[:6]
        email = f"test_child_jobs_{suffix}@example.com"
        user_id = create_test_user(admin_token, f"Test Child {suffix}", email, "testchild123", "child", 2)
        assert user_id, "Failed to create test child"
        
        child_token = login_user(email, "testchild123")
        assert child_token, "Failed to login as child"
        
        return {
            "token": child_token,
            "headers": {"Authorization": f"Bearer {child_token}", "Content-Type": "application/json"},
            "email": email,
            "user_id": user_id
        }
    
    def test_child_create_family_job(self, child_setup):
        """Test POST /api/child/jobs - Child creates a family job"""
        headers = child_setup["headers"]
        
        response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                               headers=headers,
                               json={"job_type": "family", "activity": "Keep my room clean", "frequency": "daily"})
        
        assert response.status_code == 200, f"Create family job failed: {response.text}"
        job = response.json()
        assert job.get("job_type") == "family", f"Wrong job type: {job.get('job_type')}"
        assert job.get("activity") == "Keep my room clean", f"Wrong activity"
        assert job.get("status") == "pending", f"New job should be pending"
        assert job.get("job_id"), "Job should have an ID"
        print(f"✅ POST /api/child/jobs - Child created family job: {job.get('job_id')}")
    
    def test_child_create_payday_job(self, child_setup):
        """Test POST /api/child/jobs - Child creates a payday job"""
        headers = child_setup["headers"]
        
        response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                               headers=headers,
                               json={"job_type": "payday", "activity": "Water the plants", "frequency": "twice_week"})
        
        assert response.status_code == 200, f"Create payday job failed: {response.text}"
        job = response.json()
        assert job.get("job_type") == "payday", f"Wrong job type"
        assert job.get("status") == "pending", f"New job should be pending"
        print(f"✅ POST /api/child/jobs - Child created payday job: {job.get('job_id')}")
    
    def test_child_max_3_jobs_per_type(self, child_setup):
        """Test POST /api/child/jobs - Max 3 jobs per type enforcement"""
        headers = child_setup["headers"]
        
        # Create 3 family jobs
        for i in range(3):
            response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                   headers=headers,
                                   json={"job_type": "family", "activity": f"Family job {i+1}", "frequency": "weekly"})
            assert response.status_code == 200, f"Create job {i+1} failed: {response.text}"
        
        # Try to create 4th family job - should fail
        response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                               headers=headers,
                               json={"job_type": "family", "activity": "Family job 4 - should fail", "frequency": "weekly"})
        
        assert response.status_code == 400, f"4th job should fail: {response.status_code}"
        assert "Maximum 3 family jobs allowed" in response.text, f"Wrong error: {response.text}"
        print(f"✅ POST /api/child/jobs - Max 3 jobs per type enforced")
    
    def test_child_get_jobs(self, child_setup):
        """Test GET /api/child/jobs - Child gets their jobs"""
        headers = child_setup["headers"]
        
        # Create one of each type
        make_request("POST", f"{BASE_URL}/api/child/jobs", headers=headers,
                    json={"job_type": "family", "activity": "Test family", "frequency": "daily"})
        make_request("POST", f"{BASE_URL}/api/child/jobs", headers=headers,
                    json={"job_type": "payday", "activity": "Test payday", "frequency": "weekly"})
        
        # Get jobs
        response = make_request("GET", f"{BASE_URL}/api/child/jobs", headers=headers)
        assert response.status_code == 200, f"Get jobs failed: {response.text}"
        data = response.json()
        
        assert "family_jobs" in data, "Should have family_jobs array"
        assert "payday_jobs" in data, "Should have payday_jobs array"
        assert len(data["family_jobs"]) >= 1, "Should have at least 1 family job"
        assert len(data["payday_jobs"]) >= 1, "Should have at least 1 payday job"
        print(f"✅ GET /api/child/jobs - Family: {len(data['family_jobs'])}, Payday: {len(data['payday_jobs'])}")
    
    def test_child_delete_pending_job(self, child_setup):
        """Test DELETE /api/child/jobs/{job_id} - Child deletes pending job"""
        headers = child_setup["headers"]
        
        # Create a job
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=headers,
                                      json={"job_type": "family", "activity": "To be deleted", "frequency": "daily"})
        job = create_response.json()
        job_id = job.get("job_id")
        
        # Delete it
        delete_response = make_request("DELETE", f"{BASE_URL}/api/child/jobs/{job_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify it's gone
        get_response = make_request("GET", f"{BASE_URL}/api/child/jobs", headers=headers)
        jobs = get_response.json()
        all_job_ids = [j["job_id"] for j in jobs.get("family_jobs", []) + jobs.get("payday_jobs", [])]
        assert job_id not in all_job_ids, "Deleted job should not appear in list"
        print(f"✅ DELETE /api/child/jobs/{job_id} - Job deleted successfully")


class TestParentJobOperations:
    """Test Parent job approval, rejection, and payment"""
    
    @pytest.fixture
    def parent_child_setup(self):
        """Create test parent and child, link them, return tokens"""
        admin_token = admin_login()
        assert admin_token, "Admin login failed"
        
        suffix = uuid.uuid4().hex[:6]
        parent_email = f"test_parent_jobs_{suffix}@example.com"
        child_email = f"test_child_forparent_{suffix}@example.com"
        
        parent_id = create_test_user(admin_token, f"Test Parent {suffix}", parent_email, "testparent123", "parent", None)
        child_id = create_test_user(admin_token, f"Test Child {suffix}", child_email, "testchild123", "child", 2)
        assert parent_id and child_id, "Failed to create test users"
        
        parent_token = login_user(parent_email, "testparent123")
        child_token = login_user(child_email, "testchild123")
        assert parent_token and child_token, "Failed to login users"
        
        parent_headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        child_headers = {"Authorization": f"Bearer {child_token}", "Content-Type": "application/json"}
        
        # Link parent to child
        link_response = make_request("POST", f"{BASE_URL}/api/parent/link-child",
                                    headers=parent_headers,
                                    json={"child_email": child_email})
        assert link_response.status_code in [200, 400], f"Link failed: {link_response.text}"
        
        return {
            "parent_token": parent_token,
            "parent_headers": parent_headers,
            "child_token": child_token,
            "child_headers": child_headers,
            "parent_email": parent_email,
            "child_email": child_email,
            "parent_id": parent_id,
            "child_id": child_id
        }
    
    def test_parent_get_child_jobs(self, parent_child_setup):
        """Test GET /api/parent/child-jobs - Parent gets children's jobs"""
        parent_headers = parent_child_setup["parent_headers"]
        child_headers = parent_child_setup["child_headers"]
        
        # Child creates a job
        make_request("POST", f"{BASE_URL}/api/child/jobs",
                    headers=child_headers,
                    json={"job_type": "payday", "activity": "Parent viewable job", "frequency": "weekly"})
        
        # Parent views jobs
        response = make_request("GET", f"{BASE_URL}/api/parent/child-jobs", headers=parent_headers)
        assert response.status_code == 200, f"Get child jobs failed: {response.text}"
        data = response.json()
        assert "jobs" in data, "Response should have jobs array"
        assert len(data["jobs"]) >= 1, "Should have at least one job"
        print(f"✅ GET /api/parent/child-jobs - Parent sees {len(data.get('jobs', []))} job(s)")
    
    def test_parent_approve_family_job(self, parent_child_setup):
        """Test PUT /api/parent/child-jobs/{job_id}/approve - Parent approves family job"""
        parent_headers = parent_child_setup["parent_headers"]
        child_headers = parent_child_setup["child_headers"]
        
        # Child creates job
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "family", "activity": "Family job to approve", "frequency": "daily"})
        job = create_response.json()
        job_id = job.get("job_id")
        
        # Parent approves (family jobs don't need payment details)
        approve_response = make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/approve",
                                       headers=parent_headers, json={})
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        print(f"✅ PUT /api/parent/child-jobs/{job_id}/approve - Family job approved")
    
    def test_parent_approve_payday_job_with_payment(self, parent_child_setup):
        """Test PUT /api/parent/child-jobs/{job_id}/approve - Parent approves payday job with payment"""
        parent_headers = parent_child_setup["parent_headers"]
        child_headers = parent_child_setup["child_headers"]
        
        # Child creates payday job
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "payday", "activity": "Payday job with payment", "frequency": "weekly"})
        job = create_response.json()
        job_id = job.get("job_id")
        
        # Parent approves with payment details
        approve_response = make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/approve",
                                       headers=parent_headers,
                                       json={"payment_amount": 25, "payment_type": "digital", "reminder_day": "sunday"})
        assert approve_response.status_code == 200, f"Approve with payment failed: {approve_response.text}"
        print(f"✅ PUT /api/parent/child-jobs/{job_id}/approve - Payday job approved with ₹25/week digital")
    
    def test_parent_reject_job(self, parent_child_setup):
        """Test PUT /api/parent/child-jobs/{job_id}/reject - Parent rejects job"""
        parent_headers = parent_child_setup["parent_headers"]
        child_headers = parent_child_setup["child_headers"]
        
        # Child creates job
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "payday", "activity": "Job to reject", "frequency": "weekly"})
        job = create_response.json()
        job_id = job.get("job_id")
        
        # Parent rejects
        reject_response = make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/reject",
                                      headers=parent_headers)
        assert reject_response.status_code == 200, f"Reject failed: {reject_response.text}"
        
        # Verify child can delete rejected job
        delete_response = make_request("DELETE", f"{BASE_URL}/api/child/jobs/{job_id}", headers=child_headers)
        assert delete_response.status_code == 200, "Child should be able to delete rejected job"
        print(f"✅ PUT /api/parent/child-jobs/{job_id}/reject - Job rejected, child can delete")
    
    def test_parent_pay_approved_job(self, parent_child_setup):
        """Test POST /api/parent/child-jobs/{job_id}/pay - Parent pays for approved payday job"""
        parent_headers = parent_child_setup["parent_headers"]
        child_headers = parent_child_setup["child_headers"]
        
        # Child creates payday job
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "payday", "activity": "Job to pay", "frequency": "weekly"})
        job = create_response.json()
        job_id = job.get("job_id")
        
        # Parent approves with payment
        make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/approve",
                    headers=parent_headers,
                    json={"payment_amount": 15, "payment_type": "digital", "reminder_day": "friday"})
        
        # Get child's wallet balance before
        wallet_response = make_request("GET", f"{BASE_URL}/api/wallet", headers=child_headers)
        wallet_before = wallet_response.json()
        spending_before = next((acc["balance"] for acc in wallet_before.get("accounts", []) if acc["account_type"] == "spending"), 0)
        
        # Parent pays
        pay_response = make_request("POST", f"{BASE_URL}/api/parent/child-jobs/{job_id}/pay",
                                   headers=parent_headers)
        assert pay_response.status_code == 200, f"Pay failed: {pay_response.text}"
        pay_data = pay_response.json()
        assert "Payment of ₹15 recorded" in pay_data.get("message", ""), f"Unexpected message: {pay_data}"
        
        # Verify wallet updated for digital payment
        wallet_after = make_request("GET", f"{BASE_URL}/api/wallet", headers=child_headers).json()
        spending_after = next((acc["balance"] for acc in wallet_after.get("accounts", []) if acc["account_type"] == "spending"), 0)
        assert spending_after == spending_before + 15, f"Wallet not updated: {spending_before} -> {spending_after}"
        print(f"✅ POST /api/parent/child-jobs/{job_id}/pay - ₹15 transferred to child's wallet")


class TestJobsErrorCases:
    """Test error cases and edge cases"""
    
    @pytest.fixture
    def error_setup(self):
        """Create test parent and child for error case testing"""
        admin_token = admin_login()
        assert admin_token, "Admin login failed"
        
        suffix = uuid.uuid4().hex[:6]
        parent_email = f"test_parent_err_{suffix}@example.com"
        child_email = f"test_child_err_{suffix}@example.com"
        
        create_test_user(admin_token, f"Test Parent {suffix}", parent_email, "testparent123", "parent", None)
        create_test_user(admin_token, f"Test Child {suffix}", child_email, "testchild123", "child", 2)
        
        parent_token = login_user(parent_email, "testparent123")
        child_token = login_user(child_email, "testchild123")
        
        parent_headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        child_headers = {"Authorization": f"Bearer {child_token}", "Content-Type": "application/json"}
        
        # Link
        make_request("POST", f"{BASE_URL}/api/parent/link-child", headers=parent_headers, json={"child_email": child_email})
        
        return {"parent_headers": parent_headers, "child_headers": child_headers}
    
    def test_child_cannot_delete_approved_job(self, error_setup):
        """Test DELETE /api/child/jobs/{job_id} - Cannot delete approved job"""
        parent_headers = error_setup["parent_headers"]
        child_headers = error_setup["child_headers"]
        
        # Child creates and parent approves
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "family", "activity": "Approved - no delete", "frequency": "daily"})
        job_id = create_response.json().get("job_id")
        
        make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/approve", headers=parent_headers, json={})
        
        # Child tries to delete approved job
        delete_response = make_request("DELETE", f"{BASE_URL}/api/child/jobs/{job_id}", headers=child_headers)
        assert delete_response.status_code == 400, f"Should fail: {delete_response.status_code} - {delete_response.text}"
        assert "pending or rejected" in delete_response.text.lower(), f"Wrong error: {delete_response.text}"
        print(f"✅ DELETE /api/child/jobs - Cannot delete approved job (as expected)")
    
    def test_payday_job_requires_positive_payment(self, error_setup):
        """Test PUT /api/parent/child-jobs/{job_id}/approve - Payday needs positive payment"""
        parent_headers = error_setup["parent_headers"]
        child_headers = error_setup["child_headers"]
        
        create_response = make_request("POST", f"{BASE_URL}/api/child/jobs",
                                      headers=child_headers,
                                      json={"job_type": "payday", "activity": "Zero payment test", "frequency": "weekly"})
        job_id = create_response.json().get("job_id")
        
        # Try to approve with 0 payment
        approve_response = make_request("PUT", f"{BASE_URL}/api/parent/child-jobs/{job_id}/approve",
                                       headers=parent_headers,
                                       json={"payment_amount": 0, "payment_type": "digital", "reminder_day": "sunday"})
        assert approve_response.status_code == 400, f"Should fail with 0 payment: {approve_response.status_code}"
        assert "positive" in approve_response.text.lower(), f"Wrong error: {approve_response.text}"
        print(f"✅ PUT approve - Payday job requires positive payment amount")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
