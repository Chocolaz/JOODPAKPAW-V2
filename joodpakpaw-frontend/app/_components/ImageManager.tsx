'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { assetPath } from '@/lib/utils'
import { X, Plus, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { PropertyImage } from '@/types'
import { CropModal } from '@/app/_components/CropModal'

const DEFAULT_maxFiles = 10
const MAX_TOTAL_MB = 20
const CROP_ASPECT = 4 / 3
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

interface ImageManagerProps {
  existingImages: PropertyImage[]
  newFiles: File[]
  onExistingImagesChange: (images: PropertyImage[]) => void
  onNewFilesChange: (files: File[]) => void
  renderAsGridAddButton?: boolean
  layout?: 'scroll' | 'grid'
  maxFiles?: number
}

interface FileEntry { file: File; id: number; url: string }
interface CropSession { file: File; src: string }

export function ImageManager({
  existingImages = [],
  newFiles = [],
  onExistingImagesChange,
  onNewFilesChange,
  renderAsGridAddButton = false,
  layout = 'scroll',
  maxFiles = DEFAULT_maxFiles,
}: ImageManagerProps) {
  const counterRef = useRef(0)
  const entryCacheRef = useRef<Map<File, FileEntry>>(new Map())

  const [cropQueue, setCropQueue] = useState<CropSession[]>([])
  const pendingCroppedRef = useRef<File[]>([])

  // Create URLs synchronously during render so thumbnails appear immediately.
  // Revoke stale URLs (removed files) in an effect.
  const newFileSet = new Set(newFiles)
  for (const file of newFiles) {
    if (!entryCacheRef.current.has(file)) {
      entryCacheRef.current.set(file, { file, id: counterRef.current++, url: URL.createObjectURL(file) })
    }
  }

  useEffect(() => {
    // Revoke URLs for files that were removed
    for (const [file, entry] of entryCacheRef.current) {
      if (!newFileSet.has(file)) {
        URL.revokeObjectURL(entry.url)
        entryCacheRef.current.delete(file)
      }
    }
  })

  useEffect(() => {
    return () => { for (const e of entryCacheRef.current.values()) URL.revokeObjectURL(e.url) }
  }, [])

  const commitPending = () => {
    const all = [...pendingCroppedRef.current]
    if (all.length > 0) onNewFilesChange([...newFiles, ...all])
    pendingCroppedRef.current = []
  }

  const handleCropConfirm = (file: File) => {
    URL.revokeObjectURL(cropQueue[0].src)
    pendingCroppedRef.current.push(file)
    const next = cropQueue.slice(1)
    setCropQueue(next)
    if (next.length === 0) commitPending()
  }

  const handleCancelAll = () => {
    cropQueue.forEach((s) => URL.revokeObjectURL(s.src))
    setCropQueue([])
    pendingCroppedRef.current = []
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const incomingFiles = Array.from(e.target.files)
    e.target.value = ''

    const total = existingImages.length + newFiles.length
    if (total + incomingFiles.length > maxFiles) {
      toast.error(`You can upload a maximum of ${maxFiles} photos.`)
      return
    }

    const valid = incomingFiles.filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) { toast.error(`Unsupported file: ${f.name}`); return false }
      return true
    })
    if (valid.length === 0) return

    const existingSize = existingImages.reduce((a, img) => a + (img.fileSize || 0), 0)
    const currentSize = newFiles.reduce((a, f) => a + f.size, 0)
    const incomingSize = valid.reduce((a, f) => a + f.size, 0)
    if ((existingSize + currentSize + incomingSize) / (1024 * 1024) > MAX_TOTAL_MB) {
      toast.error(`Total size cannot exceed ${MAX_TOTAL_MB}MB.`)
      return
    }

    pendingCroppedRef.current = []
    setCropQueue(valid.map((file) => ({ file, src: URL.createObjectURL(file) })))
  }

  const removeNewFile = (file: File) => onNewFilesChange(newFiles.filter((f) => f !== file))
  const removeExistingImage = (id: number) => onExistingImagesChange(existingImages.filter((img) => img.id !== id))

  const totalImages = existingImages.length + newFiles.length
  const showEmptyZone = !renderAsGridAddButton

  const currentSession = cropQueue[0]
  const queueIndex = pendingCroppedRef.current.length + 1
  const queueTotal = pendingCroppedRef.current.length + cropQueue.length

  const fileInputRef = useRef<HTMLInputElement>(null)
  const triggerUpload = () => fileInputRef.current?.click()

  // Shared thumbnail renderer
  const renderThumbnail = (
    src: string,
    key: string | number,
    onRemove: () => void,
    isCover: boolean,
    unoptimized = false,
    gridMode = false,
  ) => (
    <div key={key} className={`relative ${gridMode ? 'w-full' : 'flex-none w-32'} aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-gray-100`}>
      <Image src={src} alt="" fill unoptimized={unoptimized} className="object-cover" />
      {isCover && (
        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          Cover
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-colors"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  )

  return (
    <>
      {/* Crop modal */}
      <CropModal
        src={currentSession?.src}
        aspect={CROP_ASPECT}
        fileName={currentSession?.file.name}
        counter={queueTotal > 1 ? { current: queueIndex, total: queueTotal } : undefined}
        onConfirm={handleCropConfirm}
        onCancel={handleCancelAll}
      />

      {/* ── Main UI ── */}
      <div className="w-full">
        {/* Single hidden file input */}
        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />

        {/* Empty upload zone (Step6 style) */}
        {showEmptyZone && (
          <div
            onClick={triggerUpload}
            className="flex flex-col items-center justify-center w-full aspect-[4/3] max-w-sm mx-auto border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-deep-teal/40 hover:bg-teal-50/30 transition-all bg-white"
          >
            <Image
              src={assetPath('/graphics/steps/add-photo.svg')}
              alt=""
              width={190}
              height={190}
              className="mb-4"
            />
            <span className="text-sm font-medium text-deep-teal">Click to upload photos</span>
            <span className="text-xs text-neutral-gray mt-1">Up to {maxFiles} photos · {MAX_TOTAL_MB}MB total</span>
          </div>
        )}

        {/* Thumbnails */}
        {totalImages > 0 && (
          <div className={layout === 'grid'
            ? 'grid grid-cols-2 gap-2 mt-3'
            : 'flex gap-3 pb-2 overflow-x-auto hide-scrollbar mt-6'
          }>
            {existingImages.map((image, i) =>
              renderThumbnail(
                image.filePath,
                `existing-${image.id}`,
                () => removeExistingImage(image.id),
                i === 0,
                false,
                layout === 'grid',
              ),
            )}
            {newFiles.map((file, i) => {
              const entry = entryCacheRef.current.get(file)
              if (!entry) return null
              const isCover = existingImages.length === 0 && i === 0
              return renderThumbnail(entry.url, entry.id, () => removeNewFile(file), isCover, true, layout === 'grid')
            })}

            {totalImages < maxFiles && (
              <div
                onClick={triggerUpload}
                className={`${layout === 'grid' ? 'w-full' : 'flex-none w-32'} aspect-[4/3] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-deep-teal/40 hover:bg-teal-50/30 transition-all bg-white`}
              >
                <ImagePlus className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400">Add more</span>
              </div>
            )}
          </div>
        )}

        {/* Grid add mode — empty state */}
        {renderAsGridAddButton && totalImages === 0 && (
          <div
            onClick={triggerUpload}
            className="flex-none w-32 aspect-[4/3] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-deep-teal/40 hover:bg-teal-50/30 transition-all bg-white"
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Add photos</span>
          </div>
        )}

        {/* Progress */}
        {totalImages > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-100 rounded-full h-0.5">
              <div
                className="bg-deep-teal h-0.5 rounded-full transition-all duration-300"
                style={{ width: `${(totalImages / maxFiles) * 100}%` }}
              />
            </div>
            <p className="text-xs text-neutral-gray mt-1.5 text-right">
              {totalImages} / {maxFiles} photos
            </p>
          </div>
        )}
      </div>
    </>
  )
}
