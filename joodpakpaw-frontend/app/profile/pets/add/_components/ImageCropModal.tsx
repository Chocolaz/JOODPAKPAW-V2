'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Slider } from '@/components/ui/slider'
import { X } from 'lucide-react'

interface ImageCropModalProps {
  imageSrc: string
  onCropComplete: (croppedFile: File) => void
  onCancel: () => void
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = new Image()
  image.src = imageSrc
  await new Promise<void>((resolve) => {
    image.onload = () => resolve()
  })

  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(new File([blob!], 'pet-image.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  })
}

export function ImageCropModal({ imageSrc, onCropComplete, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    const file = await getCroppedImg(imageSrc, croppedAreaPixels)
    onCropComplete(file)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onCancel}
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-white font-medium text-sm">Adjust Photo</span>
        <button
          onClick={handleConfirm}
          className="px-4 py-1.5 rounded-full bg-accent-orange text-white text-sm font-semibold hover:bg-accent-orange/90 transition-colors"
        >
          Done
        </button>
      </div>

      {/* Cropper */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Zoom slider */}
      <div className="px-8 py-5 shrink-0">
        <p className="text-white/40 text-xs text-center mb-3">
          Pinch or use slider to zoom
        </p>
        <Slider
          min={1}
          max={3}
          step={0.01}
          value={[zoom]}
          onValueChange={(val) => setZoom(val[0])}
        />
      </div>
    </div>
  )
}
