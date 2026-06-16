'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this game and all its data? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Delete failed — try again.')
        setDeleting(false)
      }
    } catch {
      alert('Network error — try again.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Delete game"
      className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-4 h-full rounded-xl border border-slate-700/50 bg-[#1E293B] hover:bg-red-900/30 hover:border-red-800 transition text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-base">{deleting ? '…' : '🗑'}</span>
      <span className="text-xs font-medium">Delete</span>
    </button>
  )
}
