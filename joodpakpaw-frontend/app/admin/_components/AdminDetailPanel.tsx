'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function AdminDetailPanel({
  stripeColor,
  header,
  headerExtra,
  onClose,
  children,
  width = 'w-[480px]',
}: {
  stripeColor: string
  header: ReactNode
  headerExtra?: ReactNode
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-40"
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 h-full ${width} bg-white z-50 flex flex-col shadow-xl border-l border-gray-200`}
        style={{ animation: 'slideIn .22s cubic-bezier(.16,1,.3,1)' }}
      >
        {/* Status stripe */}
        <div className={`h-[3px] w-full shrink-0 ${stripeColor}`} />

        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            {header}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {headerExtra}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </>
  )
}
