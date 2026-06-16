# SmartBeachVolley — Project Description

> **Sådan bruger du numrene:** Hvert afsnit og hvert punkt har et nummer i parentes, fx [2.3]. Sig blot "ret [4.2]" eller "omformuler [7.1]" så ved jeg præcis hvad du mener.

---

## [1] Concept

[1.1] An AI-powered post-game video analysis tool for beach volleyball. Jonas uploads a video of a game after it is played and gets back an interactive web report with player stats, outcome-weighted attack heatmaps, a point-by-point rally log, and a filterable event video player.

[1.2] The tool is built for personal use first — Jonas uses it to analyze his own beach volleyball games. The data model and interface are designed with multi-user in mind from the start, so it can be shared with teammates and coaches later without a rewrite.

---

## [2] Why we are building it

[2.1] Beach volleyball players at the recreational and semi-competitive level have no affordable way to get the kind of post-game analysis that professional teams take for granted. Existing platforms (SportsVisio, SmashVision, Hudl/Balltime) are built for indoor volleyball (6v6) or require expensive dedicated camera hardware.

[2.2] None offer outcome-weighted attack heatmaps — knowing not just where a player tends to hit the ball, but whether those shots win or lose points. That coaching insight is the core differentiator of this project.

---

## [3] Camera and video input

[3.1] **Device:** iPhone 17 Pro (likely 4K 60fps — downscaled to 1080p 30fps before processing)

[3.2] **Mount:** Fixed tripod behind the court, slightly elevated so both sides are visible

[3.3] **Position:** Static throughout the game — camera does not pan or move

[3.4] **Court:** Varies per game (outdoor beach volleyball courts)

**Technical implications:**

[3.5] Static camera = single perspective transform per video, computed once from the first frame and applied to the whole video. Simple and robust.

[3.6] Court varies = automatic court detection required per video (cannot hardcode coordinates).

[3.7] 4K input gives headroom; we process at 1080p and downsample further if needed for speed.

---

## [4] Features

[4.0] Features listed in priority order. v1 covers features 1–2; features 3–4 are v1-lite and built out fully in v2.

### [4.1] Outcome-weighted attack heatmap (core differentiator)

[4.1.1] A court diagram showing where each player's attacks land on the opponent's side, coloured by outcome:
- **Green zone** — attack won the point
- **Red zone** — attack resulted in a reception or error (point lost)
- **Gradient intensity** — frequency (how often that zone is targeted)

[4.1.2] This is more valuable than a plain landing-zone heatmap: it shows not just where you hit, but whether it works. No existing product offers this at an affordable price point.

[4.1.3] Both landing zone (where the ball lands) and hit origin (where the attacker was standing) are recorded, so both views can be shown.

### [4.2] Player statistics

[4.2.1] Per-player stats displayed in a summary table:
- Attacks: total, errors, efficiency (won / total)
- Serves: total, aces, errors
- Receptions: total, errors
- Blocks: total

### [4.3] Video with marked events

[4.3.1] The uploaded video is embedded in the web interface with event markers on the timeline. Clicking a marker jumps to that moment in the video.

[4.3.2] **v1-lite:** timestamps only — click an event in the rally log to jump to it in the video.

[4.3.3] **v2 — full filtering:** filter the timeline by player and/or shot type (attack, serve, reception, block) so you can watch only your attacks or only your partner's serves.

### [4.4] Point-by-point rally log

[4.4.1] A scrollable table of every rally: who served, how the point ended (attack error, winner, net fault, etc.), and which team won.

[4.4.2] Clicking a row jumps to that point in the video (linked to feature [4.3]).

### [4.5] Dashboard (all games overview)

[4.5.1] A main dashboard listing all uploaded videos with their status (processing / complete) and key stats (date, score, teams).

[4.5.2] Clicking an entry opens that game's full analysis report.

---

## [5] Upload and setup flow

[5.1] After uploading a video, before processing begins, the user goes through a short setup step:

[5.2] **Court verification** — system extracts a representative frame and draws the detected court boundary overlay. User confirms it looks correct or manually adjusts the four corner points.

