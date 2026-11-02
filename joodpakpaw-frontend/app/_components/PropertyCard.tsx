'use client'

import { Property } from '@/types'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { cn, getLowestPrice, getPetPolicy, assetPath, getApiImageUrl } from '@/lib/utils'
import { Globe, GlobeLock, Heart, Star, Ban } from 'lucide-react'
import { FavoriteDrawer } from './FavoriteDrawer'
import { useAuth } from '@/app/_components/AuthContext'
import {
  getFavoriteFolders,
  addFavorite,
  deleteFavoriteProperty,
  trackPropertyView,
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
  favoriteFolderId?: number
}

export function PropertyCard({
  property,
  href,
  className,
  showRoomCount,
  showStatusIcon = false,
  showPetPolicyChip = false,
  showHeartIcon = false,
  favoriteFolderId,
}: PropertyCardProps) {
  const { user } = useAuth()
  const isOwner = user && property.hostId === user.id

  const [imgSrc, setImgSrc] = useState(
    getApiImageUrl(property.images[0]?.filePath) || assetPath('/graphics/welcome.svg')
  )
  const [isHeartClicked, setIsHeartClicked] = useState(property.isFavorite)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    setIsHeartClicked(property.isFavorite)
  }, [property.isFavorite])

  const finalHref =
    href || (isOwner ? `/profile/host/${property.id}` : `/detail/${property.id}`)

  const lowestPrice = getLowestPrice(property.roomCategories)
  const petPolicy = getPetPolicy(property.pets)

  const handleCardClick = () => {
    if (user) {
      trackPropertyView(property.id)
        .then(() => console.log(`[trackPropertyView] property ${property.id} tracked for user ${user.id}`))
        .catch(() => {})
    }
  }

  const handleHeartClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isHeartClicked) {
      try {
        await deleteFavoriteProperty(property.id)
        setIsHeartClicked(false)
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
        } else {
          const sortedFolders = folders.sort((a, b) => a.id - b.id)
          const targetFolder = sortedFolders[0]
          folderName = targetFolder.name
          await addFavorite({
            propertyId: property.id,
            folderId: targetFolder.id,
          })
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

  return (
    <div className={cn('group', className)}>
      {/* Card inner — hover lifts the whole card */}
      <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
        {/* Image Box */}
        <div className="w-full aspect-square relative">
          <Link href={finalHref} className="relative block w-full h-full" onClick={handleCardClick}>
            <Image
              src={imgSrc}
              alt={property.title}
              fill
              unoptimized
              className="object-cover rounded-[20px] shadow-md group-hover:shadow-xl transition-shadow duration-300"
              onError={() => setImgSrc(assetPath('/graphics/welcome.svg'))}
            />
          </Link>
          {showPetPolicyChip && petPolicy && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-white rounded-full opacity-90 text-xs font-semibold text-deep-teal shadow-sm">
              {petPolicy}
            </div>
          )}
          {showStatusIcon && !showHeartIcon && (
            <div className="absolute top-2 right-2 p-1 bg-white rounded-full opacity-90">
              {property.isBannedByAdmin ? (
                <Ban className="h-6 w-6 text-red-500" />
              ) : property.isActive ? (
                <Globe className="h-6 w-6 text-deep-teal" />
              ) : (
                <GlobeLock className="h-6 w-6 text-accent-orange" />
              )}
            </div>
          )}
          {showHeartIcon && (
            <>
              <button
                className="absolute top-2 right-2 p-1 rounded-full cursor-pointer bg-transparent border-none"
                onClick={handleHeartClick}
              >
                <Heart
                  className={cn(
                    'h-6 w-6',
                    isHeartClicked
                      ? 'text-white fill-red-400'
                      : 'text-white fill-black/40'
                  )}
                />
              </button>
              <FavoriteDrawer
                propertyId={property.id}
                isOpen={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                onSuccess={() => setIsHeartClicked(true)}
              />
            </>
          )}
        </div>

        {/* Content */}
        <Link href={finalHref} onClick={handleCardClick}>
          <div className="mt-2 px-0.5">
            <p className="text-sm md:text-base lg:text-base xl:text-lg font-medium text-deep-teal truncate">
              {property.title}
            </p>

            <div className="flex items-start justify-between gap-1">
              <div className="text-xs md:text-sm lg:text-xs xl:text-sm text-neutral-gray leading-tight">
                <p>{property.province}</p>
                <p>{property.district}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Star
                  className={cn(
                    'w-3 h-3 md:w-3.5 md:h-3.5',
                    property.avgRating > 0
                      ? 'fill-yellow-400 text-yellow-500'
                      : 'text-gray-300'
                  )}
                />
                <span className="text-xs md:text-sm lg:text-sm xl:text-base font-medium text-gray-700">
                  {property.avgRating > 0 ? property.avgRating.toFixed(1) : 'New'}
                </span>
              </div>
            </div>

            {showRoomCount && property.totalRoomCategories !== undefined && (
              <p className="text-xs md:text-sm font-medium">
                {property.totalRoomCategories} Room{' '}
                {property.totalRoomCategories === 1 ? 'Type' : 'Types'}
              </p>
            )}

            {lowestPrice !== null && (
              <p className="font-bold text-xs md:text-sm lg:text-sm xl:text-base text-deep-teal">
                THB {lowestPrice}
              </p>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
