'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { X, Check } from 'lucide-react'
import { toast } from 'sonner'

async function getCroppedImg(src: string, cropArea: Area, fileName: string): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Crop failed')); return }
        resolve(new File([blob], fileName.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      },
      'image/jpeg', 0.92,
    )
  })
}

interface CropModalProps {
  /** Blob URL of the image to crop. Pass null/undefined to hide the modal. */
  src: string | null | undefined
  aspect?: number
  fileName?: string
  /** Optional queue position label, e.g. { current: 2, total: 5 } */
  counter?: { current: number; total: number }
  onConfirm: (file: File) => void
  onCancel: () => void
}

export function CropModal({
  src,
  aspect = 4 / 3,
  fileName = 'image',
  counter,
  onConfirm,
  onCancel,
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), [])

  // Reset state when a new image is loaded
  useEffect(() => {
    if (src) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
  }, [src])

  // Lock body while open
  useEffect(() => {
    if (src) {
      document.body.style.pointerEvents = 'none'
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.pointerEvents = ''
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.pointerEvents = ''
      document.body.style.overflow = ''
    }
  }, [src])

  const handleConfirm = async () => {
    if (!src || !croppedAreaPixels) return
    setProcessing(true)
    try {
      const file = await getCroppedImg(src, croppedAreaPixels, fileName)
      onConfirm(file)
    } catch {
      toast.error('Failed to crop image.')
    } finally {
      setProcessing(false)
    }
  }

  if (!src) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/75 pointer-events-auto">
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{ containerStyle: { background: 'transparent' } }}
        />
      </div>
      <div className="shrink-0 flex items-center justify-between px-8 py-6">
        <button
          onClick={onCancel}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        {counter && counter.total > 1 && (
          <span className="text-white/30 text-xs tabular-nums">
            {counter.current} / {counter.total}
          </span>
        )}
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white disabled:opacity-40 transition-opacity"
        >
          <Check className="w-5 h-5 text-black" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
