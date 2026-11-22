'use client'

import { Property } from '@/types'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import {
  cn,
  getLowestPrice,
  getPetPolicy,
  assetPath,
  getApiImageUrl,
} from '@/lib/utils'
import {
  Globe,
  GlobeLock,
  Heart,
  Star,
  Ban,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteDrawer } from './FavoriteDrawer'
import { useAuth } from '@/app/_components/AuthContext'
import {
  getFavoriteFolders,
  addFavorite,
  deleteFavoriteProperty,
} from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { toast } from 'sonner'

interface PropertyCardProps {
  property: Property
  href?: string
  className?: string
  showRoomCount?: boolean
  showStatusIcon?: boolean
  showPetPolicyChip?: boolean
  showHeartIcon?: boolean
  showMatchReason?: boolean
  favoriteFolderId?: number
  showTotalPrice?: boolean
  checkIn?: string
  checkOut?: string
  isHighlighted?: boolean
  onHoverChange?: (id: number | null) => void
}

export function PropertyCard({
  property,
  href,
  className,
  showRoomCount,
  showStatusIcon = false,
  showPetPolicyChip = false,
  showHeartIcon = false,
  showMatchReason = false,
  favoriteFolderId,
  showTotalPrice = true,
  checkIn,
  checkOut,
  isHighlighted = false,
  onHoverChange,
}: PropertyCardProps) {
  const { user } = useAuth()
  const isOwner = Boolean(user && property.hostId === user.id)

  const imageUrls = useMemo(() => {
    const urls = (property.images ?? [])
      .map((img) => getApiImageUrl(img.filePath))
      .filter((u): u is string => Boolean(u))
    return urls.length > 0 ? urls : [assetPath('/graphics/welcome.svg')]
  }, [property.images])

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [failedIndices, setFailedIndices] = useState<Set<number>>(
    () => new Set()
  )
  const [isHeartClicked, setIsHeartClicked] = useState(property.isFavorite)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(
    favoriteFolderId ?? null
  )

  useEffect(() => {
    setIsHeartClicked(property.isFavorite)
  }, [property.isFavorite])

  const safeIndex =
    activeImageIndex < imageUrls.length ? activeImageIndex : 0
  const currentImgSrc = failedIndices.has(safeIndex)
    ? assetPath('/graphics/welcome.svg')
    : imageUrls[safeIndex]

  const finalHref = useMemo(() => {
    if (href) return href
    if (isOwner) return `/profile/host/${property.id}`
    const base = `/detail/${property.id}`
    if (checkIn && checkOut) {
      const params = new URLSearchParams({ checkIn, checkOut })
      return `${base}?${params.toString()}`
    }
    return base
  }, [href, isOwner, property.id, checkIn, checkOut])

  const lowestPrice = getLowestPrice(property.roomCategories)
  const petPolicy = getPetPolicy(property.pets)
  const hasMultipleImages = imageUrls.length > 1

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === 0 ? imageUrls.length - 1 : prev - 1
    )
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === imageUrls.length - 1 ? 0 : prev + 1
    )
  }

  const handleHeartClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isHeartClicked) {
      try {
        await deleteFavoriteProperty(property.id)
        setIsHeartClicked(false)
        setCurrentFolderId(null)
        toast.success('Property removed from favorites.')
      } catch (_error) {
        toast.error('Failed to remove from favorites.')
      }
    } else {
      try {
        const foldersResponse = await getFavoriteFolders()
        const folders = foldersResponse.favoriteFolders
        let folderName = 'default wishlist'

        if (folders.length === 0) {
          await addFavorite({ propertyId: property.id })
          const refreshed = await getFavoriteFolders()
          if (refreshed.favoriteFolders.length > 0) {
            setCurrentFolderId(refreshed.favoriteFolders[0].id)
          }
        } else {
          const sortedFolders = folders.sort((a, b) => a.id - b.id)
          const targetFolder = sortedFolders[0]
          folderName = targetFolder.name
          await addFavorite({
            propertyId: property.id,
            folderId: targetFolder.id,
          })
          setCurrentFolderId(targetFolder.id)
        }
        setIsHeartClicked(true)
        toast.success(`Property added to ${folderName}`, {
          action: {
            label: 'change',
            onClick: () => setIsDrawerOpen(true),
          },
          actionButtonStyle: {
            color: 'gray',
            textDecoration: 'underline',
            fontSize: '1rem',
          },
        })
      } catch (error) {
        if (error instanceof ApiError && error.code === 'FF-4101') {
          setIsHeartClicked(true)
          setIsDrawerOpen(true)
        } else {
          toast.error('Failed to add to favorites.')
        }
      }
    }
  }

  const hasStayTotal =
    property.stayTotalPrice != null &&
    property.stayNights != null &&
    property.stayNights > 0
  const perNightFromStay = hasStayTotal
    ? Math.round(property.stayTotalPrice! / property.stayNights!)
    : lowestPrice

  return (
    <div
      className={cn(
        'group min-w-0 rounded-2xl transition-shadow duration-200',
        isHighlighted && 'ring-2 ring-deep-teal ring-offset-2',
        className
      )}
      onMouseEnter={() => onHoverChange?.(property.id)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      {/* Image Box */}
      <div className="w-full aspect-[4/3] sm:aspect-square relative rounded-2xl overflow-hidden bg-off-white/70 border border-gray-100 group-hover:border-gray-200 shadow-sm transition-colors">
        <Link href={finalHref} className="relative block w-full h-full">
          {!isImageLoaded && (
            <Skeleton className="absolute inset-0 w-full h-full rounded-2xl bg-gray-200 animate-pulse motion-reduce:animate-none" />
          )}
          <Image
            src={currentImgSrc}
            alt={property.title}
            fill
            unoptimized
            onLoad={() => setIsImageLoaded(true)}
            className={cn(
              'object-cover rounded-2xl transition-opacity duration-300 ease-out',
              isImageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onError={() => {
              setFailedIndices((prev) => {
                const next = new Set(prev)
                next.add(safeIndex)
                return next
              })
              setIsImageLoaded(true)
            }}
          />
        </Link>

        {/* Top-left Pet Policy Chip */}
        {showPetPolicyChip && petPolicy && (
          <div className="pointer-events-none absolute top-2.5 left-2.5 px-2.5 py-1 bg-white/95 backdrop-blur-xs rounded-full text-xs font-medium text-deep-teal shadow-sm">
            {petPolicy}
          </div>
        )}

        {/* Top-right Host Status Icon */}
        {showStatusIcon && !showHeartIcon && (
          <div className="absolute top-2.5 right-2.5 p-1 bg-white rounded-full opacity-90">
            {property.isBannedByAdmin ? (
              <Ban className="h-5 w-5 text-red-500" />
            ) : property.isActive ? (
              <Globe className="h-5 w-5 text-deep-teal" />
            ) : (
              <GlobeLock className="h-5 w-5 text-accent-orange" />
            )}
          </div>
        )}

        {/* Top-right Heart Wishlist Button */}
        {showHeartIcon && (
          <>
            <button
              type="button"
              aria-label={
                isHeartClicked ? 'Remove from favorites' : 'Save to favorites'
              }
              className="absolute top-2.5 right-2.5 p-1.5 rounded-full cursor-pointer bg-transparent border-none transition-transform duration-150 hover:scale-110"
              onClick={handleHeartClick}
            >
              <Heart
                className={cn(
                  'h-5 w-5 drop-shadow-xs',
                  isHeartClicked
                    ? 'text-white fill-accent-orange'
                    : 'text-white fill-black/40'
                )}
              />
            </button>
            <FavoriteDrawer
              propertyId={property.id}
              isOpen={isDrawerOpen}
              onOpenChange={setIsDrawerOpen}
              currentFolderId={currentFolderId}
              onSuccess={(folderId) => {
                setIsHeartClicked(true)
                if (folderId != null) setCurrentFolderId(folderId)
              }}
            />
          </>
        )}

        {/* Multi-Photo Hover Carousel Controls */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-deep-teal shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-deep-teal shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Pagination Indicator Dots */}
            <div
              className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/25 backdrop-blur-xs"
              aria-hidden="true"
            >
              {imageUrls.slice(0, 5).map((_, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'rounded-full transition-opacity duration-150',
                    idx === safeIndex
                      ? 'w-1.5 h-1.5 bg-white opacity-100'
                      : 'w-1 h-1 bg-white/65 opacity-80'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card Metadata */}
      <Link href={finalHref} className="block mt-2.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold text-foreground truncate">
            {property.title}
          </p>
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <Star
              className={cn(
                'w-3.5 h-3.5',
                property.avgRating > 0
                  ? 'fill-foreground text-foreground'
                  : 'text-gray-300'
              )}
            />
            <span className="text-xs sm:text-sm font-medium text-foreground tabular-nums">
              {property.avgRating > 0 ? property.avgRating.toFixed(1) : 'New'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5 text-xs sm:text-sm text-neutral-gray">
          <p className="truncate">
            {property.district
              ? `${property.district}, ${property.province}`
              : property.province}
          </p>
          {property.host?.isVerifiedHost && (
            <span
              className="inline-flex items-center gap-0.5 text-deep-teal text-xs shrink-0"
              title="Verified host"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {showRoomCount && property.totalRoomCategories !== undefined && (
          <p className="text-xs sm:text-sm font-medium text-neutral-gray mt-0.5">
            {property.totalRoomCategories} Room{' '}
            {property.totalRoomCategories === 1 ? 'Type' : 'Types'}
          </p>
        )}

        {/* Pricing */}
        {hasStayTotal && showTotalPrice ? (
          <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold text-sm sm:text-base text-deep-teal tabular-nums underline decoration-deep-teal/30 underline-offset-2">
              ฿{property.stayTotalPrice!.toLocaleString()} total
            </span>
            <span className="text-xs text-neutral-gray tabular-nums">
              for {property.stayNights}{' '}
              {property.stayNights === 1 ? 'night' : 'nights'}
            </span>
          </div>
        ) : perNightFromStay !== null ? (
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-semibold text-sm sm:text-base text-deep-teal tabular-nums">
              ฿{perNightFromStay.toLocaleString()}
            </span>
            <span className="text-xs sm:text-sm text-neutral-gray">/ night</span>
          </div>
        ) : null}

        {/* Quiet ML Match Reason (Hallmark Floor #10: no decorative status dot) */}
        {showMatchReason &&
          property.matchReasons &&
          property.matchReasons.length > 0 && (
            <p
              title={property.matchReasons.join(', ')}
              className="mt-1 text-xs font-medium text-deep-teal/85 truncate"
            >
              {property.matchReasons[0]}
            </p>
          )}
      </Link>
    </div>
  )
}
