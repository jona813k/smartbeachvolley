/**
 * PATCH /api/games/[gameId]/debug
 *
 * Updates the verified + correction fields on a single debug frame.
 * Body: { index: number, verified: boolean, correction: string | null }
 *
 * Loads the full debug_frames array, patches the matching entry, and writes
 * it back — Postgres JSONB doesn't support partial array updates natively.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gameId } = params
  const body = await req.json()
  const { index, verified, correction } = body

  if (typeof index !== 'number') {
    return NextResponse.json({ error: 'index is required' }, { status: 400 })
  }

  // Fetch current debug_frames
  const gameRows = await sql`SELECT debug_frames FROM games WHERE id = ${gameId}`
  if (!gameRows[0]) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const frames: any[] = Array.isArray(gameRows[0].debug_frames) ? gameRows[0].debug_frames : []

  const frameIdx = frames.findIndex((f: any) => f.index === index)
  if (frameIdx === -1) {
    return NextResponse.json({ error: `Frame index ${index} not found` }, { status: 404 })
  }

  // Patch the specific frame
  frames[frameIdx] = {
    ...frames[frameIdx],
    verified: verified ?? null,
    correction: correction ?? null,
  }

  await sql`UPDATE games SET debug_frames = ${JSON.stringify(frames)}::jsonb WHERE id = ${gameId}`

  return NextResponse.json({ ok: true, frame: frames[frameIdx] })
}

/**
 * GET /api/games/[gameId]/debug
 *
 * Returns the game's debug_frames array. frame_path on each frame is a
 * Vercel Blob public URL — no signing needed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gameId } = params

  const rows = await sql`
    SELECT id, debug_frames, player_left_1, player_left_2, player_right_1, player_right_2
    FROM games
    WHERE id = ${gameId}
  `
  if (!rows[0]) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const frames: any[] = Array.isArray(rows[0].debug_frames) ? rows[0].debug_frames : []

  // frame_path is a public Blob URL — return it directly as signed_url for client compatibility
  const framesWithUrls = frames.map((frame) => ({
    ...frame,
    signed_url: frame.frame_path ?? null,
  }))

  return NextResponse.json({ frames: framesWithUrls })
}
