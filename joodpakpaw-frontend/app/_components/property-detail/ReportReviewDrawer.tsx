'use client'

import { useEffect, useRef, useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { getReportCategories, submitReviewReport } from '@/lib/api'
import type { ReportCategory } from '@/types/report'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'

interface ReportReviewDrawerProps {
  bookingId: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

function ReportContent({
  onClose,
  bookingId,
}: {
  onClose: () => void
  bookingId: number
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [categories, setCategories] = useState<ReportCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [selectedCategory, setSelectedCategory] =
    useState<ReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) setLoadingCategories(true)
    })
    getReportCategories('review')
      .then((res) => {
        if (active) setCategories(res.reportCategories)
      })
      .catch(() => toast.error('Failed to load report categories.'))
      .finally(() => {
        if (active) setLoadingCategories(false)
      })
    return () => {
      active = false
    }
  }, [])

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
    if (!selectedCategory) return
    if (!description.trim()) {
      toast.error('Please describe the issue.')
      return
    }
    setSubmitting(true)
    try {
      await submitReviewReport(
        bookingId,
        selectedCategory.id,
        description.trim(),
        images
      )
      toast.success("Report submitted. We'll review it shortly.")
      onClose()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to submit report.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {step === 1 && (
        <>
          <div className="shrink-0 px-5 pt-6 pb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-neutral-gray tabular-nums">
                Step 1 of 2
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-gray hover:bg-neutral-200 transition-colors cursor-pointer"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h2 className="font-bold text-foreground leading-snug">
              What&apos;s the issue?
            </h2>
            <p className="text-sm text-neutral-gray mt-1">
              Select the reason that best describes your concern.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {loadingCategories ? (
              <div className="flex flex-col gap-2 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 bg-neutral-100 rounded-2xl animate-pulse motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-2 pt-1">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat)
                        setStep(2)
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl border border-border bg-white hover:border-deep-teal/40 hover:bg-deep-teal/[0.03] transition-colors cursor-pointer text-left"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {cat.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-gray shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="shrink-0 px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs font-medium text-neutral-gray hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <p className="text-xs font-medium text-neutral-gray tabular-nums">
                Step 2 of 2
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-gray hover:bg-neutral-200 transition-colors cursor-pointer"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2 className="font-bold text-foreground leading-snug mt-2">
              Tell us more
            </h2>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-deep-teal/10 rounded-full">
              <span className="text-xs font-semibold text-deep-teal">
                {selectedCategory?.label}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-5">
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail…"
                rows={5}
                maxLength={500}
                autoFocus
                className="w-full border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal/40 transition-colors bg-off-white/40 placeholder:text-neutral-gray"
              />
              <p className="text-xs text-neutral-gray text-right mt-1.5 tabular-nums">
                {description.length} / 500
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Photos</p>
                <p className="text-xs text-neutral-gray">
                  Optional, up to 3 photos
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`preview ${idx + 1}`}
                      className="w-full h-full object-cover rounded-2xl border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-foreground text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                      aria-label="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-2xl text-neutral-gray hover:border-deep-teal/40 hover:text-deep-teal transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs font-medium">Add photo</span>
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

          <div className="shrink-0 px-5 py-4 border-t border-border">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="w-full py-3.5 rounded-2xl bg-accent-orange text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-accent-orange/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
            <p className="text-xs text-neutral-gray text-center mt-3 leading-relaxed">
              Reports are anonymous. We review every report within 24 hours.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export function ReportReviewDrawer({
  bookingId,
  isOpen,
  onOpenChange,
}: ReportReviewDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const handleClose = () => onOpenChange(false)

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 overflow-hidden max-w-md w-full h-[85vh] flex flex-col gap-0 [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Report Review</DialogTitle>
          </VisuallyHidden>
          <ReportContent bookingId={bookingId} onClose={handleClose} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] flex flex-col outline-none">
        <VisuallyHidden>
          <DrawerTitle>Report Review</DrawerTitle>
        </VisuallyHidden>
        <div className="flex-1 min-h-0 flex flex-col">
          <ReportContent bookingId={bookingId} onClose={handleClose} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
