'use client'

import {
  BedDouble,
  PawPrint,
  Minus,
  Plus,
  Pencil,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import Image from 'next/image'
import { RoomCategories } from '@/types'
import { useState, useMemo, useRef } from 'react'
import { deleteRoomCategory } from '@/lib/api'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { cn, getPetPolicy, formatPetSizeRange } from '@/lib/utils'
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
  onManageCalendar?: (category: RoomCategories) => void
  // Unified booking flow props (property detail)
  bookingMode?: boolean
  liveCategory?: RoomCategories
  selectedCount?: number
  onSelectCountChange?: (categoryId: number, nextCount: number) => void
  ineligibilityReason?: string | null
  stayNights?: number
  hasSearchContext?: boolean
  searchLoading?: boolean
  onPromptSelectDates?: () => void
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
  onManageCalendar,
  bookingMode = false,
  liveCategory,
  selectedCount = 0,
  onSelectCountChange,
  ineligibilityReason = null,
  stayNights = 0,
  hasSearchContext = false,
  searchLoading = false,
  onPromptSelectDates,
}: RoomCategoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const touchStartX = useRef(0)

  const canDelete =
    showDeleteButton && propertyId !== undefined && onDeleteSuccess
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
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to delete room category'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  // Booking calculations
  const availability = liveCategory?.availability
  const availableRooms = availability?.availableRooms ?? 0
  const roomsNeeded = availability?.roomsNeeded ?? 1
  const totalStayPrice = availability?.totalPrice ?? category.basePrice * stayNights
  const avgNightlyRate =
    stayNights > 0 && availability?.totalPrice
      ? Math.round(availability.totalPrice / stayNights)
      : category.basePrice

  const isSelected = bookingMode && selectedCount > 0
  const isDisabledInBooking =
    bookingMode && hasSearchContext && Boolean(ineligibilityReason)

  const handleIncrement = () => {
    if (!onSelectCountChange || isDisabledInBooking) return
    const nextCount =
      selectedCount === 0 ? Math.max(1, roomsNeeded) : selectedCount + 1
    if (nextCount <= availableRooms) {
      onSelectCountChange(category.id, nextCount)
    }
  }

  const handleDecrement = () => {
    if (!onSelectCountChange || selectedCount <= 0) return
    const minRequired = Math.max(1, roomsNeeded)
    const nextCount =
      selectedCount <= minRequired ? 0 : selectedCount - 1
    onSelectCountChange(category.id, nextCount)
  }

  const canIncrement =
    !isDisabledInBooking &&
    (selectedCount === 0
      ? availableRooms >= Math.max(1, roomsNeeded)
      : selectedCount + 1 <= availableRooms)

  return (
    <>
      <div
        className={cn(
          'relative rounded-2xl border bg-white transition-colors overflow-hidden flex flex-col',
          isSelected
            ? 'border-deep-teal ring-1 ring-deep-teal/20'
            : isDisabledInBooking
              ? 'border-border bg-off-white/50 opacity-85'
              : 'border-border hover:border-foreground/25',
          className
        )}
      >
        {/* Cover image */}
        <div
          className="relative w-full h-40 overflow-hidden bg-off-white/60 group/img shrink-0"
          onTouchStart={hasMultiple ? handleTouchStart : undefined}
          onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
        >
          {images.length > 0 || fallbackImageUrl ? (
            <>
              <div
                className={cn(
                  'relative w-full h-full bg-off-white/60',
                  images.length > 0 && 'cursor-zoom-in'
                )}
                onClick={images.length > 0 ? openLightbox : undefined}
              >
                {!isImageLoaded && (
                  <Skeleton className="absolute inset-0 w-full h-full rounded-none bg-neutral-200 animate-pulse motion-reduce:animate-none z-0" />
                )}
                <Image
                  src={
                    images.length > 0
                      ? images[imgIndex].filePath
                      : fallbackImageUrl!
                  }
                  alt={`${category.name} photo`}
                  fill
                  unoptimized
                  onLoad={() => setIsImageLoaded(true)}
                  className={cn(
                    'object-cover transition-opacity duration-300',
                    isImageLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {images.length === 0 && fallbackImageUrl && (
                  <span className="absolute bottom-2 left-2 text-[11px] font-medium bg-foreground/75 text-white px-2 py-0.5 rounded-md">
                    Property photo
                  </span>
                )}
              </div>

              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label="Previous room photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/60 hover:bg-foreground/80 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label="Next room photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/60 hover:bg-foreground/80 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full transition-colors duration-200',
                          i === imgIndex ? 'bg-white' : 'bg-white/50'
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

          {isSelected && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-deep-teal text-white px-2.5 py-1 text-xs font-semibold tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {selectedCount} selected
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col gap-3.5">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <p className="font-semibold text-deep-teal text-base leading-snug truncate capitalize">
                {category.name}
              </p>
              {bookingMode && hasSearchContext && liveCategory ? (
                <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
                  {availableRooms} rooms available
                </p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              {bookingMode && hasSearchContext && liveCategory && stayNights > 0 ? (
                <>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
                    ฿{totalStayPrice.toLocaleString()}
                  </p>
                  <p className="text-xs text-neutral-gray tabular-nums">
                    ฿{avgNightlyRate.toLocaleString()} / night
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
                    ฿{category.basePrice.toLocaleString()}
                  </p>
                  <p className="text-xs text-neutral-gray">/ night</p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-foreground/80">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <BedDouble className="w-4 h-4 text-deep-teal shrink-0" />
                <span className="tabular-nums">
                  {category.totalRoom}{' '}
                  {category.totalRoom === 1 ? 'room' : 'rooms'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <PawPrint className="w-4 h-4 text-deep-teal shrink-0" />
                <span className="tabular-nums">
                  Up to {category.numberOfPets} pets
                </span>
              </div>
              {category.petSizeCategory?.name && (
                <span className="capitalize text-neutral-gray">
                  Max {category.petSizeCategory.name}
                  {!category.petSizeCategory.name.includes('(') &&
                    ` (${formatPetSizeRange(
                      category.petSizeCategory.min,
                      category.petSizeCategory.max
                    )})`}
                </span>
              )}
            </div>

            {petPolicy && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-deep-teal/10 text-deep-teal font-medium">
                {petPolicy}
              </span>
            )}
          </div>

          {(category.facilities || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {category.facilities?.map((facility) => (
                <span
                  key={facility.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-off-white/80 text-neutral-gray border border-border truncate"
                >
                  {facility.name}
                </span>
              ))}
            </div>
          )}

          {/* Ineligibility feedback */}
          {bookingMode && hasSearchContext && ineligibilityReason && (
            <div className="mt-auto flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{ineligibilityReason}</span>
            </div>
          )}
        </div>

        {/* Unified Booking Footer */}
        {bookingMode && (
          <div className="px-5 py-3.5 border-t border-border bg-off-white/40 flex items-center justify-between gap-3">
            {!hasSearchContext ? (
              <>
                <span className="text-xs text-neutral-gray">
                  Select dates &amp; pets to check availability
                </span>
                <button
                  type="button"
                  onClick={onPromptSelectDates}
                  className="shrink-0 px-3.5 py-2 rounded-xl border border-deep-teal/30 bg-white text-xs font-semibold text-deep-teal hover:bg-deep-teal/5 transition-colors cursor-pointer"
                >
                  Check dates
                </button>
              </>
            ) : searchLoading && !liveCategory ? (
              <div className="w-full flex items-center justify-between">
                <Skeleton className="h-4 w-32 bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className="h-9 w-24 rounded-xl bg-neutral-200 motion-reduce:animate-none" />
              </div>
            ) : isDisabledInBooking ? (
              <span className="text-xs font-medium text-neutral-gray">
                Unavailable for selected stay
              </span>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground tabular-nums">
                    {selectedCount > 0
                      ? `฿${(totalStayPrice * selectedCount).toLocaleString()} for ${selectedCount} ${selectedCount === 1 ? 'room' : 'rooms'}`
                      : roomsNeeded > 1
                        ? `Requires at least ${roomsNeeded} rooms`
                        : `${availableRooms} left for your dates`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={selectedCount <= 0}
                    aria-label={`Remove ${category.name} room`}
                    className="w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center text-foreground hover:border-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground tabular-nums">
                    {selectedCount}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={!canIncrement}
                    aria-label={`Add ${category.name} room`}
                    className="w-9 h-9 rounded-full border border-deep-teal bg-deep-teal text-white flex items-center justify-center hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Host Dashboard Action Bar */}
        {(onEdit || canDelete || onManageCalendar) && (
          <div className="flex border-t border-border divide-x divide-border">
            {onManageCalendar && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onManageCalendar(category)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-medium text-deep-teal hover:bg-off-white/60 transition-colors cursor-pointer"
                title="Manage availability & daily pricing"
              >
                <CalendarDays className="w-4 h-4 text-deep-teal" />
                <span>Calendar</span>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(category)
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-deep-teal hover:bg-off-white/60 transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isOnlyRoom || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
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
        styles={{
          root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.85)' } as never,
        }}
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
