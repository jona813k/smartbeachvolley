-- SmartBeachVolley — Vercel Postgres schema
-- Run once in psql or the Vercel Postgres query console

CREATE TABLE IF NOT EXISTS games (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT,
  video_path      TEXT NOT NULL,          -- Vercel Blob public URL
  video_filename  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_setup'
                  CHECK (status IN ('pending_setup', 'queued', 'processing', 'done', 'error')),

  player_left_1   TEXT,
  player_left_2   TEXT,
  player_right_1  TEXT,
  player_right_2  TEXT,

  court_corners   JSONB,                  -- [[x,y] x 4]

  results         JSONB,
  error_message   TEXT,

  debug_frames    JSONB,                  -- array of DebugFrame objects

  frame_url       TEXT,                   -- Vercel Blob public URL for setup frame JPEG

  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS games_status_idx     ON games(status);
CREATE INDEX IF NOT EXISTS games_created_at_idx ON games(created_at DESC);
