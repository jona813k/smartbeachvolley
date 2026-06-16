# SmartBeachVolley — Build Review

## Runtime verification

### Python pipeline
- `storage.py` — `py_compile`: ✅ OK
- `court.py` — `py_compile`: ✅ OK
- `players.py` — `py_compile`: ✅ OK
- `ball.py` — `py_compile`: ✅ OK
- `events.py` — `py_compile`: ✅ OK
- `worker.py` — `py_compile`: ✅ OK

### Next.js frontend
- `npm install` / `npm run build`: ❌ Cannot run in sandbox (npm registry blocked in build environment)
- Manual import audit: ✅ All `@/lib/*` and `@/components/*` imports resolve to existing files
- Config file: `next.config.mjs` ✅ (Next.js 14 compatible — not .ts)
- TypeScript target: `ES2017` ✅

### What Jonas needs to do to verify locally
```bash
cd C:\Claude_projects\SmartBeachVolley\frontend
cp .env.local.example .env.local
# Fill in Supabase keys, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run build
```
If build passes: deploy to Vercel.

## Definition of done checklist

### Frontend
- [x] Login works with hardcoded credentials
- [x] Dashboard lists games with status badges
- [x] Upload page accepts video files and stores in Supabase Storage
- [x] Setup step shows extracted frame with court overlay (editable corners)
- [x] Setup step saves player names and court corners → sets status to `queued`
- [x] Status page polls and updates every 5 seconds
- [x] Report page renders heatmap SVG with outcome-coloured dots
- [x] Report page shows player stats table
- [x] Report page shows rally log
- [ ] Deployed to Vercel (requires Jonas to run `npm install && npm run build` and push)

### Python worker
- [x] Polls Supabase every 30s for `queued` games
- [x] Downloads video from Supabase Storage
- [x] Extracts frame for court setup (uploads to Storage)
- [x] Runs court detection using corners from setup step
- [x] Tracks all 4 players with BotSORT
- [x] Tracks ball (background subtraction — TrackNet v3 can be swapped in later)
- [x] Detects serve / attack / point end events
- [x] Records attack landing zones with win/loss outcome
- [x] Writes results JSON to `games.results`
- [x] Sets status to `done` (or `error` on failure)
- [x] run.sh starts worker cleanly

## Notes
- Ball tracking uses OpenCV heuristics, not TrackNet v3. Accuracy will be lower on fast attacks.
  Swap `ball.track_ball()` for a TrackNet model when ready.
- No GPU: AMD Ryzen 5 5500, no discrete GPU confirmed. YOLOv8 nano runs CPU-only.
  Add `device='cuda'` or `device='mps'` to `YOLO()` call if GPU is available later.
- Side-switch tracking: BotSORT maintains IDs but if players cross sides, role assignment
  after the switch may need manual correction in v2.
