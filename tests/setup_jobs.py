"""Setup test payday jobs for blank_wallet_child with different frequencies + prices."""
import os, sys, json
import requests
from pymongo import MongoClient

BASE = "https://smart-money-learn-5.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

def login(username, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"identifier": username, "password": password})
    r.raise_for_status()
    return r.json()["session_token"]

def create_job(token, activity, frequency):
    r = requests.post(f"{BASE}/api/child/jobs",
        headers={"Authorization": f"Bearer {token}"},
        json={"activity": activity, "job_type": "payday", "frequency": frequency})
    print("create", activity, r.status_code, r.text[:200])
    r.raise_for_status()
    return r.json().get("job_id") or r.json().get("job", {}).get("job_id")

def cleanup(token):
    r = requests.get(f"{BASE}/api/child/jobs", headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    data = r.json()
    for job in data.get("payday_jobs", []) + data.get("family_jobs", []):
        jid = job.get("job_id")
        dr = requests.delete(f"{BASE}/api/child/jobs/{jid}",
            headers={"Authorization": f"Bearer {token}"})
        print("delete", jid, dr.status_code)

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "setup"
    token = login("blank_wallet_child", "testpass123")
    if action == "cleanup":
        cleanup(token)
        return
    # Cleanup first
    cleanup(token)

    jobs = [
        ("Walk the dog", "weekly", 100),
        ("Water the plants", "three_week", 30),
        ("Organize the entire bookshelf and dust it", "daily", 0),  # unpriced
    ]
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    created = []
    for activity, freq, price in jobs:
        jid = create_job(token, activity, freq)
        created.append((jid, price))
        # update mongo directly
        if price > 0:
            res = db.my_jobs.update_one({"job_id": jid}, {"$set": {"payment_amount": price, "status": "approved"}})
            print("mongo update", jid, "price", price, "matched", res.matched_count)
    print("CREATED", json.dumps(created))

if __name__ == "__main__":
    main()
