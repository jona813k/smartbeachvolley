"""
storage.py — Neon Postgres + Vercel Blob helpers for the ML pipeline worker.

DB access:  psycopg2 using POSTGRES_DATABASE_URL (Neon connection string)
File store: Vercel Blob REST API using BLOB_READ_WRITE_TOKEN
"""

import datetime
import json
import logging
import os
from urllib.parse import quote

import psycopg2
import psycopg2.extras
import requests

log = logging.getLogger(__name__)


# ── DB ─────────────────────────────────────────────────────────────────────────

def _db_conn():
    """Open a new DB connection (caller must close)."""
    return psycopg2.connect(
        os.environ["POSTGRES_DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def fetch_queued_game() -> dict | None:
    """Return the oldest queued game row as a plain dict, or None."""
    conn = _db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM games WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def update_game_status(game_id: str, status: str, extra: dict | None = None) -> None:
    """Update status (and any extra columns) for a game."""
    fields: dict = {"status": status}
    if extra:
        fields.update(extra)

    set_parts: list[str] = []
    params: list = []
    for col, val in fields.items():
        if col in ("results", "debug_frames", "court_corners") and isinstance(val, (dict, list)):
            set_parts.append(f"{col} = %s::jsonb")
            params.append(json.dumps(val))
        else:
            set_parts.append(f"{col} = %s")
            params.append(val)
    params.append(game_id)

    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE games SET {', '.join(set_parts)} WHERE id = %s", params)
    finally:
        conn.close()


def write_results(game_id: str, results: dict) -> None:
    """Write results JSON and mark game as done."""
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE games SET results = %s::jsonb, status = 'done', processed_at = %s WHERE id = %s",
                    (json.dumps(results), datetime.datetime.utcnow(), game_id),
                )
    finally:
        conn.close()


def write_error(game_id: str, error_message: str) -> None:
    """Mark game as errored with a message."""
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE games SET status = 'error', error_message = %s WHERE id = %s",
                    (error_message[:2000], game_id),
                )
    finally:
        conn.close()


def write_debug_frames(game_id: str, frames_meta: list[dict]) -> None:
    """Persist the debug_frames metadata array to the games table."""
    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE games SET debug_frames = %s::jsonb WHERE id = %s",
                    (json.dumps(frames_meta), game_id),
                )
    finally:
        conn.close()


# ── Vercel Blob REST API ───────────────────────────────────────────────────────

def _blob_token() -> str:
    return os.environ["BLOB_READ_WRITE_TOKEN"]


def _blob_put(pathname: str, data: bytes, content_type: str) -> str:
    """Upload bytes to Vercel Blob. Returns the public URL."""
    url = f"https://blob.vercel-storage.com/{quote(pathname, safe='/')}"
    r = requests.put(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {_blob_token()}",
            "Content-Type": content_type,
            "x-api-version": "7",
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["url"]


def _blob_delete(urls: list[str]) -> None:
    """Batch-delete blobs by their public URLs."""
    if not urls:
        return
    r = requests.delete(
        "https://blob.vercel-storage.com",
        headers={
            "Authorization": f"Bearer {_blob_token()}",
            "Content-Type": "application/json",
            "x-api-version": "7",
        },
        data=json.dumps({"urls": urls}),
        timeout=30,
    )
    r.raise_for_status()


def download_video(game_id: str, video_url: str, dest_path: str) -> None:
    """Stream-download the video from its public Vercel Blob URL."""
    r = requests.get(video_url, stream=True, timeout=600)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)


def upload_frame(game_id: str, frame_path: str) -> str:
    """Upload the extracted setup-frame JPEG, update frame_url in DB, return URL."""
    with open(frame_path, "rb") as f:
        data = f.read()
    url = _blob_put(f"{game_id}/frame.jpg", data, "image/jpeg")

    conn = _db_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE games SET frame_url = %s WHERE id = %s", (url, game_id))
    finally:
        conn.close()
    return url


def upload_debug_frame(game_id: str, event_index: int, jpeg_bytes: bytes) -> str:
    """Upload one annotated debug frame JPEG. Returns the public URL."""
    pathname = f"{game_id}/debug/event_{event_index:03d}.jpg"
    return _blob_put(pathname, jpeg_bytes, "image/jpeg")


def delete_video_blob(video_url: str) -> None:
    """Delete the original video blob (POC cleanup — called after processing)."""
    try:
        _blob_delete([video_url])
        log.info(f"Deleted video blob: {video_url}")
    except Exception as e:
        log.warning(f"Could not delete video blob {video_url}: {e}")
