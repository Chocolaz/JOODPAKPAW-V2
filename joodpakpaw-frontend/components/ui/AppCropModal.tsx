'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react'

export interface AppCropModalProps {
  isOpen: boolean
  imageSrc: string
  aspectRatio?: number
  circularCrop?: boolean
  title?: string
  onCropComplete: (croppedFile: File, previewUrl: string) => void
  onCancel: () => void
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function AppCropModal({
  isOpen,
  imageSrc,
  aspectRatio = 1,
  circularCrop = true,
  title = 'Crop Pet Photo',
  onCropComplete,
  onCancel,
}: AppCropModalProps) {
  const [mounted, setMounted] = useState(false)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [scale, setScale] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspectRatio))
    },
    [aspectRatio],
  )

  const handleApplyCrop = async () => {
    const image = imgRef.current
    if (!image || !completedCrop) {
      onCancel()
      return
    }

    try {
      setIsProcessing(true)

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      const pixelX = completedCrop.x * scaleX
      const pixelY = completedCrop.y * scaleY
      const pixelWidth = completedCrop.width * scaleX
      const pixelHeight = completedCrop.height * scaleY

      // Target canvas resolution (high-definition 512x512 for pet avatars)
      const targetSize = Math.max(512, Math.round(pixelWidth))
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas context unavailable')
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      if (circularCrop) {
        ctx.beginPath()
        ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2)
        ctx.clip()
      }

      ctx.drawImage(
        image,
        pixelX,
        pixelY,
        pixelWidth,
        pixelHeight,
        0,
        0,
        targetSize,
        targetSize,
      )

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false)
            onCancel()
            return
          }

          const file = new File([blob], 'pet-avatar.webp', { type: 'image/webp' })
          const previewUrl = URL.createObjectURL(blob)
          setIsProcessing(false)
          onCropComplete(file, previewUrl)
        },
        'image/webp',
        0.9,
      )
    } catch (err) {
      console.error('Failed to crop image:', err)
      setIsProcessing(false)
      onCancel()
    }
  }

  if (!isOpen || !mounted || !imageSrc) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      className="fixed inset-0 z-[99999] flex flex-col bg-stone-950/95 backdrop-blur-md text-stone-100 select-none animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-800/80 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors text-sm font-medium"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>

        <div className="text-center">
          <h2 id="crop-modal-title" className="text-sm sm:text-base font-semibold text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-stone-400 hidden sm:block">
            Drag frame or adjust zoom to fit
          </p>
        </div>

        <button
          type="button"
          onClick={handleApplyCrop}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-sm transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{isProcessing ? 'Saving...' : 'Apply'}</span>
        </button>
      </header>

      {/* Main Image Cropper Canvas */}
      <main className="relative flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <div className="max-w-full max-h-[60vh] sm:max-h-[68vh] flex items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio}
            circularCrop={circularCrop}
            keepSelection
            className="rounded-xl overflow-hidden shadow-2xl border border-stone-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              onLoad={onImageLoad}
              style={{
                transform: `scale(${scale})`,
                maxHeight: '60vh',
                maxWidth: '90vw',
                objectFit: 'contain',
                transition: 'transform 100ms ease-out',
              }}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>
      </main>

      {/* Bottom Controls Bar */}
      <footer className="px-4 sm:px-6 py-4 border-t border-stone-800/80 bg-stone-900/60 shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setScale((prev) => Math.max(1, +(prev - 0.2).toFixed(1)))}
            disabled={scale <= 1 || isProcessing}
            aria-label="Zoom out"
            className="p-2 text-stone-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              disabled={isProcessing}
              aria-label="Zoom level"
              className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
            <span className="text-xs font-mono text-stone-400 w-10 text-right">
              {scale.toFixed(1)}x
            </span>
          </div>

          <button
            type="button"
            onClick={() => setScale((prev) => Math.min(3, +(prev + 0.2).toFixed(1)))}
            disabled={scale >= 3 || isProcessing}
            aria-label="Zoom in"
            className="p-2 text-stone-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setScale(1)}
            disabled={scale === 1 || isProcessing}
            aria-label="Reset zoom"
            className="p-2 text-stone-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-stone-800 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}
