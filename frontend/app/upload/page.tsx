'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { upload } from '@vercel/blob/client'

export default function UploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setError('')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('video/')) {
      setFile(f)
      setError('')
    } else {
      setError('Please drop a video file.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a video file.'); return }

    setUploading(true)
    setError('')

    try {
      // Step 1: Pre-create the game row to get a stable gameId
      const initRes = await fetch('/api/games/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || null }),
      })
      if (!initRes.ok) {
        const d = await initRes.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to initialize game')
      }
      const { gameId } = await initRes.json()

      // Step 2: Upload directly from browser to Vercel Blob (no 4.5 MB serverless limit)
      const ext = file.name.split('.').pop() || 'mp4'
      await upload(`${gameId}/original.${ext}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: gameId,
      })

      // Step 3: Navigate to game setup
      router.push(`/setup/${gameId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold text-white">Upload game</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !uploading && fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-12 text-center cursor-pointer transition bg-[#1E293B]/50"
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            {file ? (
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-slate-400 mt-1">{fileSizeMB} MB</p>
                <p className="text-xs text-slate-500 mt-2">Click to change file</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto w-12 h-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-slate-300 font-medium">Drop video here, or click to browse</p>
                <p className="text-sm text-slate-500 mt-1">MP4, MOV, WebM supported</p>
              </div>
            )}
          </div>

          {/* Optional title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">
              Game title <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="e.g. vs Thomas 2026-04-28"
              className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Upload indicator */}
          {uploading && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Uploading…</div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-500 h-2 rounded-full w-1/3 animate-pulse" />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
          >
            {uploading ? 'Uploading…' : 'Upload and continue'}
          </button>
        </form>
      </main>
    </div>
  )
}
