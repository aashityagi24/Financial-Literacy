"""Upload routes - File uploads for various content types"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pathlib import Path
import uuid
import os
import shutil
import zipfile

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOADS_DIR = ROOT_DIR / "uploads"
THUMBNAILS_DIR = UPLOADS_DIR / "thumbnails"
PDFS_DIR = UPLOADS_DIR / "pdfs"
ACTIVITIES_DIR = UPLOADS_DIR / "activities"
VIDEOS_DIR = UPLOADS_DIR / "videos"
STORE_IMAGES_DIR = UPLOADS_DIR / "store"
INVESTMENT_IMAGES_DIR = UPLOADS_DIR / "investments"
BADGES_DIR = UPLOADS_DIR / "badges"
GLOSSARY_IMAGES_DIR = UPLOADS_DIR / "glossary"

# Ensure directories exist
for dir_path in [THUMBNAILS_DIR, PDFS_DIR, ACTIVITIES_DIR, VIDEOS_DIR, STORE_IMAGES_DIR, INVESTMENT_IMAGES_DIR, BADGES_DIR, GLOSSARY_IMAGES_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/upload", tags=["uploads"])

@router.post("/image")
async def upload_general_image(file: UploadFile = File(...)):
    """Upload a general image (for glossary, etc.) - Max recommended size: 500KB, 400x400px. Supports WebP for lighter files."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPG, PNG, WebP, GIF)")
    
    # Check file size (max 2MB)
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to start
    
    if size > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(status_code=400, detail="Image must be smaller than 2MB")
    
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    if file_ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
        file_ext = "png"
    
    filename = f"img_{uuid.uuid4().hex[:12]}.{file_ext}"
    file_path = GLOSSARY_IMAGES_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/glossary/{filename}"}

@router.post("/glossary-video")
async def upload_glossary_video(file: UploadFile = File(...)):
    """Upload a video for glossary terms - Max 50MB. Supports MP4, WebM."""
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File must be a video (MP4, WebM)")
    
    # Check file size (max 50MB)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    
    if size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="Video must be smaller than 50MB")
    
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else "mp4"
    if file_ext not in ["mp4", "webm", "m4v", "mov"]:
        file_ext = "mp4"
    
    filename = f"vid_{uuid.uuid4().hex[:12]}.{file_ext}"
    file_path = GLOSSARY_IMAGES_DIR / filename  # Store in same directory
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/glossary/{filename}"}

@router.post("/badge")
async def upload_badge_image(file: UploadFile = File(...)):
    """Upload a badge image"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"badge_{uuid.uuid4().hex[:12]}.{file_ext}"
    file_path = BADGES_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/badges/{filename}"}

@router.post("/thumbnail")
async def upload_thumbnail(file: UploadFile = File(...)):
    """Upload a thumbnail image"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = THUMBNAILS_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/thumbnails/{filename}"}

