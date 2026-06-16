# SmartBeachVolley

AI-powered post-game beach volleyball video analysis tool. Jonas uploads a video after a game and gets back a web report with an outcome-weighted attack heatmap, player stats, and a point-by-point rally log.

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (TypeScript) | 14.2.x |
| Styling | Tailwind CSS | 3.x |
| Auth | JWT (jose) in HTTP-only cookie | — |
| Database | Supabase (PostgreSQL) | — |
| Storage | Supabase Storage | — |
| Python worker | Python | 3.11+ |
| Detection | YOLOv8 (ultralytics) | latest |
| Tracking | BotSORT via supervision | latest |
| Ball | OpenCV background subtraction | 4.9+ |

---

## Folder structure

```
SmartBeachVolley/
├── frontend/              Next.js app (deployed to Vercel)
│   ├── app/               App Router pages and API routes
│   ├── components/        Heatmap, StatsTable, RallyLog, CourtEditor, PlayerNameForm
│   └── lib/               supabase.ts, auth.ts, types.ts, utils.ts
├── pipeline/              Python ML worker (runs locally on Jonas's PC)
│   ├── worker.py          Main polling loop
│   ├── court.py           Perspective transform
│   ├── players.py         YOLOv8 + BotSORT tracking
│   ├── ball.py            Ball detection (background subtraction)
│   ├── events.py          Event detection + rally reconstruction
│   ├── storage.py         Supabase Storage/DB helpers
│   └── run.sh             Convenience startup script
└── supabase/
    └── schema.sql         Run this in Supabase SQL editor to create the games table
```

---

## How to run locally

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run dev
```

Visit http://localhost:3000 — login with username `jonas` and the password from `.env.local`.

### Python worker

```bash
cd pipeline
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
bash run.sh
```

The worker polls Supabase every 30s for queued games. Keep it running overnight while games process.

---

## Deploy (frontend)

1. Push `frontend/` to GitHub repo `jona813k/smartbeachvolley`
2. Import to Vercel — root directory: `frontend`
3. Add all env vars from `.env.local.example` in Vercel dashboard
4. Deploy

---

## Hardcoded credentials

```
ADMIN_USERNAME=jonas
ADMIN_PASSWORD=<generate a strong password>
JWT_SECRET=<openssl rand -base64 32>
```

---

## Architecture decisions

- **No public FastAPI server**: The Python worker polls Supabase directly. No port-forwarding or public IP needed — just Jonas's PC running `run.sh`.
- **Frame extraction on worker**: The court setup frame is extracted by the worker after upload (not in the API). The setup page polls `/api/games/:id/frame` every 5s waiting for the frame to appear.
- **next.config.mjs (not .ts)**: Next.js 14 does not support `next.config.ts`. Always use `.mjs`.
- **`target: ES2017`** in tsconfig: Required for `Map.entries()` iteration without `--downlevelIteration`.
- **Service role key server-side only**: The Supabase service role key is never sent to the browser. All storage access goes through Next.js API routes.
- **Ball tracking**: Using OpenCV background subtraction + blob detection as a first version. TrackNet v3 can be swapped in later by replacing `ball.track_ball()`.

---

## Version notes

- Next.js 14.x: use `next.config.mjs`, NOT `next.config.ts`
- TypeScript target must be `ES2017` or higher for Map iteration
- Tailwind 3.x: config format is `tailwind.config.ts` with `export default`
- Python 3.11+ required (uses `X | Y` union type syntax in type hints)

---

## Known limitations (v1)

- Ball tracking is heuristic — misses fast attacks and indoor-style cuts
- Player role assignment can fail if camera angle is unusual
- Side-switch tracking: BotSORT maintains IDs but role reassignment after side switches is not yet implemented
- No GPU acceleration (CPU only for now — Jonas's PC: AMD Ryzen 5 5500, no discrete GPU confirmed)
- Processing time: ~3–5× real-time on CPU (1hr game ≈ 3–5hrs processing)
- Max video size limited by Vercel's 4.5MB body limit — upload goes directly to Supabase Storage via API route with `maxDuration = 300`

---

## Runtime verification

- Config file format: `next.config.mjs` ✓ (Next.js 14 compatible)
- TypeScript target: `ES2017` ✓
- Python syntax: verified with `py_compile`
- npm build: see REVIEW.md
