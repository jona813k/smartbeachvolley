import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { del } from '@vercel/blob'

// GET /api/games/[gameId] — fetch a single game
export async function GET(
  _request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT * FROM games WHERE id = ${params.gameId}`
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

// DELETE /api/games/[gameId] — delete game and all its blobs
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT video_path, frame_url, debug_frames FROM games WHERE id = ${params.gameId}`
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const game = rows[0]

  // Collect all Vercel Blob URLs to delete
  const blobUrls: string[] = []
  if (game.video_path) blobUrls.push(game.video_path)
  if (game.frame_url) blobUrls.push(game.frame_url)
  if (Array.isArray(game.debug_frames)) {
    for (const frame of game.debug_frames) {
      if (frame?.frame_path) blobUrls.push(frame.frame_path)
    }
  }

  // Delete blobs (best-effort — don't fail if blobs are already gone)
  if (blobUrls.length > 0) {
    try {
      await del(blobUrls)
    } catch (err) {
      console.warn('Blob deletion partial failure (continuing):', err)
    }
  }

  // Delete DB record
  await sql`DELETE FROM games WHERE id = ${params.gameId}`

  return NextResponse.json({ ok: true })
}
