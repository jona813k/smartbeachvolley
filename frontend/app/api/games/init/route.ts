import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

// POST /api/games/init — pre-create a game row so we have a gameId before client-side blob upload
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const title = body.title ?? null
    const gameId = randomUUID()

    await sql`
      INSERT INTO games (id, title, video_path, video_filename, status)
      VALUES (${gameId}, ${title}, 'pending', 'pending', 'pending_setup')
    `

    return NextResponse.json({ gameId }, { status: 201 })
  } catch (err) {
    console.error('Game init error:', err)
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
  }
}
