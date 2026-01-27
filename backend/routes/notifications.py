"""Notification routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["notifications"])

class NotificationCreate(BaseModel):
    user_id: str
    notification_type: str
    title: str
    message: str
    from_user_id: Optional[str] = None
    from_user_name: Optional[str] = None
    related_id: Optional[str] = None
    amount: Optional[float] = None

async def create_notification(
    user_id: str, 
    notification_type: str, 
    title: str, 
    message: str,
    from_user_id: str = None,
    from_user_name: str = None,
    related_id: str = None,
    amount: float = None
):
    """Helper function to create notifications"""
    db = get_db()
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "from_user_id": from_user_id,
        "from_user_name": from_user_name,
        "related_id": related_id,
        "amount": amount,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification

@router.get("/notifications")
async def get_notifications(request: Request):
    """Get notifications for current user"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    notifications = await db.notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Normalize notification fields for consistency
    for notif in notifications:
        if "notification_type" not in notif and "type" in notif:
            notif["notification_type"] = notif["type"]
        if "read" not in notif and "is_read" in notif:
            notif["read"] = notif["is_read"]
        elif "read" not in notif:
            notif["read"] = False
        if "title" not in notif or not notif["title"]:
            message = notif.get("message", "Notification")
            notif["title"] = message[:50] + "..." if len(message) > 50 else message
    
    unread_count = sum(1 for n in notifications if not n.get("read", False))
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@router.post("/notifications/mark-read")
async def mark_notifications_read(request: Request):
    """Mark all notifications as read"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True, "read": True}}
    )
    
    return {"message": "Notifications marked as read"}

@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    result1 = await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    result2 = await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True, "read": True}}
    )
    
    total_updated = result1.modified_count + result2.modified_count
    return {"message": "All notifications marked as read", "updated": total_updated}

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    result = await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}
