"""Authentication services"""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import random
import string

# Import db from the main server module when used from routes
# This will be set by the server.py when importing
db = None

def set_db(database):
    """Set the database instance - called by server.py"""
    global db
    db = database

async def get_session_from_header(request: Request) -> Optional[str]:
    """Get session token from Authorization header"""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return None

async def get_session_from_cookie(request: Request) -> Optional[str]:
    """Get session token from cookie"""
    return request.cookies.get("session_token")

async def get_current_user(request: Request) -> dict:
    """Get current user from session token (cookie first, then header)"""
    session_token = await get_session_from_cookie(request)
    if not session_token:
        session_token = await get_session_from_header(request)
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def require_admin(request: Request) -> dict:
    """Require admin role"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_teacher(request: Request) -> dict:
    """Require teacher role"""
    user = await get_current_user(request)
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user

async def require_parent(request: Request) -> dict:
    """Require parent role"""
    user = await get_current_user(request)
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Parent access required")
    return user

async def require_child(request: Request) -> dict:
    """Require child role"""
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Child access required")
    return user

async def get_current_school(request: Request):
    """Get current school from session"""
    session_token = request.cookies.get("session_token")
    if not session_token or not session_token.startswith("school_sess_"):
        raise HTTPException(status_code=401, detail="Not authenticated as school")
    
    session = await db.user_sessions.find_one({
        "session_token": session_token,
        "user_type": "school"
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    if datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    school = await db.schools.find_one({"school_id": session["user_id"]}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=401, detail="School not found")
    
    return school

async def require_school(request: Request):
    """Require school authentication"""
    return await get_current_school(request)

def generate_invite_code():
    """Generate a 6-character invite code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
