"""
events.py — Rule-based event detection from ball and player trajectories.

Detects:
  - Serve: ball first appears near server's position, upward then downward trajectory
  - Attack: ball moving fast toward opponent side, followed by landing
  - Point end: ball hits ground or goes OOB (ball disappears after landing zone)

All timestamps are in milliseconds.
"""

from dataclasses import dataclass, field
from typing import Literal
from ball import BallDetection
import numpy as np


EventType = Literal["serve", "attack", "point_end"]
Outcome = Literal["won", "lost"]


@dataclass
class GameEvent:
    type: EventType
    player: str         # e.g. "left_1"
    timestamp_ms: float
    outcome: Outcome | None = None
    land_x: float | None = None   # normalised court coords
    land_y: float | None = None


@dataclass
class Rally:
    number: int
    serving_team: Literal["left", "right"]
    winning_team: Literal["left", "right"] | None = None
    score_left: int = 0
    score_right: int = 0
    end_reason: str = "unknown"
    timestamp_ms: float = 0.0


def detect_events(
    ball_detections: list[BallDetection],
    player_tracks: dict[str, list[tuple[int, float, float]]],  # role → [(frame, cx, cy)]
    court_transform,  # court.pixel_to_court function (partial with M baked in)
    fps: float = 30.0,
) -> tuple[list[GameEvent], list[Rally]]:
    """
    Analyse ball trajectory to detect events and reconstruct rallies.

    Strategy:
    1. Find ball speed profile (large speed spikes = impact)
    2. Classify impact as serve, attack, or ground contact based on:
       - Ball height (y coord), ball speed, proximity to players
    3. Group events into rallies (point_end marks end of each rally)
    """
    events: list[GameEvent] = []
    rallies: list[Rally] = []

    if len(ball_detections) < 10:
        return events, rallies  # not enough data

    # Build lookup: frame_idx → BallDetection
    ball_by_frame: dict[int, BallDetection] = {d.frame_idx: d for d in ball_detections}

    # Build lookup: frame_idx → dict[role, (cx, cy)]
    player_by_frame: dict[int, dict[str, tuple[float, float]]] = {}
    for role, positions in player_tracks.items():
        for (frame_idx, cx, cy) in positions:
            if frame_idx not in player_by_frame:
                player_by_frame[frame_idx] = {}
            player_by_frame[frame_idx][role] = (cx, cy)

    # Compute frame-by-frame ball speed (pixels/frame)
    frames = sorted(ball_by_frame.keys())
    speeds: dict[int, float] = {}
    for i in range(1, len(frames)):
        f0, f1 = frames[i - 1], frames[i]
        if f1 - f0 > 5:
            continue  # gap too large
        d0, d1 = ball_by_frame[f0], ball_by_frame[f1]
        dist = np.hypot(d1.x - d0.x, d1.y - d0.y)
        speeds[f1] = dist / (f1 - f0)

    # Detect speed peaks (impacts) — threshold: >25 px/frame
    SPEED_THRESHOLD = 25.0
    MIN_GAP_FRAMES = int(fps * 0.5)  # min 0.5s between events

    peaks: list[int] = []
    last_peak = -MIN_GAP_FRAMES
    for f in frames:
        spd = speeds.get(f, 0.0)
        if spd > SPEED_THRESHOLD and f - last_peak >= MIN_GAP_FRAMES:
            peaks.append(f)
            last_peak = f

    # Classify each impact
    score_left = 0
    score_right = 0
    rally_number = 1
    serving_team: Literal["left", "right"] = "left"
    rally_start_ms = 0.0

    current_rally = Rally(
        number=rally_number,
        serving_team=serving_team,
        timestamp_ms=0.0,
    )

    for peak_frame in peaks:
        ball = ball_by_frame[peak_frame]
        ts_ms = ball.timestamp_ms
        players_at = player_by_frame.get(peak_frame, {})

        # Find nearest player to ball at this frame
        nearest_role, nearest_dist = _nearest_player(ball.x, ball.y, players_at)

        # Classify: is the ball in the upper half (attack/serve) or lower (landing)?
        ball_court_x, ball_court_y = court_transform(ball.x, ball.y)
        is_high = ball.y < _frame_height(ball_by_frame) * 0.6

        if len(peaks) > 1 and peak_frame == peaks[0]:
            # First impact is always a serve
            event = GameEvent(type="serve", player=nearest_role or "left_1", timestamp_ms=ts_ms)
            events.append(event)
        elif is_high and nearest_dist < 80:
            # Ball high + player nearby → attack
            # Outcome determined by next landing event
            attacker_side = "left" if (nearest_role or "").startswith("left") else "right"
            event = GameEvent(type="attack", player=nearest_role or "left_1", timestamp_ms=ts_ms)
            events.append(event)

            # Look ahead for next low-speed frame (landing)
            landing = _find_landing(peak_frame, frames, speeds, ball_by_frame, fps)
            if landing:
                land_cx, land_cy = court_transform(landing.x, landing.y)
                # Landing on opponent side = won; own side = lost (or out)
                if attacker_side == "left":
                    outcome: Outcome = "won" if land_cx > 0.5 else "lost"
                else:
                    outcome = "won" if land_cx < 0.5 else "lost"

                event.outcome = outcome
                event.land_x = land_cx
                event.land_y = land_cy

                # Point end
                if attacker_side == "left":
                    winner: Literal["left", "right"] = "left" if outcome == "won" else "right"
                else:
                    winner = "right" if outcome == "won" else "left"

                if winner == "left":
                    score_left += 1
                else:
                    score_right += 1

                current_rally.winning_team = winner
                current_rally.score_left = score_left
                current_rally.score_right = score_right
                current_rally.end_reason = "attack_winner" if outcome == "won" else "attack_error"
                rallies.append(current_rally)

                events.append(GameEvent(type="point_end", player="", timestamp_ms=landing.timestamp_ms))

                rally_number += 1
                serving_team = winner
                current_rally = Rally(
                    number=rally_number,
                    serving_team=serving_team,
                    timestamp_ms=landing.timestamp_ms,
                )

    # Close any open rally
    if current_rally.winning_team is None and len(rallies) > 0:
        # Incomplete — don't add
        pass

    return events, rallies


