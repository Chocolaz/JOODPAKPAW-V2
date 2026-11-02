'use client'

import { useRef, useState } from 'react'
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
}

function AppealContent({
  propertyId,
  reportCategoryId = 10,
  onClose,
  onSuccess,
}: {
  propertyId?: number
  reportCategoryId?: number
  onClose: () => void
  onSuccess?: () => void
}) {
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const added = files.slice(0, 3 - images.length)
    setImages((prev) => [...prev, ...added])
    setPreviews((prev) => [...prev, ...added.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setImages((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await submitUnbanPropertyRequest(reportCategoryId, description.trim(), propertyId, images)
      toast.success('Appeal submitted. We will review it shortly.')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Failed to submit appeal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-gray-900 leading-snug">Submit Appeal</h2>
            <p className="text-sm text-gray-400 mt-1">Request a review of your suspended property.</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-modern px-5 pb-5 flex flex-col gap-5">
        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            Explain why you believe your property should be reinstated. Provide as much detail as possible to help us review your appeal fairly.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Your explanation <span className="text-red-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe why your property should be reinstated..."
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal transition"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{description.length} characters</p>
        </div>

        {/* Images */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Supporting images <span className="text-gray-400 font-normal">(optional, max 3)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {previews.map((src, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-deep-teal hover:text-deep-teal transition-colors"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px]">Add photo</span>
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
      <div className="shrink-0 px-5 py-4 border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-deep-teal text-white text-sm font-semibold transition hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? 'Submitting...' : 'Submit Appeal'}
        </button>
      </div>
    </div>
  )
}

export function UnbanPropertyDrawer({ propertyId, reportCategoryId, isOpen, onOpenChange, onSuccess }: UnbanPropertyDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const handleClose = () => onOpenChange(false)

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 overflow-hidden max-w-md w-full h-[85vh] flex flex-col gap-0 [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Submit Appeal</DialogTitle>
          </VisuallyHidden>
          <AppealContent propertyId={propertyId} reportCategoryId={reportCategoryId} onClose={handleClose} onSuccess={onSuccess} />
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
          <AppealContent propertyId={propertyId} reportCategoryId={reportCategoryId} onClose={handleClose} onSuccess={onSuccess} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
