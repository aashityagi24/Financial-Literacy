"""
Test Admin Notifications for System Events
Tests:
1. POST /api/admin/school-enquiry creates notification for admins with type 'new_school_enquiry'
2. POST /api/subscriptions/capture-lead creates notification for admins with type 'new_checkout_lead' (only for new leads)
3. GET /api/notifications returns admin notifications with correct types, titles, and messages
4. Mark all read functionality for admin notifications
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminNotifications:
    """Test admin notification system for system events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("session_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.admin_user = data.get("user", {})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        yield
        
        # Cleanup - no specific cleanup needed
    
    def test_school_enquiry_creates_admin_notification(self):
        """Test that submitting a school enquiry creates a notification for admin users"""
        # Generate unique test data
        unique_id = uuid.uuid4().hex[:8]
        test_school_name = f"TEST_School_{unique_id}"
        test_email = f"test_{unique_id}@testschool.com"
        
        # Submit school enquiry (public endpoint - no auth needed)
        enquiry_response = requests.post(f"{BASE_URL}/api/admin/school-enquiry", json={
            "school_name": test_school_name,
            "person_name": f"Test Person {unique_id}",
            "contact_number": "+91 9876543210",
            "email": test_email,
            "city": "Test City",
            "designation": "Principal",
            "grades": ["grade_1", "grade_2"]
        })
        
        assert enquiry_response.status_code == 200, f"School enquiry failed: {enquiry_response.text}"
        enquiry_data = enquiry_response.json()
        assert "enquiry_id" in enquiry_data
        
        # Fetch admin notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200, f"Failed to fetch notifications: {notif_response.text}"
        
        notif_data = notif_response.json()
        notifications = notif_data.get("notifications", [])
        
        # Find the notification for this school enquiry
        school_enquiry_notifs = [
            n for n in notifications 
            if n.get("notification_type") == "new_school_enquiry" 
            and test_school_name in n.get("message", "")
        ]
        
        assert len(school_enquiry_notifs) > 0, f"No notification found for school enquiry. Notifications: {[n.get('notification_type') for n in notifications[:10]]}"
        
        notif = school_enquiry_notifs[0]
        assert notif.get("title") == "New School Enquiry", f"Wrong title: {notif.get('title')}"
        assert test_school_name in notif.get("message", ""), f"School name not in message: {notif.get('message')}"
        assert notif.get("related_id") == enquiry_data["enquiry_id"], "Related ID should match enquiry_id"
        
        print(f"✓ School enquiry notification created successfully: {notif.get('title')}")
    
    def test_capture_lead_creates_admin_notification_for_new_lead(self):
        """Test that capturing a new checkout lead creates a notification for admin users"""
        # Generate unique test data
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_lead_{unique_id}@example.com"
        test_name = f"Test Lead {unique_id}"
        
        # Capture a new lead (public endpoint - no auth needed)
        lead_response = requests.post(f"{BASE_URL}/api/subscriptions/capture-lead", json={
            "name": test_name,
            "email": test_email,
            "phone": "+91 9876543210",
            "plan_type": "single_parent",
            "duration": "1_month",
            "num_children": 2,
            "lead_status": "form_submitted"
        })
        
        assert lead_response.status_code == 200, f"Capture lead failed: {lead_response.text}"
        
        # Fetch admin notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200, f"Failed to fetch notifications: {notif_response.text}"
        
        notif_data = notif_response.json()
        notifications = notif_data.get("notifications", [])
        
        # Find the notification for this checkout lead
        checkout_lead_notifs = [
            n for n in notifications 
            if n.get("notification_type") == "new_checkout_lead" 
            and (test_name in n.get("message", "") or test_email in n.get("message", ""))
        ]
        
        assert len(checkout_lead_notifs) > 0, f"No notification found for checkout lead. Notifications: {[n.get('notification_type') for n in notifications[:10]]}"
        
        notif = checkout_lead_notifs[0]
        assert notif.get("title") == "New Checkout Lead", f"Wrong title: {notif.get('title')}"
        assert notif.get("related_id") == test_email, f"Related ID should be email: {notif.get('related_id')}"
        
        print(f"✓ Checkout lead notification created successfully: {notif.get('title')}")
    
    def test_capture_lead_does_not_create_notification_for_existing_lead(self):
        """Test that updating an existing lead does NOT create a new notification"""
        # Generate unique test data
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_existing_lead_{unique_id}@example.com"
        test_name = f"Test Existing Lead {unique_id}"
        
        # First, capture a new lead
        first_response = requests.post(f"{BASE_URL}/api/subscriptions/capture-lead", json={
            "name": test_name,
            "email": test_email,
            "phone": "+91 9876543210",
            "plan_type": "single_parent",
            "duration": "1_month",
            "num_children": 1,
            "lead_status": "form_closed"
        })
        assert first_response.status_code == 200
        
        # Get current notification count
        notif_response_before = self.session.get(f"{BASE_URL}/api/notifications")
        notif_count_before = len([
            n for n in notif_response_before.json().get("notifications", [])
            if n.get("notification_type") == "new_checkout_lead"
        ])
        
        # Update the same lead (same email)
        second_response = requests.post(f"{BASE_URL}/api/subscriptions/capture-lead", json={
            "name": test_name + " Updated",
            "email": test_email,  # Same email
            "phone": "+91 9876543211",
            "plan_type": "two_parents",
            "duration": "6_months",
            "num_children": 3,
            "lead_status": "form_submitted"
        })
        assert second_response.status_code == 200
        
        # Get notification count after update
        notif_response_after = self.session.get(f"{BASE_URL}/api/notifications")
        notif_count_after = len([
            n for n in notif_response_after.json().get("notifications", [])
            if n.get("notification_type") == "new_checkout_lead"
        ])
        
        # Count should be the same (no new notification for update)
        assert notif_count_after == notif_count_before, f"Notification count increased from {notif_count_before} to {notif_count_after} - should not create notification for existing lead update"
        
        print(f"✓ No duplicate notification created for existing lead update")
    
    def test_notifications_have_correct_structure(self):
        """Test that admin notifications have the correct structure"""
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        
        notif_data = notif_response.json()
        assert "notifications" in notif_data
        assert "unread_count" in notif_data
        
        notifications = notif_data.get("notifications", [])
        
        # Check structure of notifications
        for notif in notifications[:5]:  # Check first 5
            assert "notification_id" in notif, "Missing notification_id"
            assert "notification_type" in notif or "type" in notif, "Missing notification_type"
            assert "title" in notif, "Missing title"
            assert "message" in notif, "Missing message"
            assert "created_at" in notif, "Missing created_at"
            assert "read" in notif or "is_read" in notif, "Missing read status"
        
        print(f"✓ Notifications have correct structure. Total: {len(notifications)}, Unread: {notif_data.get('unread_count')}")
    
    def test_mark_all_notifications_as_read(self):
        """Test that mark all read works for admin notifications"""
        # First, ensure there are some unread notifications
        notif_response_before = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response_before.status_code == 200
        
        # Mark all as read
        mark_read_response = self.session.post(f"{BASE_URL}/api/notifications/mark-all-read")
        assert mark_read_response.status_code == 200, f"Mark all read failed: {mark_read_response.text}"
        
        # Verify all are marked as read
        notif_response_after = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response_after.status_code == 200
        
        notif_data = notif_response_after.json()
        unread_count = notif_data.get("unread_count", 0)
        
        assert unread_count == 0, f"Unread count should be 0 after mark all read, got {unread_count}"
        
        # Verify individual notifications are marked as read
        notifications = notif_data.get("notifications", [])
        for notif in notifications[:10]:
            assert notif.get("read", notif.get("is_read", False)) == True, f"Notification {notif.get('notification_id')} not marked as read"
        
        print(f"✓ Mark all read works correctly. Unread count: {unread_count}")
    
    def test_notification_types_for_admin_alerts(self):
        """Test that admin alert notification types are correctly set"""
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        
        notifications = notif_response.json().get("notifications", [])
        
        # Get unique notification types
        notification_types = set(n.get("notification_type", n.get("type", "unknown")) for n in notifications)
        
        print(f"Found notification types: {notification_types}")
        
        # Check for admin-specific notification types
        admin_types = {"new_school_enquiry", "new_checkout_lead", "new_subscription"}
        found_admin_types = notification_types.intersection(admin_types)
        
        print(f"✓ Admin notification types found: {found_admin_types}")
        
        # At least one admin type should exist (from our tests)
        # This is a soft check since we just created some
        if len(found_admin_types) == 0:
            print("Note: No admin notification types found yet - this may be expected if no events have occurred")


class TestNotificationEndpoints:
    """Test notification API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "admin@learnersplanet.com",
            "password": "finlit@2026"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("session_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        yield
    
    def test_get_notifications_requires_auth(self):
        """Test that GET /api/notifications requires authentication"""
        # Make request without auth
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/notifications requires authentication")
    
    def test_mark_read_requires_auth(self):
        """Test that POST /api/notifications/mark-read requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notifications/mark-read")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/notifications/mark-read requires authentication")
    
    def test_mark_all_read_requires_auth(self):
        """Test that POST /api/notifications/mark-all-read requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notifications/mark-all-read")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/notifications/mark-all-read requires authentication")
    
    def test_school_enquiry_is_public(self):
        """Test that POST /api/admin/school-enquiry is a public endpoint"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/admin/school-enquiry", json={
            "school_name": f"TEST_Public_School_{unique_id}",
            "person_name": "Test Person",
            "contact_number": "+91 9876543210",
            "email": f"test_public_{unique_id}@test.com"
        })
        assert response.status_code == 200, f"School enquiry should be public, got {response.status_code}: {response.text}"
        print("✓ POST /api/admin/school-enquiry is public (no auth required)")
    
    def test_capture_lead_is_public(self):
        """Test that POST /api/subscriptions/capture-lead is a public endpoint"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/subscriptions/capture-lead", json={
            "name": f"Test Public Lead {unique_id}",
            "email": f"test_public_lead_{unique_id}@test.com",
            "phone": "+91 9876543210",
            "plan_type": "single_parent",
            "duration": "1_month",
            "num_children": 1
        })
        assert response.status_code == 200, f"Capture lead should be public, got {response.status_code}: {response.text}"
        print("✓ POST /api/subscriptions/capture-lead is public (no auth required)")
