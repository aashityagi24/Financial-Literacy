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

# Ensure directories exist
for dir_path in [THUMBNAILS_DIR, PDFS_DIR, ACTIVITIES_DIR, VIDEOS_DIR, STORE_IMAGES_DIR, INVESTMENT_IMAGES_DIR, BADGES_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/upload", tags=["uploads"])

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
    """Upload an HTML activity (zip file with index.html and assets)"""
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
        
        # Check if index.html exists
        index_path = activity_folder / "index.html"
        if not index_path.exists():
            # Check subdirectory
            for item in activity_folder.iterdir():
                if item.is_dir():
                    sub_index = item / "index.html"
                    if sub_index.exists():
                        # Move contents up
                        for sub_item in item.iterdir():
                            shutil.move(str(sub_item), str(activity_folder / sub_item.name))
                        item.rmdir()
                        break
        
        if not (activity_folder / "index.html").exists():
            shutil.rmtree(activity_folder)
            raise HTTPException(status_code=400, detail="ZIP must contain an index.html file")
            
    except zipfile.BadZipFile:
        shutil.rmtree(activity_folder)
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    
    return {"url": f"/api/uploads/activities/{folder_name}/index.html", "folder": folder_name}

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
