"""Live Classes - admin-managed, grade + curriculum scoped calendar.

Each class is a dated session with a join link, a brief, timing and (later) a
recording link. Children see published classes matching their grade and their
school's curricula; parents see the union of classes for their linked children.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from services.curricula import (
    get_active_curricula, content_curricula_clause, normalize_curricula,
)

router = APIRouter(tags=["live_classes"])

db = None


def init_db(database):
    global db
    db = database


def get_db():
    return db


async def _require_admin(request: Request):
    from services.auth import get_current_user
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _clean(doc):
    doc.pop("_id", None)
    return doc


def _grade_curricula_clause(grade, active_curricula):
    """Match a class whose grade range includes `grade` and whose curricula
    overlaps `active_curricula`."""
    return {
        "$and": [
            {"min_grade": {"$lte": grade}},
            {"max_grade": {"$gte": grade}},
            content_curricula_clause(active_curricula),
        ]
    }


def _parse_grade(v, name):
    try:
        g = int(v)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{name} must be a number")
    if g < 0 or g > 5:
        raise HTTPException(status_code=400, detail=f"{name} must be between 0 and 5")
    return g


def _parse_duration(v):
    try:
        d = int(v)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="duration_minutes must be a number")
    if d <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes must be positive")
    return d


def _parse_datetime(v):
    if not v or not isinstance(v, str):
        raise HTTPException(status_code=400, detail="scheduled_at is required")
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="scheduled_at must be a valid ISO-8601 datetime")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _validate_url(v, name):
    if v and not (isinstance(v, str) and (v.startswith("http://") or v.startswith("https://"))):
        raise HTTPException(status_code=400, detail=f"{name} must be an http(s) URL")
    return v or ""


# ---------------------------------------------------------------- Admin CRUD

@router.post("/admin/live-classes")
async def create_live_class(request: Request):
    await _require_admin(request)
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    scheduled_at = _parse_datetime(body.get("scheduled_at"))
    min_grade = _parse_grade(body.get("min_grade", 0), "min_grade")
    max_grade = _parse_grade(body.get("max_grade", 5), "max_grade")
    if min_grade > max_grade:
        raise HTTPException(status_code=400, detail="min_grade cannot be greater than max_grade")
    doc = {
        "class_id": f"class_{uuid.uuid4().hex[:12]}",
        "title": title,
        "brief": body.get("brief", ""),
        "scheduled_at": scheduled_at,  # canonical UTC ISO 8601
        "duration_minutes": _parse_duration(body.get("duration_minutes", 60)),
        "meeting_link": _validate_url(body.get("meeting_link", ""), "meeting_link"),
        "recording_url": _validate_url(body.get("recording_url", ""), "recording_url"),
        "min_grade": min_grade,
        "max_grade": max_grade,
        "curricula": normalize_curricula(body.get("curricula")),
        "is_published": bool(body.get("is_published", True)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.live_classes.insert_one(doc)
    return _clean(doc)


@router.get("/admin/live-classes")
async def list_all_live_classes(request: Request):
    await _require_admin(request)
    classes = await db.live_classes.find({}, {"_id": 0}).sort("scheduled_at", 1).to_list(1000)
    return classes


@router.put("/admin/live-classes/{class_id}")
async def update_live_class(class_id: str, request: Request):
    await _require_admin(request)
    body = await request.json()
    updates = {}
    if "title" in body:
        title = (body.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        updates["title"] = title
    if "brief" in body:
        updates["brief"] = body["brief"]
    if "scheduled_at" in body:
        updates["scheduled_at"] = _parse_datetime(body.get("scheduled_at"))
    if "is_published" in body:
        updates["is_published"] = bool(body["is_published"])
    if "meeting_link" in body:
        updates["meeting_link"] = _validate_url(body.get("meeting_link", ""), "meeting_link")
    if "recording_url" in body:
        updates["recording_url"] = _validate_url(body.get("recording_url", ""), "recording_url")
    if "duration_minutes" in body:
        updates["duration_minutes"] = _parse_duration(body.get("duration_minutes"))
    if "min_grade" in body:
        updates["min_grade"] = _parse_grade(body.get("min_grade"), "min_grade")
    if "max_grade" in body:
        updates["max_grade"] = _parse_grade(body.get("max_grade"), "max_grade")
    if "curricula" in body:
        updates["curricula"] = normalize_curricula(body.get("curricula"))
    # Validate grade range against the resulting document.
    if "min_grade" in updates or "max_grade" in updates:
        existing = await db.live_classes.find_one({"class_id": class_id}, {"_id": 0, "min_grade": 1, "max_grade": 1})
        if not existing:
            raise HTTPException(status_code=404, detail="Class not found")
        lo = updates.get("min_grade", existing.get("min_grade", 0))
        hi = updates.get("max_grade", existing.get("max_grade", 5))
        if lo > hi:
            raise HTTPException(status_code=400, detail="min_grade cannot be greater than max_grade")
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.live_classes.update_one({"class_id": class_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class updated"}


@router.delete("/admin/live-classes/{class_id}")
async def delete_live_class(class_id: str, request: Request):
    await _require_admin(request)
    result = await db.live_classes.delete_one({"class_id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted"}


# ---------------------------------------------------------- Child / Parent view

@router.get("/live-classes")
async def get_my_live_classes(request: Request):
    """Published classes scoped to the caller. Children: their grade + school
    curricula. Parents: union over their linked children."""
    from services.auth import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")

    role = user.get("role")
    query = {"is_published": True}

    if role == "parent":
        links = await db.parent_child_links.find(
            {"parent_id": user["user_id"], "status": "active"}, {"_id": 0, "child_id": 1}
        ).to_list(50)
        child_clauses = []
        for link in links:
            child = await db.users.find_one({"user_id": link["child_id"]}, {"_id": 0})
            if not child:
                continue
            grade = child.get("grade", 0) or 0
            active = await get_active_curricula(child, db)
            child_clauses.append(_grade_curricula_clause(grade, active))
        if not child_clauses:
            return []
        query["$or"] = child_clauses
    elif role == "child":
        grade = user.get("grade", 0) or 0
        active = await get_active_curricula(user, db)
        clause = _grade_curricula_clause(grade, active)
        query = {"$and": [{"is_published": True}, clause]}
    else:
        # Teachers/school-admins/others have no personal grade — the Calendar is
        # a child + parent surface, so return nothing for them here.
        return []

    classes = await db.live_classes.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(1000)
    return classes