def _nearest_player(
    bx: float, by: float, players: dict[str, tuple[float, float]]
) -> tuple[str | None, float]:
    if not players:
        return None, float("inf")
    dists = {role: np.hypot(bx - cx, by - cy) for role, (cx, cy) in players.items()}
    best = min(dists, key=lambda r: dists[r])
    return best, dists[best]


def _find_landing(
    peak_frame: int,
    frames: list[int],
    speeds: dict[int, float],
    ball_by_frame: dict[int, BallDetection],
    fps: float,
) -> BallDetection | None:
    """Find the first frame after peak where ball speed drops below 10 px/frame."""
    max_look = int(fps * 1.5)  # look ahead 1.5 seconds
    for f in frames:
        if f <= peak_frame:
            continue
        if f > peak_frame + max_look:
            break
        if speeds.get(f, 999) < 10:
            return ball_by_frame[f]
    return None


def _frame_height(ball_by_frame: dict[int, BallDetection]) -> float:
    if not ball_by_frame:
        return 1080.0
    return max(d.y for d in ball_by_frame.values()) * 1.2


def compute_player_stats(events: list[GameEvent], player_names: dict[str, str]) -> dict:
    """Aggregate event data into per-player stats."""
    stats: dict[str, dict] = {}
    for role in ["left_1", "left_2", "right_1", "right_2"]:
        player_events = [e for e in events if e.player == role]
        attacks = [e for e in player_events if e.type == "attack"]
        serves = [e for e in player_events if e.type == "serve"]
        attack_wins = sum(1 for e in attacks if e.outcome == "won")
        attack_errors = sum(1 for e in attacks if e.outcome == "lost")
        aces = sum(1 for e in serves if e.outcome == "won")
        serve_errors = sum(1 for e in serves if e.outcome == "lost")
        efficiency = (attack_wins / len(attacks)) if attacks else 0.0

        stats[role] = {
            "attacks": len(attacks),
            "attack_errors": attack_errors,
            "attack_efficiency": round(efficiency, 3),
            "serves": len(serves),
            "aces": aces,
            "serve_errors": serve_errors,
        }
    return stats


def build_heatmap_data(events: list[GameEvent]) -> dict:
    """Build per-player heatmap arrays from attack events."""
    heatmap: dict[str, list] = {"left_1": [], "left_2": [], "right_1": [], "right_2": []}
    for e in events:
        if e.type == "attack" and e.land_x is not None and e.land_y is not None and e.player in heatmap:
            heatmap[e.player].append({
                "x": round(e.land_x, 4),
                "y": round(e.land_y, 4),
                "outcome": e.outcome,
                "timestamp_ms": int(e.timestamp_ms),
            })
    return heatmap
