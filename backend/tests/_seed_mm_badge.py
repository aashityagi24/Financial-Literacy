import sys, uuid
from datetime import datetime, timezone, timedelta
from dotenv import dotenv_values
from pymongo import MongoClient

e = dotenv_values("/app/backend/.env")
db = MongoClient(e["MONGO_URL"])[e["DB_NAME"]]
action = sys.argv[1]
SUB_ID = "sub_qa_mm_badge"
if action == "add":
    db.subscriptions.delete_one({"subscription_id": SUB_ID})
    db.subscriptions.insert_one({
        "subscription_id": SUB_ID, "plan_type": "money_masters", "batch_id": "mmb_qa_badge",
        "batch_name": "QA MM Grade 3 Batch", "grade": 3, "amount": 1499,
        "payment_status": "completed", "is_active": True,
        "subscriber_name": "Wallet Demo Parent", "subscriber_email": "wallet_demo_parent@test.com",
        "parent_emails": ["wallet_demo_parent@test.com"],
        "child_user_ids": ["test_child_wallet_demo"], "child_name": "Wallet Demo Child",
        "start_date": datetime.now(timezone.utc).isoformat(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=40)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    print("added")
else:
    print("deleted", db.subscriptions.delete_one({"subscription_id": SUB_ID}).deleted_count)
