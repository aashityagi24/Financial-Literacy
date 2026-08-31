"""Emergent Object Storage client - so uploaded files survive redeploys
(the app pod's local disk is ephemeral once deployed)."""
import os
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "coinquest"

_storage_key = None


def init_storage(force: bool = False):
    """Call once; cached for the process lifetime. force=True mints a fresh key."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(relative_path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes to `{APP_NAME}/uploads/{relative_path}`."""
    key = init_storage()
    path = f"{APP_NAME}/uploads/{relative_path}"
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(relative_path: str) -> tuple:
    """Download bytes from `{APP_NAME}/uploads/{relative_path}`. Returns (content, content_type)."""
    key = init_storage()
    path = f"{APP_NAME}/uploads/{relative_path}"
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
