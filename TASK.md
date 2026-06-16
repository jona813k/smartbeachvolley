<!-- RESTART -->
<!-- INSTRUCTION: Skip the Coder. Load C:\Claude_projects\_skills\3_reviewer.md and run a full review of this project against the spec below. Fix all Critical and Major issues autonomously, then produce REVIEW.md and hand off to the Deployer. -->
# SmartBeachVolley — TASK.md

## Project overview
AI-powered post-game video analysis tool for beach volleyball. Jonas uploads a video after a game and gets back a web report with an outcome-weighted attack heatmap, player stats, and a point-by-point rally log. Personal use only in v1.

---

## What is being built

### Frontend — Next.js (TypeScript) on Vercel
- Login page (hardcoded credentials, same JWT pattern as FastForWhat)
- Dashboard: list of all uploaded games with status and key stats
- Upload page: video file upload → Supabase Storage
- Setup step: court corner verification + player naming (before processing starts)
- Processing status page: polls Supabase every 5s for status updates
- Game report page: heatmap, stats table, rally log

### Backend — Local Python worker (runs on Jonas's PC)
- Polls Supabase for games with status `queued`
- Downloads video from Supabase Storage
- Runs ML pipeline (see below)
- Writes results back to Supabase
- No public API needed — all communication via Supabase

### ML pipeline (Python)
1. Court detection (OpenCV perspective transform — 4 corner points from setup step)
2. Player tracking (YOLOv8 + BotSORT — continuous identity across side switches)
3. Ball tracking (TrackNet v3)
4. Event detection (rule-based from trajectory: serve, attack, point end)
5. Attack outcome attribution (win/loss per attack landing zone)
6. Write JSON results to Supabase

---

## Architecture

```
Next.js (Vercel)  ──────────────────────┐
        │                               │
        │ upload video                  │ read results
        ▼                               ▼
Supabase Storage              Supabase DB (PostgreSQL)
        │                               ▲
        │ download video                │ write results
        ▼                               │
Local Python worker (Jonas's PC) ───────┘
  polls every 30s for queued jobs
```

No public-facing FastAPI server in v1. The Python worker polls Supabase directly. This means processing only runs when Jonas's PC is on and the worker is running.

---

## Database schema

### `games` table
```sql
CREATE TABLE games (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT,                          -- optional label e.g. "vs Thomas 2026-04-28"
  video_path      TEXT NOT NULL,                 -- Supabase Storage path
  video_filename  TEXT NOT NULL,                 -- original filename
  status          TEXT NOT NULL DEFAULT 'pending_setup'
                  CHECK (status IN ('pending_setup', 'queued', 'processing', 'done', 'error')),

  -- Player names (set in setup step)
  player_left_1   TEXT,
  player_left_2   TEXT,
  player_right_1  TEXT,
  player_right_2  TEXT,

  -- Court corners (set in setup step) — 4 pixel [x,y] points from video frame
  court_corners   JSONB,

  -- Processing results (written by Python worker)
  results         JSONB,   -- see Results JSON schema below
  error_message   TEXT,

  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at    TIMESTAMPTZ
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON games FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX games_status_idx ON games(status);
CREATE INDEX games_created_at_idx ON games(created_at DESC);
```

### Results JSON schema (stored in `games.results`)
```json
{
  "score": { "left": 21, "right": 18 },
  "duration_ms": 2700000,
  "player_stats": {
    "left_1": { "attacks": 34, "attack_errors": 4, "attack_efficiency": 0.82, "serves": 12, "aces": 2, "serve_errors": 1 },
    "left_2": { ... },
    "right_1": { ... },
    "right_2": { ... }
  },
  "heatmap_data": {
    "left_1": [
      { "x": 0.3, "y": 0.7, "outcome": "won", "timestamp_ms": 12400 },
      { "x": 0.6, "y": 0.2, "outcome": "lost", "timestamp_ms": 34800 }
    ],
    "left_2": [ ... ],
    "right_1": [ ... ],
    "right_2": [ ... ]
  },
  "rallies": [
    {
      "number": 1,
      "serving_team": "left",
      "winning_team": "left",
      "score_left": 1,
      "score_right": 0,
      "end_reason": "attack_winner",
      "timestamp_ms": 8200
    }
  ],
  "events": [
    { "type": "serve", "player": "left_1", "timestamp_ms": 5000 },
    { "type": "attack", "player": "right_2", "timestamp_ms": 7100, "outcome": "won", "land_x": 0.4, "land_y": 0.3 }
  ]
}
```

### Supabase Storage bucket
- Bucket name: `game-videos`
- Private (only accessible via service role key)
- Videos uploaded as: `{game_id}/original.{ext}`
- Frame screenshot uploaded as: `{game_id}/frame.jpg` (used for court setup step)

---

## Auth
Single hardcoded admin user. Same JWT/HTTP-only-cookie approach as FastForWhat.

```
ADMIN_USERNAME=jonas
ADMIN_PASSWORD=[strong password — generate at build time]
JWT_SECRET=[generate with: openssl rand -base64 32]
```

