'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { submitVerification } from '@/lib/api'
import { CropModal } from '@/app/_components/CropModal'
import { ImageUploadBox } from './ImageUploadBox'

export function UploadForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [idPhoto, setIdPhoto] = useState<File | null>(null)
  const [selfieWithId, setSelfieWithId] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<'id' | 'selfie' | null>(null)

  const canSubmit = !!idPhoto && !!selfieWithId && !submitting

  const handleFileSelected = (target: 'id' | 'selfie', file: File) => {
    setCropSrc(URL.createObjectURL(file))
    setCropTarget(target)
  }

  const handleCropConfirm = (file: File) => {
    if (cropTarget === 'id') setIdPhoto(file)
    else if (cropTarget === 'selfie') setSelfieWithId(file)
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropTarget(null)
  }

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropTarget(null)
  }

  const handleSubmit = async () => {
    if (!idPhoto || !selfieWithId) return
    setSubmitting(true)
    try {
      await submitVerification(idPhoto, selfieWithId)
      toast.success("Verification submitted! We'll review it shortly.")
      onSubmitted()
    } catch {
      toast.error('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.div
        key="upload"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        {/* Info banner */}
        <div className="bg-deep-teal/5 border border-deep-teal/10 rounded-2xl px-4 py-3 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-deep-teal shrink-0 mt-0.5" />
          <p className="text-sm text-deep-teal/80 leading-relaxed">
            Make sure both photos are clear and well-lit before submitting.
          </p>
        </div>

        {/* Upload boxes */}
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadBox
            label="ID Photo"
            description="Front of your government-issued ID"
            file={idPhoto}
            onFileSelected={(f) => handleFileSelected('id', f)}
          />
          <ImageUploadBox
            label="Selfie with ID"
            description="Hold your ID next to your face"
            file={selfieWithId}
            onFileSelected={(f) => handleFileSelected('selfie', f)}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3.5 rounded-full bg-accent-orange text-white text-sm font-semibold hover:bg-accent-orange/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Submit for Verification
            </>
          )}
        </button>
      </motion.div>

      <CropModal
        src={cropSrc}
        aspect={cropTarget === 'id' ? 4 / 3 : 3 / 4}
        fileName={cropTarget === 'id' ? 'id-photo.jpg' : 'selfie-with-id.jpg'}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  )
}
