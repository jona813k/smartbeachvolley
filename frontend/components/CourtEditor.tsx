'use client'

import { useState, useRef, useCallback } from 'react'
import type { CourtCorners } from '@/lib/types'

interface Props {
  frameUrl: string
  initialCorners: CourtCorners
  onChange: (corners: CourtCorners) => void
}

const CORNER_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']
const CORNER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']

export default function CourtEditor({ frameUrl, initialCorners, onChange }: Props) {
  const [corners, setCorners] = useState<CourtCorners>(initialCorners)
  const [dragging, setDragging] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Convert pixel coords relative to natural image size → display coords
  function toDisplay(x: number, y: number): { dx: number; dy: number } {
    const img = imgRef.current
    if (!img) return { dx: x, dy: y }
    const scaleX = img.clientWidth / img.naturalWidth
    const scaleY = img.clientHeight / img.naturalHeight
    return { dx: x * scaleX, dy: y * scaleY }
  }

  // Convert display coords → natural image pixel coords
  function toNatural(dx: number, dy: number): [number, number] {
    const img = imgRef.current
    if (!img) return [dx, dy]
    const scaleX = img.naturalWidth / img.clientWidth
    const scaleY = img.naturalHeight / img.clientHeight
    return [Math.round(dx * scaleX), Math.round(dy * scaleY)]
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null) return
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img) return
    const rect = img.getBoundingClientRect()
    const dx = Math.max(0, Math.min(img.clientWidth, e.clientX - rect.left))
    const dy = Math.max(0, Math.min(img.clientHeight, e.clientY - rect.top))
    const [nx, ny] = toNatural(dx, dy)
    const next = [...corners] as CourtCorners
    next[dragging] = [nx, ny]
    setCorners(next)
    onChange(next)
  }, [dragging, corners, onChange])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Drag the four corner handles to align with the court boundaries.
      </p>

      <div
        ref={containerRef}
        className="relative select-none cursor-crosshair rounded-lg overflow-hidden border border-slate-700"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={frameUrl}
          alt="Court frame"
          className="w-full block"
          draggable={false}
        />

        {/* Overlay SVG for court lines + handles */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          {/* Court polygon */}
          {imgRef.current && (
            <polygon
              points={corners.map(([x, y]) => {
                const { dx, dy } = toDisplay(x, y)
                return `${dx},${dy}`
              }).join(' ')}
              fill="rgba(59,130,246,0.08)"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          )}
        </svg>

        {/* Draggable handles */}
        {corners.map(([x, y], i) => {
          const { dx, dy } = toDisplay(x, y)
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: dx,
                top: dy,
                transform: 'translate(-50%, -50%)',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: CORNER_COLORS[i],
                border: '3px solid white',
                cursor: 'grab',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                zIndex: 10,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                setDragging(i)
              }}
              title={CORNER_LABELS[i]}
            />
          )
        })}
      </div>

      {/* Corner coordinate readout */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {corners.map(([x, y], i) => (
          <div key={i} className="flex items-center gap-2 bg-[#1E293B] rounded px-3 py-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: CORNER_COLORS[i] }}
            />
            <span className="text-slate-400">{CORNER_LABELS[i]}:</span>
            <span className="text-slate-200 font-mono">{x}, {y}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
