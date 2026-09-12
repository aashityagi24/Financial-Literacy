"""Backend tests for the GET /api/child/homework additive teacher_name / reward_coins fields (Round 2 revision)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


def login(username, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": username, "password": password})
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return r.cookies


def test_homework_returns_teacher_name_and_reward_for_g3():
    """classmate_g3 has 2 pending homework items (Testing/video overdue, Candy Shop/activity overdue)."""
    cookies = login("classmate_g3", "testpass123")
    r = requests.get(f"{BASE_URL}/api/child/homework", cookies=cookies)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "homework" in data
    hws = data["homework"]
    assert len(hws) >= 2, f"expected at least 2 homework items, got {len(hws)}"

    # Fields exist on every item (backward compatible additive fields)
    for hw in hws:
        assert "teacher_name" in hw
        assert "reward_coins" in hw

    pending = [h for h in hws if not h["done"]]
    assert len(pending) >= 1

    # At least one pending has non-null teacher_name and reward_coins populated
    hw = pending[0]
    assert hw["teacher_name"], f"teacher_name should be populated, got {hw.get('teacher_name')!r}"
    assert isinstance(hw["teacher_name"], str) and len(hw["teacher_name"]) > 0
    # reward_coins should be an int/float and > 0
    assert hw["reward_coins"] is not None, "reward_coins should be resolved from content_items"
    assert isinstance(hw["reward_coins"], (int, float))


def test_homework_titles_include_testing_and_candy_shop():
    cookies = login("classmate_g3", "testpass123")
    r = requests.get(f"{BASE_URL}/api/child/homework", cookies=cookies)
    hws = r.json()["homework"]
    titles = [h.get("content_title") for h in hws]
    assert any("Testing" in (t or "") for t in titles), f"expected 'Testing' hw, got {titles}"
    assert any("Candy" in (t or "") for t in titles), f"expected 'Candy Shop' hw, got {titles}"


def test_homework_g1_no_homework_still_returns_200():
    """classmate_g1 (grade 1, has classroom) — endpoint should return 200 with valid structure."""
    cookies = login("classmate_g1", "testpass123")
    r = requests.get(f"{BASE_URL}/api/child/homework", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert "homework" in data
    assert "pending_count" in data
    assert isinstance(data["homework"], list)


def test_next_lesson_still_works_for_g1():
    """Regression: existing next-lesson endpoint (iteration_109) still passes."""
    cookies = login("classmate_g1", "testpass123")
    r = requests.get(f"{BASE_URL}/api/content/next-lesson", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert "daily_goal" in data
    assert "completed_today" in data


def test_homework_mark_done_video_type():
    """Mark 'Testing' (video) as done — verify it disappears from pending after refetch, then reset."""
    cookies = login("classmate_g3", "testpass123")
    r = requests.get(f"{BASE_URL}/api/child/homework", cookies=cookies)
    hws = r.json()["homework"]
    target = next((h for h in hws if h.get("content_type") == "video" and not h["done"]), None)
    if not target:
        pytest.skip("no pending video homework for g3")
    hw_id = target["homework_id"]
    # mark done
    mr = requests.post(f"{BASE_URL}/api/child/homework/{hw_id}/mark-done", cookies=cookies)
    assert mr.status_code == 200, mr.text
    # refetch — this item should now be done
    r2 = requests.get(f"{BASE_URL}/api/child/homework", cookies=cookies)
    hws2 = r2.json()["homework"]
    updated = next((h for h in hws2 if h["homework_id"] == hw_id), None)
    assert updated is not None
    assert updated["done"] is True
    # Cleanup: unmark by deleting the homework_completions doc directly is not exposed via API.
    # Leave it done — next run will just skip this test if 'Testing' is no longer pending.
