-- SmartBeachVolley — Supabase schema
-- Run this in the Supabase SQL editor

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
  results         JSONB,   -- see Results JSON schema in TASK.md
  error_message   TEXT,

  -- Debug frames (written by Python worker alongside results)
  -- Array of DebugFrame objects — one per detected event
  -- Each frame: { index, event_type, player, player_name, timestamp_ms,
  --               frame_path, bbox, verified, correction }
  debug_frames    JSONB,

  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at    TIMESTAMPTZ
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON games FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX games_status_idx ON games(status);
CREATE INDEX games_created_at_idx ON games(created_at DESC);

-- Migration (run this if you already have the games table):
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS debug_frames JSONB;

-- Storage bucket: game-videos
-- Create this in Supabase dashboard → Storage → New bucket
-- Name: game-videos
-- Public: false (private)
-- File size limit: 2GB (or as large as needed for video files)
