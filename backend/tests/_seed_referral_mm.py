"""Temporary seed for referral-code UI QA: creates an MM batch (grade 3) + a
referral code covering that batch. Run with `--cleanup` to delete both."""
import sys
from datetime import datetime, timedelta, timezone

import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
s = requests.Session()
s.post(f"{BASE}/api/auth/login", json={"identifier": "admin@learnersplanet.com", "password": "finlit@2026"}).raise_for_status()

if "--cleanup" in sys.argv:
    for b in s.get(f"{BASE}/api/subscriptions/admin/money-masters/batches").json():
        if b["name"].startswith("TEST_"):
            print("del batch", b["batch_id"], s.delete(f"{BASE}/api/subscriptions/admin/money-masters/batches/{b['batch_id']}").status_code)
    for c in s.get(f"{BASE}/api/subscriptions/admin/referral-codes").json():
        if c["code"].startswith(("QAUI", "TESTREF", "MMQA")):
            print("del code", c["code"], s.delete(f"{BASE}/api/subscriptions/admin/referral-codes/{c['referral_id']}").status_code)
    sys.exit()

start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
end = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
r = s.post(f"{BASE}/api/subscriptions/admin/money-masters/batches", json={
    "name": "TEST_QA MM Batch G3", "grades": [3], "start_date": start, "end_date": end,
    "price": 2000, "description": "TEST batch for referral QA"})
print(r.status_code, r.text[:300])
batch_id = r.json()["batch_id"]
c = s.post(f"{BASE}/api/subscriptions/admin/referral-codes", json={
    "code": "MMQA25", "discount_percent": 25, "applicable_batches": [batch_id],
    "applicable_plans": [{"plan_type": "single_parent", "duration": "1_month"}]})
print(c.status_code, c.text[:300])
print("BATCH_ID", batch_id)
