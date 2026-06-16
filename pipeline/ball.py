"""
ball.py — Ball tracking.

Uses a lightweight colour + motion heuristic approach as a practical first version.
The ball is small, fast, and often motion-blurred — full TrackNet v3 would require
a separate training step. This heuristic works well enough for event detection.

TrackNet v3 can be swapped in later by replacing `track_ball()` with a model-based call.
"""

import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class BallDetection:
    frame_idx: int
    timestamp_ms: float
    x: float  # pixel x of ball center
    y: float  # pixel y of ball center
    confidence: float


def track_ball(video_path: str, progress_callback=None) -> list[BallDetection]:
    """
    Detect the volleyball across frames using background subtraction + circular blob detection.

    Volleyball characteristics:
    - Yellow/white spherical object, ~15–30px diameter at typical iPhone recording distance
    - High motion between frames when attacked
    - Absent for much of each rally (only visible during serve/attack trajectory)

    Returns list of BallDetection (one per detected frame, not necessarily contiguous).
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Background subtractor to isolate moving objects
    bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=120, varThreshold=40, detectShadows=False)

    # SimpleBlobDetector tuned for ball-like objects
    params = cv2.SimpleBlobDetector_Params()
    params.filterByColor = False
    params.filterByArea = True
    params.minArea = 80
    params.maxArea = 2000
    params.filterByCircularity = True
    params.minCircularity = 0.5
    params.filterByConvexity = True
    params.minConvexity = 0.7
    params.filterByInertia = True
    params.minInertiaRatio = 0.3

    detector = cv2.SimpleBlobDetector_create(params)

    detections: list[BallDetection] = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        timestamp_ms = (frame_idx / fps) * 1000.0

        # Apply background subtraction
        fg_mask = bg_subtractor.apply(frame)

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)

        # Detect blobs in the foreground mask
        keypoints = detector.detect(fg_mask)

        if keypoints:
            # Pick the most circular blob that is above the mid-line (ball is usually airborne)
            frame_h = frame.shape[0]
            candidates = [kp for kp in keypoints if kp.pt[1] < frame_h * 0.85]

            if candidates:
                # Sort by size (volleyball has a fairly consistent apparent size)
                best = min(candidates, key=lambda kp: abs(kp.size - 20))
                detections.append(BallDetection(
                    frame_idx=frame_idx,
                    timestamp_ms=timestamp_ms,
                    x=best.pt[0],
                    y=best.pt[1],
                    confidence=best.response if best.response > 0 else 0.5,
                ))

        frame_idx += 1
        if progress_callback and frame_idx % 100 == 0:
            progress_callback(frame_idx, total_frames)

    cap.release()
    return detections


def smooth_trajectory(detections: list[BallDetection], max_gap_frames: int = 10) -> list[BallDetection]:
    """
    Fill short gaps in ball trajectory by linear interpolation.
    Gaps longer than max_gap_frames are left empty (ball not visible = not in play).
    """
    if len(detections) < 2:
        return detections

    result = list(detections)
    filled: list[BallDetection] = []
    filled.append(result[0])

    for i in range(1, len(result)):
        prev = result[i - 1]
        curr = result[i]
        gap = curr.frame_idx - prev.frame_idx

        if 1 < gap <= max_gap_frames:
            for g in range(1, gap):
                t = g / gap
                filled.append(BallDetection(
                    frame_idx=prev.frame_idx + g,
                    timestamp_ms=prev.timestamp_ms + (curr.timestamp_ms - prev.timestamp_ms) * t,
                    x=prev.x + (curr.x - prev.x) * t,
                    y=prev.y + (curr.y - prev.y) * t,
                    confidence=0.3,  # interpolated — lower confidence
                ))

        filled.append(curr)

    return filled
