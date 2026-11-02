'use client'

import Image from 'next/image'
import { assetPath, cn } from '@/lib/utils'
import { PropertyList } from '@/app/_components/PropertyList'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useProfileContext } from '../ProfileContext'
import { useEffect, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HostBookingList } from './_components/HostBookingList'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'
import { HostBookingHistoryList } from './_components/HostBookingHistoryList'
import { HostReviewsTab } from './_components/HostReviewsTab'
import {
  Plus,
  LayoutGrid,
  CalendarDays,
  History,
  Check,
  ExternalLink,
  ChevronLeft,
  Star,
  Ban,
  Clock,
} from 'lucide-react'
import { HostBanner } from '@/app/profile/_components/HostBanner'
import { useUserProfile } from '@/app/profile/_hooks/useUserProfile'
import { UnbanPropertyDrawer } from './_components/UnbanPropertyDrawer'
import { useState } from 'react'

const UNBAN_ALL_CATEGORY_ID = 11

export default function HostPage() {
  const { user } = useAuth()
  const { profile, refreshProfile } = useUserProfile()
  const isHost = user?.role?.some((role) => role.name === 'host')
  const [isAppealOpen, setIsAppealOpen] = useState(false)

  const {
    hostProperties: { properties, loading, error, refetch },
  } = useProfileContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const filterParam = searchParams.get('filter') || 'all'
  const fromNotifications = searchParams.get('from') === 'notifications'

  const defaultTab = useMemo(() => {
    if (
      isHost &&
      (tabParam === 'bookings' ||
        tabParam === 'history' ||
        tabParam === 'reviews')
    )
      return tabParam
    return 'properties'
  }, [isHost, tabParam])

  const publishedCount = useMemo(
    () => properties.filter((p) => p.isActive).length,
    [properties]
  )
  const draftCount = useMemo(
    () => properties.length - publishedCount,
    [properties, publishedCount]
  )

  const filteredProperties = useMemo(() => {
    if (filterParam === 'published') return properties.filter((p) => p.isActive)
    if (filterParam === 'draft') return properties.filter((p) => !p.isActive)
    return properties
  }, [properties, filterParam])

  const setFilter = (f: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', f)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    refetch()
  }, [refetch])

  // Lock page scroll — only the card list should scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    // Outer wrapper anchors the height chain for both mobile and desktop
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-[calc(100vh-5rem)] xl:h-[calc(100vh-6rem)] overflow-hidden">
      <UnbanPropertyDrawer
        isOpen={isAppealOpen}
        onOpenChange={setIsAppealOpen}
        reportCategoryId={UNBAN_ALL_CATEGORY_ID}
        onSuccess={refreshProfile}
      />

      {/* Mobile banner — shrink-0 so it takes its natural height */}
      <div className="lg:hidden shrink-0">
        <HostBanner
          summary={{
            total: properties.length,
            published: publishedCount,
            draft: draftCount,
          }}
        />
      </div>

      {/* Banned all properties banner */}
      {profile?.isBannedAllProperties &&
        (profile.hasPendingUnbanAllPropertiesRequest ? (
          <div className="shrink-0 mx-4 lg:mx-12 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-700">
                Appeal Under Review
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                We'll notify you once it's been reviewed.
              </p>
            </div>
          </div>
        ) : (
          <div className="shrink-0 mx-4 lg:mx-12 mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Ban className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-red-700 leading-tight">
                    Your account has been suspended
                  </p>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      (profile.unbanAllPropertiesRequestCount ?? 0) >= 2
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-red-600 border border-red-200'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {2 - (profile.unbanAllPropertiesRequestCount ?? 0)}/2
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(profile.unbanAllPropertiesRequestCount ?? 0) >= 2
                    ? 'Maximum appeals reached. No further appeals can be submitted.'
                    : 'All your properties have been deactivated and are no longer visible to guests. You may submit an appeal to request a review.'}
                </p>
              </div>
            </div>
            {(profile.unbanAllPropertiesRequestCount ?? 0) < 2 && (
              <button
                onClick={() => setIsAppealOpen(true)}
                className="w-full text-sm font-semibold text-red-600 border border-red-300 rounded-xl py-2.5 hover:bg-red-100 transition-colors"
              >
                Submit Appeal
              </button>
            )}
          </div>
        ))}

      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        {/* Tab bar */}
        {isHost && (
          <TabsList className="grid w-full grid-cols-4 rounded-none h-11 lg:h-13 shrink-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 lg:px-12">
            <TabsTrigger
              value="properties"
              className="flex items-center gap-2 text-sm lg:text-base"
            >
              <LayoutGrid className="w-4 h-4 hidden lg:block" />
              Properties
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="flex items-center gap-2 text-sm lg:text-base"
            >
              <CalendarDays className="w-4 h-4 hidden lg:block" />
              Bookings
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 text-sm lg:text-base"
            >
              <History className="w-4 h-4 hidden lg:block" />
              History
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="flex items-center gap-2 text-sm lg:text-base"
            >
              <Star className="w-4 h-4 hidden lg:block" />
              Reviews
            </TabsTrigger>
          </TabsList>
        )}

        {/* Properties tab */}
        <TabsContent
          value="properties"
          className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col"
        >
          {/* Desktop stats + filter bar — shrink-0 */}
          <div className="hidden lg:flex items-center justify-between px-12 pt-8 pb-4 shrink-0">
            <div>
              <p className="text-sm text-accent-orange font-medium">
                Hello, {user?.firstName}!
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    router.push(
                      fromNotifications ? '/notifications' : '/profile'
                    )
                  }
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-500 hover:text-gray-800 -ml-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold text-deep-teal">
                  My Properties
                </h2>
                {user?.id && (
                  <button
                    onClick={() => router.push(`/hosts/${user.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-deep-teal/30 text-deep-teal hover:bg-deep-teal hover:text-white hover:border-deep-teal transition-all duration-150"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View public profile
                  </button>
                )}
              </div>
            </div>
            {!loading && !error && properties.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                    filterParam === 'all'
                      ? 'bg-deep-teal text-white border-deep-teal shadow-sm'
                      : 'bg-white text-deep-teal border-deep-teal/40 hover:border-deep-teal hover:bg-deep-teal/10 hover:scale-105'
                  )}
                >
                  {filterParam === 'all' && <Check className="w-3.5 h-3.5" />}
                  {properties.length} Total
                </button>
                {publishedCount > 0 && (
                  <button
                    onClick={() => setFilter('published')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                      filterParam === 'published'
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-white text-green-700 border-green-300 hover:border-green-500 hover:bg-green-50 hover:scale-105'
                    )}
                  >
                    {filterParam === 'published' && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {publishedCount} Published
                  </button>
                )}
                {draftCount > 0 && (
                  <button
                    onClick={() => setFilter('draft')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                      filterParam === 'draft'
                        ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                        : 'bg-white text-yellow-700 border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50 hover:scale-105'
                    )}
                  >
                    {filterParam === 'draft' && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {draftCount} Draft
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable card area */}
          <div className={cn("flex-1 min-h-0 scrollbar-modern px-4 md:px-6 lg:px-12 pt-4 lg:pt-0 pb-28 lg:pb-8", (loading || error || properties.length > 0) ? "overflow-y-auto" : "overflow-hidden")}>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 lg:gap-5"
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
                      <div className="mt-2 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <ErrorState message={error} />
                </motion.div>
              ) : properties.length > 0 ? (
                <motion.div
                  key={`content-${filterParam}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 lg:gap-5"
                >
                  {/* Add Property card */}
                  <button
                    onClick={() =>
                      !profile?.isBannedAllProperties &&
                      router.push('/profile/host/add-property')
                    }
                    disabled={!!profile?.isBannedAllProperties}
                    className={cn(
                      'block w-full text-left group',
                      profile?.isBannedAllProperties
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer'
                    )}
                  >
                    <div
                      className={cn(
                        'aspect-square w-full rounded-[20px] border-2 border-dashed flex flex-col items-center justify-center transition-all duration-200',
                        profile?.isBannedAllProperties
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-gray-300 group-hover:border-deep-teal bg-gray-50 group-hover:bg-teal-50/50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center transition-colors mb-2',
                          profile?.isBannedAllProperties
                            ? 'bg-gray-200'
                            : 'bg-deep-teal/10 group-hover:bg-deep-teal/20'
                        )}
                      >
                        <Plus
                          className={cn(
                            'w-6 h-6',
                            profile?.isBannedAllProperties
                              ? 'text-gray-400'
                              : 'text-deep-teal'
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          profile?.isBannedAllProperties
                            ? 'text-gray-400'
                            : 'text-deep-teal'
                        )}
                      >
                        Add Property
                      </span>
                    </div>
                  </button>

                  {filteredProperties.length > 0 ? (
                    <PropertyList
                      properties={filteredProperties}
                      className="contents"
                      buildHref={(property) => `/profile/host/${property.id}`}
                      showRoomCount={true}
                      showStatusIcon={true}
                    />
                  ) : (
                    <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center">
                      <p className="text-base font-medium text-gray-500">
                        No {filterParam} properties
                      </p>
                      <button
                        onClick={() => setFilter('all')}
                        className="text-sm text-deep-teal underline underline-offset-2"
                      >
                        Show all
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-16 items-center text-center mt-10 lg:mt-20 px-6"
                >
                  <Image
                    src={assetPath('/graphics/no-host.svg')}
                    alt="No host listing"
                    width={280}
                    height={280}
                    className="w-full h-auto max-w-[200px] lg:max-w-[280px] mx-auto lg:mx-0"
                  />
                  <div className="lg:text-left mt-6 lg:mt-0">
                    <h2 className="text-xl lg:text-3xl font-semibold text-deep-teal">
                      No properties yet
                    </h2>
                    <p className="mt-2 text-sm lg:text-base text-neutral-gray leading-relaxed max-w-[280px]">
                      Open your home and heart to new furry friends
                    </p>
                    <button
                      onClick={() => router.push('/profile/host/add-property')}
                      disabled={!!profile?.isBannedAllProperties}
                      className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-orange text-white hover:bg-accent-orange/80 text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent-orange"
                    >
                      <Plus className="w-5 h-5" />
                      Add Your First Property
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        {isHost && (
          <TabsContent
            value="bookings"
            className="mt-0 flex-1 min-h-0 overflow-hidden"
          >
            <HostBookingList />
          </TabsContent>
        )}

        {isHost && (
          <TabsContent
            value="history"
            className="mt-0 flex-1 min-h-0 overflow-hidden"
          >
            <HostBookingHistoryList />
          </TabsContent>
        )}

        {isHost && (
          <TabsContent
            value="reviews"
            className="mt-0 flex-1 min-h-0 overflow-hidden"
          >
            <HostReviewsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
