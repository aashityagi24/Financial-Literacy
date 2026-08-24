"""
Auto-mapping of a teacher's students to a school (link-existing / bulk / create)
and forward-case when a child joins a classroom whose teacher belongs to a school.

DB schema notes:
- users collection uses `user_id` (not `id`)
- classrooms use `classroom_id` and (optionally) `join_code`
- enrollments live in `classroom_students`
- schools collection uses `school_id`

Cleanup is critical: teacher t_test_1 and the 6 students of demo_classroom_1
MUST end with NO school_id after this suite runs.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://smart-money-learn-5.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

SCHOOL_USERNAME = "springfield"
SCHOOL_PASSWORD = "school123"
SCHOOL_ID = "school_c0bc3d3734b7"
OTHER_SCHOOL_ID = "school_daee554c6477"  # St. Kabir

TEACHER_ID = "t_test_1"
TEACHER_EMAIL = "ttest@t.com"
CLASSROOM_ID = "demo_classroom_1"

DEMO_STUDENT_IDS = [
    "test_child_wallet_demo",
    "test_peer_child",
    "ceafdb6b-5559-43f8-8cee-078b08c1c7a3",
    "50604e17-3caa-44d4-9815-1fea21d8a58b",
    "7ff05e45-6822-45e5-b7f7-9c33554fe5d1",
    "368b8a71-acdf-433b-a9ab-6dbc87c10855",  # Cara G3
]
CARA_ID = "368b8a71-acdf-433b-a9ab-6dbc87c10855"


@pytest.fixture(scope="module")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _clean(db):
    db.users.update_one({"user_id": TEACHER_ID}, {"$unset": {"school_id": ""}})
    db.users.update_many({"user_id": {"$in": DEMO_STUDENT_IDS}}, {"$unset": {"school_id": ""}})


@pytest.fixture(scope="module", autouse=True)
def initial_and_final_cleanup(db):
    _clean(db)
    yield
    _clean(db)


def _school_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/school-login",
               json={"username": SCHOOL_USERNAME, "password": SCHOOL_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"school-login failed: {r.status_code} {r.text}"
    return s


# --------------------- Test 1: link-existing maps 6 students ---------------------
class TestLinkExistingAutoMaps:
    def test_link_existing_maps_all_six(self, db):
        _clean(db)
        s = _school_session()
        r = s.post(f"{BASE_URL}/api/school/users/link-existing",
                   json={"identifier": TEACHER_EMAIL, "user_type": "teacher"},
                   timeout=15)
        assert r.status_code == 200, f"link-existing failed: {r.status_code} {r.text}"
        data = r.json()
        print("link-existing response:", data)
        assert data.get("students_mapped") == 6
        assert data.get("students_skipped") == []

        teacher = db.users.find_one({"user_id": TEACHER_ID})
        assert teacher.get("school_id") == SCHOOL_ID
        for sid in DEMO_STUDENT_IDS:
            u = db.users.find_one({"user_id": sid})
            assert u.get("school_id") == SCHOOL_ID, f"student {sid} not mapped ({u.get('school_id')})"

        # Verify via dashboard
        r2 = s.get(f"{BASE_URL}/api/school/dashboard", timeout=15)
        assert r2.status_code == 200, r2.text
        dash = r2.json()
        # Try several possible keys for students
        candidates = []
        for key in ("students", "children", "child_users", "users"):
            v = dash.get(key)
            if isinstance(v, list):
                candidates = v
                break
        if not candidates:
            # nested structure
            for k, v in dash.items():
                if isinstance(v, dict):
                    for k2, v2 in v.items():
                        if isinstance(v2, list) and v2 and isinstance(v2[0], dict) and ("user_id" in v2[0] or "id" in v2[0]):
                            candidates = v2
                            break
        print(f"dashboard: top-level keys={list(dash.keys())}, students list len={len(candidates)}")
        dash_ids = {(x.get("user_id") or x.get("id")) for x in candidates}
        missing = [sid for sid in DEMO_STUDENT_IDS if sid not in dash_ids]
        assert not missing, f"Missing from dashboard: {missing}"

        _clean(db)
        # Sanity: after cleanup nothing has school_id
        assert db.users.find_one({"user_id": TEACHER_ID}).get("school_id") is None
        for sid in DEMO_STUDENT_IDS:
            assert db.users.find_one({"user_id": sid}).get("school_id") is None


# --------------------- Test 2: skip path (Cara in St. Kabir) ---------------------
class TestSkipPathOtherSchool:
    def test_skip_cara_other_school(self, db):
        _clean(db)
        assert db.schools.find_one({"school_id": OTHER_SCHOOL_ID}) is not None
        db.users.update_one({"user_id": CARA_ID}, {"$set": {"school_id": OTHER_SCHOOL_ID}})

        s = _school_session()
        r = s.post(f"{BASE_URL}/api/school/users/link-existing",
                   json={"identifier": TEACHER_EMAIL, "user_type": "teacher"},
                   timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        print("skip-path response:", data)
        assert data.get("students_mapped") == 5
        skipped = data.get("students_skipped") or []
        assert len(skipped) == 1, f"expected 1 skipped, got {skipped}"
        entry = skipped[0]
        # Confirm Cara flagged with St. Kabir
        name_field = " ".join(str(v) for v in entry.values() if isinstance(v, str))
        assert "Cara" in name_field, f"skipped entry not Cara: {entry}"
        other_val = str(entry.get("other_school") or entry.get("school_name") or "")
        assert "Kabir" in other_val, f"other_school not St. Kabir: {entry}"

        # Cara still in St. Kabir
        assert db.users.find_one({"user_id": CARA_ID}).get("school_id") == OTHER_SCHOOL_ID
        # Other 5 mapped to springfield
        for sid in DEMO_STUDENT_IDS:
            if sid == CARA_ID:
                continue
            assert db.users.find_one({"user_id": sid}).get("school_id") == SCHOOL_ID

        _clean(db)


# --------------------- Test 3: forward join-classroom auto-maps ---------------------
class TestForwardJoinClassroom:
    def test_child_join_classroom_auto_maps(self, db):
        _clean(db)
        # Ensure teacher has Springfield
        db.users.update_one({"user_id": TEACHER_ID}, {"$set": {"school_id": SCHOOL_ID}})

        # Ensure classroom has a join_code we can use (temporary; restore after)
        classroom = db.classrooms.find_one({"classroom_id": CLASSROOM_ID})
        assert classroom, f"classroom {CLASSROOM_ID} not found"
        original_join_code = classroom.get("join_code")
        temp_join_code = original_join_code or f"TEST{uuid.uuid4().hex[:6].upper()}"
        if not original_join_code:
            db.classrooms.update_one({"classroom_id": CLASSROOM_ID},
                                     {"$set": {"join_code": temp_join_code}})
        print(f"join_code used: {temp_join_code}")

        # Find a candidate child with NO school and NOT enrolled in demo_classroom_1
        # AND not enrolled in ANY active classroom (endpoint enforces single-classroom)
        enrolled_ids = {e.get("student_id") for e in db.classroom_students.find(
            {"$or": [{"status": "active"}, {"status": {"$exists": False}}]}
        )}
        candidate = None
        for u in db.users.find({"role": "child"}).limit(500):
            uid = u.get("user_id")
            if not uid or uid in enrolled_ids or u.get("school_id"):
                continue
            candidate = u
            break
        assert candidate, "No candidate child (role=child, no school, no enrollment) found"
        child_id = candidate["user_id"]
        print(f"Candidate child: user_id={child_id} username={candidate.get('username')}")

        # Insert session cookie directly to authenticate as this child
        session_token = f"sess_{uuid.uuid4().hex}"
        db.user_sessions.insert_one({
            "user_id": child_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        created_enrollment_id = None
        try:
            sess = requests.Session()
            sess.cookies.set("session_token", session_token,
                             domain=BASE_URL.split("://", 1)[1].split("/")[0])
            r = sess.post(f"{BASE_URL}/api/student/join-classroom",
                          json={"code": temp_join_code}, timeout=15)
            print(f"join-classroom -> {r.status_code} {r.text[:400]}")
            assert r.status_code == 200, r.text

            # Track enrollment for cleanup
            enr = db.classroom_students.find_one({
                "classroom_id": CLASSROOM_ID, "student_id": child_id
            })
            assert enr, "enrollment not created"
            created_enrollment_id = enr["_id"]

            # Verify child now has SCHOOL_ID
            after = db.users.find_one({"user_id": child_id})
            assert after.get("school_id") == SCHOOL_ID, \
                f"child school_id={after.get('school_id')} != {SCHOOL_ID}"
        finally:
            # Cleanup
            db.user_sessions.delete_one({"session_token": session_token})
            if created_enrollment_id is not None:
                db.classroom_students.delete_one({"_id": created_enrollment_id})
            db.users.update_one({"user_id": child_id}, {"$unset": {"school_id": ""}})
            if not original_join_code:
                db.classrooms.update_one({"classroom_id": CLASSROOM_ID},
                                         {"$unset": {"join_code": ""}})
            _clean(db)
