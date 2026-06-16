"""
worker.py — Main polling loop for the SmartBeachVolley ML pipeline.

Polls Supabase every POLL_INTERVAL_SECONDS for games with status 'queued',
then runs the full ML pipeline on each one.

Usage:
    python worker.py

Or via run.sh (recommended — activates venv first).
"""

import os
import sys
import time
import tempfile
import traceback
import logging
from functools import partial
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the directory containing this script
load_dotenv(Path(__file__).parent / ".env")

from supabase import create_client

import storage
import court
import players
import ball as ball_module
import events as events_module
import debug as debug_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))


def get_queued_game() -> dict | None:
    """Fetch one queued game from Supabase."""
    client = storage.get_client()
    result = (
        client.table("games")
        .select("*")
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def process_game(game: dict) -> None:
    game_id = game["id"]
    log.info(f"Processing game {game_id} ({game.get('video_filename', '')})")

    # Mark as processing
    storage.update_game_status(game_id, "processing")

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, "video.mp4")
        frame_path = os.path.join(tmpdir, "frame.jpg")

        # 1. Download video
        log.info(f"  Downloading video: {game['video_path']}")
        storage.download_video(game_id, game["video_path"], video_path)

        # 2. Extract frame (for court setup reference)
        log.info("  Extracting frame…")
        court.extract_frame(video_path, frame_path)
        storage.upload_frame(game_id, frame_path)

        # 3. Court perspective transform
        corners = game.get("court_corners")
        if not corners or len(corners) != 4:
            raise ValueError("court_corners missing or invalid — complete setup step first")

        M = court.build_transform(corners)
        transform_fn = partial(court.pixel_to_court, M=M)

        # 4. Player tracking
        log.info("  Tracking players (YOLOv8 + BotSORT)…")

        def player_progress(frame, total):
            log.info(f"    Player tracking: {frame}/{total} frames")

        raw_tracks = players.track_players(video_path, progress_callback=player_progress)

        # Determine frame width from video
        import cv2
        cap = cv2.VideoCapture(video_path)
        frame_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        duration_ms = int((total_frames / fps) * 1000)

        role_map = players.assign_player_roles(raw_tracks, frame_width)
        log.info(f"  Player roles: {role_map}")

        # Remap: role → list of (frame, cx, cy)
        player_by_role: dict[str, list[tuple[int, float, float]]] = {}
        for role, tid in role_map.items():
            player_by_role[role] = raw_tracks.get(tid, [])

        # 5. Ball tracking
        log.info("  Tracking ball…")

        def ball_progress(frame, total):
            log.info(f"    Ball tracking: {frame}/{total} frames")

        ball_detections = ball_module.track_ball(video_path, progress_callback=ball_progress)
        ball_detections = ball_module.smooth_trajectory(ball_detections)
        log.info(f"  Ball: {len(ball_detections)} detections")

        # 6. Event detection
        log.info("  Detecting events…")
        game_events, rallies = events_module.detect_events(
            ball_detections,
            player_by_role,
            transform_fn,
            fps=fps,
        )
        log.info(f"  Events: {len(game_events)}, Rallies: {len(rallies)}")

        # Build player names map (used by debug frames + results below)
        player_names = {
            "left_1":  game.get("player_left_1",  "Left 1"),
            "left_2":  game.get("player_left_2",  "Left 2"),
            "right_1": game.get("player_right_1", "Right 1"),
            "right_2": game.get("player_right_2", "Right 2"),
        }

        # 7. Extract debug frames — one annotated JPEG per event
        log.info("  Extracting debug frames…")
        debug_frames_raw = debug_module.extract_debug_frames(
            video_path,
            game_events,
            player_by_role,
            player_names=player_names,
            fps=fps,
        )

        debug_frames_meta: list[dict] = []
        for meta, jpeg_bytes in debug_frames_raw:
            try:
                storage_path = storage.upload_debug_frame(game_id, meta.index, jpeg_bytes)
                meta.frame_path = storage_path
            except Exception as e:
                log.warning(f"  Debug frame upload failed (event {meta.index}): {e}")

            debug_frames_meta.append({
                "index":        meta.index,
                "event_type":   meta.event_type,
                "player":       meta.player,
                "player_name":  meta.player_name,
                "timestamp_ms": meta.timestamp_ms,
                "frame_path":   meta.frame_path,
                "bbox":         list(meta.bbox) if meta.bbox else None,
                "verified":     None,
                "correction":   None,
            })

        log.info(f"  Debug: {len(debug_frames_meta)} frames extracted")

        # 8. Compute score from rallies
        score_left = rallies[-1].score_left if rallies else 0
        score_right = rallies[-1].score_right if rallies else 0

        # 8. Build results JSON
        player_stats = events_module.compute_player_stats(game_events, player_names)
        heatmap_data = events_module.build_heatmap_data(game_events)

        results = {
            "score": {"left": score_left, "right": score_right},
            "duration_ms": duration_ms,
            "player_stats": player_stats,
            "heatmap_data": heatmap_data,
            "rallies": [
                {
                    "number": r.number,
                    "serving_team": r.serving_team,
                    "winning_team": r.winning_team,
                    "score_left": r.score_left,
                    "score_right": r.score_right,
                    "end_reason": r.end_reason,
                    "timestamp_ms": int(r.timestamp_ms),
                }
                for r in rallies
            ],
            "events": [
                {
                    "type": e.type,
                    "player": e.player,
                    "timestamp_ms": int(e.timestamp_ms),
                    **({"outcome": e.outcome} if e.outcome else {}),
                    **({"land_x": e.land_x, "land_y": e.land_y} if e.land_x is not None else {}),
                }
                for e in game_events
            ],
        }

        # 9. Write results + debug frames to Supabase
        log.info("  Writing results to Supabase…")
        storage.write_results(game_id, results)
        if debug_frames_meta:
            storage.write_debug_frames(game_id, debug_frames_meta)
        log.info(f"  Done! Score: {score_left}–{score_right}")


def main():
    log.info(f"SmartBeachVolley worker started. Polling every {POLL_INTERVAL}s.")

    while True:
        try:
            game = get_queued_game()
            if game:
                try:
                    process_game(game)
                except Exception as e:
                    log.error(f"Failed to process game {game['id']}: {e}")
                    traceback.print_exc()
                    storage.write_error(game["id"], str(e))
            else:
                log.debug("No queued games. Sleeping…")
        except Exception as e:
            log.error(f"Polling error: {e}")
            traceback.print_exc()

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
