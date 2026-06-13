"""
Backend tests for:
1) New content type 'know_it_sheet' (create + switch type via PUT)
2) Grade-scoped content move - verifies grade_parents persistence and
   content_count behavior across grades on /api/content/topics
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@learnersplanet.com"
ADMIN_PASSWORD = "finlit@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/admin-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin-login failed: {r.status_code} {r.text}"
    token = r.json().get("session_token") or r.json().get("token") or r.json().get("access_token")
    assert token, f"No token in response: {r.json()}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def parent_token():
    """Parent users get the public /api/content/topics?grade=N grade filter applied.
    Admin users get filter_grade=None so they cannot validate grade-scoped counts.
    """
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": "wallet_demo_parent", "password": "testpass123"},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"parent login failed: {r.status_code} {r.text}")
    token = r.json().get("session_token") or r.json().get("token")
    if not token:
        pytest.skip(f"No token in parent login response: {r.json()}")
    return token


@pytest.fixture(scope="module")
def parent_headers(parent_token):
    return {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def two_subtopics(admin_headers):
    """Find two subtopics under same parent that both support grade 1 and 2.
    Prefer ones with content so we can verify decrement on the source side."""
    r = requests.get(f"{BASE_URL}/api/admin/content/topics", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    topics = r.json()

    def supports(sub, g):
        return sub.get("min_grade", 0) <= g <= sub.get("max_grade", 5)

    best = None  # (parent, subA, subB)
    for t in topics:
        subs = [s for s in (t.get("subtopics") or []) if supports(s, 1) and supports(s, 2)]
        if len(subs) >= 2:
            with_content = [s for s in subs if s.get("content_count", 0) > 0]
            without = [s for s in subs if s.get("content_count", 0) == 0]
            if with_content and without:
                return t, with_content[0], without[0]
            if best is None:
                best = (t, subs[0], subs[1])
    if best:
        return best
    pytest.skip("No topic with 2 subtopics supporting grades 1 & 2")


# --- Tests for know_it_sheet content type ---

class TestKnowItSheetType:
    def test_create_know_it_sheet_persists(self, admin_headers, two_subtopics):
        _, subA, _ = two_subtopics
        payload = {
            "topic_id": subA["topic_id"],
            "title": "TEST_KnowItSheet_Item",
            "description": "TEST know-it-sheet creation",
            "content_type": "know_it_sheet",
            "content_data": {"pdf_url": "https://example.com/test.pdf"},
            "visible_to": ["child"],
            "min_grade": 0,
            "max_grade": 5,
            "is_published": True,
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/content/items", headers=admin_headers, json=payload, timeout=20
        )
        assert r.status_code in (200, 201), r.text
        content_id = r.json().get("content_id")
        assert content_id

        # Verify via admin GET
        r2 = requests.get(
            f"{BASE_URL}/api/admin/content/items?topic_id={subA['topic_id']}",
            headers=admin_headers,
            timeout=20,
        )
        assert r2.status_code == 200
        items = r2.json()
        match = next((i for i in items if i.get("content_id") == content_id), None)
        assert match is not None, "Newly created know_it_sheet not found"
        assert match.get("content_type") == "know_it_sheet"

        # cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/content/items/{content_id}", headers=admin_headers, timeout=20
        )

    def test_switch_content_type_round_trip(self, admin_headers, two_subtopics):
        _, subA, _ = two_subtopics
        # create as worksheet
        r = requests.post(
            f"{BASE_URL}/api/admin/content/items",
            headers=admin_headers,
            json={
                "topic_id": subA["topic_id"],
                "title": "TEST_TypeSwitch_Item",
                "content_type": "worksheet",
                "content_data": {"pdf_url": "https://example.com/ws.pdf"},
                "visible_to": ["child"],
                "is_published": True,
            },
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        content_id = r.json().get("content_id")

        def _current_type():
            rr = requests.get(
                f"{BASE_URL}/api/admin/content/items?topic_id={subA['topic_id']}",
                headers=admin_headers,
                timeout=20,
            )
            assert rr.status_code == 200
            it = next((i for i in rr.json() if i.get("content_id") == content_id), None)
            assert it is not None, "Item disappeared"
            return it.get("content_type")

        for new_type in ["know_it_sheet", "workbook", "worksheet"]:
            rr = requests.put(
                f"{BASE_URL}/api/admin/content/items/{content_id}",
                headers=admin_headers,
                json={"content_type": new_type},
                timeout=20,
            )
            assert rr.status_code == 200, f"PUT failed -> {new_type}: {rr.text}"
            assert _current_type() == new_type, f"Type did not switch to {new_type}"

        # cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/content/items/{content_id}", headers=admin_headers, timeout=20
        )


# --- Tests for grade-scoped move + counts ---

class TestGradeScopedMoveCounts:
    def _get_subtopic_count(self, headers, parent_topic_id, subtopic_id, grade):
        """Read public /api/content/topics?grade=X (as parent) and return content_count for subtopic."""
        r = requests.get(
            f"{BASE_URL}/api/content/topics?grade={grade}",
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        topics = r.json()
        parent = next((t for t in topics if t.get("topic_id") == parent_topic_id), None)
        if parent is None:
            return None
        sub = next(
            (s for s in (parent.get("subtopics") or []) if s.get("topic_id") == subtopic_id),
            None,
        )
        return sub.get("content_count") if sub else None

    def test_grade_scoped_move_persists_and_counts_update(self, admin_headers, parent_headers, two_subtopics):
        parent, subA, subB = two_subtopics

        # Create a fresh content item in subA so initial counts are predictable
        cr = requests.post(
            f"{BASE_URL}/api/admin/content/items",
            headers=admin_headers,
            json={
                "topic_id": subA["topic_id"],
                "title": "TEST_GradeMove_Item",
                "content_type": "worksheet",
                "content_data": {"pdf_url": "https://example.com/gm.pdf"},
                "visible_to": ["child"],
                "min_grade": 0,
                "max_grade": 5,
                "is_published": True,
            },
            timeout=20,
        )
        assert cr.status_code in (200, 201), cr.text
        content_id = cr.json()["content_id"]

        try:
            # Baseline counts for grade=1 and grade=2 (queried via parent token)
            a_before_g1 = self._get_subtopic_count(parent_headers, parent["topic_id"], subA["topic_id"], 1) or 0
            b_before_g1 = self._get_subtopic_count(parent_headers, parent["topic_id"], subB["topic_id"], 1) or 0
            a_before_g2 = self._get_subtopic_count(parent_headers, parent["topic_id"], subA["topic_id"], 2) or 0
            b_before_g2 = self._get_subtopic_count(parent_headers, parent["topic_id"], subB["topic_id"], 2) or 0

            # Move content for grade 1 only
            mr = requests.post(
                f"{BASE_URL}/api/admin/content/items/{content_id}/move",
                headers=admin_headers,
                json={"new_topic_id": subB["topic_id"], "grade": "1"},
                timeout=20,
            )
            assert mr.status_code == 200, mr.text

            # Verify db state via admin GET (item itself)
            ir = requests.get(
                f"{BASE_URL}/api/admin/content/items?topic_id={subA['topic_id']}",
                headers=admin_headers,
                timeout=20,
            )
            assert ir.status_code == 200
            # The item should still have topic_id == subA (global), but grade_parents.1 == subB
            # admin endpoint filters by topic_id == subA so it should still appear there
            item = next((i for i in ir.json() if i.get("content_id") == content_id), None)
            assert item is not None, "Item not found under original topic"
            assert item.get("topic_id") == subA["topic_id"], "Global topic_id should remain unchanged"
            gp = item.get("grade_parents") or {}
            assert gp.get("1") == subB["topic_id"], f"grade_parents.1 not set correctly: {gp}"

            # Verify counts on grade=1: A decreased by 1, B increased by 1
            a_after_g1 = self._get_subtopic_count(parent_headers, parent["topic_id"], subA["topic_id"], 1) or 0
            b_after_g1 = self._get_subtopic_count(parent_headers, parent["topic_id"], subB["topic_id"], 1) or 0
            assert a_after_g1 == a_before_g1 - 1, (
                f"Source subtopic count for grade 1 did not decrement: "
                f"before={a_before_g1} after={a_after_g1}"
            )
            assert b_after_g1 == b_before_g1 + 1, (
                f"Dest subtopic count for grade 1 did not increment: "
                f"before={b_before_g1} after={b_after_g1}"
            )

            # Verify other grades unaffected — grade=2 counts unchanged
            a_after_g2 = self._get_subtopic_count(parent_headers, parent["topic_id"], subA["topic_id"], 2) or 0
            b_after_g2 = self._get_subtopic_count(parent_headers, parent["topic_id"], subB["topic_id"], 2) or 0
            assert a_after_g2 == a_before_g2, (
                f"Grade 2 count for source unexpectedly changed: {a_before_g2} -> {a_after_g2}"
            )
            assert b_after_g2 == b_before_g2, (
                f"Grade 2 count for dest unexpectedly changed: {b_before_g2} -> {b_after_g2}"
            )
        finally:
            requests.delete(
                f"{BASE_URL}/api/admin/content/items/{content_id}",
                headers=admin_headers,
                timeout=20,
            )
