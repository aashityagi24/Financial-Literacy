"""Seed / cleanup live classes for the /calendar UI test. Usage: python seed_live_classes_ui.py [seed|clean]"""
import sys
from datetime import datetime, timedelta, timezone

import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
tok = requests.post(f"{API}/auth/login", json={"identifier": "admin@learnersplanet.com",
                                               "password": "finlit@2026"}, timeout=30).json()
TOKEN = tok.get("session_token") or tok.get("token") or tok.get("access_token")
H = {"Authorization": f"Bearer {TOKEN}"}


def iso(minutes):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z")


SEEDS = [
    dict(title="TEST_UI Upcoming FL", brief="Upcoming class brief", scheduled_at=iso(60 * 24 * 3),
         duration_minutes=45, meeting_link="https://meet.google.com/upcoming-fl",
         min_grade=0, max_grade=5, curricula=["financial_literacy"]),
    dict(title="TEST_UI Live Now", brief="Live right now", scheduled_at=iso(-10),
         duration_minutes=60, meeting_link="https://meet.google.com/live-now",
         min_grade=0, max_grade=5, curricula=["financial_literacy"]),
    dict(title="TEST_UI Past With Recording", brief="Past with recording", scheduled_at=iso(-60 * 24 * 5),
         duration_minutes=45, meeting_link="https://meet.google.com/past1",
         recording_url="https://youtube.com/watch?v=rec1", min_grade=0, max_grade=5,
         curricula=["financial_literacy"]),
    dict(title="TEST_UI Past No Recording", brief="Past without recording", scheduled_at=iso(-60 * 24 * 6),
         duration_minutes=45, min_grade=0, max_grade=5, curricula=["financial_literacy"]),
    dict(title="TEST_UI ENT Only Hidden", scheduled_at=iso(60 * 24 * 4), min_grade=0, max_grade=5,
         curricula=["money_entrepreneurship"], meeting_link="https://meet.google.com/ent"),
    dict(title="TEST_UI Grade45 Hidden", scheduled_at=iso(60 * 24 * 4), min_grade=4, max_grade=5,
         curricula=["financial_literacy"], meeting_link="https://meet.google.com/g45"),
    dict(title="TEST_UI Draft Hidden", scheduled_at=iso(60 * 24 * 4), min_grade=0, max_grade=5,
         curricula=["financial_literacy"], is_published=False),
]


def clean():
    n = 0
    for c in requests.get(f"{API}/admin/live-classes", headers=H, timeout=30).json():
        if c["title"].startswith("TEST_UI") or c["title"].startswith("TEST_LC"):
            requests.delete(f"{API}/admin/live-classes/{c['class_id']}", headers=H, timeout=30)
            n += 1
    print(f"deleted {n}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if mode == "clean":
        clean()
    else:
        clean()
        for s in SEEDS:
            r = requests.post(f"{API}/admin/live-classes", json=s, headers=H, timeout=30)
            print(r.status_code, s["title"], r.json().get("class_id"))
