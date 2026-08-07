"""Tests for the My Wallet child endpoints incl. Save/Give buckets, pagination, breakdown, parent view."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def child_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": "wallet_demo_child", "password": "testpass123"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def child_client(child_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {child_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def parent_client():
    r = requests.post(f"{API}/auth/login", json={"identifier": "wallet_demo_parent", "password": "testpass123"})
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s, r.json().get("user", {})


# GET /wallet/my-wallet — structure includes new keys
def test_get_my_wallet_structure(child_client):
    r = child_client.get(f"{API}/wallet/my-wallet")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("balance", "total_in", "total_out", "month_in", "month_out",
              "breakdown", "entries", "page", "total_pages", "total_entries", "page_size"):
        assert k in data, f"missing {k}"
    assert set(data["breakdown"].keys()) == {"spend", "save", "give"}
    for b in ("spend", "save", "give"):
        assert "total" in data["breakdown"][b]
        assert "categories" in data["breakdown"][b]
    assert isinstance(data["entries"], list)


# Overspend rejection with specific message
def test_overspend_rejected(child_client):
    bal = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": bal + 10000, "category": "toys"})
    assert r.status_code == 400
    assert "don't have that much" in r.json().get("detail", "").lower() or "wallet" in r.json().get("detail", "").lower()


def test_zero_amount_rejected(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 0, "category": "toys"})
    assert r.status_code == 400


def test_invalid_entry_type(child_client):
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "bogus", "amount": 10, "category": "toys"})
    assert r.status_code == 400


# Income increases balance
def test_income_increases_balance(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()["balance"]
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "income", "amount": 60, "category": "cash", "note": "TEST_income"})
    assert r.status_code == 200, r.text
    after = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(after["balance"] - before, 2) == 60.0
    top = after["entries"][0]
    assert top["direction"] == "in"
    assert top["is_manual"] is True


# Spend decreases balance and updates spend breakdown
def test_spend_updates_breakdown(child_client):
    before = child_client.get(f"{API}/wallet/my-wallet").json()
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 10, "category": "toys", "note": "TEST_spend"})
    assert r.status_code == 200, r.text
    after = child_client.get(f"{API}/wallet/my-wallet").json()
    assert round(before["balance"] - after["balance"], 2) == 10.0
    # Spend bucket total went up by 10
    assert round(after["breakdown"]["spend"]["total"] - before["breakdown"]["spend"]["total"], 2) == 10.0
    # toys category present in spend breakdown
    cats = {c["category"]: c["amount"] for c in after["breakdown"]["spend"]["categories"]}
    assert "toys" in cats


# Save moves my_wallet -> savings and appears in save breakdown
def test_save_moves_to_savings_and_breakdown(child_client):
    wallet_before = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_before = child_client.get(f"{API}/wallet").json().get("accounts", [])
    piggy_before = next((a for a in accounts_before if a["account_type"] == "savings"), {}).get("balance", 0.0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 20, "category": "goal", "note": "TEST_save"})
    assert r.status_code == 200, r.text

    wallet_after = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_after = child_client.get(f"{API}/wallet").json().get("accounts", [])
    piggy_after = next((a for a in accounts_after if a["account_type"] == "savings"), {}).get("balance", 0.0)

    assert round(wallet_before["balance"] - wallet_after["balance"], 2) == 20.0
    assert round(piggy_after - piggy_before, 2) == 20.0
    assert round(wallet_after["breakdown"]["save"]["total"] - wallet_before["breakdown"]["save"]["total"], 2) == 20.0
    top = wallet_after["entries"][0]
    assert top["bucket"] == "save"
    assert top["direction"] == "out"
    assert top["is_manual"] is True


# Give moves my_wallet -> gifting and appears in give breakdown
def test_give_moves_to_gifting_and_breakdown(child_client):
    wallet_before = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_before = child_client.get(f"{API}/wallet").json().get("accounts", [])
    gift_before = next((a for a in accounts_before if a["account_type"] == "gifting"), {}).get("balance", 0.0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "give", "amount": 8, "category": "charity", "note": "TEST_give"})
    assert r.status_code == 200, r.text

    wallet_after = child_client.get(f"{API}/wallet/my-wallet").json()
    accounts_after = child_client.get(f"{API}/wallet").json().get("accounts", [])
    gift_after = next((a for a in accounts_after if a["account_type"] == "gifting"), {}).get("balance", 0.0)

    assert round(wallet_before["balance"] - wallet_after["balance"], 2) == 8.0
    assert round(gift_after - gift_before, 2) == 8.0
    assert round(wallet_after["breakdown"]["give"]["total"] - wallet_before["breakdown"]["give"]["total"], 2) == 8.0
    top = wallet_after["entries"][0]
    assert top["bucket"] == "give"


# Pagination — 10/page, newest first
def test_pagination(child_client):
    p1 = child_client.get(f"{API}/wallet/my-wallet?page=1&page_size=10").json()
    assert p1["page"] == 1
    assert p1["page_size"] == 10
    assert len(p1["entries"]) <= 10
    # Should have >10 entries because we've been adding through this run
    if p1["total_entries"] > 10:
        assert p1["total_pages"] >= 2
        p2 = child_client.get(f"{API}/wallet/my-wallet?page=2&page_size=10").json()
        assert p2["page"] == 2
        assert len(p2["entries"]) >= 1
        # newest first: page 1 first entry created_at >= page 2 first entry created_at
        assert p1["entries"][0]["created_at"] >= p2["entries"][0]["created_at"]
        # No overlap
        p1_ids = {e["transaction_id"] for e in p1["entries"]}
        p2_ids = {e["transaction_id"] for e in p2["entries"]}
        assert p1_ids.isdisjoint(p2_ids)


# Parent money-story: linked parent should get the same shape
def test_parent_money_story(parent_client):
    session, _ = parent_client
    # Find the linked child
    r = session.get(f"{API}/parent/children")
    assert r.status_code == 200, r.text
    children = r.json()
    assert len(children) >= 1
    child_id = children[0].get("child_id") or children[0].get("user_id") or children[0].get("id")
    assert child_id, f"no child id in {children[0]}"

    r = session.get(f"{API}/parent/child/{child_id}/money-story")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("balance", "breakdown", "entries", "page", "total_pages"):
        assert k in data
    assert set(data["breakdown"].keys()) == {"spend", "save", "give"}


# Parent unlinked -> 403
def test_parent_unlinked_forbidden(parent_client):
    session, _ = parent_client
    r = session.get(f"{API}/parent/child/nonexistent_child_xyz/money-story")
    assert r.status_code == 403


# ============================================================
# NEW FEATURES: Save-to-goal, Undo/Delete, Edit/Fix, Guards
# ============================================================

def _get_goals(child_client):
    r = child_client.get(f"{API}/child/savings-goals")
    assert r.status_code == 200, r.text
    return [g for g in r.json() if not g.get("completed")]


def _get_balance(child_client):
    return child_client.get(f"{API}/wallet/my-wallet").json()["balance"]


def _get_goal(child_client, goal_id):
    goals = child_client.get(f"{API}/child/savings-goals").json()
    return next((g for g in goals if g.get("goal_id") == goal_id), None)


def _ensure_balance(child_client, needed):
    """Top up my_wallet with income if balance too low."""
    bal = _get_balance(child_client)
    if bal < needed:
        child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "income", "amount": (needed - bal) + 50,
                                "category": "cash", "note": "TEST_topup"})


# Save into a specific goal increments that goal's current_amount and decreases my_wallet
def test_save_to_specific_goal(child_client):
    goals = _get_goals(child_client)
    assert goals, "No active savings goals seeded"
    goal = goals[0]
    goal_id = goal["goal_id"]
    _ensure_balance(child_client, 30)
    bal_before = _get_balance(child_client)
    goal_before = float(goal.get("current_amount", 0) or 0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 15, "goal_id": goal_id,
                                "note": "TEST_save_goal"})
    assert r.status_code == 200, r.text

    goal_after = float(_get_goal(child_client, goal_id).get("current_amount", 0) or 0)
    bal_after = _get_balance(child_client)
    assert round(goal_after - goal_before, 2) == 15.0
    assert round(bal_before - bal_after, 2) == 15.0

    top = child_client.get(f"{API}/wallet/my-wallet").json()["entries"][0]
    assert top["is_manual"] is True
    assert top["bucket"] == "save"
    assert goal["title"].lower() in top["title"].lower() or "goal" in top["title"].lower()


# Save to a non-existent goal returns 404
def test_save_to_invalid_goal_404(child_client):
    _ensure_balance(child_client, 20)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 5,
                                "goal_id": "nonexistent_goal_xyz", "note": "TEST_bad_goal"})
    assert r.status_code == 404


# DELETE a manual spend restores balance
def test_delete_manual_spend_restores_balance(child_client):
    _ensure_balance(child_client, 25)
    bal_before = _get_balance(child_client)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 12, "category": "toys",
                                "note": "TEST_del_spend"})
    tx_id = r.json()["transaction_id"]
    assert _get_balance(child_client) == pytest.approx(bal_before - 12, abs=0.01)

    d = child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")
    assert d.status_code == 200, d.text
    assert _get_balance(child_client) == pytest.approx(bal_before, abs=0.01)


# DELETE a save-to-goal entry reverses goal.current_amount and returns wallet money
def test_delete_save_to_goal_reverses_goal(child_client):
    goals = _get_goals(child_client)
    assert goals
    goal_id = goals[0]["goal_id"]
    _ensure_balance(child_client, 25)

    bal_before = _get_balance(child_client)
    goal_before = float(_get_goal(child_client, goal_id).get("current_amount", 0) or 0)

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 10, "goal_id": goal_id,
                                "note": "TEST_del_save_goal"})
    tx_id = r.json()["transaction_id"]
    assert float(_get_goal(child_client, goal_id).get("current_amount", 0)) == pytest.approx(goal_before + 10, abs=0.01)

    d = child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")
    assert d.status_code == 200, d.text
    assert float(_get_goal(child_client, goal_id).get("current_amount", 0)) == pytest.approx(goal_before, abs=0.01)
    assert _get_balance(child_client) == pytest.approx(bal_before, abs=0.01)


# DELETE a manual_income entry decreases balance
def test_delete_manual_income_decreases_balance(child_client):
    bal_before = _get_balance(child_client)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "income", "amount": 30, "category": "cash",
                                "note": "TEST_del_income"})
    tx_id = r.json()["transaction_id"]
    assert _get_balance(child_client) == pytest.approx(bal_before + 30, abs=0.01)

    d = child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")
    assert d.status_code == 200, d.text
    assert _get_balance(child_client) == pytest.approx(bal_before, abs=0.01)


# Cannot delete a non-manual entry (e.g., a chore_reward or savings_contribution)
def test_delete_non_manual_rejected(child_client):
    # Find a non-manual my_wallet entry in the ledger
    story = child_client.get(f"{API}/wallet/my-wallet?page=1&page_size=50").json()
    non_manual = None
    for pg in range(1, story.get("total_pages", 1) + 1):
        page_data = child_client.get(f"{API}/wallet/my-wallet?page={pg}&page_size=50").json()
        for e in page_data["entries"]:
            if not e.get("is_manual") and e.get("transaction_id"):
                non_manual = e
                break
        if non_manual:
            break
    if not non_manual:
        pytest.skip("No non-manual entry available to test guard")
    r = child_client.delete(f"{API}/wallet/my-wallet/entry/{non_manual['transaction_id']}")
    assert r.status_code == 400
    assert "yourself" in r.json().get("detail", "").lower() or "undo" in r.json().get("detail", "").lower()


# DELETE non-existent transaction returns 404
def test_delete_nonexistent_returns_404(child_client):
    r = child_client.delete(f"{API}/wallet/my-wallet/entry/trans_doesnotexist_xyz")
    assert r.status_code == 404


# EDIT amount up: balance adjusts by delta
def test_edit_spend_amount_adjusts_balance_by_delta(child_client):
    _ensure_balance(child_client, 50)
    bal0 = _get_balance(child_client)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 10, "category": "toys",
                                "note": "TEST_edit"})
    tx_id = r.json()["transaction_id"]
    assert _get_balance(child_client) == pytest.approx(bal0 - 10, abs=0.01)

    # Edit to 25 (delta -15 more from wallet)
    up = child_client.put(f"{API}/wallet/my-wallet/entry/{tx_id}",
                          json={"amount": 25, "note": "TEST_edit_updated"})
    assert up.status_code == 200, up.text
    assert _get_balance(child_client) == pytest.approx(bal0 - 25, abs=0.01)

    # Edit down to 4 (return 21)
    up2 = child_client.put(f"{API}/wallet/my-wallet/entry/{tx_id}", json={"amount": 4})
    assert up2.status_code == 200, up2.text
    assert _get_balance(child_client) == pytest.approx(bal0 - 4, abs=0.01)

    # Cleanup: delete
    child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")


# EDIT save-to-goal amount adjusts goal.current_amount by DIFFERENCE (not double-apply)
def test_edit_save_goal_adjusts_by_difference(child_client):
    goals = _get_goals(child_client)
    goal_id = goals[0]["goal_id"]
    _ensure_balance(child_client, 60)
    bal0 = _get_balance(child_client)
    g0 = float(_get_goal(child_client, goal_id).get("current_amount", 0))

    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "save", "amount": 15, "goal_id": goal_id,
                                "note": "TEST_edit_goal"})
    tx_id = r.json()["transaction_id"]
    assert float(_get_goal(child_client, goal_id).get("current_amount", 0)) == pytest.approx(g0 + 15, abs=0.01)

    # Edit to 25 (goal should go +10, wallet -10 more)
    up = child_client.put(f"{API}/wallet/my-wallet/entry/{tx_id}", json={"amount": 25})
    assert up.status_code == 200, up.text
    assert float(_get_goal(child_client, goal_id).get("current_amount", 0)) == pytest.approx(g0 + 25, abs=0.01)
    assert _get_balance(child_client) == pytest.approx(bal0 - 25, abs=0.01)

    # Cleanup: delete (also verifies goal returns to g0)
    d = child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")
    assert d.status_code == 200
    assert float(_get_goal(child_client, goal_id).get("current_amount", 0)) == pytest.approx(g0, abs=0.01)
    assert _get_balance(child_client) == pytest.approx(bal0, abs=0.01)


# EDIT to zero rejected
def test_edit_zero_amount_rejected(child_client):
    _ensure_balance(child_client, 20)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 5, "category": "toys",
                                "note": "TEST_edit_zero"})
    tx_id = r.json()["transaction_id"]
    up = child_client.put(f"{API}/wallet/my-wallet/entry/{tx_id}", json={"amount": 0})
    assert up.status_code == 400
    child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")


# EDIT non-manual rejected
def test_edit_non_manual_rejected(child_client):
    for pg in range(1, 10):
        page_data = child_client.get(f"{API}/wallet/my-wallet?page={pg}&page_size=50").json()
        for e in page_data["entries"]:
            if not e.get("is_manual") and e.get("transaction_id"):
                r = child_client.put(f"{API}/wallet/my-wallet/entry/{e['transaction_id']}",
                                     json={"amount": 5})
                assert r.status_code == 400
                return
        if pg >= page_data.get("total_pages", 1):
            break
    pytest.skip("No non-manual entry available")


# EDIT amount that exceeds wallet balance rejected AND rollback restores original
def test_edit_exceeds_balance_rolls_back(child_client):
    _ensure_balance(child_client, 30)
    bal0 = _get_balance(child_client)
    r = child_client.post(f"{API}/wallet/my-wallet/entry",
                          json={"entry_type": "spend", "amount": 5, "category": "toys",
                                "note": "TEST_edit_over"})
    tx_id = r.json()["transaction_id"]
    bal_after_create = _get_balance(child_client)
    assert bal_after_create == pytest.approx(bal0 - 5, abs=0.01)

    # Try editing to a huge amount
    up = child_client.put(f"{API}/wallet/my-wallet/entry/{tx_id}",
                          json={"amount": bal0 + 10000})
    assert up.status_code == 400
    # Balance should be back to bal_after_create (i.e., original spend restored)
    assert _get_balance(child_client) == pytest.approx(bal_after_create, abs=0.01)
    child_client.delete(f"{API}/wallet/my-wallet/entry/{tx_id}")