[5.3] **Player naming** — user types the names of the two players starting on each side. Example: "Left side: Jonas + Mikkel — Right side: Thomas + Kasper".

[5.4] **Confirm → processing starts** — estimated completion time shown (next morning for cloud, variable for local).

[5.5] This flow solves two problems at once: court detection accuracy and player identity. It also catches bad camera angles or missed court corners before wasting compute time.

---

## [6] Processing and hosting

[6.1] **Target time:** overnight (analysis ready the next morning). This is a retrospective tool, not real-time.

[6.2] **Dual-mode processing:**

| Mode | Where | Cost | Use case |
|---|---|---|---|
| Cloud | GPU instance (Modal or RunPod) | ~2 DKK per game | Primary — upload from anywhere, processed overnight |
| Local | Jonas's Windows PC (AMD GPU) | Free | Testing, development, offline use |

[6.3] The processing pipeline is identical in both modes — same Python code, different execution environment. A simple flag or config switches between local and cloud dispatch.

[6.4] **Jonas's PC:** AMD GPU (exact model TBD — check Device Manager). If the GPU supports ROCm (AMD's CUDA equivalent), local processing runs at full GPU speed. Otherwise falls back to CPU — slower but functional, expect 2–4x realtime on a modern CPU for 1080p.

---

## [7] Player tracking across side switches

[7.1] Beach volleyball teams switch sides every 7 points (every 5 in the tiebreak). This invalidates any position-based or side-based player identification.

[7.2] **Solution:** BotSORT continuous object tracking. Each player is tracked as a unique identity from the moment they first appear until the video ends, regardless of court position. The system follows movement trajectories — not positions or jersey colors. This handles side switches correctly as long as players do not leave the frame for more than a few seconds.

[7.3] Players are pre-named in the setup step (see [5.3]), so the tracker just needs to maintain identity consistency, not infer names.

[7.4] **Known limitation:** if two players with near-identical appearance are fully occluded simultaneously (e.g. both crouch behind the net at the same time), tracking may swap identities. This edge case is flagged in the output rather than silently misattributing stats.

---

## [8] Rules and scoring

[8.1] No hardcoded game formats. The system counts events as they happen and records the score as it evolves. This means:

[8.2] Standard 3-set games (21/21/15) work correctly.

[8.3] Best-of-1 casual games work correctly.

[8.4] Games that go to deuce (23-21, 22-20, etc.) work correctly.

[8.5] Games where the score was miscounted mid-match still produce a valid event log — the rally log shows what actually happened, not what the score "should" have been.

---

## [9] Tech stack

[9.0] **Note:** This project requires Python for the ML/CV pipeline. The entire computer vision ecosystem (YOLOv8, TrackNet, OpenCV, PyTorch) runs in Python. This deviates from Jonas's default TypeScript/C# stack but is the only sensible choice for this domain.

| Layer | Technology | Reason |
|---|---|---|
| [9.1] Video processing / ML | Python 3.11+ | Only viable option for CV/ML ecosystem |
| [9.2] Object detection | YOLOv8 (Ultralytics) | Industry standard, good volleyball pre-trained weights on Roboflow |
| [9.3] Ball tracking | TrackNet v3 | Designed specifically for small fast-moving balls in sports video |
| [9.4] Player tracking | YOLOv8 + BotSORT | Continuous identity tracking across side switches |
| [9.5] Court detection | OpenCV perspective transform | Well-understood, reliable, static camera makes this easy |
| [9.6] Event detection | Rule-based from ball trajectory + VideoMAE fallback | Trajectory change detection for most events; VideoMAE for ambiguous segments |
| [9.7] Backend API | FastAPI (Python) | Async, easy file upload, consistent with processing language |
| [9.8] Task queue | Celery + Redis | Background job processing with status polling |
| [9.9] Web frontend | Next.js (TypeScript) | Jonas's default; clean separation from processing backend |
| [9.10] Database | Supabase (PostgreSQL) | Stores analysis results, game metadata, player stats, event timestamps |
| [9.11] File storage | Supabase Storage | Uploaded videos + processed output files |
| [9.12] Cloud GPU | Modal or RunPod | On-demand GPU for overnight processing (~2 DKK/game) |
| [9.13] Local GPU | PyTorch with ROCm (AMD) or CPU fallback | Free local processing for dev/testing |

