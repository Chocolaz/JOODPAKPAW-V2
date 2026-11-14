'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, FileImage, Trash2, UploadCloud } from 'lucide-react'

interface PromptPaySlipDropzoneProps {
  slipFile: File | null
  onSlipChange: (file: File | null) => void
  amount?: number
  className?: string
}

const VALID_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SLIP_BYTES = 10 * 1024 * 1024

export function PromptPaySlipDropzone({
  slipFile,
  onSlipChange,
  amount,
  className,
}: PromptPaySlipDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const slipPreviewUrl = useMemo(
    () => (slipFile ? URL.createObjectURL(slipFile) : null),
    [slipFile]
  )

  useEffect(() => {
    return () => {
      if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl)
    }
  }, [slipPreviewUrl])

  const validateAndSetFile = (file: File) => {
    setFileError(null)
    if (!VALID_MIMES.has(file.type)) {
      const err = 'Only image files (JPG, PNG, WebP) are allowed.'
      setFileError(err)
      toast.error(err)
      return
    }
    if (file.size === 0) {
      const err = 'Selected file is empty.'
      setFileError(err)
      toast.error(err)
      return
    }
    if (file.size > MAX_SLIP_BYTES) {
      const err = 'File size exceeds the 10MB limit.'
      setFileError(err)
      toast.error(err)
      return
    }
    onSlipChange(file)
    toast.success('Payment slip attached successfully')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleRemoveFile = () => {
    onSlipChange(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAttachMockSlip = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#f7f2e8'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#1c4f4a'
      ctx.fillRect(0, 0, canvas.width, 96)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText('JoodPakPaw PromptPay Slip (Mock)', 28, 58)
      ctx.fillStyle = '#323232'
      ctx.font = '18px sans-serif'
      if (typeof amount === 'number' && amount > 0) {
        ctx.fillText(`Amount: THB ${amount.toLocaleString()}`, 28, 160)
      }
      ctx.fillText(`Ref: MOCK-${Date.now()}`, 28, 200)
      ctx.fillStyle = '#ff6f3c'
      ctx.fillRect(28, 240, 180, 36)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('DEMO VERIFIED', 46, 264)
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      const mockFile = new File([blob], 'mock-promptpay-slip.png', {
        type: 'image/png',
      })
      validateAndSetFile(mockFile)
    }, 'image/png')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          Upload transfer slip
        </label>
        <span className="text-[11px] text-neutral-gray">
          JPG, PNG, WebP up to 10MB
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {!slipFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={handleDrop}
          onClick={handleAttachMockSlip}
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 bg-white',
            isDragging
              ? 'border-accent-orange bg-accent-orange/5'
              : 'border-border hover:border-accent-orange/50'
          )}
        >
          <div className="w-9 h-9 rounded-full bg-off-white flex items-center justify-center text-accent-orange">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              Click to upload or drag & drop slip
            </p>
            <p className="text-[11px] text-neutral-gray">
              Bank transfer confirmation receipt
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border p-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {slipPreviewUrl ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0 bg-off-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slipPreviewUrl}
                  alt="Slip preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-off-white flex items-center justify-center shrink-0 text-deep-teal">
                <FileImage className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {slipFile.name}
              </p>
              <p className="text-[11px] text-neutral-gray mt-0.5">
                {(slipFile.size / 1024).toFixed(1)} KB · Ready to submit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAttachMockSlip}
              className="text-xs text-deep-teal h-8 px-2 hover:bg-deep-teal/5"
            >
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="text-xs text-red-600 h-8 px-2 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {fileError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}
    </div>
  )
}
