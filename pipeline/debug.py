"""
debug.py — Extract and annotate key frames for the debug review UI.

For each detected GameEvent, this module:
  1. Seeks to the event frame in the video
  2. Finds the relevant player's bounding box at that frame
  3. Draws the box + a label ("Jonas – Angreb") onto the frame
  4. Returns the annotated JPEG bytes + metadata

All frames are uploaded to Supabase Storage under:
  {game_id}/debug/event_{index:03d}.jpg
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

from events import GameEvent

log = logging.getLogger(__name__)

EventType = Literal['serve', 'attack', 'receive', 'set', 'point_end']

# Danish labels shown on the frame
EVENT_LABELS: dict[str, str] = {
    'serve':      'Server',
    'attack':     'Angreb',
    'receive':    'Modtager',
    'set':        'Hæver',
    'point_end':  'Point slut',
}

# Colour per event type (BGR)
EVENT_COLOURS: dict[str, tuple[int, int, int]] = {
    'serve':      (50,  200, 50),    # green
    'attack':     (50,  50,  220),   # red
    'receive':    (200, 150, 50),    # blue-ish
    'set':        (200, 100, 200),   # purple
    'point_end':  (50,  200, 200),   # yellow
}


@dataclass
class DebugFrameMeta:
    """Metadata for one annotated frame — mirrors the DebugFrame TS type."""
    index: int
    event_type: str
    player: str
    player_name: str
    timestamp_ms: float
    frame_path: str              # set after upload
    bbox: tuple[int, int, int, int] | None  # x, y, w, h in original pixels


def _ms_to_frame(timestamp_ms: float, fps: float) -> int:
    return max(0, int(round(timestamp_ms / 1000.0 * fps)))


def _find_player_bbox(
    player_tracks: dict[str, list[tuple[int, float, float]]],
    player_role: str,
    frame_idx: int,
    search_window: int = 5,
) -> tuple[int, int, int, int] | None:
    """
    Look up the player's centre position in raw_tracks around frame_idx.
    Returns (x, y, w, h) as an estimated bounding box, or None if not found.
    player_tracks: role → [(frame, cx, cy), ...]
    """
    track = player_tracks.get(player_role, [])
    if not track:
        return None

    # Find the closest detection within ±search_window frames
    best = min(
        track,
        key=lambda t: abs(t[0] - frame_idx),
        default=None,
    )
    if best is None or abs(best[0] - frame_idx) > search_window:
        return None

    _, cx, cy = best
    # Approximate person bounding box: 60 px wide, 160 px tall (person at ~720p)
    w, h = 60, 160
    x = int(cx - w / 2)
    y = int(cy - h / 2)
    return (x, y, w, h)


def _annotate_frame(
    frame: np.ndarray,
    player_name: str,
    event_type: str,
    bbox: tuple[int, int, int, int] | None,
) -> np.ndarray:
    """
    Draw bounding box (if known) and event label onto a video frame.
    Returns an annotated copy.
    """
    out = frame.copy()
    colour = EVENT_COLOURS.get(event_type, (200, 200, 200))
    label_text = f"{player_name} – {EVENT_LABELS.get(event_type, event_type)}"

    if bbox:
        x, y, w, h = bbox
        # Clamp to frame bounds
        fh, fw = out.shape[:2]
        x, y = max(0, x), max(0, y)
        x2, y2 = min(fw, x + w), min(fh, y + h)

        cv2.rectangle(out, (x, y), (x2, y2), colour, 3)

        # Label background
        (tw, th), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
        lx, ly = x, max(th + baseline + 4, y - 4)
        cv2.rectangle(out, (lx, ly - th - baseline - 4), (lx + tw + 8, ly + 2), colour, -1)
        cv2.putText(out, label_text, (lx + 4, ly - baseline), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
    else:
        # No bbox — just stamp label in top-left corner
        (tw, th), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
        cv2.rectangle(out, (10, 10), (10 + tw + 12, 10 + th + baseline + 8), colour, -1)
        cv2.putText(out, label_text, (16, 10 + th + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)

    return out


def extract_debug_frames(
    video_path: str,
    game_events: list[GameEvent],
    player_tracks: dict[str, list[tuple[int, float, float]]],
    player_names: dict[str, str],
    fps: float,
) -> list[tuple[DebugFrameMeta, bytes]]:
    """
    For each event in game_events, extract the video frame, annotate it,
    and return (metadata, jpeg_bytes).

    Caller is responsible for uploading the bytes to Supabase Storage.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        log.error(f"Cannot open video: {video_path}")
        return []

    results: list[tuple[DebugFrameMeta, bytes]] = []

    for idx, event in enumerate(game_events):
        frame_idx = _ms_to_frame(event.timestamp_ms, fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, float(frame_idx))
        ok, frame = cap.read()
        if not ok:
            log.warning(f"  Debug: could not read frame {frame_idx} for event {idx}")
            continue

        bbox = _find_player_bbox(player_tracks, event.player, frame_idx)
        player_name = player_names.get(event.player, event.player)

        annotated = _annotate_frame(frame, player_name, event.type, bbox)

        # Encode as JPEG
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not ok:
            log.warning(f"  Debug: JPEG encode failed for event {idx}")
            continue

        meta = DebugFrameMeta(
            index=idx,
            event_type=event.type,
            player=event.player,
            player_name=player_name,
            timestamp_ms=event.timestamp_ms,
            frame_path="",   # filled in by caller after upload
            bbox=bbox,
        )
        results.append((meta, buf.tobytes()))
        log.info(f"  Debug frame {idx}/{len(game_events)}: {event.type} by {player_name}")

    cap.release()
    return results