Middleware protects all routes except `/login` and `/api/login`.

---

## Branding and design
- Clean, minimal dark sports aesthetic
- Primary color: dark navy `#0F172A` with accent `#3B82F6` (blue)
- Font: Inter (body), system-ui fallback
- No Aarhus 1900 branding — this is Jonas's personal tool
- Desktop-first (same as FastForWhat)
- No logo needed for v1 — text only

---

## Environment variables

### Next.js (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_USERNAME=jonas
ADMIN_PASSWORD=
JWT_SECRET=
```

### Python worker (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
POLL_INTERVAL_SECONDS=30
```

---

## Folder structure
```
C:\Claude_projects\SmartBeachVolley\
├── frontend/                    ← Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← redirect to /dashboard
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── upload/page.tsx
│   │   ├── setup/[gameId]/page.tsx
│   │   ├── status/[gameId]/page.tsx
│   │   └── report/[gameId]/page.tsx
│   ├── components/
│   │   ├── Heatmap.tsx          ← SVG court diagram with attack dots
│   │   ├── StatsTable.tsx
│   │   ├── RallyLog.tsx
│   │   ├── CourtEditor.tsx      ← drag corners to verify court detection
│   │   └── PlayerNameForm.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── types.ts
│   ├── middleware.ts
│   └── ...config files
│
├── pipeline/                    ← Python ML worker
│   ├── worker.py                ← main polling loop
│   ├── court.py                 ← perspective transform
│   ├── players.py               ← YOLOv8 + BotSORT tracking
│   ├── ball.py                  ← TrackNet v3
│   ├── events.py                ← event detection from trajectories
│   ├── heatmap.py               ← outcome attribution
│   ├── storage.py               ← Supabase upload/download helpers
│   ├── requirements.txt
│   ├── .env
│   └── run.sh                   ← convenience script: activates venv + starts worker
│
├── supabase/
│   └── schema.sql
│
├── Project description SmartBeachVolley.md
└── TASK.md
```

---

## Hosting and deployment

### Frontend
- GitHub repo: `jona813k/smartbeachvolley` (private)
- Vercel project: `smartbeachvolley` (new project, separate from FastForWhat)
- Auto-deploy from `main` branch

### Backend (Python worker)
- Runs locally on Jonas's PC
- Start command: `bash pipeline/run.sh`
- Can be set up as a scheduled Windows Task to run overnight
- No public IP or port opening required

---

## Tech stack versions
- Next.js: 14.2.x (same as FastForWhat — avoid 15.x for now)
- React: 18
- TypeScript: 5
- Tailwind CSS: 3.x
- Python: 3.11+
- ultralytics (YOLOv8): latest
- torch: 2.x (CPU for now — ROCm if AMD GPU confirmed)
- supervision (BotSORT): latest
- supabase-py: latest
- python-dotenv: latest

---

## Security
- All video access via service role key (server-side only)
- No public upload endpoint — must be authenticated
- Videos stored privately in Supabase Storage
- JWT in HTTP-only cookie (same as FastForWhat)

---

## Testing
- No automated tests for v1 ML pipeline (too complex to mock)
- Basic smoke test: upload a 30s clip, confirm status reaches `done` and results JSON is non-empty
- Frontend: manual testing only for v1

---

## Out of scope for v1
- Cloud GPU processing (Modal/RunPod)
- Video playback with event markers
- Filterable video timeline
- Real-time/live analysis
- Multi-user auth
- Season aggregation
- Mobile interface
- Opponent scouting

---

## Definition of done

### Frontend
- [ ] Login works with hardcoded credentials
- [ ] Dashboard lists games with status badges
- [ ] Upload page accepts video files and stores in Supabase Storage
- [ ] Setup step shows extracted frame with court overlay (editable corners)
- [ ] Setup step saves player names and court corners → sets status to `queued`
- [ ] Status page polls and updates every 5 seconds
- [ ] Report page renders heatmap SVG with outcome-coloured dots
- [ ] Report page shows player stats table
- [ ] Report page shows rally log
- [ ] Deployed to Vercel

### Python worker
- [ ] Polls Supabase every 30s for `queued` games
- [ ] Downloads video from Supabase Storage
- [ ] Extracts frame for court setup (uploads to Storage)
- [ ] Runs court detection using corners from setup step
- [ ] Tracks all 4 players with BotSORT
- [ ] Tracks ball with TrackNet v3
- [ ] Detects serve / attack / point end events
- [ ] Records attack landing zones with win/loss outcome
- [ ] Writes results JSON to `games.results`
- [ ] Sets status to `done` (or `error` on failure)
- [ ] run.sh starts worker cleanly

### End-to-end
- [ ] Upload → setup → queued → processing → done flow works on a real clip
- [ ] Heatmap shows dots at correct court positions
- [ ] Stats match manually counted events (spot-check on 5 rallies)

---

## Folder location
`C:\Claude_projects\SmartBeachVolley\`
