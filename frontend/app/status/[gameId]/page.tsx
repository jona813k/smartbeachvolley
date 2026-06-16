'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Game } from '@/lib/types'

function StatusStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        done
          ? 'bg-green-500 border-green-500'
          : active
          ? 'border-blue-400 bg-blue-900/30'
          : 'border-slate-700 bg-transparent'
      }`}>
        {done && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
        {active && !done && (
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        )}
      </div>
      <span className={`text-sm ${done ? 'text-slate-300' : active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </span>
    </div>
  )
}

const STATUS_STEPS: { status: Game['status']; label: string }[] = [
  { status: 'pending_setup', label: 'Setup complete' },
  { status: 'queued', label: 'Queued for processing' },
  { status: 'processing', label: 'ML pipeline running' },
  { status: 'done', label: 'Analysis complete' },
]

function getStepState(stepStatus: Game['status'], currentStatus: Game['status']) {
  const order: Game['status'][] = ['pending_setup', 'queued', 'processing', 'done']
  const stepIdx = order.indexOf(stepStatus)
  const currIdx = order.indexOf(currentStatus === 'error' ? 'done' : currentStatus)
  return {
    done: stepIdx < currIdx || currentStatus === 'done',
    active: stepIdx === currIdx && currentStatus !== 'done',
  }
}

export default function StatusPage() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.gameId as string

  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState('')

  async function fetchGame() {
    try {
      const res = await fetch(`/api/games/${gameId}`)
      if (!res.ok) { setError('Game not found'); return }
      const data: Game = await res.json()
      setGame(data)
      if (data.status === 'done') {
        router.push(`/report/${gameId}`)
      }
    } catch {
      setError('Failed to load game status')
    }
  }

  useEffect(() => {
    fetchGame()
    const interval = setInterval(fetchGame, 5000)
    return () => clearInterval(interval)
  }, [gameId])

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold text-white">Processing</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : !game ? (
          <p className="text-slate-500">Loading…</p>
        ) : game.status === 'error' ? (
          <div className="bg-[#1E293B] rounded-xl p-8">
            <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Processing failed</h2>
            {game.error_message && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 mt-4 text-left font-mono">
                {game.error_message}
              </p>
            )}
            <Link href="/dashboard" className="mt-6 inline-block text-blue-400 hover:text-blue-300 text-sm">
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="bg-[#1E293B] rounded-xl p-8">
            {/* Spinner */}
            <div className="flex justify-center mb-8">
              <svg className="w-12 h-12 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>

            <h2 className="text-white font-semibold text-lg mb-1">
              {game.title || game.video_filename}
            </h2>
            <p className="text-slate-400 text-sm mb-8">Refreshes automatically every 5 seconds</p>

            <div className="text-left space-y-4">
              {STATUS_STEPS.map(({ status, label }) => {
                const { done, active } = getStepState(status, game.status)
                return <StatusStep key={status} label={label} done={done} active={active} />
              })}
            </div>

            {(game.status === 'queued') && (
              <p className="mt-6 text-xs text-slate-500">
                Make sure the Python worker is running on your PC.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