@router.post("/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF worksheet"""
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    filename = f"{uuid.uuid4().hex[:16]}.pdf"
    file_path = PDFS_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/pdfs/{filename}"}

@router.post("/activity")
async def upload_activity_html(file: UploadFile = File(...)):
    """Upload an HTML activity (zip file with HTML and assets)"""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")
    
    folder_name = uuid.uuid4().hex[:16]
    activity_folder = ACTIVITIES_DIR / folder_name
    activity_folder.mkdir(parents=True, exist_ok=True)
    
    # Save the zip file temporarily
    zip_path = activity_folder / "temp.zip"
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Extract the zip file
    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(activity_folder)
        zip_path.unlink()  # Remove the zip file after extraction
        
        # Find any HTML file (not just index.html)
        html_file = None
        
        # First check for index.html
        if (activity_folder / "index.html").exists():
            html_file = "index.html"
        else:
            # Look for any .html or .htm file
            for item in activity_folder.iterdir():
                if item.is_file() and (item.suffix.lower() == '.html' or item.suffix.lower() == '.htm'):
                    html_file = item.name
                    break
                elif item.is_dir():
                    # Check subdirectory
                    for sub_item in item.iterdir():
                        if sub_item.is_file() and (sub_item.suffix.lower() == '.html' or sub_item.suffix.lower() == '.htm'):
                            # Move contents up from subdirectory
                            for move_item in item.iterdir():
                                shutil.move(str(move_item), str(activity_folder / move_item.name))
                            item.rmdir()
                            html_file = sub_item.name
                            break
                    if html_file:
                        break
        
        if not html_file:
            shutil.rmtree(activity_folder)
            raise HTTPException(status_code=400, detail="ZIP must contain an HTML file (.html or .htm)")
            
    except zipfile.BadZipFile:
        shutil.rmtree(activity_folder)
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    
    return {"url": f"/api/uploads/activities/{folder_name}/{html_file}", "folder": folder_name}

@router.post("/html")
async def upload_html_file(file: UploadFile = File(...)):
    """Upload a standalone HTML file (not zipped)"""
    if not file.filename.endswith(".html") and not file.filename.endswith(".htm"):
        raise HTTPException(status_code=400, detail="File must be an HTML file (.html or .htm)")
    
    folder_name = uuid.uuid4().hex[:16]
    html_folder = ACTIVITIES_DIR / folder_name
    html_folder.mkdir(parents=True, exist_ok=True)
    
    # Save as index.html so it can be served the same way as ZIP extracts
    file_path = html_folder / "index.html"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/activities/{folder_name}/index.html", "folder": folder_name}

@router.post("/video")
async def upload_video_file(file: UploadFile = File(...)):
    """Upload an MP4 video file"""
    allowed_extensions = [".mp4", ".webm", ".mov"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File must be a video ({', '.join(allowed_extensions)})")
    
    # Generate unique filename
    filename = f"{uuid.uuid4().hex[:16]}{file_ext}"
    file_path = VIDEOS_DIR / filename
    
    # Save the video file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/videos/{filename}"}

@router.post("/walkthrough-video")
async def upload_walkthrough_video(file: UploadFile = File(...), user_type: str = "child"):
    """Upload a walkthrough video for a specific user type (child, parent, teacher)"""
    allowed_extensions = [".mp4", ".webm", ".mov"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File must be a video ({', '.join(allowed_extensions)})")
    
    if user_type not in ["child", "parent", "teacher"]:
        raise HTTPException(status_code=400, detail="user_type must be child, parent, or teacher")
    
    # Use user_type in filename for walkthrough video
    filename = f"walkthrough_{user_type}{file_ext}"
    file_path = VIDEOS_DIR / filename
    
    # Remove any existing walkthrough video for this user type with different extension
    for ext in allowed_extensions:
        existing = VIDEOS_DIR / f"walkthrough_{user_type}{ext}"
        if existing.exists() and existing != file_path:
            existing.unlink()
    
    # Save the video file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/videos/{filename}"}

@router.post("/goal-image")
async def upload_goal_image(file: UploadFile = File(...)):
    """Upload an image for a savings goal"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"goal_{uuid.uuid4().hex[:16]}{file_ext}"
    file_path = THUMBNAILS_DIR / filename
    
    # Save the image
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"url": f"/api/uploads/thumbnails/{filename}"}

@router.post("/store-image")
async def upload_store_image(file: UploadFile = File(...)):
    """Upload an image for store items"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = STORE_IMAGES_DIR / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/store/{filename}"}

@router.post("/investment-image")
async def upload_investment_image(file: UploadFile = File(...)):
    """Upload an image for investments (plant images or stock logos)"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{uuid.uuid4().hex[:16]}.{file_ext}"
    file_path = INVESTMENT_IMAGES_DIR / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/investments/{filename}"}


# ============== CHUNKED UPLOAD ==============
CHUNKS_DIR = UPLOADS_DIR / "chunks"
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

# Map destination types to directories
DEST_MAP = {
    "video": VIDEOS_DIR,
    "image": GLOSSARY_IMAGES_DIR,
    "thumbnail": THUMBNAILS_DIR,
    "pdf": PDFS_DIR,
    "badge": BADGES_DIR,
    "quest": UPLOADS_DIR / "quests",
    "repository": UPLOADS_DIR / "repository",
    "store": STORE_IMAGES_DIR,
    "glossary": GLOSSARY_IMAGES_DIR,
    "investment": INVESTMENT_IMAGES_DIR,
    "goal": THUMBNAILS_DIR,
    "activity": ACTIVITIES_DIR,
    "audio": UPLOADS_DIR / "audio",
}

from fastapi import Form

@router.post("/chunked/init")
async def chunked_upload_init(filename: str = Form(...), dest_type: str = Form("video"), total_chunks: int = Form(1)):
    """Initialize a chunked upload session"""
    upload_id = uuid.uuid4().hex[:16]
    upload_dir = CHUNKS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    return {"upload_id": upload_id, "filename": filename, "dest_type": dest_type}

@router.post("/chunked/part")
async def chunked_upload_part(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...)
):
    """Upload a single chunk"""
    upload_dir = CHUNKS_DIR / upload_id
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    chunk_path = upload_dir / f"chunk_{chunk_index:04d}"
    content = await file.read()
    with open(chunk_path, "wb") as f:
        f.write(content)
    
    return {"chunk_index": chunk_index, "received": len(content)}

@router.post("/chunked/complete")
async def chunked_upload_complete(
    upload_id: str = Form(...),
    filename: str = Form(...),
    dest_type: str = Form("video"),
    total_chunks: int = Form(1)
):
    """Assemble chunks into the final file"""
    upload_dir = CHUNKS_DIR / upload_id
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    # Determine destination
    dest_dir = DEST_MAP.get(dest_type, VIDEOS_DIR)
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = os.path.splitext(filename)[1].lower()
    final_filename = f"{uuid.uuid4().hex[:16]}{file_ext}"
    
    # Handle zip files for activities
    if dest_type == "activity" and file_ext == ".zip":
        # Assemble into temp file first
        temp_path = upload_dir / f"temp{file_ext}"
        with open(temp_path, "wb") as outfile:
            for i in range(total_chunks):
                chunk_path = upload_dir / f"chunk_{i:04d}"
                if not chunk_path.exists():
                    raise HTTPException(status_code=400, detail=f"Missing chunk {i}")
                with open(chunk_path, "rb") as chunk:
                    outfile.write(chunk.read())
        
        # Extract zip
        folder_name = uuid.uuid4().hex[:12]
        extract_dir = ACTIVITIES_DIR / folder_name
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(temp_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Find HTML file
        html_file = None
        for f in extract_dir.rglob("*.html"):
            html_file = f.name
            break
        
        # Cleanup
        shutil.rmtree(upload_dir, ignore_errors=True)
        
        if html_file:
            return {"url": f"/api/uploads/activities/{folder_name}/{html_file}", "folder": folder_name}
        return {"url": f"/api/uploads/activities/{folder_name}/index.html", "folder": folder_name}
    
    # Standard file assembly
    final_path = dest_dir / final_filename
    with open(final_path, "wb") as outfile:
        for i in range(total_chunks):
            chunk_path = upload_dir / f"chunk_{i:04d}"
            if not chunk_path.exists():
                raise HTTPException(status_code=400, detail=f"Missing chunk {i}")
            with open(chunk_path, "rb") as chunk:
                outfile.write(chunk.read())
    
    # Cleanup chunks
    shutil.rmtree(upload_dir, ignore_errors=True)
    
    # Build URL path based on dest_type
    url_prefix_map = {
        "video": "videos",
        "image": "glossary",
        "thumbnail": "thumbnails",
        "pdf": "pdfs",
        "badge": "badges",
        "quest": "quests",
        "repository": "repository",
        "store": "store",
        "glossary": "glossary",
        "investment": "investments",
        "goal": "thumbnails",
    }
    url_prefix = url_prefix_map.get(dest_type, "videos")
    
    return {"url": f"/api/uploads/{url_prefix}/{final_filename}"}
