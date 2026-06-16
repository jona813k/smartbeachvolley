import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET /api/games/[gameId]/frame — return the public Blob URL for the setup frame JPEG
export async function GET(
  _request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await sql`SELECT frame_url FROM games WHERE id = ${params.gameId}`
  if (!rows[0]) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!rows[0].frame_url) return NextResponse.json({ error: 'Frame not ready' }, { status: 404 })

  return NextResponse.json({ url: rows[0].frame_url })
}
