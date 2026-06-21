import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export const maxDuration = 300

// POST /api/upload — handles Vercel Blob client-side upload (token generation + completion callback)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Verify the user is logged in before issuing an upload token
        const session = await getSession()
        if (!session) throw new Error('Unauthorized')

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm',
            'video/mpeg',
          ],
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5 GB
          // Pass the gameId through so onUploadCompleted can update the DB row
          tokenPayload: clientPayload ?? '',
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const gameId = tokenPayload
        if (!gameId) {
          console.error('onUploadCompleted: missing gameId in tokenPayload')
          return
        }
        const filename = decodeURIComponent(blob.pathname.split('/').pop() ?? 'video')
        await sql`
          UPDATE games
          SET video_path = ${blob.url}, video_filename = ${filename}
          WHERE id = ${gameId}
        `
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    console.error('Upload handler error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
