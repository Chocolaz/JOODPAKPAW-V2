'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export function ImageLightbox({
  src,
  label,
  onClose,
}: {
  src: string
  label: string
  onClose: () => void
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">{label}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <img
          src={src}
          alt={label}
          className="w-full rounded-xl object-contain max-h-[78vh] shadow-2xl"
        />
        <p className="text-center text-white/30 text-xs">
          Press Esc or click outside to close
        </p>
      </div>
    </div>
  )
}
