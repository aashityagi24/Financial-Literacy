"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import httpx

# Database will be injected
_db = None

def init_db(database):
    """Initialize database reference"""
    global _db
    _db = database

def get_db():
    """Get database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(prefix="/auth", tags=["auth"])

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class SchoolLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/admin-login")
async def admin_login(login_data: AdminLoginRequest, response: Response):
    """Admin login with email and password"""
    db = get_db()
    ADMIN_EMAIL = "admin@learnersplanet.com"
    ADMIN_PASSWORD = "finlit@2026"
    
    if login_data.email != ADMIN_EMAIL or login_data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Find or create admin user
    admin_user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not admin_user:
        admin_user = {
            "user_id": f"admin_{uuid.uuid4().hex[:12]}",
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        admin_user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": admin_user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {"user": admin_user, "session_token": session_token}

@router.post("/school-login")
async def school_login(login_data: SchoolLoginRequest, response: Response):
    """School login with username and password"""
    db = get_db()
    school = await db.schools.find_one({"username": login_data.username}, {"_id": 0})
    
    if not school:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if school.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"school_sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": school["school_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_type": "school"
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "school": {
            "school_id": school["school_id"],
            "name": school["name"],
            "username": school["username"],
            "role": "school"
        },
        "session_token": session_token
    }

@router.post("/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Google OAuth for session data"""
    print("=" * 50)
    print("SESSION ENDPOINT CALLED")
    print("=" * 50)
    
    db = get_db()
    body = await request.json()
    session_id = body.get("session_id")
    
    print(f"Received session_id: {session_id[:30] if session_id else 'None'}...")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            print("Calling Emergent auth validation endpoint...")
            # Use the correct Emergent auth endpoint with X-Session-ID header
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            print(f"Auth response status: {auth_response.status_code}")
            print(f"Auth response body: {auth_response.text[:500] if auth_response.text else 'empty'}")
            
            if auth_response.status_code != 200:
                print(f"AUTH FAILED: {auth_response.text}")
                raise HTTPException(status_code=401, detail=f"Invalid session: {auth_response.text}")
            
            user_data = auth_response.json()
            print(f"User data received: email={user_data.get('email')}, name={user_data.get('name')}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"AUTH EXCEPTION: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Auth validation failed: {str(e)}")
    
    email = user_data.get("email")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": user_data.get("name", "User"),
            "picture": user_data.get("picture"),
            "role": None,
            "grade": None,
            "avatar": None,
            "streak_count": 0,
            "last_login_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"email": email}, {"_id": 0})
    else:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        last_login = user.get("last_login_date")
        
        if last_login != today:
            if last_login:
                last_date = datetime.strptime(last_login, "%Y-%m-%d")
                today_date = datetime.strptime(today, "%Y-%m-%d")
                days_diff = (today_date - last_date).days
                
                if days_diff == 1:
                    new_streak = user.get("streak_count", 0) + 1
                elif days_diff > 1:
                    new_streak = 1
                else:
                    new_streak = user.get("streak_count", 0)
            else:
                new_streak = 1
            
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"last_login_date": today, "streak_count": new_streak}}
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
    
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {"user": user, "session_token": session_token}

@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    from services.auth import get_current_user
    user = await get_current_user(request)
    return user

@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    db = get_db()
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        httponly=True,
        secure=True,
        samesite="none",
        path="/"
    )
    
    return {"message": "Logged out"}

@router.put("/profile")
async def update_profile(request: Request):
    """Update user profile (role, grade, avatar)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    body = await request.json()
    
    update_data = {}
    if "role" in body:
        update_data["role"] = body["role"]
    if "grade" in body:
        update_data["grade"] = body["grade"]
    if "avatar" in body:
        update_data["avatar"] = body["avatar"]
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
        
        if body.get("role") == "child":
            existing_wallet = await db.wallet_accounts.find_one({"user_id": user["user_id"]})
            if not existing_wallet:
                for account_type in ["spending", "savings", "investing", "gifting"]:
                    wallet_doc = {
                        "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                        "user_id": user["user_id"],
                        "account_type": account_type,
                        "balance": 100.0 if account_type == "spending" else 0.0,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.wallet_accounts.insert_one(wallet_doc)
                
                await db.transactions.insert_one({
                    "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                    "user_id": user["user_id"],
                    "to_account": "spending",
                    "amount": 100.0,
                    "transaction_type": "initial_deposit",
                    "description": "Welcome bonus!",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated_user

@router.post("/complete-onboarding")
async def complete_onboarding(request: Request):
    """Mark user onboarding as complete"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"has_completed_onboarding": True}}
    )
    
    return {"message": "Onboarding completed", "has_completed_onboarding": True}
