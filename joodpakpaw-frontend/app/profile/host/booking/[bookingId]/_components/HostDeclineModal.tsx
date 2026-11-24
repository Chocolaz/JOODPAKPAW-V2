'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from '@/components/ui/dialog'
import { hostCancelBooking } from '@/lib/api'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HostDeclineModalProps {
  bookingId: number
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const PRESET_CHIPS = [
  'Fully booked',
  'Facility maintenance',
  'Cannot accommodate special pet care needs',
  'Schedule conflict',
] as const

export function HostDeclineModal({
  bookingId,
  isOpen,
  onClose,
  onSuccess,
}: HostDeclineModalProps) {
  const [reason, setReason] = useState('')
  const [isDeclining, setIsDeclining] = useState(false)

  const handleChipClick = (chip: string) => {
    setReason((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return chip
      if (trimmed.includes(chip)) return prev
      const combined = `${trimmed}. ${chip}`
      return combined.slice(0, 500)
    })
  }

  const handleDeclineSubmit = async () => {
    setIsDeclining(true)
    try {
      const trimmed = reason.trim()
      await hostCancelBooking(bookingId, trimmed)
      toast.success('Booking request declined.')
      setReason('')
      onClose()
      onSuccess()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to decline booking request.'
      )
    } finally {
      setIsDeclining(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeclining) {
      setReason('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogOverlay className="bg-black/60" />
      <DialogContent className="max-w-md w-full bg-white rounded-2xl p-6 border border-border shadow-sm">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5 shrink-0" />
            <DialogTitle className="text-base font-semibold text-foreground">
              Decline booking request
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-neutral-gray leading-relaxed">
            Please specify why you are unable to accept this reservation. This reason
            will be shared with the guest, and reserved dates will be returned to your
            calendar automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-gray">
              Quick reasons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  disabled={isDeclining}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border border-border transition-colors text-left cursor-pointer',
                    reason.includes(chip)
                      ? 'bg-deep-teal/10 text-deep-teal border-deep-teal/30 font-medium'
                      : 'bg-off-white/80 hover:bg-off-white text-foreground'
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="decline-reason-input"
              className="text-xs font-medium text-neutral-gray"
            >
              Explanation note
            </label>
            <Textarea
              id="decline-reason-input"
              placeholder="Provide context for the guest (e.g. schedule conflict, maintenance)..."
              value={reason}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setReason(e.target.value)
                }
              }}
              disabled={isDeclining}
              rows={4}
              className="resize-none border-border focus-visible:ring-deep-teal text-xs text-foreground bg-white"
            />
            <div className="flex items-center justify-between text-xs text-neutral-gray">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-neutral-gray" />
                Optional, up to 500 characters
              </span>
              <span
                className={cn(
                  'tabular-nums font-medium',
                  reason.length >= 500 ? 'text-red-600' : 'text-neutral-gray'
                )}
              >
                {reason.length}/500
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            disabled={isDeclining}
            onClick={() => handleOpenChange(false)}
            className="h-10 px-4 rounded-xl text-xs font-medium text-foreground hover:bg-off-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isDeclining}
            onClick={handleDeclineSubmit}
            className="h-10 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
          >
            {isDeclining ? (
              <Spinner className="size-3.5 mr-1.5" />
            ) : (
              <XCircle className="size-3.5 mr-1.5" />
            )}
            {isDeclining ? 'Declining...' : 'Decline request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
