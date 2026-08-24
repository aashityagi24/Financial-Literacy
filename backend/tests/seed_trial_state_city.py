"""Seed 2 extra TEST_ trial leads (different states) so admin State/City filters have data."""
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

LEADS = [
    {"parent_name": "TEST_Filter MH", "phone": "9876500011", "email": "TEST_mh@example.com",
     "child_name": "TEST_MHKid", "child_grade": 2, "state": "Maharashtra", "city": "Pune"},
    {"parent_name": "TEST_Filter TN", "phone": "9876500022", "email": "TEST_tn@example.com",
     "child_name": "TEST_TNKid", "child_grade": 4, "state": "Tamil Nadu", "city": "Chennai"},
]

if __name__ == "__main__":
    for lead in LEADS:
        r = requests.post(f"{API}/subscriptions/money-masters/trial-enquiry", json=lead, timeout=30)
        print(lead["state"], lead["city"], r.status_code, r.text[:200])
