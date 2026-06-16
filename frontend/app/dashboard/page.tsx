import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import type { Game } from '@/lib/types'
import Link from 'next/link'
import { formatDistanceToNow } from '@/lib/utils'
import SignOutButton from '@/components/SignOutButton'
import DeleteGameButton from '@/components/DeleteGameButton'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: Game['status'] }) {
  const map: Record<Game['status'], { label: string; className: string }> = {
    pending_setup: { label: 'Setup required', className: 'bg-yellow-900/40 text-yellow-300 border-yellow-700' },
    queued:        { label: 'Queued',          className: 'bg-slate-700/60 text-slate-300 border-slate-600' },
    processing:    { label: 'Processing',      className: 'bg-blue-900/40 text-blue-300 border-blue-700 animate-pulse' },
    done:          { label: 'Done',            className: 'bg-green-900/40 text-green-300 border-green-700' },
    error:         { label: 'Error',           className: 'bg-red-900/40 text-red-300 border-red-700' },
  }
  const { label, className } = map[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}

function gameHref(game: Game): string {
  if (game.status === 'pending_setup') return `/setup/${game.id}`
  if (game.status === 'queued' || game.status === 'processing') return `/status/${game.id}`
  if (game.status === 'done') return `/report/${game.id}`
  return `/status/${game.id}`
}

function ScorePill({ results }: { results: Game['results'] }) {
  if (!results) return null
  return (
    <span className="text-sm font-mono text-slate-300">
      {results.score.left} – {results.score.right}
    </span>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const rows = await sql`SELECT * FROM games ORDER BY created_at DESC`
  const games = rows as unknown as Game[]

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">SmartBeachVolley</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/upload"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              + Upload game
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {games.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-500 text-lg">No games yet.</p>
            <p className="text-slate-600 text-sm mt-1">Upload your first game video to get started.</p>
            <Link
              href="/upload"
              className="mt-6 inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
            >
              Upload game
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Games</h2>
              <span className="text-sm text-slate-500">{games.length} game{games.length !== 1 ? 's' : ''}</span>
            </div>

            {games.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-2"
              >
                {/* Main row — links to report / setup / status */}
                <Link
                  href={gameHref(game)}
                  className="flex-1 min-w-0 block bg-[#1E293B] hover:bg-[#243450] border border-slate-700/50 rounded-xl p-5 transition group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <StatusBadge status={game.status} />
                        {game.results && <ScorePill results={game.results} />}
                      </div>
                      <p className="font-medium text-white truncate">
                        {game.title || game.video_filename}
                      </p>
                      {game.player_left_1 && (
                        <p className="text-sm text-slate-500 mt-0.5 truncate">
                          {game.player_left_1} & {game.player_left_2} vs {game.player_right_1} & {game.player_right_2}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{formatDistanceToNow(game.created_at)}</p>
                      <span className="text-slate-600 group-hover:text-slate-400 transition text-lg">→</span>
                    </div>
                  </div>
                </Link>

                {/* Debug button — only for done games */}
                {game.status === 'done' && (
                  <Link
                    href={`/debug/${game.id}`}
                    title="Debug review"
                    className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-4 h-full rounded-xl border border-slate-700/50 bg-[#1E293B] hover:bg-slate-700/60 hover:border-slate-600 transition text-slate-500 hover:text-slate-300"
                  >
                    <span className="text-base">🔍</span>
                    <span className="text-xs font-medium">Debug</span>
                  </Link>
                )}

                {/* Delete button — always visible */}
                <DeleteGameButton gameId={game.id} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
