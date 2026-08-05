"""Backend tests for teacher classroom delete + quest archive/unarchive flow.
Validates:
- Teacher DELETE classroom => 403 with admin message
- Archive/unarchive endpoints work and list filter respects ?archived=
- Student quest visibility unaffected by teacher-side archiving
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TEACHER_CREDS = {"identifier": "test_teacher_1", "password": "testpassword"}
STUDENT_CREDS = {"identifier": "classmate_g3", "password": "testpass123"}
CLASSROOM_ID = "demo_classroom_1"
QUEST_ID = "quest_media_test_001"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("token") or data.get("access_token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def teacher_headers():
    return {"Authorization": f"Bearer {_login(TEACHER_CREDS)}"}


@pytest.fixture(scope="module")
def student_headers():
    return {"Authorization": f"Bearer {_login(STUDENT_CREDS)}"}


# --- Delete classroom must be forbidden ---
class TestTeacherCannotDeleteClassroom:
    def test_delete_classroom_returns_403(self, teacher_headers):
        r = requests.delete(
            f"{BASE_URL}/api/teacher/classrooms/{CLASSROOM_ID}",
            headers=teacher_headers, timeout=20,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "admin" in body or "school" in body, f"missing admin message: {r.text}"

    def test_delete_nonexistent_classroom_also_403(self, teacher_headers):
        r = requests.delete(
            f"{BASE_URL}/api/teacher/classrooms/nonexistent_xyz",
            headers=teacher_headers, timeout=20,
        )
        assert r.status_code == 403


# --- Archive flow ---
class TestQuestArchiveFlow:
    def test_active_list_contains_quest(self, teacher_headers):
        r = requests.get(f"{BASE_URL}/api/teacher/quests?archived=false",
                         headers=teacher_headers, timeout=20)
        assert r.status_code == 200
        quests = r.json() if isinstance(r.json(), list) else r.json().get("quests", [])
        ids = [q.get("id") or q.get("quest_id") for q in quests]
        assert QUEST_ID in ids, f"quest {QUEST_ID} not in active list: {ids}"

    def test_archive_quest(self, teacher_headers):
        r = requests.post(f"{BASE_URL}/api/teacher/quests/{QUEST_ID}/archive",
                          headers=teacher_headers, timeout=20)
        assert r.status_code in (200, 201), f"archive failed: {r.status_code} {r.text}"

    def test_archived_absent_from_active_list(self, teacher_headers):
        r = requests.get(f"{BASE_URL}/api/teacher/quests?archived=false",
                         headers=teacher_headers, timeout=20)
        assert r.status_code == 200
        quests = r.json() if isinstance(r.json(), list) else r.json().get("quests", [])
        ids = [q.get("id") or q.get("quest_id") for q in quests]
        assert QUEST_ID not in ids, "archived quest still shown in active list"

    def test_archived_present_in_archived_list(self, teacher_headers):
        r = requests.get(f"{BASE_URL}/api/teacher/quests?archived=true",
                         headers=teacher_headers, timeout=20)
        assert r.status_code == 200
        quests = r.json() if isinstance(r.json(), list) else r.json().get("quests", [])
        ids = [q.get("id") or q.get("quest_id") for q in quests]
        assert QUEST_ID in ids, f"quest not in archived list: {ids}"

    def test_student_still_sees_quest_after_archive(self, student_headers):
        # Try both endpoints per spec
        found = False
        for path in ["/api/child/quests", "/api/quests-new"]:
            r = requests.get(f"{BASE_URL}{path}", headers=student_headers, timeout=20)
            if r.status_code != 200:
                continue
            data = r.json()
            quests = data if isinstance(data, list) else (
                data.get("quests") or data.get("active") or data.get("available") or []
            )
            # Some responses may nest active/completed
            if isinstance(data, dict):
                for k in ("active", "available", "completed", "quests"):
                    v = data.get(k)
                    if isinstance(v, list):
                        quests = quests + v if quests is not v else v
            ids = [q.get("id") or q.get("quest_id") for q in quests if isinstance(q, dict)]
            print(f"student {path} -> ids: {ids}")
            if QUEST_ID in ids:
                found = True
                break
        assert found, "Student can no longer see archived quest - archiving should NOT affect students"

    def test_unarchive_quest(self, teacher_headers):
        r = requests.post(f"{BASE_URL}/api/teacher/quests/{QUEST_ID}/unarchive",
                          headers=teacher_headers, timeout=20)
        assert r.status_code in (200, 201), f"unarchive failed: {r.status_code} {r.text}"

    def test_active_list_contains_quest_after_unarchive(self, teacher_headers):
        r = requests.get(f"{BASE_URL}/api/teacher/quests?archived=false",
                         headers=teacher_headers, timeout=20)
        assert r.status_code == 200
        quests = r.json() if isinstance(r.json(), list) else r.json().get("quests", [])
        ids = [q.get("id") or q.get("quest_id") for q in quests]
        assert QUEST_ID in ids, "quest not restored after unarchive"
