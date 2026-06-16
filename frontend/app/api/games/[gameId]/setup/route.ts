import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

// POST /api/games/[gameId]/setup — save player names + court corners, set status to 'queued'
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    player_left_1,
    player_left_2,
    player_right_1,
    player_right_2,
    court_corners,
  } = await request.json()

  if (!player_left_1 || !player_left_2 || !player_right_1 || !player_right_2) {
    return NextResponse.json({ error: 'All four player names are required' }, { status: 400 })
  }

  if (!court_corners || !Array.isArray(court_corners) || court_corners.length !== 4) {
    return NextResponse.json({ error: 'court_corners must be an array of 4 [x,y] points' }, { status: 400 })
  }

  const { rows } = await sql`
    UPDATE games
    SET
      player_left_1  = ${player_left_1},
      player_left_2  = ${player_left_2},
      player_right_1 = ${player_right_1},
      player_right_2 = ${player_right_2},
      court_corners  = ${JSON.stringify(court_corners)}::jsonb,
      status         = 'queued'
    WHERE id = ${params.gameId}
    RETURNING *
  `
  if (!rows[0]) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}
