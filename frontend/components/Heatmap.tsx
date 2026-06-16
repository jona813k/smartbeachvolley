'use client'

import type { HeatmapPoint } from '@/lib/types'

interface Props {
  data: HeatmapPoint[]
  playerName: string
  className?: string
}

// Court is rendered as a 400×220 SVG (roughly 9m × 5m beach volleyball court ratio)
const W = 400
const H = 220
const PAD = 20

// Court inner dimensions (inside the padding)
const CW = W - PAD * 2
const CH = H - PAD * 2

export default function Heatmap({ data, playerName, className = '' }: Props) {
  const wonCount = data.filter(p => p.outcome === 'won').length
  const lostCount = data.filter(p => p.outcome === 'lost').length
  const total = data.length

  return (
    <div className={`bg-[#1E293B] rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{playerName}</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Won ({wonCount})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Lost ({lostCount})
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded"
        style={{ background: '#0F172A' }}
      >
        {/* Court outline */}
        <rect
          x={PAD} y={PAD} width={CW} height={CH}
          fill="none" stroke="#334155" strokeWidth="2" rx="2"
        />

        {/* Net line (center vertical) */}
        <line
          x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD}
          stroke="#475569" strokeWidth="2" strokeDasharray="4 3"
        />

        {/* Attack zone lines (3m from each end ≈ 33% of court) */}
        <line
          x1={PAD + CW * 0.33} y1={PAD} x2={PAD + CW * 0.33} y2={H - PAD}
          stroke="#1E3A5F" strokeWidth="1" strokeDasharray="3 3"
        />
        <line
          x1={PAD + CW * 0.67} y1={PAD} x2={PAD + CW * 0.67} y2={H - PAD}
          stroke="#1E3A5F" strokeWidth="1" strokeDasharray="3 3"
        />

        {/* Side label */}
        <text x={PAD + 6} y={H - PAD - 6} fontSize="9" fill="#334155">LEFT</text>
        <text x={W - PAD - 6} y={H - PAD - 6} fontSize="9" fill="#334155" textAnchor="end">RIGHT</text>

        {/* Attack landing dots */}
        {data.map((point, i) => {
          const cx = PAD + point.x * CW
          const cy = PAD + point.y * CH
          const isWon = point.outcome === 'won'
          return (
            <g key={i}>
              <circle
                cx={cx} cy={cy} r={7}
                fill={isWon ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}
                stroke={isWon ? '#4ADE80' : '#F87171'}
                strokeWidth="1.5"
              />
              <circle
                cx={cx} cy={cy} r={2.5}
                fill={isWon ? '#4ADE80' : '#F87171'}
              />
            </g>
          )
        })}

        {total === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#475569">
            No attacks recorded
          </text>
        )}
      </svg>

      {total > 0 && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          {total} attacks · {Math.round((wonCount / total) * 100)}% efficiency
        </p>
      )}
    </div>
  )
}
