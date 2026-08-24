"""Seed/cleanup helper for EW track Lessons UI test.
Usage: python _seed_ew_track_topic.py seed | cleanup
"""
import json
import sys
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
STATE = "/tmp/ew_seed_state.json"

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"identifier": "admin@learnersplanet.com", "password": "finlit@2026"})
r.raise_for_status()
s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})

if sys.argv[1] == "seed":
    t = s.post(f"{BASE}/api/admin/content/topics", json={
        "title": "TEST_QA Kidpreneur Basics", "description": "QA seeded topic", "icon": "PiggyBank",
        "min_grade": 1, "max_grade": 3, "curricula": ["money_entrepreneurship"]})
    t.raise_for_status()
    tid = t.json()["topic_id"]
    sub = s.post(f"{BASE}/api/admin/content/topics", json={
        "title": "TEST_QA What Is Money", "description": "QA seeded subtopic", "icon": "Coins",
        "min_grade": 1, "max_grade": 3, "curricula": ["money_entrepreneurship"], "parent_id": tid})
    sub.raise_for_status()
    sid = sub.json()["topic_id"]
    json.dump({"topic_id": tid, "sub_id": sid}, open(STATE, "w"))
    print(json.dumps({"topic_id": tid, "sub_id": sid}))
else:
    st = json.load(open(STATE))
    for k in ["sub_id", "topic_id"]:
        d = s.delete(f"{BASE}/api/admin/content/topics/{st[k]}")
        print(k, st[k], d.status_code)
