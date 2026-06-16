export type GameStatus = 'pending_setup' | 'queued' | 'processing' | 'done' | 'error'

// Debug frame — one per detected event, written by the Python worker
export interface DebugFrame {
  index: number              // sequential index within game (0-based)
  event_type: 'serve' | 'attack' | 'receive' | 'set' | 'point_end'
  player: string             // role key e.g. "left_1"
  player_name: string        // human name e.g. "Jonas"
  timestamp_ms: number       // when in the video this frame was taken
  frame_path: string         // Vercel Blob public URL for the annotated JPEG
  bbox: [number, number, number, number] | null  // [x, y, w, h] drawn on frame
  // Review fields — filled in by user on /debug page
  verified: boolean | null   // null = not reviewed, true = correct, false = wrong
  correction: string | null  // free-text when verified === false
}

export interface Game {
  id: string
  title: string | null
  video_path: string         // Vercel Blob public URL
  video_filename: string
  status: GameStatus
  player_left_1: string | null
  player_left_2: string | null
  player_right_1: string | null
  player_right_2: string | null
  court_corners: CourtCorners | null
  results: GameResults | null
  debug_frames: DebugFrame[] | null
  error_message: string | null
  frame_url: string | null   // Vercel Blob public URL for the setup frame JPEG
  created_at: string
  processed_at: string | null
}

export type CourtCorners = [[number, number], [number, number], [number, number], [number, number]]
// [top-left, top-right, bottom-right, bottom-left] in pixel coordinates from the video frame

export interface PlayerStats {
  attacks: number
  attack_errors: number
  attack_efficiency: number
  serves: number
  aces: number
  serve_errors: number
}

export interface HeatmapPoint {
  x: number       // 0.0–1.0 normalised court position
  y: number       // 0.0–1.0 normalised court position
  outcome: 'won' | 'lost'
  timestamp_ms: number
}

export interface Rally {
  number: number
  serving_team: 'left' | 'right'
  winning_team: 'left' | 'right'
  score_left: number
  score_right: number
  end_reason: string
  timestamp_ms: number
}

export interface GameEvent {
  type: 'serve' | 'attack' | 'point_end'
  player: string
  timestamp_ms: number
  outcome?: 'won' | 'lost'
  land_x?: number
  land_y?: number
}

export interface GameResults {
  score: { left: number; right: number }
  duration_ms: number
  player_stats: {
    left_1: PlayerStats
    left_2: PlayerStats
    right_1: PlayerStats
    right_2: PlayerStats
  }
  heatmap_data: {
    left_1: HeatmapPoint[]
    left_2: HeatmapPoint[]
    right_1: HeatmapPoint[]
    right_2: HeatmapPoint[]
  }
  rallies: Rally[]
  events: GameEvent[]
}
