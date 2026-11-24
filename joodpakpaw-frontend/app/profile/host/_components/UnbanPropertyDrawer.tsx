'use client'

import { useEffect, useRef, useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { submitUnbanPropertyRequest } from '@/lib/api'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'

interface UnbanPropertyDrawerProps {
  propertyId?: number
  reportCategoryId?: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  quota?: number
  suspensionReason?: string | null
  lastAppealNote?: string | null
}

function AppealContent({
  propertyId,
  reportCategoryId = 10,
  onClose,
  onSuccess,
  quota,
  suspensionReason,
  lastAppealNote,
}: {
  propertyId?: number
  reportCategoryId?: number
  onClose: () => void
  onSuccess?: () => void
  quota?: number
  suspensionReason?: string | null
  lastAppealNote?: string | null
}) {
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewsRef = useRef<string[]>(previews)
  previewsRef.current = previews

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const isQuotaExceeded = quota !== undefined && quota >= 2

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const added = files.slice(0, 3 - images.length)
    setImages((prev) => [...prev, ...added])
    setPreviews((prev) => [
      ...prev,
      ...added.map((f) => URL.createObjectURL(f)),
    ])
    e.target.value = ''
  }

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setImages((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!description.trim() || isQuotaExceeded) return
    setSubmitting(true)
    try {
      await submitUnbanPropertyRequest(
        reportCategoryId,
        description.trim(),
        propertyId,
        images
      )
      toast.success('Appeal submitted. We will review it shortly.')
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to submit appeal. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-deep-teal leading-snug">
                Submit Appeal
              </h2>
              {quota !== undefined && (
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums ${
                    isQuotaExceeded
                      ? 'bg-neutral-900 text-white'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {Math.max(0, 2 - quota)}/2 remaining
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-gray mt-1">
              Request a review of your suspended{' '}
              {propertyId ? 'property' : 'account'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-off-white text-neutral-gray hover:bg-gray-200 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto modern-scrollbar px-5 py-5 flex flex-col gap-4">
        {suspensionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-800">
              Suspension Reason
            </p>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
              {suspensionReason}
            </p>
          </div>
        )}

        {lastAppealNote && (
          <div className="bg-off-white border border-border rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-foreground">
              Previous Appeal Decision
            </p>
            <p className="text-xs text-neutral-gray mt-0.5 leading-relaxed">
              {lastAppealNote}
            </p>
          </div>
        )}

        {isQuotaExceeded ? (
          <div className="bg-off-white border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-foreground leading-relaxed font-medium">
              Maximum appeal limit (2/2) has been reached for this suspension.
              You cannot submit further appeals in this cycle.
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              Explain why your {propertyId ? 'property' : 'account'} should be
              reinstated. Provide clear supporting detail to speed up review.
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Your explanation <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isQuotaExceeded}
            placeholder={
              isQuotaExceeded
                ? 'Maximum appeal attempts reached.'
                : 'Describe why your suspension should be reconsidered...'
            }
            rows={5}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-white resize-none focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal transition-colors disabled:opacity-50 disabled:bg-off-white"
          />
          <p className="text-xs text-neutral-gray mt-1 text-right tabular-nums">
            {description.length} characters
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Supporting images{' '}
            <span className="text-neutral-gray font-normal">
              (optional, max 3)
            </span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {previews.map((src, idx) => (
              <div
                key={idx}
                className="relative w-20 h-20 rounded-xl overflow-hidden border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center cursor-pointer"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {!isQuotaExceeded && images.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-neutral-gray hover:border-deep-teal hover:text-deep-teal transition-colors cursor-pointer"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-[11px]">Add photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagePick}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-4 border-t border-border">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !description.trim() || isQuotaExceeded}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-deep-teal text-white text-sm font-semibold transition-colors hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting
            ? 'Submitting...'
            : isQuotaExceeded
            ? 'Appeals Limit Reached'
            : 'Submit Appeal'}
        </button>
      </div>
    </div>
  )
}

export function UnbanPropertyDrawer({
  propertyId,
  reportCategoryId,
  isOpen,
  onOpenChange,
  onSuccess,
  quota,
  suspensionReason,
  lastAppealNote,
}: UnbanPropertyDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const handleClose = () => onOpenChange(false)

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 overflow-hidden max-w-md w-full h-[85vh] flex flex-col gap-0 [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Submit Appeal</DialogTitle>
          </VisuallyHidden>
          <AppealContent
            propertyId={propertyId}
            reportCategoryId={reportCategoryId}
            onClose={handleClose}
            onSuccess={onSuccess}
            quota={quota}
            suspensionReason={suspensionReason}
            lastAppealNote={lastAppealNote}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] flex flex-col outline-none">
        <VisuallyHidden>
          <DrawerTitle>Submit Appeal</DrawerTitle>
        </VisuallyHidden>
        <div className="flex-1 min-h-0 flex flex-col">
          <AppealContent
            propertyId={propertyId}
            reportCategoryId={reportCategoryId}
            onClose={handleClose}
            onSuccess={onSuccess}
            quota={quota}
            suspensionReason={suspensionReason}
            lastAppealNote={lastAppealNote}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
