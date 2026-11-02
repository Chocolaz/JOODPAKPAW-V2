'use client'

import { useState, useEffect } from 'react'
import { getPropertyById, getPropertyRecommendations } from '@/lib/api'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { usePropertyLoader } from '@/app/_hooks/usePropertyLoader'
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
import { useAuth } from '@/app/_components/AuthContext'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { PropertyCard } from '@/app/_components/PropertyCard'
import type { Property } from '@/types'

function PropertyDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto pb-32 lg:pb-10">
      {/* Gallery skeleton */}
      {/* Mobile */}
      <div className="md:hidden">
        <Skeleton className="w-full aspect-square rounded-none" />
      </div>
      {/* Tablet+ */}
      <div
        className="hidden md:grid grid-cols-2 gap-2 rounded-2xl overflow-hidden pb-4"
        style={{ height: 480 }}
      >
        <Skeleton className="w-full h-full rounded-none" />
        <div className="grid grid-rows-2 gap-2">
          <Skeleton className="w-full h-full rounded-none" />
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-8 lg:px-2 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start lg:mt-2">
        {/* Left content */}
        <div className="space-y-4 mt-4">
          {/* Header */}
          <Skeleton className="h-8 w-3/4" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Contact button */}
          <Skeleton className="h-10 w-full rounded-full lg:hidden" />

          {/* Facilities */}
          <div className="border-t pt-8 space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* Host card */}
          <div className="border-t pt-8 mb-10">
            <Skeleton className="h-5 w-36 mb-5" />
            <div className="flex items-center gap-4 rounded-2xl p-5 border border-gray-100">
              <Skeleton className="w-16 h-16 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
            </div>
          </div>

          {/* Room categories */}
          <div className="border-t pt-8 space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="border-t pt-8 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="border-t pt-8 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        </div>

        {/* Right sidebar (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-3">
            <Skeleton className="h-96 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: 'easeOut' as const },
  }),
}

export default function PropertyDetailPage() {
  const { property, loading, error, refreshProperty } =
    usePropertyLoader(getPropertyById)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const [reportOpen, setReportOpen] = useState(false)
  const { track } = useRecentlyViewed()
  const [recommendations, setRecommendations] = useState<Property[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)

  useEffect(() => {
    if (property?.id) track(property.id)
  }, [property?.id])

  useEffect(() => {
    if (!property?.id) return

    setRecommendationsLoading(true)
    getPropertyRecommendations(property.id, 12)
      .then((res) => {
        setRecommendations(res.properties || [])
      })
      .catch((err) => {
        console.error('Failed to load recommendations:', err)
        setRecommendations([])
      })
      .finally(() => setRecommendationsLoading(false))
  }, [property?.id])

  const handleShare = async () => {
    if (navigator.share && property) {
      try {
        await navigator.share({
          title: property.title,
          text: `Check out this property: ${property.title}`,
          url: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/detail/${property.id}`,
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
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

  if (loading) return <PropertyDetailSkeleton />
  if (error) return <ErrorState message={error} />
  if (!property) return <ErrorState message="Property not found." />

  const roomCategoriesArray = normalizeRoomCategories(property.roomCategories)
  const startingPrice =
    roomCategoriesArray.length > 0
      ? Math.min(...roomCategoriesArray.map((r) => r.basePrice))
      : undefined

  return (
    <div className="max-w-6xl mx-auto relative pb-32 lg:pb-10">
      <PageHeaderButtons
        onBackClick={handleBack}
        onShareClick={handleShare}
        onReportClick={
          isAuthenticated && user?.id !== property.hostId
            ? () => setReportOpen(true)
            : undefined
        }
      />

      {/* Gallery — full width, slides in from top */}
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <PropertyImageGallery images={property.images} />
      </motion.div>

      {/* Body */}
      <div className="px-4 md:px-8 lg:px-2 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start lg:mt-2">
        {/* Left: content — each section staggers in */}
        <div className="min-w-0">
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <PropertyHeader property={property} />
          </motion.div>

          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <PropertyFacilities
              facilities={property.facilities}
              description={property.description}
            />
          </motion.div>

          {property.host && (
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <PropertyHost
                host={property.host}
                hostAvgRating={property.hostAvgRating}
                chatRoomId={property.chatRoomId}
                onChatSuccess={refreshProperty}
              />
            </motion.div>
          )}

          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <PropertyRoomCategories
              propertyId={property.id}
              roomCategories={roomCategoriesArray}
              onDeleteSuccess={refreshProperty}
              showDeleteButton={false}
              fallbackImageUrl={property.images?.[0]?.filePath}
            />
          </motion.div>

          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <PropertyReviews
              avgRating={property.avgRating}
              reviewCount={property.reviewCount ?? 0}
              reviews={property.reviews}
            />
          </motion.div>

          <motion.div
            custom={6}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <PropertyLocation property={property} />
          </motion.div>
        </div>

        {/* Right: sticky booking sidebar (desktop only) */}
        <motion.div
          className="hidden lg:block"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="sticky top-6 flex flex-col gap-3">
            <BookingDrawer
              propertyId={property.id}
              sidebarMode
              startingPrice={startingPrice}
              avgRating={property.avgRating}
              reviewCount={property.reviewCount ?? 0}
            />
          </div>
        </motion.div>
      </div>

      {/* Mobile fixed bottom booking bar */}
      <div className="lg:hidden">
        <BookingDrawer propertyId={property.id} />
      </div>

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          viewport={{ once: true }}
          className="mt-16 px-4 md:px-8 lg:px-2"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-baloo2 font-bold mb-6">
              Similar Properties
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
              {recommendations.map((rec) => {
                const currentChain = searchParams.get('propertyChain') || ''
                const newChain = currentChain ? `${currentChain},${property.id}` : String(property.id)
                return (
                  <PropertyCard
                    key={rec.id}
                    property={rec}
                    href={`/detail/${rec.id}?propertyChain=${newChain}`}
                  />
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      <ReportPropertyDrawer
        propertyId={property.id}
        isOpen={reportOpen}
        onOpenChange={setReportOpen}
      />
    </div>
  )
}
