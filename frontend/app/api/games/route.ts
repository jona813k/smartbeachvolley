import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET /api/games — list all games ordered by created_at desc
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await sql`
    SELECT id, title, video_filename, status, created_at, processed_at,
           player_left_1, player_left_2, player_right_1, player_right_2, results
    FROM games
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

// POST /api/games — create a new game record (called after video upload)
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, video_path, video_filename } = await request.json()
  if (!video_path || !video_filename) {
    return NextResponse.json({ error: 'video_path and video_filename are required' }, { status: 400 })
  }

  const { rows } = await sql`
    INSERT INTO games (title, video_path, video_filename, status)
    VALUES (${title ?? null}, ${video_path}, ${video_filename}, 'pending_setup')
    RETURNING *
  `
  return NextResponse.json(rows[0], { status: 201 })
}
