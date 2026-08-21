"""Helper: set up / tear down temporary state for the Learn-switcher UI test.
Usage: python setup_curriculum_ui.py setup|teardown
"""
import sys
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
API = fe["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
be = dotenv_values("/app/backend/.env")
db = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]
SCHOOL = "school_daee554c6477"


def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"identifier": "admin@learnersplanet.com",
                                                 "password": "finlit@2026"}, timeout=30)
    return {"Authorization": f"Bearer {r.json()['session_token']}"}


def setup():
    h = admin_headers()
    t = requests.post(f"{API}/admin/content/topics", headers=h, json={
        "title": "TEST_LEARN_ENT_Topic", "min_grade": 0, "max_grade": 5,
        "curricula": ["money_entrepreneurship"]}, timeout=30).json()
    i = requests.post(f"{API}/admin/content/items", headers=h, json={
        "topic_id": t["topic_id"], "title": "TEST_LEARN_ENT_Item", "content_type": "worksheet",
        "content_data": {"text": "x"}, "visible_to": ["child"], "min_grade": 0, "max_grade": 5,
        "is_published": True, "curricula": ["money_entrepreneurship"]}, timeout=30).json()
    requests.put(f"{API}/admin/schools/{SCHOOL}/curricula", headers=h,
                 json={"curricula": ["financial_literacy", "money_entrepreneurship"]}, timeout=30)
    db.users.update_one({"username": "classmate_g1"}, {"$set": {"school_id": SCHOOL}})
    print("setup done", t["topic_id"], i["content_id"])


def teardown():
    h = admin_headers()
    db.users.update_one({"username": "classmate_g1"}, {"$unset": {"school_id": ""}})
    requests.put(f"{API}/admin/schools/{SCHOOL}/curricula", headers=h,
                 json={"curricula": ["financial_literacy"]}, timeout=30)
    tids = [t["topic_id"] for t in db.content_topics.find(
        {"title": {"$regex": "^TEST_(LEARN|UI)_"}}, {"topic_id": 1})]
    subs = [t["topic_id"] for t in db.content_topics.find({"parent_id": {"$in": tids}}, {"topic_id": 1})]
    tids += subs
    db.content_items.delete_many({"topic_id": {"$in": tids}})
    db.content_topics.delete_many({"topic_id": {"$in": tids}})
    print("teardown done. topics:", db.content_topics.count_documents({}),
          "items:", db.content_items.count_documents({}),
          "schools:", list(db.schools.find({}, {"_id": 0, "school_id": 1, "curricula": 1})),
          "child school:", db.users.find_one({"username": "classmate_g1"}, {"_id": 0, "school_id": 1}))


if __name__ == "__main__":
    {"setup": setup, "teardown": teardown}[sys.argv[1]]()
