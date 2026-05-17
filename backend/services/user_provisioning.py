"""Helpers for creating child accounts that may not have an email address.
Children can be created with either:
  - an email (legacy path), or
  - a username + password only (new path).

Usernames are unique across the users collection. The helpers below handle
sanitisation, uniqueness checks and auto-generation so callers don't repeat
the same logic in every route.
"""
import re
import secrets
import hashlib
import uuid
from datetime import datetime, timezone


_USERNAME_ALPHABET_RE = re.compile(r"[^a-z0-9_]+")
_RESERVED_USERNAMES = {"admin", "root", "system", "support", "test"}


def _slugify(value: str) -> str:
    """Lowercase, keep only [a-z0-9_], collapse repeats. Returns '' on empty."""
    if not value:
        return ""
    s = value.strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")
    s = _USERNAME_ALPHABET_RE.sub("", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s[:24]


async def _is_username_taken(db, username: str) -> bool:
    if not username:
        return True
    return await db.users.find_one({"username": username}, {"_id": 1}) is not None


async def resolve_username(db, supplied_username: str | None, name: str, email: str | None) -> str:
    """Resolve a unique, validated username:
    1. If admin/parent supplied one — sanitise + ensure unique (raise if taken).
    2. Else derive from email prefix (if present) and uniquify with a suffix.
    3. Else derive from name and uniquify with a random suffix.
    """
    if supplied_username:
        clean = _slugify(supplied_username)
        if len(clean) < 3:
            raise ValueError("Username must be at least 3 characters (letters, numbers, underscores)")
        if clean in _RESERVED_USERNAMES:
            raise ValueError("That username is reserved")
        if await _is_username_taken(db, clean):
            raise ValueError(f"Username '{clean}' is already taken")
        return clean

    base = _slugify(email.split("@")[0]) if email else _slugify(name) or "user"
    if not base or base in _RESERVED_USERNAMES:
        base = "kid"
    candidate = base
    # Try the base first, then base_1234, base_5678, etc.
    for _ in range(8):
        if not await _is_username_taken(db, candidate):
            return candidate
        candidate = f"{base}_{secrets.randbelow(9000) + 1000}"
    # Last resort — long random suffix so we don't loop forever.
    return f"{base}_{uuid.uuid4().hex[:6]}"


def auto_generate_password(length: int = 10) -> str:
    """Generate a friendly random password (no ambiguous characters)."""
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_child_user(
    db,
    name: str,
    grade: int = 0,
    *,
    email: str | None = None,
    username: str | None = None,
    password: str | None = None,
    school_id: str | None = None,
    extra: dict | None = None,
) -> dict:
    """Create a child user record (and wallet accounts) supporting either the
    email-based path or the username/password-only path. Returns the new
    user document (with the cleartext password if it was auto-generated, so
    the caller can show it back to admins/parents)."""
    name = (name or "").strip()
    if not name:
        raise ValueError("Name is required")

    email_clean = (email or "").strip().lower() or None
    if email_clean:
        existing = await db.users.find_one({"email": email_clean}, {"_id": 1})
        if existing:
            raise ValueError("A user with this email already exists")

    final_username = await resolve_username(db, username, name, email_clean)

    if password is None or password == "":
        password = auto_generate_password()
        auto_generated_password = True
    else:
        auto_generated_password = False
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "name": name,
        "username": final_username,
        "email": email_clean,
        "password_hash": hashlib.sha256(password.encode()).hexdigest(),
        "role": "child",
        "grade": grade,
        "balance": 100.0,
        "streak_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if school_id:
        user_doc["school_id"] = school_id
        user_doc["created_by_school"] = True
    if extra:
        user_doc.update(extra)
    await db.users.insert_one(user_doc)

    # Wallet accounts (always created for children)
    for account_type in ["spending", "savings", "investing", "gifting"]:
        await db.wallet_accounts.insert_one({
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "account_type": account_type,
            "balance": 100.0 if account_type == "spending" else 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "user_id": user_id,
        "name": name,
        "username": final_username,
        "email": email_clean,
        "grade": grade,
        "password": password if auto_generated_password else None,
        "auto_generated_password": auto_generated_password,
    }
