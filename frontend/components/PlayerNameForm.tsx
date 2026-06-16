'use client'

interface PlayerNames {
  player_left_1: string
  player_left_2: string
  player_right_1: string
  player_right_2: string
}

interface Props {
  values: PlayerNames
  onChange: (values: PlayerNames) => void
}

const FIELDS: { key: keyof PlayerNames; label: string; side: string }[] = [
  { key: 'player_left_1', label: 'Left side — Player 1', side: 'left' },
  { key: 'player_left_2', label: 'Left side — Player 2', side: 'left' },
  { key: 'player_right_1', label: 'Right side — Player 1', side: 'right' },
  { key: 'player_right_2', label: 'Right side — Player 2', side: 'right' },
]

export default function PlayerNameForm({ values, onChange }: Props) {
  function handleChange(key: keyof PlayerNames, value: string) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {FIELDS.map(({ key, label, side }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1.5 ${side === 'left' ? 'bg-blue-500' : 'bg-emerald-500'}`}
            />
            {label}
          </label>
          <input
            type="text"
            value={values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder="Player name"
            className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      ))}
    </div>
  )
}
