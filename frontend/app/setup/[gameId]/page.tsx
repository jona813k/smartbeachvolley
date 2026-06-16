'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import CourtEditor from '@/components/CourtEditor'
import PlayerNameForm from '@/components/PlayerNameForm'
import type { CourtCorners } from '@/lib/types'

// Default court corners: rough estimate for a 1920x1080 frame
// The user will adjust them to match the actual court
const DEFAULT_CORNERS: CourtCorners = [
  [480, 270],   // top-left
  [1440, 270],  // top-right
  [1440, 810],  // bottom-right
  [480, 810],   // bottom-left
]

export default function SetupPage() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.gameId as string

  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [frameLoading, setFrameLoading] = useState(true)
  const [corners, setCorners] = useState<CourtCorners>(DEFAULT_CORNERS)
  const [players, setPlayers] = useState({
    player_left_1: '',
    player_left_2: '',
    player_right_1: '',
    player_right_2: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Poll for the frame image — Python worker extracts it after upload
    let attempts = 0
    const maxAttempts = 30 // 2.5 minutes

    async function tryFetchFrame() {
      try {
        const res = await fetch(`/api/games/${gameId}/frame`)
        if (res.ok) {
          const { url } = await res.json()
          setFrameUrl(url)
          setFrameLoading(false)
          return
        }
      } catch { /* not ready yet */ }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(tryFetchFrame, 5000)
      } else {
        setFrameLoading(false)
        setError('Frame not available yet — the worker may not be running. You can still set player names and submit with default court corners.')
      }
    }

    tryFetchFrame()
  }, [gameId])

  const allPlayersFilled = Object.values(players).every((v) => v.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allPlayersFilled) { setError('Please enter all four player names.'); return }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/games/${gameId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...players, court_corners: corners }),
      })

      if (res.ok) {
        router.push(`/status/${gameId}`)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save setup')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold text-white">Game setup</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Court editor */}
          <section className="bg-[#1E293B] rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4">Court corners</h2>
            {frameLoading ? (
              <div className="flex items-center gap-3 py-12 justify-center text-slate-500">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Waiting for frame extraction…</span>
              </div>
            ) : frameUrl ? (
              <CourtEditor
                frameUrl={frameUrl}
                initialCorners={corners}
                onChange={setCorners}
              />
            ) : (
              <div className="bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-3 text-sm text-yellow-400">
                Frame not available — court corners set to defaults. You can adjust them after the worker runs.
              </div>
            )}
          </section>

          {/* Player names */}
          <section className="bg-[#1E293B] rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4">Player names</h2>
            <p className="text-sm text-slate-400 mb-4">
              Enter names as they appear at the start of the video (left side serves first).
            </p>
            <PlayerNameForm values={players} onChange={setPlayers} />
          </section>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !allPlayersFilled}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
          >
            {saving ? 'Saving…' : 'Save and queue for processing'}
          </button>
        </form>
      </main>
    </div>
  )
}