---

## [10] Architecture overview

```
User (browser)
    │
    ▼
Next.js frontend
    │
    ├── Upload video → FastAPI /upload
    │       └── Store in Supabase Storage
    │
    ├── Setup step → FastAPI /setup
    │       └── Court detection frame + player naming
    │
    ├── Trigger processing → Celery task dispatched
    │       └── Cloud: Modal/RunPod GPU instance
    │           Local: same Celery worker on Jonas's PC
    │
    └── Poll status / view report → FastAPI /status, /report
            └── Results read from Supabase (PostgreSQL)

Processing pipeline (Python):
    Video → Downsample → Court detection (OpenCV)
         → Player tracking (YOLOv8 + BotSORT)
         → Ball tracking (TrackNet v3)
         → Event detection (trajectory rules + VideoMAE)
         → Attack outcome attribution
         → Write results to Supabase
```

---

## [11] Roadmap

### [11.1] v1 — Foundation (build first)
- [ ] [11.1.1] Video upload and Supabase Storage integration
- [ ] [11.1.2] Setup step: court verification UI + player naming
- [ ] [11.1.3] Court detection (OpenCV perspective transform)
- [ ] [11.1.4] Player tracking (YOLOv8 + BotSORT)
- [ ] [11.1.5] Ball tracking (TrackNet v3)
- [ ] [11.1.6] Basic event detection (serve, attack, point end)
- [ ] [11.1.7] Attack landing zone recording
- [ ] [11.1.8] Outcome-weighted heatmap (win/loss per zone)
- [ ] [11.1.9] Player statistics table
- [ ] [11.1.10] Processing status polling
- [ ] [11.1.11] Game report page
- [ ] [11.1.12] Dashboard (all games list)
- [ ] [11.1.13] Local processing mode (Jonas's PC)

### [11.2] v2 — Video intelligence
- [ ] [11.2.1] Video embed with event markers
- [ ] [11.2.2] Filterable video timeline (by player, by shot type)
- [ ] [11.2.3] Point-by-point rally log with video jump links
- [ ] [11.2.4] Cloud GPU processing (Modal or RunPod integration)
- [ ] [11.2.5] Full event detection (block, dig/reception, net fault)
- [ ] [11.2.6] Hit origin heatmap view (in addition to landing zone)

### [11.3] v3 — Multi-user and season stats
- [ ] [11.3.1] Auth (invite-only or open signup)
- [ ] [11.3.2] Multi-game season aggregation
- [ ] [11.3.3] Opponent scouting (analyze video with other teams)
- [ ] [11.3.4] Shareable report links

---

## [12] Research notes

[12.1] **SportsVisio**: $34/game or $199/month. Indoor volleyball stats only. No beach volleyball support. No attack heatmap.

[12.2] **SmashVision AI**: Pay-per-match, built for club/team indoor use. No beach-specific features.

[12.3] **Hudl/Balltime**: Industry standard, requires dedicated cameras, expensive. Not relevant.

[12.4] **Open source available**: VolleyBallYolo dataset on Roboflow (pre-labelled, ready to fine-tune). `openvolley/ovml` (R package with YOLO models). `VolleyVision` GitHub project. Tennis Analyzer YOLOv8 (reference architecture for court mapping + 2D top-down view — directly applicable).

[12.5] **Key technical insight**: Perspective transformation is the foundation for all spatial analysis. Well-understood with working implementations in the tennis analyzer reference project.

[12.6] **Hardest problem**: Event detection. Approach: trajectory-based rules for clear cases (ball velocity drop = point end, player contact = hit event) + VideoMAE video transformer for ambiguous segments.

[12.7] **Second hardest**: Player identity across side switches. Solution: continuous BotSORT tracking, not position-based logic.

---

## Folder location
`C:\Claude_projects\SmartBeachVolley\`
