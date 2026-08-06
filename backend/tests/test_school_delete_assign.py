"""Tests for iteration 89:
- GET /api/auth/me has_password flag
- PUT /api/auth/change-password (child + revert)
- School dashboard extras (join_code / parents / classrooms)
- School delete teacher keeps student classless
- Assign classless student to a class
- Delete student, delete parent (keeps children)
Cleans up all QA_ data.
"""
import os, uuid, requests, pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

SCHOOL_USER = "springfield"
SCHOOL_PASS = "school123"
TEACHER_USER = "test_teacher_1"
TEACHER_PASS = "testpassword"
CHILD_USER = "classmate_g3"
CHILD_PASS = "testpass123"


def _login(identifier, password):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, r.text
    return s


def _school_login():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/school-login", json={"username": SCHOOL_USER, "password": SCHOOL_PASS})
    assert r.status_code == 200, r.text
    return s


# ---------- has_password + change-password ----------
def test_teacher_has_password_flag():
    s = _login(TEACHER_USER, TEACHER_PASS)
    r = s.get(f"{BASE}/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data.get("has_password") is True, data


def test_child_change_password_and_revert():
    s = _login(CHILD_USER, CHILD_PASS)
    r = s.get(f"{BASE}/api/auth/me")
    assert r.status_code == 200 and r.json().get("has_password") is True

    new_pw = "tempPass_QA_123"
    r = s.put(f"{BASE}/api/auth/change-password",
              json={"current_password": CHILD_PASS, "new_password": new_pw})
    assert r.status_code == 200, r.text

    # verify login works with new
    s2 = _login(CHILD_USER, new_pw)

    # revert
    r = s2.put(f"{BASE}/api/auth/change-password",
               json={"current_password": new_pw, "new_password": CHILD_PASS})
    assert r.status_code == 200, r.text

    # final login works with original
    _login(CHILD_USER, CHILD_PASS)


# ---------- School delete + assign ----------
qa_tag = uuid.uuid4().hex[:6]
QA_TEACHER_EMAIL = f"qa_del_teacher_{qa_tag}@ex.com"
QA_STUDENT_NAME = f"QA_Student_{qa_tag}"
QA_PARENT_EMAIL = f"qa_del_parent_{qa_tag}@ex.com"
QA_CLASS = f"QA_Class_{qa_tag}"
QA_TEACHER2_EMAIL = f"qa_del_teacher2_{qa_tag}@ex.com"
QA_CLASS2 = f"QA_Class2_{qa_tag}"

created_ids = {}


@pytest.fixture(scope="module")
def school_sess():
    return _school_login()


def test_seed_qa_data(school_sess):
    """Create teacher/class/student/parent via unified upload + a second teacher/class for assign."""
    rows = [
        {
            "student_name": QA_STUDENT_NAME, "student_grade": 3,
            "student_username": f"qa_stu_{qa_tag}",
            "student_password": "testpass123",
            "teacher_name": f"QA_Teacher_{qa_tag}", "teacher_email": QA_TEACHER_EMAIL,
            "class_name": QA_CLASS,
            "parent_name": f"QA_Parent_{qa_tag}", "parent_email": QA_PARENT_EMAIL,
        },
        # second teacher & class (with a throwaway student to trigger creation)
        {
            "student_name": f"QA_Filler_{qa_tag}", "student_grade": 3,
            "student_username": f"qa_filler_{qa_tag}",
            "student_password": "testpass123",
            "teacher_name": f"QA_Teacher2_{qa_tag}", "teacher_email": QA_TEACHER2_EMAIL,
            "class_name": QA_CLASS2,
            "parent_name": f"QA_Parent2_{qa_tag}", "parent_email": f"qa_del_parent2_{qa_tag}@ex.com",
        },
    ]
    r = school_sess.post(f"{BASE}/api/school/upload/unified", json={"data": rows})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["teachers_created"] >= 1
    assert body["students_created"] >= 1


def _find_dashboard(school_sess):
    r = school_sess.get(f"{BASE}/api/school/dashboard")
    assert r.status_code == 200, r.text
    return r.json()


def test_dashboard_has_new_fields(school_sess):
    d = _find_dashboard(school_sess)
    assert "parents" in d and isinstance(d["parents"], list)
    assert "classrooms" in d and isinstance(d["classrooms"], list)
    # find our seeded teacher and check join_code
    t = next((t for t in d["teachers"] if t.get("email") == QA_TEACHER_EMAIL), None)
    assert t is not None, "seeded teacher missing"
    assert t.get("join_code"), f"teacher missing join_code: {t}"
    created_ids["teacher_id"] = t["user_id"]

    t2 = next((t for t in d["teachers"] if t.get("email") == QA_TEACHER2_EMAIL), None)
    assert t2 is not None
    created_ids["teacher2_id"] = t2["user_id"]
    # classroom2 id for later assign
    cl2 = next((c for c in d["classrooms"] if c.get("name") == QA_CLASS2), None)
    assert cl2 is not None
    created_ids["classroom2_id"] = cl2["classroom_id"]

    # student
    stu = next((s for s in d["students"] if s.get("username") == f"qa_stu_{qa_tag}"), None)
    assert stu is not None
    assert "in_class" in stu
    created_ids["student_id"] = stu["user_id"]

    # parent
    par = next((p for p in d["parents"] if p.get("email") == QA_PARENT_EMAIL), None)
    assert par is not None
    created_ids["parent_id"] = par["user_id"]


def test_delete_teacher_keeps_student_classless(school_sess):
    tid = created_ids["teacher_id"]
    r = school_sess.delete(f"{BASE}/api/school/users/{tid}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "teacher"
    assert body["classrooms"] >= 1

    # dashboard: teacher gone, student still there and classless
    d = _find_dashboard(school_sess)
    assert not any(t.get("user_id") == tid for t in d["teachers"])
    stu = next((s for s in d["students"] if s.get("user_id") == created_ids["student_id"]), None)
    assert stu is not None, "student should still exist"
    assert not stu.get("in_class"), f"student should be classless: {stu}"


def test_assign_classless_student(school_sess):
    sid = created_ids["student_id"]
    cid = created_ids["classroom2_id"]
    r = school_sess.post(f"{BASE}/api/school/students/{sid}/assign-class",
                         json={"classroom_id": cid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("join_code")

    d = _find_dashboard(school_sess)
    stu = next((s for s in d["students"] if s.get("user_id") == sid), None)
    assert stu and stu.get("in_class"), f"student should be enrolled now: {stu}"


def test_delete_parent_keeps_children(school_sess):
    pid = created_ids["parent_id"]
    sid = created_ids["student_id"]
    r = school_sess.delete(f"{BASE}/api/school/users/{pid}")
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "parent"

    d = _find_dashboard(school_sess)
    assert not any(p.get("user_id") == pid for p in d["parents"])
    assert any(s.get("user_id") == sid for s in d["students"]), "child must remain"


def test_delete_student(school_sess):
    sid = created_ids["student_id"]
    r = school_sess.delete(f"{BASE}/api/school/users/{sid}")
    assert r.status_code == 200
    d = _find_dashboard(school_sess)
    assert not any(s.get("user_id") == sid for s in d["students"])


def test_cleanup_remaining_qa(school_sess):
    """Delete everything with tag qa_tag left over: teacher2, filler student, parent2."""
    d = _find_dashboard(school_sess)
    # delete remaining students with the tag
    for s in d["students"]:
        if qa_tag in (s.get("username") or "") or qa_tag in (s.get("name") or ""):
            school_sess.delete(f"{BASE}/api/school/users/{s['user_id']}")
    d = _find_dashboard(school_sess)
    for t in d["teachers"]:
        if qa_tag in (t.get("email") or ""):
            school_sess.delete(f"{BASE}/api/school/users/{t['user_id']}")
    d = _find_dashboard(school_sess)
    for p in d["parents"]:
        if qa_tag in (p.get("email") or ""):
            school_sess.delete(f"{BASE}/api/school/users/{p['user_id']}")

    # verify
    d = _find_dashboard(school_sess)
    leftover_stu = [s for s in d["students"] if qa_tag in (s.get("username") or "")]
    leftover_tea = [t for t in d["teachers"] if qa_tag in (t.get("email") or "")]
    leftover_par = [p for p in d["parents"] if qa_tag in (p.get("email") or "")]
    assert not leftover_stu and not leftover_tea and not leftover_par, \
        f"leftover QA data: students={leftover_stu} teachers={leftover_tea} parents={leftover_par}"
