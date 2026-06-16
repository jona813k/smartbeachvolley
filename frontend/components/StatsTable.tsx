import type { GameResults } from '@/lib/types'

interface Props {
  results: GameResults
  playerNames: { left_1: string; left_2: string; right_1: string; right_2: string }
}

function EffBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-300 w-8 text-right">{pct}%</span>
    </div>
  )
}

type PlayerKey = 'left_1' | 'left_2' | 'right_1' | 'right_2'

const PLAYERS: PlayerKey[] = ['left_1', 'left_2', 'right_1', 'right_2']

export default function StatsTable({ results, playerNames }: Props) {
  return (
    <div className="bg-[#1E293B] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Player</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Attacks</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Errors</th>
            <th className="px-4 py-3 text-slate-400 font-medium text-center w-40">Efficiency</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Serves</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Aces</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Serve err.</th>
          </tr>
        </thead>
        <tbody>
          {PLAYERS.map((key, i) => {
            const stats = results.player_stats[key]
            const name = playerNames[key]
            const side = key.startsWith('left') ? 'left' : 'right'
            return (
              <tr
                key={key}
                className={`border-b border-slate-800/60 ${i % 2 === 0 ? '' : 'bg-[#0F172A]/30'}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${side === 'left' ? 'bg-blue-500' : 'bg-emerald-500'}`}
                    />
                    <span className="text-white font-medium">{name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{stats.attacks}</td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{stats.attack_errors}</td>
                <td className="px-4 py-3">
                  <EffBar value={stats.attack_efficiency} />
                </td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{stats.serves}</td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{stats.aces}</td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{stats.serve_errors}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
