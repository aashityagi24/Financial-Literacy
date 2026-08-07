"""Tests for /api/school/upload/unified – one-CSV unified provisioning.

Covers: dedup teachers/parents/classrooms, error handling on bad rows,
generated credentials login (parent+student), subscription grant, and DB
integrity (parent_child_links, classroom_students, school_id on entities).

All test data is prefixed with 'QA_' and cleaned up in module teardown so
the Springfield school returns to its original state.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://savings-goals-test.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

SCHOOL_USERNAME = "springfield"
SCHOOL_PASSWORD = "school123"
SCHOOL_ID = "school_c0bc3d3734b7"

# Unique tag per run so we can identify + cleanup deterministically
TAG = f"QA_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def school_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/school-login",
               json={"username": SCHOOL_USERNAME, "password": SCHOOL_PASSWORD},
               timeout=30)
    assert r.status_code == 200, f"school-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def upload_result(school_session):
    """Perform the unified upload once and share result across tests."""
    t1_email = f"{TAG}_teacher1@qa.test".lower()
    t2_email = f"{TAG}_teacher2@qa.test".lower()
    p1_email = f"{TAG}_parent1@qa.test".lower()
    p2_email = f"{TAG}_parent2@qa.test".lower()
    s2_email = f"{TAG}_studentb@qa.test".lower()
    s3_username = f"{TAG}_studc".lower()
    s3_password = "StudCpass!23"

    rows = [
        # (a) email-less, no username -> auto-generated username + password
        {"student_name": f"{TAG} Kid A", "student_grade": 2,
         "teacher_name": f"{TAG} Teacher1", "teacher_email": t1_email,
         "class_name": f"{TAG}-Class1",
         "parent_name": f"{TAG} Parent1", "parent_email": p1_email,
         "subscription": "active", "subscription_duration": "1_month"},
        # (b) student with email
        {"student_name": f"{TAG} Kid B", "student_grade": 3,
         "student_email": s2_email,
         "teacher_name": f"{TAG} Teacher1", "teacher_email": t1_email,
         "class_name": f"{TAG}-Class1",
         "parent_name": f"{TAG} Parent1", "parent_email": p1_email},
        # (c) explicit username + password
        {"student_name": f"{TAG} Kid C", "student_grade": 4,
         "student_username": s3_username, "student_password": s3_password,
         "teacher_name": f"{TAG} Teacher2", "teacher_email": t2_email,
         "class_name": f"{TAG}-Class2",
         "parent_name": f"{TAG} Parent2", "parent_email": p2_email},
        # (e) bad row: missing teacher_email + parent_email
        {"student_name": f"{TAG} Bad Kid", "student_grade": 1,
         "teacher_name": "NoEmail", "teacher_email": "",
         "class_name": "NoTeacherClass",
         "parent_name": "NoParent", "parent_email": ""},
    ]

    r = school_session.post(f"{BASE_URL}/api/school/upload/unified",
                            json={"data": rows}, timeout=60)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    data = r.json()
    data["_emails"] = {
        "t1": t1_email, "t2": t2_email,
        "p1": p1_email, "p2": p2_email,
        "s2": s2_email, "s3_user": s3_username, "s3_pw": s3_password,
    }
    return data


# ----------------------------- Tests -----------------------------

class TestUnifiedUpload:
    def test_counts(self, upload_result):
        r = upload_result
        # (a)+(b) share teacher1+class1+parent1; (c) has teacher2+class2+parent2
        assert r["students_created"] == 3, r
        assert r["teachers_created"] == 2, r
        assert r["parents_created"] == 2, r
        assert r["classrooms_created"] == 2, r
        assert r["enrollments"] == 3, r
        assert r["parent_links"] == 3, r  # p1->kidA, p1->kidB, p2->kidC
        assert r["subscribed"] == 1, r

    def test_errors_contains_bad_row(self, upload_result):
        errs = upload_result["errors"]
        assert len(errs) == 1, errs
        assert "Row 5" in errs[0]
        assert "teacher_email" in errs[0] and "parent_email" in errs[0]

    def test_credentials_returned(self, upload_result):
        creds = upload_result["credentials"]
        # 2 teachers + 2 parents + 3 students = 7 auto-generated credentials
        assert len(creds) >= 7, creds
        roles = [c["role"] for c in creds]
        assert roles.count("teacher") == 2
        assert roles.count("parent") == 2
        assert roles.count("student") == 3
        for c in creds:
            assert c.get("login") and c.get("password") and c.get("name")

    def test_db_shared_parent_linked_to_both_kids(self, upload_result, mongo):
        p1 = upload_result["_emails"]["p1"]
        parent = mongo.users.find_one({"email": p1})
        assert parent and parent["role"] == "parent"
        assert parent.get("school_id") == SCHOOL_ID
        assert parent.get("password_hash")
        links = list(mongo.parent_child_links.find({"parent_id": parent["user_id"]}))
        assert len(links) == 2, links

    def test_db_teacher_and_classroom(self, upload_result, mongo):
        t1 = upload_result["_emails"]["t1"]
        teacher = mongo.users.find_one({"email": t1})
        assert teacher and teacher["role"] == "teacher"
        assert teacher.get("school_id") == SCHOOL_ID
        assert teacher.get("password_hash")
        cls = mongo.classrooms.find_one({"teacher_id": teacher["user_id"], "name": f"{TAG}-Class1"})
        assert cls, "shared classroom must exist"
        enrolls = list(mongo.classroom_students.find({
            "classroom_id": cls["classroom_id"], "status": "active"
        }))
        assert len(enrolls) == 2, enrolls

    def test_db_students_have_school_and_grade(self, upload_result, mongo):
        s2 = upload_result["_emails"]["s2"]
        stu = mongo.users.find_one({"email": s2})
        assert stu and stu["role"] == "child"
        assert stu.get("school_id") == SCHOOL_ID
        assert stu.get("grade") == 3

        s3_user = upload_result["_emails"]["s3_user"]
        stu3 = mongo.users.find_one({"username": s3_user})
        assert stu3 and stu3.get("school_id") == SCHOOL_ID
        assert stu3.get("grade") == 4

    def test_db_subscription_granted(self, upload_result, mongo):
        p1 = upload_result["_emails"]["p1"]
        sub = mongo.subscriptions.find_one({"subscriber_email": p1, "granted_by_admin": True})
        assert sub, "subscription should be created for parent1"

    def test_generated_parent_can_login(self, upload_result):
        creds = upload_result["credentials"]
        p1 = upload_result["_emails"]["p1"]
        parent_cred = next((c for c in creds if c["role"] == "parent" and c["login"] == p1), None)
        assert parent_cred, "parent1 credentials should be in response"
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": parent_cred["login"],
                                "password": parent_cred["password"]}, timeout=30)
        assert r.status_code == 200, f"parent login failed: {r.status_code} {r.text}"

    def test_generated_student_can_login(self, upload_result):
        # Kid C used explicit username+password
        s3_user = upload_result["_emails"]["s3_user"]
        s3_pw = upload_result["_emails"]["s3_pw"]
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": s3_user, "password": s3_pw}, timeout=30)
        assert r.status_code == 200, f"student login failed: {r.status_code} {r.text}"

    def test_generated_autouser_student_can_login(self, upload_result):
        creds = upload_result["credentials"]
        # Kid A was email-less/username-less -> auto generated
        auto = next((c for c in creds if c["role"] == "student"
                     and c["name"].endswith("Kid A")), None)
        assert auto, "auto-generated student credentials for Kid A should exist"
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": auto["login"],
                                "password": auto["password"]}, timeout=30)
        assert r.status_code == 200, f"auto student login failed: {r.status_code} {r.text}"


# ----------------------------- Cleanup -----------------------------

def teardown_module(module):
    """Remove ALL QA_ data created by this run (users, classrooms, links,
    enrollments, wallets, subscriptions)."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        # Users we created (teachers/parents by email, students by name/email/username)
        user_query = {"$or": [
            {"email": {"$regex": f"^{TAG}", "$options": "i"}},
            {"name": {"$regex": f"^{TAG}"}},
            {"username": {"$regex": f"^{TAG.lower()}"}},
        ]}
        user_ids = [u["user_id"] for u in db.users.find(user_query, {"user_id": 1})]
        if user_ids:
            db.wallet_accounts.delete_many({"user_id": {"$in": user_ids}})
            db.classroom_students.delete_many({"student_id": {"$in": user_ids}})
            db.parent_child_links.delete_many({"$or": [
                {"parent_id": {"$in": user_ids}}, {"child_id": {"$in": user_ids}}]})
            db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
        db.classrooms.delete_many({"name": {"$regex": f"^{TAG}"}})
        db.subscriptions.delete_many({"$or": [
            {"subscriber_email": {"$regex": f"^{TAG}", "$options": "i"}},
            {"parent_emails": {"$regex": f"^{TAG}", "$options": "i"}},
        ]})
        db.users.delete_many(user_query)
        print(f"[cleanup] removed {len(user_ids)} users tagged {TAG}")
    finally:
        client.close()
