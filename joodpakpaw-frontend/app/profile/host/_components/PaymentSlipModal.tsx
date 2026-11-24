'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Receipt,
  RefreshCw,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiImageUrl } from '@/lib/utils'

interface PaymentSlipModalProps {
  isOpen: boolean
  onClose: () => void
  slipUrl: string | null | undefined
  bookingId: number
  expectedTotal: number
  isPending?: boolean
  onAcceptBooking?: () => void
  isAccepting?: boolean
}

export function PaymentSlipModal({
  isOpen,
  onClose,
  slipUrl,
  bookingId,
  expectedTotal,
  isPending = false,
  onAcceptBooking,
  isAccepting = false,
}: PaymentSlipModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [imageError, setImageError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const resolvedSlipUrl = slipUrl ? getApiImageUrl(slipUrl) || slipUrl : null

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !resolvedSlipUrl) return null

  const handleClose = () => {
    setZoomLevel(1)
    setImageError(false)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Payment transfer slip for booking #${bookingId}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-lg border border-border flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-deep-teal shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              PromptPay transfer receipt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={resolvedSlipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground bg-off-white hover:bg-off-white/80 rounded-lg border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Open original
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-neutral-gray hover:text-foreground hover:bg-off-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoom toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-off-white/70 border-b border-border text-xs text-neutral-gray shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setZoomLevel((z) => Math.max(1, Number((z - 0.5).toFixed(1))))
              }
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded-lg border border-border bg-white hover:bg-off-white disabled:opacity-40 transition-colors cursor-pointer"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="tabular-nums font-medium text-foreground px-1.5">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoomLevel((z) => Math.min(4, Number((z + 0.5).toFixed(1))))
              }
              disabled={zoomLevel >= 4}
              className="p-1.5 rounded-lg border border-border bg-white hover:bg-off-white disabled:opacity-40 transition-colors cursor-pointer"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="flex items-center gap-1 ml-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-off-white text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <span className="text-xs text-neutral-gray hidden sm:inline">
            Scroll to pan (1x to 4x)
          </span>
        </div>

        {/* Image viewport */}
        <div className="relative flex-1 min-h-[280px] max-h-[60vh] overflow-auto modern-scrollbar bg-off-white/40 p-4 flex items-center justify-center">
          {imageError ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <p className="text-sm font-semibold text-foreground">
                Unable to load transfer slip image
              </p>
              <p className="text-xs text-neutral-gray max-w-sm">
                The image file could not be loaded from storage. Please verify your connection and retry.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setImageError(false)
                  setRetryNonce((n) => n + 1)
                }}
                className="h-8 text-xs rounded-xl"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="transition-transform duration-150 ease-out flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={retryNonce}
                src={resolvedSlipUrl}
                alt={`PromptPay transfer slip for booking #${bookingId}`}
                onError={() => setImageError(true)}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
                className="max-h-[55vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Footer verification bar */}
        <div className="px-4 py-3 border-t border-border bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-neutral-gray">Expected total</span>
            <span className="font-bold text-deep-teal tabular-nums text-sm">
              ฿{expectedTotal.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-off-white border border-border text-neutral-gray tabular-nums">
              Booking #{bookingId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
            {isPending && onAcceptBooking && (
              <Button
                type="button"
                size="sm"
                disabled={isAccepting}
                onClick={onAcceptBooking}
                className="rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {isAccepting ? 'Accepting...' : 'Accept Booking'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
