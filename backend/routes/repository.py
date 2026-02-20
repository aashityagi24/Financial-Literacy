"""Teacher Repository routes - Admin uploads resources for teachers to use in quests"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
import uuid
import shutil

router = APIRouter(tags=["repository"])

# Database reference
db = None

# Upload directory
ROOT_DIR = Path(__file__).parent.parent
REPOSITORY_DIR = ROOT_DIR / "uploads" / "repository"
REPOSITORY_DIR.mkdir(parents=True, exist_ok=True)

def init_db(database):
    global db
    db = database

def get_db():
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db

# ============== ADMIN ROUTES ==============

@router.get("/admin/repository")
async def get_repository_items(
    request: Request,
    topic_id: Optional[str] = None,
    subtopic_id: Optional[str] = None,
    grade: Optional[int] = None,
    file_type: Optional[str] = None
):
    """Get all repository items with optional filters"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    query = {}
    if topic_id:
        query["topic_id"] = topic_id
    if subtopic_id:
        query["subtopic_id"] = subtopic_id
    if grade:
        query["$and"] = [
            {"min_grade": {"$lte": grade}},
            {"max_grade": {"$gte": grade}}
        ]
    if file_type:
        query["file_type"] = file_type
    
    items = await db.teacher_repository.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get topics for dropdown
    topics = await db.content_topics.find({"parent_id": None}, {"_id": 0, "topic_id": 1, "title": 1}).to_list(100)
    
    return {
        "items": items,
        "total": len(items),
        "topics": topics
    }

@router.get("/admin/repository/subtopics/{topic_id}")
async def get_subtopics_for_topic(request: Request, topic_id: str):
    """Get subtopics for a specific topic"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    subtopics = await db.content_topics.find(
        {"parent_id": topic_id}, 
        {"_id": 0, "topic_id": 1, "title": 1}
    ).to_list(100)
    
    return {"subtopics": subtopics}

@router.post("/admin/repository")
async def create_repository_item(request: Request):
    """Create a new repository item with file upload"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    data = await request.json()
    
    # Validate required fields
    required = ["title", "file_url", "file_type", "topic_id", "subtopic_id", "min_grade", "max_grade"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Get topic and subtopic names
    topic = await db.content_topics.find_one({"topic_id": data["topic_id"]}, {"_id": 0, "title": 1})
    subtopic = await db.content_topics.find_one({"topic_id": data["subtopic_id"]}, {"_id": 0, "title": 1})
    
    item = {
        "item_id": f"repo_{uuid.uuid4().hex[:12]}",
        "title": data["title"],
        "description": data.get("description", ""),
        "file_url": data["file_url"],
        "file_type": data["file_type"],  # 'image' or 'pdf'
        "thumbnail_url": data.get("thumbnail_url", data["file_url"] if data["file_type"] == "image" else ""),
        "topic_id": data["topic_id"],
        "topic_name": topic["title"] if topic else "",
        "subtopic_id": data["subtopic_id"],
        "subtopic_name": subtopic["title"] if subtopic else "",
        "min_grade": int(data["min_grade"]),
        "max_grade": int(data["max_grade"]),
        "tags": data.get("tags", []),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teacher_repository.insert_one(item)
    
    # Remove MongoDB _id before returning (it's not JSON serializable)
    item.pop("_id", None)
    
    return {"message": "Repository item created", "item": item}

@router.post("/upload/repository")
async def upload_repository_file(file: UploadFile = File(...)):
    """Upload a file (image or PDF) for the repository"""
    # Get file extension
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    # Determine file type by content_type OR extension
    image_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'}
    pdf_extensions = {'pdf'}
    
    is_image = file.content_type and file.content_type.startswith("image/") or file_ext in image_extensions
    is_pdf = file.content_type == "application/pdf" or file_ext in pdf_extensions
    
    if not is_image and not is_pdf:
        raise HTTPException(status_code=400, detail=f"File must be an image (JPG, PNG, WebP) or PDF. Got: {file.content_type}, ext: {file_ext}")
    
    # Check file size (max 10MB for PDFs, 5MB for images)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    
    max_size = 10 * 1024 * 1024 if is_pdf else 5 * 1024 * 1024
    if size > max_size:
        raise HTTPException(status_code=400, detail=f"File must be smaller than {max_size // (1024*1024)}MB")
    
    # Generate filename
    if not file_ext or file_ext not in (image_extensions | pdf_extensions):
        file_ext = "pdf" if is_pdf else "png"
    file_type = "pdf" if is_pdf else "image"
    filename = f"repo_{uuid.uuid4().hex[:12]}.{file_ext}"
    file_path = REPOSITORY_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "url": f"/api/uploads/repository/{filename}",
        "file_type": file_type,
        "filename": filename
    }

@router.put("/admin/repository/{item_id}")
async def update_repository_item(request: Request, item_id: str):
    """Update a repository item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    data = await request.json()
    
    # Get topic and subtopic names if changed
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    allowed_fields = ["title", "description", "file_url", "thumbnail_url", "topic_id", "subtopic_id", 
                      "min_grade", "max_grade", "tags", "is_active"]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Update topic/subtopic names
    if "topic_id" in data:
        topic = await db.content_topics.find_one({"topic_id": data["topic_id"]}, {"_id": 0, "title": 1})
        update_data["topic_name"] = topic["title"] if topic else ""
    
    if "subtopic_id" in data:
        subtopic = await db.content_topics.find_one({"topic_id": data["subtopic_id"]}, {"_id": 0, "title": 1})
        update_data["subtopic_name"] = subtopic["title"] if subtopic else ""
    
    result = await db.teacher_repository.update_one(
        {"item_id": item_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item updated"}

@router.delete("/admin/repository/{item_id}")
async def delete_repository_item(request: Request, item_id: str):
    """Delete a repository item"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    result = await db.teacher_repository.delete_one({"item_id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted"}

# ============== TEACHER ROUTES ==============

@router.get("/teacher/repository")
async def teacher_get_repository(
    request: Request,
    topic_id: Optional[str] = None,
    subtopic_id: Optional[str] = None,
    grade: Optional[int] = None,
    file_type: Optional[str] = None,
    search: Optional[str] = None
):
    """Get repository items for teachers to use in quests"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can access repository")
    
    query = {"is_active": True}
    
    if topic_id:
        query["topic_id"] = topic_id
    if subtopic_id:
        query["subtopic_id"] = subtopic_id
    if grade:
        query["$and"] = [
            {"min_grade": {"$lte": grade}},
            {"max_grade": {"$gte": grade}}
        ]
    if file_type:
        query["file_type"] = file_type
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    
    items = await db.teacher_repository.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Get topics for filtering
    topics = await db.content_topics.find({"parent_id": None}, {"_id": 0, "topic_id": 1, "title": 1}).to_list(100)
    
    return {
        "items": items,
        "total": len(items),
        "topics": topics
    }

@router.get("/teacher/repository/subtopics/{topic_id}")
async def teacher_get_subtopics(request: Request, topic_id: str):
    """Get subtopics for a topic (for teacher filtering)"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    
    if user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can access repository")
    
    subtopics = await db.content_topics.find(
        {"parent_id": topic_id}, 
        {"_id": 0, "topic_id": 1, "title": 1}
    ).to_list(100)
    
    return {"subtopics": subtopics}
