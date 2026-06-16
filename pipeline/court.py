"""
court.py — Court detection via perspective transform.

Takes the 4 corner pixel coordinates from the setup step and creates a perspective
transform matrix that maps video pixels → normalised court coordinates [0,1].
"""

import cv2
import numpy as np


def extract_frame(video_path: str, frame_path: str, frame_number: int = 60) -> None:
    """Extract a single frame from the video and save as JPEG.

    Defaults to frame 60 (~2s into a 30fps video) to skip the initial fade.
    Falls back to frame 0 if video is shorter.
    """
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    target = min(frame_number, total - 1)
    cap.set(cv2.CAP_PROP_POS_FRAMES, target)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise RuntimeError(f"Failed to extract frame {target} from {video_path}")

    cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])


def build_transform(corners: list[list[int]]) -> np.ndarray:
    """Build the perspective transform matrix from the 4 corner points.

    corners: [[x,y], [x,y], [x,y], [x,y]] in order: top-left, top-right, bottom-right, bottom-left
    Returns a 3x3 homography matrix M such that cv2.perspectiveTransform(pt, M) → [0,1]×[0,1]
    """
    src = np.array(corners, dtype=np.float32)

    # Destination: normalised unit square
    dst = np.array([
        [0.0, 0.0],  # top-left
        [1.0, 0.0],  # top-right
        [1.0, 1.0],  # bottom-right
        [0.0, 1.0],  # bottom-left
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(src, dst)
    return M


def pixel_to_court(pixel_x: float, pixel_y: float, M: np.ndarray) -> tuple[float, float]:
    """Transform a single pixel coordinate to normalised court [0,1]×[0,1]."""
    pt = np.array([[[pixel_x, pixel_y]]], dtype=np.float32)
    result = cv2.perspectiveTransform(pt, M)
    cx, cy = float(result[0][0][0]), float(result[0][0][1])
    # Clamp to [0, 1]
    cx = max(0.0, min(1.0, cx))
    cy = max(0.0, min(1.0, cy))
    return cx, cy
