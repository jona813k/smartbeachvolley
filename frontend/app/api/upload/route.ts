import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'

export const maxDuration = 300 // 5 min timeout for large video files

// POST /api/upload — upload a video to Vercel Blob and create a game record
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('video') as File | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported video format. Use MP4, MOV, or WebM.' }, { status: 400 })
    }

    const gameId = randomUUID()
    const ext = file.name.split('.').pop() || 'mp4'
    const blobPath = `${gameId}/original.${ext}`

    // Upload to Vercel Blob
    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type,
    })

    // Create game record
    const { rows } = await sql`
      INSERT INTO games (id, title, video_path, video_filename, status)
      VALUES (${gameId}, ${title ?? null}, ${blob.url}, ${file.name}, 'pending_setup')
      RETURNING *
    `

    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
