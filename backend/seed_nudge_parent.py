import asyncio, os, hashlib, uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    email = "nudge_parent@test.com"
    pwd = "testpass123"
    ph = hashlib.sha256(pwd.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    end = (now + timedelta(days=365)).isoformat()

    # Remove any children linked to this parent + the parent itself for a clean slate
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.parent_child_links.delete_many({"parent_id": existing["user_id"]})
        await db.users.delete_one({"email": email})

    uid = f"user_{uuid.uuid4().hex}"
    await db.users.insert_one({
        "user_id": uid,
        "email": email,
        "name": "Nudge Test Parent",
        "role": "parent",
        "password_hash": ph,
        "created_at": now.isoformat(),
    })

    # Active subscription so login passes the paywall
    await db.subscriptions.delete_many({"parent_emails": email})
    await db.subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex}",
        "subscriber_email": email,
        "parent_emails": [email],
        "child_user_ids": [],
        "payment_status": "completed",
        "is_active": True,
        "status": "active",
        "plan_type": "single_parent",
        "duration": "1_year",
        "end_date": end,
        "created_at": now.isoformat(),
    })
    print("Created parent:", email, "/", pwd, "uid:", uid)
    client.close()

asyncio.run(main())
