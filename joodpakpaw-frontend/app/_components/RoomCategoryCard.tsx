'use client'

import { BedDouble, PawPrint, Minus, Pencil, ImageOff, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { RoomCategories } from '@/types'
import { useState, useMemo, useRef } from 'react'
import { deleteRoomCategory } from '@/lib/api'
import { toast } from 'sonner'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { cn } from '@/lib/utils'
import { getPetPolicy } from '@/lib/utils'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

interface RoomCategoryCardProps {
  category: RoomCategories
  propertyId?: number
  onDeleteSuccess?: (deletedCategoryId: number) => void
  showDeleteButton?: boolean
  className?: string
  isOnlyRoom?: boolean
  fallbackImageUrl?: string
  onEdit?: (category: RoomCategories) => void
}

export function RoomCategoryCard({
  category,
  propertyId,
  onDeleteSuccess,
  showDeleteButton = false,
  className,
  isOnlyRoom = false,
  fallbackImageUrl,
  onEdit,
}: RoomCategoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const touchStartX = useRef(0)

  const canDelete = showDeleteButton && propertyId !== undefined && onDeleteSuccess
  const petPolicy = useMemo(() => getPetPolicy(category.pets), [category.pets])
  const images = category.images ?? []
  const hasMultiple = images.length > 1

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImgIndex((i) => (i - 1 + images.length) % images.length)
  }

  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImgIndex((i) => (i + 1) % images.length)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) < 40) return
    if (delta > 0) setImgIndex((i) => (i + 1) % images.length)
    else setImgIndex((i) => (i - 1 + images.length) % images.length)
  }

  const openLightbox = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxIndex(imgIndex)
    setLightboxOpen(true)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!canDelete || !propertyId || !onDeleteSuccess) return
    setIsModalOpen(false)
    setIsDeleting(true)
    try {
      await deleteRoomCategory(propertyId, category.id)
      toast.success('Room Category Deleted')
      onDeleteSuccess(category.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete room category')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className={cn('relative rounded-2xl border border-neutral-200 bg-white shadow-md/20 hover:shadow-lg/30 transition-all duration-300 overflow-hidden', className)}>

        {/* Cover image */}
        <div
          className="relative w-full h-40 overflow-hidden rounded-t-2xl bg-neutral-100 group/img"
          onTouchStart={hasMultiple ? handleTouchStart : undefined}
          onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
        >
          {images.length > 0 || fallbackImageUrl ? (
            <>
              <div
                className={cn('relative w-full h-full', images.length > 0 && 'cursor-zoom-in')}
                onClick={images.length > 0 ? openLightbox : undefined}
              >
                <Image
                  src={images.length > 0 ? images[imgIndex].filePath : fallbackImageUrl!}
                  alt={`${category.name} photo`}
                  fill
                  unoptimized
                  className="object-cover transition-opacity duration-200"
                />
                {images.length === 0 && fallbackImageUrl && (
                  <span className="absolute bottom-2 left-2 text-[10px] font-medium bg-black/50 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    Property photo
                  </span>
                )}
              </div>

              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-full transition-all duration-200',
                          i === imgIndex ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-300">
              <ImageOff className="w-8 h-8" />
              <span className="text-xs">No photo</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="font-semibold text-deep-teal text-lg leading-tight truncate">{category.name}</p>
            <p className="shrink-0 text-right">
              <span className="text-xl font-semibold text-neutral-900">{category.basePrice.toLocaleString()}</span>
              <span className="text-neutral-500 ml-1 text-sm">THB / night</span>
            </p>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-3 text-sm text-neutral-700">
            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-accent-orange/80" />
                  <span>{category.totalRoom} {category.totalRoom === 1 ? 'room' : 'rooms'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-accent-orange/80" />
                  <span>{category.numberOfPets} pets max</span>
                </div>
              </div>
              {category.petSizeCategory?.name && (
                <div className="text-xs text-neutral-600 font-medium">
                  Room size: {category.petSizeCategory.name.toLowerCase() === 'small' ? '< 12m²' : category.petSizeCategory.name.toLowerCase() === 'medium' ? '12–20m²' : '> 20m²'}
                </div>
              )}
            </div>
            {petPolicy && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-neutral-900 text-white font-medium shadow-sm">
                {petPolicy}
              </span>
            )}
          </div>

          {(category.facilities || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 min-w-0">
              {category.facilities?.map((facility) => (
                <span key={facility.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-neutral-100 text-neutral-700 border border-neutral-200 truncate">
                  {facility.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        {(onEdit || canDelete) && (
          <div className="flex border-t border-neutral-100">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(category) }}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-deep-teal hover:bg-neutral-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            {onEdit && canDelete && <div className="w-px bg-neutral-100" />}
            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isOnlyRoom || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={images.map((img) => ({ src: img.filePath }))}
        index={lightboxIndex}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        carousel={{ finite: images.length <= 1, imageFit: 'contain' }}
        controller={{ closeOnBackdropClick: true }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.85)' } as never }}
      />

      {canDelete && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Room Category"
          message={`Are you sure you want to delete the <strong>${category.name}</strong> room category? This action cannot be undone.`}
          confirmButtonClassName="bg-accent-orange hover:bg-red-700"
          titleClassName="text-accent-orange"
        />
      )}
    </>
  )
}
