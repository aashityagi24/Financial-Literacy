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


def _get_frontend_origin(request: Request, state: str = None) -> str:
    """Derive the frontend origin dynamically from request context."""
    # 1. Try state parameter (set during login initiation)
    if state:
        try:
            decoded = urllib.parse.unquote(state)
            parsed = urllib.parse.urlparse(decoded)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            pass
    # 2. Try origin header
    origin = request.headers.get("origin", "").rstrip("/")
    if origin and origin.startswith("http"):
        return origin
    # 3. Try referer header
    referer = request.headers.get("referer", "")
    if referer:
        parsed = urllib.parse.urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    # 4. Derive from host header
    host = request.headers.get("host", "")
    if host:
        scheme = "https"
        return f"{scheme}://{host}"
    # 5. Fallback to env
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if redirect_uri:
        parsed = urllib.parse.urlparse(redirect_uri)
        return f"{parsed.scheme}://{parsed.netloc}"
    return ""


def _get_callback_url(origin: str) -> str:
    """Build the Google OAuth callback URL from the frontend origin.
    Production custom domain uses /auth/google/callback (Nginx proxies to /api).
    Preview/Emergent domains use /api/auth/google/callback directly.
    """
    if not origin:
        return GOOGLE_REDIRECT_URI or ""
    parsed = urllib.parse.urlparse(origin)
    host = parsed.netloc or ""
    # Custom domains (e.g. coinquest.co.in) proxy /auth → /api/auth via Nginx
    if host and not host.endswith(".emergentagent.com") and not host.endswith(".emergent.host"):
        return f"{origin}/auth/google/callback"
    # Emergent preview/deployed domains use /api prefix
    return f"{origin}/api/auth/google/callback"

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
    
    # Check subscription for D2C parent users (not admin/teacher/school)
    user_role = user.get("role")
    if user_role in ["parent"] and not user.get("school_id"):
        login_now = datetime.now(timezone.utc).isoformat()
        login_email = user.get("email", "").lower()
        login_sub = await db.subscriptions.find_one({
            "parent_emails": login_email,
            "payment_status": "completed",
            "is_active": True,
            "end_date": {"$gt": login_now}
        })
        if not login_sub:
            raise HTTPException(status_code=403, detail="Your subscription has expired or is inactive. Please purchase a plan to continue.")
    
    # Single device login: Invalidate ALL previous sessions for this user
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    
    # Update last login timestamp
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new session
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
    """Create a new user account with email/password or add password to existing Google account"""
    db = get_db()
    
    email = signup_data.email.strip().lower()
    name = signup_data.name.strip()
    password = signup_data.password
    
    # Validate email format
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check subscription - must have active subscription
    now_check = datetime.now(timezone.utc).isoformat()
    sub = await db.subscriptions.find_one({
        "parent_emails": email,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now_check}
    })
    if not sub:
        raise HTTPException(status_code=403, detail="No active subscription found for this email. Please purchase a plan first.")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    existing = await db.users.find_one({"email": email})
    if existing:
        # If user exists from Google OAuth (no password), add password to their account
        if existing.get("password_hash"):
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
        # Add password to existing Google OAuth account
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": password_hash, "name": name or existing.get("name")}}
        )
        user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": password_hash,
            "role": "parent",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "auth_provider": "email"
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    
    # Auto-login: create session
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
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
    
    return {"message": "Account ready!", "user": user, "session_token": session_token}

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
    
    # Admin allows multiple simultaneous logins - no session invalidation
    
    # Create new session
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
    
    # Single device login: Invalidate ALL previous sessions for this school
    await db.user_sessions.delete_many({"user_id": school["school_id"]})
    
    # Create new session
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
    frontend_url = _get_frontend_origin(request)
    callback_url = _get_callback_url(frontend_url)
    state = urllib.parse.quote(frontend_url) if frontend_url else ""
    
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
    # Otherwise determine dynamically from request
    if redirect_uri:
        callback_url = redirect_uri
    else:
        origin = _get_frontend_origin(request, state)
        callback_url = _get_callback_url(origin)
    
    # Exchange code for tokens
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
        # NEW Google user: check subscription BEFORE creating account
        _now_pre = datetime.now(timezone.utc).isoformat()
        _pre_sub = await db.subscriptions.find_one({
            "parent_emails": email.lower(),
            "payment_status": "completed",
            "is_active": True,
            "end_date": {"$gt": _now_pre}
        })
        if not _pre_sub:
            _fe = _get_frontend_origin(request, state)
            return RedirectResponse(url=f"{_fe}/?no_subscription=true", status_code=302)
        
        # Subscription found - create the user
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
    
    # --- Subscription gate for D2C users (Google OAuth) ---
    _user_role = user.get("role")
    if _user_role not in ["admin", "teacher"] and not user.get("school_id"):
        if _user_role in ["parent", "child", None]:
            _now = datetime.now(timezone.utc).isoformat()
            _sub = await db.subscriptions.find_one({
                "$or": [
                    {"parent_emails": email.lower()},
                    {"child_user_ids": user.get("user_id", "")}
                ],
                "payment_status": "completed",
                "is_active": True,
                "end_date": {"$gt": _now}
            })
            if not _sub:
                _fe = _get_frontend_origin(request, state)
                return RedirectResponse(url=f"{_fe}/?no_subscription=true", status_code=302)

    
    # Single device login: Invalidate ALL previous sessions for this user
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    
    # Update last login timestamp
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Determine frontend URL dynamically
    frontend_url = _get_frontend_origin(request, state)
    
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
        # NEW Google user: check subscription BEFORE creating account
        _now_pre = datetime.now(timezone.utc).isoformat()
        _pre_sub = await db.subscriptions.find_one({
            "parent_emails": email.lower(),
            "payment_status": "completed",
            "is_active": True,
            "end_date": {"$gt": _now_pre}
        })
        if not _pre_sub:
            raise HTTPException(status_code=403, detail="No active subscription found for this email. Please purchase a plan first.")
        
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
    
    # Subscription gate for D2C users
    _user_role = user.get("role")
    if _user_role not in ["admin", "teacher"] and not user.get("school_id"):
        if _user_role in ["parent", "child", None]:
            _now = datetime.now(timezone.utc).isoformat()
            _sub = await db.subscriptions.find_one({
                "$or": [
                    {"parent_emails": email.lower()},
                    {"child_user_ids": user.get("user_id", "")}
                ],
                "payment_status": "completed",
                "is_active": True,
                "end_date": {"$gt": _now}
            })
            if not _sub:
                raise HTTPException(status_code=403, detail="Your subscription has expired or is inactive. Please purchase a plan to continue.")
    
    # Single device login: Invalidate ALL previous sessions for this user
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    
    # Update last login timestamp
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new session
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
    
    # Check subscription status for non-school D2C users
    role = user.get("role")
    if role in ["admin", "teacher"] or user.get("school_id"):
        user["subscription_status"] = "active"
    elif role in ["parent", "child", None]:
        now = datetime.now(timezone.utc).isoformat()
        email = user.get("email", "").lower()
        user_id = user.get("user_id", "")
        
        # Check by parent email or child user_id
        sub = await db.subscriptions.find_one({
            "$or": [
                {"parent_emails": email},
                {"child_user_ids": user_id}
            ],
            "payment_status": "completed",
            "is_active": True,
            "end_date": {"$gt": now}
        }, {"_id": 0, "subscription_id": 1, "end_date": 1, "plan_type": 1, "num_children": 1, "num_parents": 1})
        
        if sub:
            user["subscription_status"] = "active"
            user["subscription_id"] = sub["subscription_id"]
            user["subscription_end_date"] = sub["end_date"]
        else:
            user["subscription_status"] = "none"
    else:
        user["subscription_status"] = "active"
    
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

class ChangePasswordRequest(BaseModel):
    current_password: str = ""
    new_password: str

@router.put("/change-password")
async def change_password(request: Request, body: ChangePasswordRequest):
    """Change user password (for email-auth users, or set password for Google-auth users)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    full_user = await db.users.find_one({"user_id": user["user_id"]})
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # If user has existing password, verify current password
    if full_user.get("password_hash"):
        current_hash = hashlib.sha256(body.current_password.encode()).hexdigest()
        if current_hash != full_user["password_hash"]:
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hashlib.sha256(body.new_password.encode()).hexdigest()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password updated successfully"}

@router.put("/update-picture")
async def update_picture(request: Request):
    """Update user profile picture URL"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    body = await request.json()
    
    picture_url = body.get("picture", "")
    if not picture_url:
        raise HTTPException(status_code=400, detail="Picture URL is required")
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"picture": picture_url}}
    )
    
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated

