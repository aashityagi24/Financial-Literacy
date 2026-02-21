"""Glossary/Word Bank routes for financial literacy terms"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["glossary"])

_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    return _db

# ============== PUBLIC ROUTES ==============

@router.get("/glossary/words")
async def get_glossary_words(
    request: Request,
    search: Optional[str] = None,
    letter: Optional[str] = None,
    category: Optional[str] = None,
    grade: Optional[int] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get glossary words with optional filters"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    # Build query
    query = {}
    
    # Search by term only (not meaning or description)
    if search:
        query["term"] = {"$regex": search, "$options": "i"}
    
    # Filter by starting letter
    if letter and len(letter) == 1:
        query["term"] = {"$regex": f"^{letter}", "$options": "i"}
    
    # Filter by category
    if category:
        query["category"] = category
    
    # Grade filter - show words appropriate for the user's grade
    if grade is not None:
        query["min_grade"] = {"$lte": grade}
        query["max_grade"] = {"$gte": grade}
    elif user and user.get("role") == "child" and user.get("grade") is not None:
        user_grade = user["grade"]
        query["min_grade"] = {"$lte": user_grade}
        query["max_grade"] = {"$gte": user_grade}
    
    # Get total count
    total = await db.glossary_words.count_documents(query)
    
    # Get words sorted alphabetically
    words = await db.glossary_words.find(
        query, 
        {"_id": 0}
    ).sort("term", 1).skip(skip).limit(limit).to_list(limit)
    
    # Get all unique starting letters for navigation
    all_letters = await db.glossary_words.distinct("first_letter")
    all_letters = sorted([l for l in all_letters if l])
    
    # Get all categories
    all_categories = await db.glossary_words.distinct("category")
    all_categories = [c for c in all_categories if c]
    
    return {
        "words": words,
        "total": total,
        "letters": all_letters,
        "categories": all_categories
    }

@router.get("/glossary/words/{word_id}")
async def get_glossary_word(word_id: str, request: Request):
    """Get a single glossary word by ID"""
    db = get_db()
    
    word = await db.glossary_words.find_one({"word_id": word_id}, {"_id": 0})
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    
    return word

@router.get("/glossary/word-of-day")
async def get_word_of_day(request: Request):
    """Get a random word of the day based on user's grade"""
    from services.auth import get_current_user
    import random
    db = get_db()
    user = await get_current_user(request)
    
    query = {}
    if user and user.get("role") == "child" and user.get("grade") is not None:
        user_grade = user["grade"]
        query["min_grade"] = {"$lte": user_grade}
        query["max_grade"] = {"$gte": user_grade}
    
    # Use date as seed for consistent daily word
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    words = await db.glossary_words.find(query, {"_id": 0}).to_list(1000)
    if not words:
        return None
    
    # Use date string as seed for reproducible random selection
    random.seed(today)
    word = random.choice(words)
    random.seed()  # Reset seed
    
    return word

# ============== ADMIN ROUTES ==============

@router.get("/admin/glossary/words")
async def admin_get_all_words(
    request: Request,
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Admin: Get all glossary words"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    query = {}
    if search:
        query["$or"] = [
            {"term": {"$regex": search, "$options": "i"}},
            {"meaning": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    
    total = await db.glossary_words.count_documents(query)
    words = await db.glossary_words.find(
        query, 
        {"_id": 0}
    ).sort("term", 1).skip(skip).limit(limit).to_list(limit)
    
    # Get all categories for filter dropdown
    all_categories = await db.glossary_words.distinct("category")
    
    return {
        "words": words,
        "total": total,
        "categories": [c for c in all_categories if c]
    }

@router.post("/admin/glossary/words")
async def admin_create_word(request: Request):
    """Admin: Create a new glossary word"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    
    term = body.get("term", "").strip()
    if not term:
        raise HTTPException(status_code=400, detail="Term is required")
    
    # Check for duplicate term
    existing = await db.glossary_words.find_one({"term": {"$regex": f"^{term}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="A word with this term already exists")
    
    word_id = f"word_{uuid.uuid4().hex[:12]}"
    first_letter = term[0].upper() if term else ""
    
    word_doc = {
        "word_id": word_id,
        "term": term,
        "first_letter": first_letter,
        "meaning": body.get("meaning", ""),
        "description": body.get("description", ""),
        "examples": body.get("examples", []),
        "image_url": body.get("image_url"),
        "video_url": body.get("video_url"),
        "media_type": body.get("media_type", "image"),  # 'image' or 'video'
        "category": body.get("category", "general"),
        "min_grade": body.get("min_grade", 0),
        "max_grade": body.get("max_grade", 5),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.glossary_words.insert_one(word_doc)
    
    return {"message": "Word created", "word_id": word_id}

@router.put("/admin/glossary/words/{word_id}")
async def admin_update_word(word_id: str, request: Request):
    """Admin: Update a glossary word"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    
    existing = await db.glossary_words.find_one({"word_id": word_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Word not found")
    
    update_fields = {}
    allowed_fields = ["term", "meaning", "description", "examples", "image_url", "video_url", "media_type", "category", "min_grade", "max_grade"]
    
    for field in allowed_fields:
        if field in body:
            update_fields[field] = body[field]
    
    # Update first_letter if term changed
    if "term" in update_fields:
        term = update_fields["term"].strip()
        update_fields["first_letter"] = term[0].upper() if term else ""
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.glossary_words.update_one(
        {"word_id": word_id},
        {"$set": update_fields}
    )
    
    return {"message": "Word updated"}

@router.delete("/admin/glossary/words/{word_id}")
async def admin_delete_word(word_id: str, request: Request):
    """Admin: Delete a glossary word"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    result = await db.glossary_words.delete_one({"word_id": word_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Word not found")
    
    return {"message": "Word deleted"}

@router.post("/admin/glossary/bulk-import")
async def admin_bulk_import_words(request: Request):
    """Admin: Bulk import words from JSON"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    body = await request.json()
    words = body.get("words", [])
    
    if not words:
        raise HTTPException(status_code=400, detail="No words provided")
    
    imported = 0
    skipped = 0
    
    for word_data in words:
        term = word_data.get("term", "").strip()
        if not term:
            skipped += 1
            continue
        
        # Check for duplicate
        existing = await db.glossary_words.find_one({"term": {"$regex": f"^{term}$", "$options": "i"}})
        if existing:
            skipped += 1
            continue
        
        word_id = f"word_{uuid.uuid4().hex[:12]}"
        first_letter = term[0].upper() if term else ""
        
        word_doc = {
            "word_id": word_id,
            "term": term,
            "first_letter": first_letter,
            "meaning": word_data.get("meaning", ""),
            "description": word_data.get("description", ""),
            "examples": word_data.get("examples", []),
            "image_url": word_data.get("image_url"),
            "category": word_data.get("category", "general"),
            "min_grade": word_data.get("min_grade", 0),
            "max_grade": word_data.get("max_grade", 5),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.glossary_words.insert_one(word_doc)
        imported += 1
    
    return {"message": f"Imported {imported} words, skipped {skipped} duplicates"}
