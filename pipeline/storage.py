"""
storage.py — Supabase Storage helpers for downloading/uploading video and frame files.

TODO (worker migration): The frontend has been migrated from Supabase to
Vercel Postgres + Vercel Blob. This file still uses supabase-py and the
Supabase Storage bucket. To complete the migration:
  1. Replace supabase-py with psycopg2 (or psycopg3) for DB access using
     the POSTGRES_URL connection string from Vercel.
  2. Replace all supabase.storage calls with HTTP uploads to Vercel Blob
     using the BLOB_READ_WRITE_TOKEN and the @vercel/blob REST API
     (PUT https://blob.vercel-storage.com/<pathname>).
  3. Store the returned public Blob URL in video_path / frame_url / frame_path
     instead of the old Supabase storage path.
"""

import os
import tempfile
from supabase import create_client, Client

BUCKET = "game-videos"


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def download_video(game_id: str, video_path: str, dest_path: str) -> None:
    """Download a video from Supabase Storage to a local file."""
    client = get_client()
    data = client.storage.from_(BUCKET).download(video_path)
    with open(dest_path, "wb") as f:
        f.write(data)


def upload_frame(game_id: str, frame_path: str) -> str:
    """Upload the extracted frame JPEG to Storage. Returns the storage path."""
    client = get_client()
    storage_path = f"{game_id}/frame.jpg"
    with open(frame_path, "rb") as f:
        client.storage.from_(BUCKET).upload(
            storage_path,
            f.read(),
            {"content-type": "image/jpeg", "upsert": "true"},
        )
    return storage_path


def update_game_status(game_id: str, status: str, extra: dict | None = None) -> None:
    """Update the game's status in the database."""
    client = get_client()
    payload: dict = {"status": status}
    if extra:
        payload.update(extra)
    client.table("games").update(payload).eq("id", game_id).execute()


def write_results(game_id: str, results: dict) -> None:
    """Write the completed results JSON and mark the game as done."""
    import datetime
    client = get_client()
    client.table("games").update({
        "results": results,
        "status": "done",
        "processed_at": datetime.datetime.utcnow().isoformat(),
    }).eq("id", game_id).execute()


def write_error(game_id: str, error_message: str) -> None:
    """Mark the game as errored with a message."""
    client = get_client()
    client.table("games").update({
        "status": "error",
        "error_message": error_message[:2000],
    }).eq("id", game_id).execute()


# ── Debug frame helpers ────────────────────────────────────────────────────────

def upload_debug_frame(game_id: str, event_index: int, jpeg_bytes: bytes) -> str:
    """
    Upload a single annotated JPEG to Storage.
    Returns the storage path: "{game_id}/debug/event_{index:03d}.jpg"
    """
    client = get_client()
    storage_path = f"{game_id}/debug/event_{event_index:03d}.jpg"
    client.storage.from_(BUCKET).upload(
        storage_path,
        jpeg_bytes,
        {"content-type": "image/jpeg", "upsert": "true"},
    )
    return storage_path


def write_debug_frames(game_id: str, frames_meta: list[dict]) -> None:
    """
    Persist the debug_frames metadata array to the games table.
    Each dict in frames_meta is a serialisable DebugFrameMeta.
    """
    client = get_client()
    client.table("games").update({
        "debug_frames": frames_meta,
    }).eq("id", game_id).execute()


def get_debug_frame_signed_url(frame_path: str, expires_in: int = 3600) -> str:
    """Return a signed URL for a debug frame JPEG (valid for expires_in seconds)."""
    client = get_client()
    result = client.storage.from_(BUCKET).create_signed_url(frame_path, expires_in)
    return result.get("signedURL", "")
