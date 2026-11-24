'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getPropertyById,
  trackPropertyView,
  getFavoriteFolders,
  addFavorite,
  deleteFavoriteProperty,
} from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { usePropertyLoader } from '@/app/_hooks/usePropertyLoader'
import { useSimilarProperties } from '@/app/_hooks/useSimilarProperties'
import { PropertyImageGallery } from '@/app/_components/property-detail/PropertyImageGallery'
import { PropertyHeader } from '@/app/_components/property-detail/PropertyHeader'
import { PropertyFacilities } from '@/app/_components/property-detail/PropertyFacilities'
import { PropertyLocation } from '@/app/_components/property-detail/PropertyLocation'
import { PropertyReviews } from '@/app/_components/property-detail/PropertyReviews'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeaderButtons } from '@/app/_components/property-detail/PageHeaderButtons'
import { PropertyRoomCategories } from '@/app/_components/property-detail/PropertyRoomCategories'
import { PropertyHost } from '@/app/_components/property-detail/PropertyHost'
import { normalizeRoomCategories } from '@/lib/utils'
import { BookingDrawer } from '@/app/_components/property-detail/BookingDrawer'
import { ReportPropertyDrawer } from '@/app/_components/property-detail/ReportPropertyDrawer'
import { ReportReviewDrawer } from '@/app/_components/property-detail/ReportReviewDrawer'
import { FavoriteDrawer } from '@/app/_components/FavoriteDrawer'
import { useAuth } from '@/app/_components/AuthContext'
import { useBooking } from '@/app/_context/BookingContext'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { Skeleton } from '@/components/ui/skeleton'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { InlinePanel } from '@/app/_components/property-detail/BookingSearchBar'
import { ChevronLeft, Flag, Heart, Share2 } from 'lucide-react'
import { toast } from 'sonner'

function PropertyDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10 pb-28 lg:pb-12 lg:-mt-16 xl:-mt-[72px] lg:pt-6">
      {/* Desktop Top Editorial Header Skeleton */}
      <div className="hidden lg:block space-y-3 mb-5">
        <Skeleton className="h-8 w-1/2 bg-neutral-200 motion-reduce:animate-none" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-64 bg-neutral-200 motion-reduce:animate-none" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl bg-neutral-200 motion-reduce:animate-none" />
            <Skeleton className="h-9 w-20 rounded-xl bg-neutral-200 motion-reduce:animate-none" />
          </div>
        </div>
      </div>

      {/* Gallery Skeleton */}
      <div className="md:hidden -mx-4">
        <Skeleton className="w-full aspect-[4/3] rounded-none bg-neutral-200 motion-reduce:animate-none" />
      </div>
      <div className="hidden md:grid grid-cols-2 gap-2 rounded-2xl overflow-hidden h-[320px] lg:h-[360px] xl:h-[380px] mb-6">
        <Skeleton className="w-full h-full rounded-none bg-neutral-200 motion-reduce:animate-none" />
        <div className="grid grid-rows-2 gap-2">
          <Skeleton className="w-full h-full rounded-none bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="w-full h-full rounded-none bg-neutral-200 motion-reduce:animate-none" />
        </div>
      </div>

      {/* Body Split */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:items-start mt-5 lg:mt-0">
        <div className="space-y-8">
          <div className="lg:hidden space-y-2.5">
            <Skeleton className="h-7 w-3/4 bg-neutral-200 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-48 bg-neutral-200 motion-reduce:animate-none" />
          </div>

          <div className="border-t border-border pt-8 space-y-3">
            <Skeleton className="h-6 w-40 bg-neutral-200 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full bg-neutral-200 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-5/6 bg-neutral-200 motion-reduce:animate-none" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-5 w-full bg-neutral-200 motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-8 space-y-4">
            <Skeleton className="h-6 w-40 bg-neutral-200 motion-reduce:animate-none" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-64 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <Skeleton className="h-96 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}

export default function PropertyDetailPage() {
  const { property, loading, error, accessDenied, unauthorized, refreshProperty } =
    usePropertyLoader(getPropertyById, 'public-property')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, requireAuth } = useAuth()
  const {
    date,
    activePetCount,
    stayNights,
    loading: roomSearchLoading,
    selectedPets,
    petSizeId,
    currentPropertyData,
    handleSelectChange,
    hydrateDatesFromQuery,
  } = useBooking()

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReviewId, setReportReviewId] = useState<number | null>(null)
  const [favoriteDrawerOpen, setFavoriteDrawerOpen] = useState(false)
  const [favoriteOverride, setFavoriteOverride] = useState<{
    propId: number
    propVal: boolean
    val: boolean
  } | null>(null)
  const [desktopSidebarPanel, setDesktopSidebarPanel] =
    useState<InlinePanel>(null)

  const { track } = useRecentlyViewed()
  const trackedRecentRef = useRef<number | null>(null)
  const trackedPropertyRef = useRef<number | null>(null)
  const hydratedQueryRef = useRef<string | null>(null)

  const { properties: recommendations, isLoading: recommendationsLoading } =
    useSimilarProperties(property?.id, 10)

  const checkInQuery = searchParams.get('checkIn')
  const checkOutQuery = searchParams.get('checkOut')

  useEffect(() => {
    if (!property?.id || trackedRecentRef.current === property.id) return
    trackedRecentRef.current = property.id
    track(property.id)
  }, [property?.id, track])

  // Hydrate ?checkIn & ?checkOut from Home/Browse cards once per route query
  useEffect(() => {
    if (!property?.id || !checkInQuery || !checkOutQuery) return
    const key = `${property.id}:${checkInQuery}:${checkOutQuery}`
    if (hydratedQueryRef.current === key) return
    hydratedQueryRef.current = key
    hydrateDatesFromQuery(checkInQuery, checkOutQuery)
  }, [property?.id, checkInQuery, checkOutQuery, hydrateDatesFromQuery])

  useEffect(() => {
    if (!property?.id || !isAuthenticated || !user) return
    if (user.id === property.hostId) return
    if (trackedPropertyRef.current === property.id) return

    trackedPropertyRef.current = property.id
    trackPropertyView(property.id).catch(() => {})
  }, [property?.id, property?.hostId, isAuthenticated, user])

  const isFavorite =
    property &&
    favoriteOverride &&
    favoriteOverride.propId === property.id &&
    favoriteOverride.propVal === property.isFavorite
      ? favoriteOverride.val
      : Boolean(property?.isFavorite)

  const handleToggleFavorite = async () => {
    if (!property) return
    if (!requireAuth()) return

    if (isFavorite) {
      setFavoriteOverride({
        propId: property.id,
        propVal: property.isFavorite,
        val: false,
      })
      try {
        await deleteFavoriteProperty(property.id)
        toast.success('Removed from favorites')
      } catch (err: unknown) {
        setFavoriteOverride({
          propId: property.id,
          propVal: property.isFavorite,
          val: true,
        })
        const msg =
          err instanceof ApiError ? err.message : 'Failed to remove favorite'
        toast.error(msg)
      }
      return
    }

    setFavoriteOverride({
      propId: property.id,
      propVal: property.isFavorite,
      val: true,
    })
    try {
      const foldersRes = await getFavoriteFolders()
      const defaultFolder = foldersRes.favoriteFolders[0]
      if (!defaultFolder) {
        setFavoriteOverride({
          propId: property.id,
          propVal: property.isFavorite,
          val: false,
        })
        setFavoriteDrawerOpen(true)
        return
      }
      await addFavorite({ propertyId: property.id, folderId: defaultFolder.id })
      toast.success(`Saved to "${defaultFolder.name}"`, {
        action: {
          label: 'Change folder',
          onClick: () => setFavoriteDrawerOpen(true),
        },
      })
    } catch (err: unknown) {
      setFavoriteOverride({
        propId: property.id,
        propVal: property.isFavorite,
        val: false,
      })
      const msg =
        err instanceof ApiError ? err.message : 'Failed to save to favorites'
      toast.error(msg)
    }
  }

  const handleShare = async () => {
    if (!property) return
    const shareUrl = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/detail/${property.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title,
          text: `Check out ${property.title} on JoodPakPaw`,
          url: shareUrl,
        })
        return
      } catch {
        // User cancelled or share failed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const handleBack = () => {
    const fromBookings = searchParams.get('fromBookings')
    const bookingId = searchParams.get('bookingId')
    const fromFavorites = searchParams.get('fromFavorites')
    const folderId = searchParams.get('folderId')
    const propertyChain = searchParams.get('propertyChain')

    if (fromBookings === 'true' && bookingId) {
      router.push(`/profile/bookings/${bookingId}`)
    } else if (fromBookings === 'true') {
      router.push('/profile/bookings')
    } else if (fromFavorites === 'true' && folderId) {
      router.push(`/favorites/${folderId}`)
    } else if (fromFavorites === 'true') {
      router.push('/favorites')
    } else if (propertyChain) {
      const chain = propertyChain.split(',')
      if (chain.length > 0) {
        const previousPropertyId = chain[chain.length - 1]
        const updatedChain = chain.slice(0, -1).join(',')
        const query = updatedChain ? `?propertyChain=${updatedChain}` : ''
        router.push(`/detail/${previousPropertyId}${query}`)
      } else {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }

  const handlePromptSelectDates = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('drawer', 'open')
      router.replace(`?${params.toString()}`, { scroll: false })
      return
    }
    setDesktopSidebarPanel(!date?.from || !date?.to ? 'checkin' : 'pets')
    document.getElementById('booking-sidebar')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  if (accessDenied || unauthorized) return null
  if (loading) return <PropertyDetailSkeleton />
  if (error) return <ErrorState message={error} />
  if (!property) return <ErrorState message="Property not found." />

  const roomCategoriesArray = normalizeRoomCategories(property.roomCategories)
  const startingPrice =
    roomCategoriesArray.length > 0
      ? Math.min(...roomCategoriesArray.map((r) => r.basePrice))
      : undefined

  const canReport = Boolean(isAuthenticated && user?.id !== property.hostId)
  const hasSearchContext = Boolean(
    date?.from && date?.to && stayNights > 0 && activePetCount > 0
  )

  const desktopHeaderActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-off-white/70 transition-colors cursor-pointer"
      >
        <Share2 className="w-4 h-4 text-deep-teal" />
        <span>Share</span>
      </button>

      <button
        type="button"
        onClick={handleToggleFavorite}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-off-white/70 transition-colors cursor-pointer"
      >
        <Heart
          className={
            isFavorite
              ? 'w-4 h-4 fill-accent-orange text-accent-orange'
              : 'w-4 h-4 text-deep-teal'
          }
        />
        <span>{isFavorite ? 'Saved' : 'Save'}</span>
      </button>

      {canReport && (
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-neutral-gray hover:text-deep-teal hover:bg-off-white/70 transition-colors cursor-pointer"
        >
          <Flag className="w-4 h-4" />
          <span>Report</span>
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-[1200px] mx-auto relative pb-28 lg:pb-12 lg:-mt-16 xl:-mt-[72px]">
      {/* Mobile-only floating solid header buttons */}
      <div className="lg:hidden">
        <PageHeaderButtons
          onBackClick={handleBack}
          onShareClick={handleShare}
          onSaveClick={handleToggleFavorite}
          isFavorite={isFavorite}
          onReportClick={canReport ? () => setReportOpen(true) : undefined}
        />
      </div>

      {/* Desktop: Editorial Top Bar ABOVE Photo Mosaic */}
      <div className="hidden lg:block px-8 xl:px-10 pt-4 pb-4 space-y-2.5">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-gray hover:text-deep-teal transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to stays</span>
        </button>

        <PropertyHeader property={property} actions={desktopHeaderActions} />
      </div>

      {/* Gallery */}
      <div className="md:px-8 lg:px-8 xl:px-10">
        <PropertyImageGallery images={property.images} />
      </div>

      {/* Main Content Split */}
      <div className="px-4 md:px-8 lg:px-8 xl:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:items-start mt-5 lg:mt-6">
        {/* Left: Editorial Content & Unified Room Selection */}
        <div className="min-w-0 space-y-8">
          {/* Mobile Header sits below gallery */}
          <div className="lg:hidden">
            <PropertyHeader property={property} />
          </div>

          <PropertyFacilities
            facilities={property.facilities}
            description={property.description}
          />

          <PropertyRoomCategories
            propertyId={property.id}
            roomCategories={roomCategoriesArray}
            onDeleteSuccess={refreshProperty}
            showDeleteButton={false}
            fallbackImageUrl={property.images?.[0]?.filePath}
            bookingMode
            liveRoomCategories={currentPropertyData.roomCategories ?? []}
            selectedRooms={currentPropertyData.selectedRooms ?? {}}
            onSelectCountChange={(catId, nextCount) =>
              handleSelectChange(catId, nextCount, property.id)
            }
            selectedPets={selectedPets}
            petSizeId={petSizeId}
            stayNights={stayNights}
            hasSearchContext={hasSearchContext}
            searchLoading={roomSearchLoading}
            onPromptSelectDates={handlePromptSelectDates}
          />

          {property.host && (
            <PropertyHost
              host={property.host}
              hostAvgRating={property.hostAvgRating}
              chatRoomId={property.chatRoomId}
              onChatSuccess={refreshProperty}
              propertyId={property.id}
              propertyTitle={property.title}
              propertyThumbnail={property.images?.[0]?.filePath}
              startingPrice={startingPrice}
            />
          )}

          <PropertyReviews
            avgRating={property.avgRating}
            reviewCount={property.reviewCount ?? 0}
            reviews={property.reviews}
            onReportReview={
              isAuthenticated ? (id) => setReportReviewId(id) : undefined
            }
          />

          <PropertyLocation property={property} />
        </div>

        {/* Right: Sticky Booking Card (Desktop only) */}
        <aside className="hidden lg:block sticky top-6">
          <BookingDrawer
            propertyId={property.id}
            sidebarMode
            startingPrice={startingPrice}
            avgRating={property.avgRating}
            reviewCount={property.reviewCount ?? 0}
            inlinePanel={desktopSidebarPanel}
            onInlinePanelChange={setDesktopSidebarPanel}
          />
        </aside>
      </div>

      {/* Mobile fixed bottom conversion bar */}
      <div className="lg:hidden">
        <BookingDrawer
          propertyId={property.id}
          startingPrice={startingPrice}
          avgRating={property.avgRating}
          reviewCount={property.reviewCount ?? 0}
        />
      </div>

      {/* Similar Properties (5-col desktop grid matching DESIGN.md) */}
      {recommendationsLoading ? (
        <section className="mt-14 px-4 md:px-8 lg:px-8 xl:px-10">
          <h2 className="font-semibold text-deep-teal mb-5">
            Similar Properties
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-3/4 bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-1/2 bg-neutral-200 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </section>
      ) : recommendations.length > 0 ? (
        <section className="mt-14 px-4 md:px-8 lg:px-8 xl:px-10 border-t border-border pt-10">
          <h2 className="font-semibold text-deep-teal mb-5">
            Similar Properties
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
            {recommendations.slice(0, 10).map((rec) => {
              const currentChain = searchParams.get('propertyChain') || ''
              const newChain = currentChain
                ? `${currentChain},${property.id}`
                : String(property.id)
              return (
                <PropertyCard
                  key={rec.id}
                  property={rec}
                  href={`/detail/${rec.id}?propertyChain=${newChain}`}
                  showHeartIcon={isAuthenticated}
                  showMatchReason
                />
              )
            })}
          </div>
        </section>
      ) : null}

      <ReportPropertyDrawer
        propertyId={property.id}
        isOpen={reportOpen}
        onOpenChange={setReportOpen}
      />

      {reportReviewId !== null && (
        <ReportReviewDrawer
          bookingId={reportReviewId}
          isOpen={reportReviewId !== null}
          onOpenChange={(open) => {
            if (!open) setReportReviewId(null)
          }}
        />
      )}

      <FavoriteDrawer
        propertyId={property.id}
        isOpen={favoriteDrawerOpen}
        onOpenChange={setFavoriteDrawerOpen}
        onSuccess={() =>
          setFavoriteOverride({
            propId: property.id,
            propVal: property.isFavorite,
            val: true,
          })
        }
      />
    </div>
  )
}
