'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DebugFrame {
  index: number
  event_type: string
  player: string
  player_name: string
  timestamp_ms: number
  frame_path: string
  bbox: [number, number, number, number] | null
  verified: boolean | null
  correction: string | null
  signed_url: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_DK: Record<string, string> = {
  serve:      'Server',
  attack:     'Angreb',
  receive:    'Modtager',
  set:        'Hæver',
  point_end:  'Point slut',
}

const EVENT_COLOUR: Record<string, string> = {
  serve:      'text-green-400',
  attack:     'text-red-400',
  receive:    'text-blue-400',
  set:        'text-purple-400',
  point_end:  'text-yellow-400',
}

function fmtTime(ms: number) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function statusDot(verified: boolean | null) {
  if (verified === true)  return <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
  if (verified === false) return <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
  return <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DebugPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const router = useRouter()

  const [frames, setFrames] = useState<DebugFrame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving]         = useState(false)
  const [correctionText, setCorrectionText] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)

  // Derived
  const total   = frames.length
  const frame   = frames[currentIdx] ?? null
  const reviewed = frames.filter(f => f.verified !== null).length
  const correct  = frames.filter(f => f.verified === true).length
  const wrong    = frames.filter(f => f.verified === false).length

  // ── Fetch frames on mount ──────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    fetch(`/api/games/${gameId}/debug`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setFrames(data.frames ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [gameId])

  // Sync correction text when frame changes
  useEffect(() => {
    if (!frame) return
    setCorrectionText(frame.correction ?? '')
    setShowCorrection(frame.verified === false)
  }, [currentIdx, frame?.index])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goTo = useCallback((idx: number) => {
    setCurrentIdx(Math.max(0, Math.min(total - 1, idx)))
  }, [total])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' || e.key === 'd') goTo(currentIdx + 1)
      if (e.key === 'ArrowLeft'  || e.key === 'a') goTo(currentIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIdx, goTo])

  // ── Save review ────────────────────────────────────────────────────────────

  const saveVerdict = useCallback(async (verified: boolean) => {
    if (!frame) return
    setSaving(true)

    const correction = verified ? null : (correctionText.trim() || null)

    try {
      const res = await fetch(`/api/games/${gameId}/debug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: frame.index, verified, correction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Update local state
      setFrames(prev => prev.map(f =>
        f.index === frame.index ? { ...f, verified, correction } : f
      ))

      // Auto-advance to next unreviewed frame
      const nextUnreviewed = frames.findIndex((f, i) => i > currentIdx && f.verified === null)
      if (nextUnreviewed !== -1) goTo(nextUnreviewed)
      else if (currentIdx < total - 1) goTo(currentIdx + 1)
    } catch (e: any) {
      alert('Fejl: ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [frame, correctionText, gameId, frames, currentIdx, total, goTo])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Indlæser debug frames…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/dashboard" className="text-blue-400 hover:underline">← Dashboard</Link>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-2">Ingen debug frames fundet.</p>
          <p className="text-slate-600 text-sm mb-6">
            Debug frames genereres automatisk næste gang workeren behandler et spil.
          </p>
          <Link href={`/report/${gameId}`} className="text-blue-400 hover:underline">← Rapport</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur sticky top-0 z-20 px-6 py-3 flex items-center gap-4">
        <Link href={`/report/${gameId}`} className="text-slate-500 hover:text-slate-300 transition text-sm">
          ← Rapport
        </Link>
        <h1 className="text-white font-bold flex-1">Debug review</h1>

        {/* Progress summary */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{reviewed}/{total} gennemgået</span>
          <span className="text-green-400">{correct} ✓</span>
          <span className="text-red-400">{wrong} ✗</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar: event list ── */}
        <aside className="w-56 shrink-0 border-r border-slate-800 overflow-y-auto bg-[#0F172A]">
          {frames.map((f, i) => (
            <button
              key={f.index}
              onClick={() => goTo(i)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-800/60 flex items-center gap-2 transition
                ${i === currentIdx ? 'bg-slate-700/60' : 'hover:bg-slate-800/40'}`}
            >
              {statusDot(f.verified)}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${EVENT_COLOUR[f.event_type] ?? 'text-slate-300'}`}>
                  {EVENT_TYPE_DK[f.event_type] ?? f.event_type}
                </div>
                <div className="text-xs text-slate-500 truncate">{f.player_name} · {fmtTime(f.timestamp_ms)}</div>
              </div>
            </button>
          ))}
        </aside>

        {/* ── Main: frame viewer ── */}
        <main className="flex-1 flex flex-col items-center justify-start overflow-y-auto p-6 gap-6">

          {frame && (
            <>
              {/* Frame image */}
              <div className="w-full max-w-3xl">
                <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                  {frame.signed_url ? (
                    <img
                      key={frame.signed_url}
                      src={frame.signed_url}
                      alt={`Event ${frame.index}`}
                      className="w-full object-contain max-h-[60vh]"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-600">
                      Intet billede tilgængeligt
                    </div>
                  )}

                  {/* Overlay badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-900/80 backdrop-blur ${EVENT_COLOUR[frame.event_type] ?? 'text-white'}`}>
                      {EVENT_TYPE_DK[frame.event_type] ?? frame.event_type}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-sm bg-slate-900/80 backdrop-blur text-white">
                      {frame.player_name}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-sm bg-slate-900/80 backdrop-blur text-slate-400">
                      {fmtTime(frame.timestamp_ms)}
                    </span>
                  </div>

                  {/* Verified badge */}
                  {frame.verified !== null && (
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-sm font-bold backdrop-blur
                      ${frame.verified ? 'bg-green-900/80 text-green-300' : 'bg-red-900/80 text-red-300'}`}>
                      {frame.verified ? '✓ Korrekt' : '✗ Forkert'}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation counter */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => goTo(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 transition"
                >
                  ← Forrige
                </button>
                <span className="text-slate-500 text-sm">{currentIdx + 1} / {total}</span>
                <button
                  onClick={() => goTo(currentIdx + 1)}
                  disabled={currentIdx === total - 1}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 transition"
                >
                  Næste →
                </button>
              </div>

              {/* Review buttons */}
              <div className="w-full max-w-3xl space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => saveVerdict(true)}
                    disabled={saving}
                    className="flex-1 py-3.5 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold text-lg transition"
                  >
                    ✓ Korrekt
                  </button>
                  <button
                    onClick={() => {
                      setShowCorrection(true)
                    }}
                    disabled={saving}
                    className="flex-1 py-3.5 rounded-xl bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-lg transition"
                  >
                    ✗ Forkert
                  </button>
                </div>

                {/* Correction input — shown when "Forkert" is clicked */}
                {showCorrection && (
                  <div className="bg-slate-800 border border-red-800/50 rounded-xl p-4 space-y-3">
                    <label className="block text-sm font-semibold text-red-400">
                      Hvad skete der egentlig?
                    </label>
                    <textarea
                      value={correctionText}
                      onChange={e => setCorrectionText(e.target.value)}
                      placeholder='fx "Spiller 2 angreb, ikke spiller 3" eller "Det var en sætning, ikke et angreb"'
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-600 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveVerdict(false)}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition"
                      >
                        {saving ? 'Gemmer…' : 'Gem korrektion'}
                      </button>
                      <button
                        onClick={() => setShowCorrection(false)}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
                      >
                        Annuller
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing correction note */}
                {frame.verified === false && frame.correction && !showCorrection && (
                  <div className="bg-slate-800/50 border border-red-900/40 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Din korrektion:</p>
                    <p className="text-sm text-slate-300">{frame.correction}</p>
                    <button
                      onClick={() => setShowCorrection(true)}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Rediger
                    </button>
                  </div>
                )}
              </div>

              {/* Keyboard hint */}
              <p className="text-xs text-slate-700">
                ← → eller A / D for at navigere
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
