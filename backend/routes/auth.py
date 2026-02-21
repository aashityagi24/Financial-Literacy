"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import httpx
import os
import urllib.parse

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

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class SchoolLoginRequest(BaseModel):
    username: str
    password: str

class UnifiedLoginRequest(BaseModel):
    identifier: str  # email or username
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

@router.post("/login")
async def unified_login(login_data: UnifiedLoginRequest, response: Response):
    """Unified login supporting email or username"""
    db = get_db()
    identifier = login_data.identifier.strip()
    password = login_data.password
    
    # Hash password for comparison
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Try to find user by email or username
    user = await db.users.find_one({
        "$or": [
            {"email": identifier.lower()},
            {"username": identifier}
        ],
        "password_hash": password_hash
    }, {"_id": 0, "password_hash": 0})  # Exclude sensitive fields
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email/username or password")
    
    # Create session
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

@router.post("/signup")
async def signup(signup_data: SignupRequest, response: Response):
    """Create a new user account with email/password"""
    db = get_db()
    
    email = signup_data.email.strip().lower()
    name = signup_data.name.strip()
    password = signup_data.password
    
    # Validate email format
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Create user (default role is 'parent' - they can add children later)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "password_hash": password_hash,
        "role": "parent",  # Default to parent role
        "created_at": datetime.now(timezone.utc).isoformat(),
        "auth_provider": "email"
    }
    
    await db.users.insert_one(user)
    
    # Remove internal fields from response
    user_response = {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "created_at": user["created_at"]
    }
    
    return {"message": "Account created successfully", "user": user_response}

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

@router.get("/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    # Get the origin from headers to determine correct redirect URI
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    
    # Determine the correct callback URL based on origin
    # NOTE: For custom domains, the redirect URI must match exactly what's registered in Google Console
    if "coinquest.co.in" in origin:
        # Production domain - use /auth/google/callback (without /api) as registered in Google Console
        callback_url = "https://coinquest.co.in/auth/google/callback"
        frontend_url = "https://coinquest.co.in"
    elif "coinquest-kids-2.preview.emergentagent.com" in origin:
        callback_url = "https://literate-kids.preview.emergentagent.com/api/auth/google/callback"
        frontend_url = "https://literate-kids.preview.emergentagent.com"
    else:
        # Fallback to environment variable
        callback_url = GOOGLE_REDIRECT_URI
        frontend_url = origin.rstrip("/") if origin else ""
    
    # Store the frontend URL origin (without path) in state for redirect after auth
    if frontend_url:
        parsed = urllib.parse.urlparse(frontend_url)
        frontend_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else frontend_url
    else:
        frontend_origin = ""
    state = urllib.parse.quote(frontend_origin) if frontend_origin else ""
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "select_account"
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)

@router.get("/google/callback")
async def google_callback(request: Request, response: Response, code: str = None, state: str = None, error: str = None, redirect_uri: str = None):
    """Handle Google OAuth callback"""
    db = get_db()
    
    # Log the callback details for debugging
    print("=== Google OAuth Callback ===")
    print(f"Host: {request.headers.get('host', 'unknown')}")
    print(f"State: {state}")
    print(f"Redirect URI param: {redirect_uri}")
    print(f"Code present: {bool(code)}")
    
    # Get frontend URL from state
    frontend_url = urllib.parse.unquote(state) if state else ""
    print(f"Frontend URL from state: {frontend_url}")
    
    if error:
        print(f"OAuth error: {error}")
        return RedirectResponse(url=f"{frontend_url}?error={error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code received")
    
    # Use provided redirect_uri if available (from frontend forwarding)
    # Otherwise determine based on host - MUST match what's registered in Google Console
    if redirect_uri:
        callback_url = redirect_uri
        print(f"Using provided redirect_uri: {callback_url}")
    else:
        host = request.headers.get("host", "")
        # For coinquest.co.in, use /auth/google/callback (without /api) as registered in Google Console
        if "coinquest.co.in" in host:
            callback_url = "https://coinquest.co.in/auth/google/callback"
        elif "coinquest-kids-2.preview.emergentagent.com" in host:
            callback_url = "https://literate-kids.preview.emergentagent.com/api/auth/google/callback"
        else:
            callback_url = GOOGLE_REDIRECT_URI
        print(f"Determined callback_url from host: {callback_url}")
    
    # Exchange code for tokens
    print(f"Exchanging code with redirect_uri: {callback_url}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": callback_url
            }
        )
        
        if token_response.status_code != 200:
            print(f"Token exchange failed: {token_response.status_code}")
            print(f"Response: {token_response.text}")
            error_detail = token_response.json().get("error_description", "Failed to exchange authorization code")
            raise HTTPException(status_code=401, detail=error_detail)
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        print("Token exchange successful, got access_token")
        
        # Get user info
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to get user info")
        
        user_data = userinfo_response.json()
        print(f"Got user info: {user_data.get('email')}")
    
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
        # Update streak
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
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Determine frontend URL - from state or based on host
    if state:
        frontend_url = urllib.parse.unquote(state)
        # Extract only the origin (scheme + host) from the URL, removing any path
        parsed = urllib.parse.urlparse(frontend_url)
        frontend_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        host = request.headers.get("host", "")
        if "coinquest.co.in" in host:
            frontend_url = "https://coinquest.co.in"
        else:
            frontend_url = "https://literate-kids.preview.emergentagent.com"
    
    # Create redirect response with session cookie
    redirect_url = f"{frontend_url}/auth/callback?session={session_token}"
    redirect_response = RedirectResponse(url=redirect_url, status_code=302)
    
    redirect_response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return redirect_response

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
    db = get_db()
    user = await get_current_user(request)
    
    # If teacher has school_id, fetch school name
    if user and user.get("role") == "teacher" and user.get("school_id"):
        school = await db.schools.find_one({"school_id": user["school_id"]}, {"_id": 0, "name": 1})
        if school:
            user["school_name"] = school.get("name")
    
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
