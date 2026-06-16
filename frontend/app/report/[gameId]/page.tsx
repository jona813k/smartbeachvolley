import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import type { Game } from '@/lib/types'
import Link from 'next/link'
import Heatmap from '@/components/Heatmap'
import StatsTable from '@/components/StatsTable'
import RallyLog from '@/components/RallyLog'
import { formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: { gameId: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { rows } = await sql`SELECT * FROM games WHERE id = ${params.gameId}`
  if (!rows[0]) notFound()

  const game = rows[0] as unknown as Game
  if (game.status !== 'done') redirect(`/status/${params.gameId}`)

  const results = game.results!

  const playerNames = {
    left_1: game.player_left_1 || 'Left 1',
    left_2: game.player_left_2 || 'Left 2',
    right_1: game.player_right_1 || 'Right 1',
    right_2: game.player_right_2 || 'Right 2',
  }

  const leftWon = results.score.left > results.score.right

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition text-sm">← Dashboard</Link>
            <h1 className="text-lg font-bold text-white truncate">
              {game.title || game.video_filename}
            </h1>
          </div>
          <span className="text-xs text-slate-500 shrink-0">{formatDuration(results.duration_ms)}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Score hero */}
        <section className="bg-[#1E293B] rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-8">
            <div className="flex-1 text-right">
              <p className="text-slate-400 text-sm mb-1">{playerNames.left_1} & {playerNames.left_2}</p>
              <p className="text-5xl font-bold font-mono text-white">{results.score.left}</p>
              {leftWon && <p className="text-xs text-green-400 mt-1 font-medium">Winner</p>}
            </div>
            <div className="text-2xl text-slate-600 font-mono">–</div>
            <div className="flex-1 text-left">
              <p className="text-slate-400 text-sm mb-1">{playerNames.right_1} & {playerNames.right_2}</p>
              <p className="text-5xl font-bold font-mono text-white">{results.score.right}</p>
              {!leftWon && <p className="text-xs text-green-400 mt-1 font-medium">Winner</p>}
            </div>
          </div>
        </section>

        {/* Heatmaps */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4">Attack heatmaps</h2>
          <div className="grid grid-cols-2 gap-4">
            <Heatmap
              data={results.heatmap_data.left_1}
              playerName={playerNames.left_1}
            />
            <Heatmap
              data={results.heatmap_data.left_2}
              playerName={playerNames.left_2}
            />
            <Heatmap
              data={results.heatmap_data.right_1}
              playerName={playerNames.right_1}
            />
            <Heatmap
              data={results.heatmap_data.right_2}
              playerName={playerNames.right_2}
            />
          </div>
        </section>

        {/* Stats table */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4">Player statistics</h2>
          <StatsTable results={results} playerNames={playerNames} />
        </section>

        {/* Rally log */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4">Rally log</h2>
          <RallyLog rallies={results.rallies} playerNames={playerNames} />
        </section>

      </main>
    </div>
  )
}
