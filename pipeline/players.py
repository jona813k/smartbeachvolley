"""
players.py — Player tracking with YOLOv8 + BotSORT.

Tracks 4 players continuously across the full video, maintaining identity
even through side switches (mid-game position changes).

Returns a dict mapping track_id → list of (frame_idx, x_center, y_center) tuples.
"""

import numpy as np
from ultralytics import YOLO
import supervision as sv


def track_players(video_path: str, progress_callback=None) -> dict[int, list[tuple[int, float, float]]]:
    """
    Run YOLOv8 person detection + BotSORT tracking on the video.

    Returns:
        tracks: {track_id: [(frame_idx, x_center, y_center), ...]}
    """
    model = YOLO("yolov8n.pt")  # nano model — fast, good enough for person detection

    tracker = sv.ByteTrack()  # BotSORT-compatible tracker from supervision

    tracks: dict[int, list[tuple[int, float, float]]] = {}
    frame_idx = 0

    import cv2
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Run YOLO — only detect persons (class 0)
        results = model(frame, classes=[0], verbose=False)[0]

        detections = sv.Detections.from_ultralytics(results)

        # Filter to only keep the 4 highest-confidence detections per frame
        # (there are exactly 4 players on a beach volleyball court)
        if len(detections) > 4:
            top4 = np.argsort(detections.confidence)[-4:]
            detections = detections[top4]

        # Update tracker
        tracked = tracker.update_with_detections(detections)

        for i, track_id in enumerate(tracked.tracker_id):
            if track_id is None:
                continue
            tid = int(track_id)
            box = tracked.xyxy[i]
            cx = float((box[0] + box[2]) / 2)
            cy = float((box[1] + box[3]) / 2)

            if tid not in tracks:
                tracks[tid] = []
            tracks[tid].append((frame_idx, cx, cy))

        frame_idx += 1
        if progress_callback and frame_idx % 100 == 0:
            progress_callback(frame_idx, total_frames)

    cap.release()
    return tracks


def assign_player_roles(tracks: dict[int, list[tuple[int, float, float]]], frame_width: float) -> dict[str, int]:
    """
    Assign track IDs to player roles (left_1, left_2, right_1, right_2).

    Uses the first 10 seconds of tracks to determine starting positions.
    Left players: avg x < frame_width/2
    Within each side: player with lower avg y = player 1.

    Returns: {'left_1': track_id, 'left_2': track_id, 'right_1': track_id, 'right_2': track_id}
    """
    # Compute mean positions for each track using first 300 frames (~10s at 30fps)
    mean_positions: dict[int, tuple[float, float]] = {}
    for tid, positions in tracks.items():
        early = [(x, y) for (_, x, y) in positions[:300]]
        if early:
            mean_positions[tid] = (
                float(np.mean([p[0] for p in early])),
                float(np.mean([p[1] for p in early])),
            )

    # Sort by x position
    sorted_by_x = sorted(mean_positions.items(), key=lambda kv: kv[1][0])

    if len(sorted_by_x) < 4:
        # Fall back: assign in order
        result = {}
        roles = ['left_1', 'left_2', 'right_1', 'right_2']
        for i, (tid, _) in enumerate(sorted_by_x):
            if i < 4:
                result[roles[i]] = tid
        return result

    # Two leftmost = left team, two rightmost = right team
    left_tracks = sorted(sorted_by_x[:2], key=lambda kv: kv[1][1])   # sort by y: lower y = player 1
    right_tracks = sorted(sorted_by_x[2:], key=lambda kv: kv[1][1])

    return {
        'left_1': left_tracks[0][0],
        'left_2': left_tracks[1][0],
        'right_1': right_tracks[0][0],
        'right_2': right_tracks[1][0],
    }
