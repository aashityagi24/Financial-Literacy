"""Application configuration"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

class Settings:
    """Application settings loaded from environment"""
    MONGO_URL: str = os.environ.get('MONGO_URL', '')
    DB_NAME: str = os.environ.get('DB_NAME', 'coinquest')
    
    # Upload directories
    UPLOADS_DIR = ROOT_DIR / "uploads"
    THUMBNAILS_DIR = UPLOADS_DIR / "thumbnails"
    PDFS_DIR = UPLOADS_DIR / "pdfs"
    ACTIVITIES_DIR = UPLOADS_DIR / "activities"
    VIDEOS_DIR = UPLOADS_DIR / "videos"
    STORE_IMAGES_DIR = UPLOADS_DIR / "store"
    INVESTMENT_IMAGES_DIR = UPLOADS_DIR / "investments"
    QUEST_ASSETS_DIR = UPLOADS_DIR / "quests"
    
    def __init__(self):
        # Create upload directories
        for dir_path in [
            self.UPLOADS_DIR, self.THUMBNAILS_DIR, self.PDFS_DIR,
            self.ACTIVITIES_DIR, self.VIDEOS_DIR, self.STORE_IMAGES_DIR,
            self.INVESTMENT_IMAGES_DIR, self.QUEST_ASSETS_DIR
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

settings = Settings()
