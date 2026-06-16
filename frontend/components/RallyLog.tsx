import type { Rally } from '@/lib/types'

interface Props {
  rallies: Rally[]
  playerNames: { left_1: string; left_2: string; right_1: string; right_2: string }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const END_REASON_LABELS: Record<string, string> = {
  attack_winner: 'Attack winner',
  attack_error: 'Attack error',
  serve_ace: 'Ace',
  serve_error: 'Serve error',
  defensive_error: 'Defensive error',
  net_touch: 'Net touch',
  out_of_bounds: 'Out of bounds',
  unknown: 'Point',
}

export default function RallyLog({ rallies, playerNames }: Props) {
  const leftTeam = `${playerNames.left_1} & ${playerNames.left_2}`
  const rightTeam = `${playerNames.right_1} & ${playerNames.right_2}`

  return (
    <div className="bg-[#1E293B] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Point-by-point log</span>
        <span className="text-xs text-slate-500">{rallies.length} rallies</span>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-[480px] overflow-y-auto">
        {rallies.map((rally) => {
          const wonLeft = rally.winning_team === 'left'
          return (
            <div key={rally.number} className="flex items-center px-4 py-2.5 gap-4 hover:bg-[#0F172A]/30 transition">
              {/* Rally number */}
              <span className="text-xs text-slate-600 font-mono w-6 shrink-0">{rally.number}</span>

              {/* Timestamp */}
              <span className="text-xs text-slate-500 font-mono w-10 shrink-0">
                {formatTimestamp(rally.timestamp_ms)}
              </span>

              {/* Score */}
              <span className="text-xs font-mono font-semibold text-slate-300 w-10 shrink-0">
                {rally.score_left}–{rally.score_right}
              </span>

              {/* End reason */}
              <span className="text-xs text-slate-400 flex-1 truncate">
                {END_REASON_LABELS[rally.end_reason] || rally.end_reason}
              </span>

              {/* Winner */}
              <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded ${
                wonLeft
                  ? 'bg-blue-900/40 text-blue-300'
                  : 'bg-emerald-900/40 text-emerald-300'
              }`}>
                {wonLeft ? leftTeam.split(' & ')[0] : rightTeam.split(' & ')[0]} team
              </span>

              {/* Serving indicator */}
              <span className="text-xs text-slate-600 shrink-0">
                {rally.serving_team === 'left' ? '↑L' : '↑R'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
