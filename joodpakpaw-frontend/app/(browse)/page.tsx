'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { PageHeader } from '@/app/_components/PageHeader'
import { PropertyList } from '@/app/_components/PropertyList'
import { getProperties, getPropertiesByIds } from '@/lib/api'
import { readGeoCache, writeGeoCache } from '@/lib/geoCache'
import { Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SearchX,
  Compass,
  Star,
  Loader2,
  Tag,
  MapPin,
  Dog,
  Cat,
  Clock,
  TrendingUp,
  Heart,
} from 'lucide-react'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { useFeaturedSections } from '@/app/_hooks/useFeaturedSections'
import { useRecommendedProperties } from '@/app/_hooks/useRecommendedProperties'
import { BrowseSection } from './_components/BrowseSection'

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const RECOMMEND_LIMIT = 10
const PAGE_SIZE = 50
const SECTION_FETCH_LIMIT = 7
const EMPTY_SECTION = {
  data: [] as Property[],
  totalRows: 0,
  totalPages: 0,
  limit: 0,
  page: 1,
  orderBy: '',
  sort: '',
}

export default function Home() {
  const { featured, isLoading: isFeaturedLoading, mutate: mutateFeatured } = useFeaturedSections()

  const [pagedProperties, setPagedProperties] = useState<Property[]>([])
  const [page, setPage] = useState(1)
  const [pagedTotalPages, setPagedTotalPages] = useState<number | null>(null)
  const [pagedTotalRows, setPagedTotalRows] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const { isAuthenticated, user, loading: authLoading } = useAuth()
  const { searchQuery, filters, buildSeeAllUrl } = useBrowseFilters()
  const { ids: recentlyViewedIds } = useRecentlyViewed()
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lon: number
  } | null>(null)
  const recommendedLocation = useMemo(
    () =>
      userLocation ? { lat: userLocation.lat, lng: userLocation.lon } : null,
    [userLocation]
  )
  const {
    properties: recommendedProperties,
    totalRows: recommendedTotal,
    isLoading: isRecommendedLoading,
  } = useRecommendedProperties(1, RECOMMEND_LIMIT, recommendedLocation)

  const [filterResults, setFilterResults] = useState<Property[]>([])
  const [filterTotal, setFilterTotal] = useState(0)
  const [isFilterLoading, setIsFilterLoading] = useState(false)

  const filterKeyRef = useRef(0)

  // Revalidate featured sections when auth status genuinely changes (e.g. login/logout)
  const prevAuthRef = useRef(isAuthenticated)
  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated) {
      prevAuthRef.current = isAuthenticated
      mutateFeatured()
    }
  }, [isAuthenticated, mutateFeatured])

  const sectionData = useMemo(() => ({
    topRated: featured?.topRated || [],
    topRatedTotal: featured?.topRatedTotal || 0,
    bestValue: featured?.bestValue || [],
    bestValueTotal: featured?.bestValueTotal || 0,
    newListings: featured?.newListings || [],
    newListingsTotal: featured?.newListingsTotal || 0,
    trending: featured?.trending || [],
    trendingTotal: featured?.trendingTotal || 0,
    dogFriendly: featured?.dogFriendly || [],
    dogFriendlyTotal: featured?.dogFriendlyTotal || 0,
    catFriendly: featured?.catFriendly || [],
    catFriendlyTotal: featured?.catFriendlyTotal || 0,
  }), [featured])

  const properties = useMemo(() => {
    const base = featured?.allProperties || []
    if (pagedProperties.length === 0) return base
    return [...base, ...pagedProperties]
  }, [featured?.allProperties, pagedProperties])

  const totalPages = pagedTotalPages ?? (featured?.allPropertiesTotalPages || 1)
  const totalRows = pagedTotalRows ?? (featured?.allPropertiesTotal || 0)

  const fetchMoreProperties = useCallback(
    async (nextPage: number) => {
      setLoadingMore(true)
      try {
        const response = await getProperties(nextPage, PAGE_SIZE)
        setPagedProperties((prev) => [...prev, ...response.data])
        setPage(nextPage)
        setPagedTotalPages(response.totalPages)
        setPagedTotalRows(response.totalRows)
      } catch (error) {
        console.error('Failed to load more properties:', error)
      } finally {
        setLoadingMore(false)
      }
    },
    []
  )

  const fetchProperties = useCallback(
    async (pageNum: number, reset = false) => {
      if (reset) {
        setPagedProperties([])
        setPage(1)
        setPagedTotalPages(null)
        setPagedTotalRows(null)
        await mutateFeatured()
      } else {
        await fetchMoreProperties(pageNum)
      }
    },
    [fetchMoreProperties, mutateFeatured]
  )

  useEffect(() => {
    const cached = readGeoCache()
    if (cached) {
      setUserLocation(cached)
      return
    }
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }
        writeGeoCache(coords.lat, coords.lon)
        setUserLocation(coords)
      },
      () => {}
    )
  }, [])

  const hasActiveFilters =
    filters.petTypes.length > 0 ||
    filters.minRating > 0 ||
    filters.maxPrice !== ''
  const isFiltering = !!searchQuery || hasActiveFilters

  useEffect(() => {
    if (!isFiltering) {
      setFilterResults([])
      setFilterTotal(0)
      return
    }
    const key = ++filterKeyRef.current
    setIsFilterLoading(true)
    getProperties(1, PAGE_SIZE, {
      search: searchQuery || undefined,
      petTypes:
        filters.petTypes.length > 0 ? filters.petTypes.join(',') : undefined,
      minRating: filters.minRating || undefined,
      maxPrice: filters.maxPrice || undefined,
    })
      .then((res) => {
        if (key !== filterKeyRef.current) return
        setFilterResults(res.data)
        setFilterTotal(res.totalRows)
      })
      .catch(console.error)
      .finally(() => {
        if (key === filterKeyRef.current) setIsFilterLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isFiltering,
    searchQuery,
    filters.petTypes.join(','),
    filters.minRating,
    filters.maxPrice,
  ])

  // Exclude the current user's own properties
  const visibleProperties = useMemo(() => {
    if (!user) return properties
    return properties.filter((p) => p.hostId !== user.id)
  }, [properties, user])

  const topRatedItems = sectionData.topRated
  const bestValueItems = sectionData.bestValue
  const newListingsItems = sectionData.newListings
  const trendingItems = sectionData.trending

  const nearYou = useMemo(() => {
    if (!userLocation) return []
    return [...visibleProperties]
      .filter((p) => {
        if (p.latitude == null || p.longitude == null) return false
        return (
          haversineDistance(
            userLocation.lat,
            userLocation.lon,
            Number(p.latitude),
            Number(p.longitude)
          ) <= 50
        )
      })
      .sort((a, b) => {
        const distA = haversineDistance(
          userLocation.lat,
          userLocation.lon,
          Number(a.latitude),
          Number(a.longitude)
        )
        const distB = haversineDistance(
          userLocation.lat,
          userLocation.lon,
          Number(b.latitude),
          Number(b.longitude)
        )
        return distA - distB
      })
  }, [visibleProperties, userLocation])

  const dogFriendly = sectionData.dogFriendly
  const catFriendly = sectionData.catFriendly

  const [extraRecentlyViewedMap, setExtraRecentlyViewedMap] = useState<
    Map<number, Property>
  >(() => new Map())
  const [settledRecentlyViewedIds, setSettledRecentlyViewedIds] = useState<
    Set<number>
  >(() => new Set())

  const loadedPoolMap = useMemo(() => {
    const map = new Map<number, Property>(extraRecentlyViewedMap)
    for (const prop of [
      ...visibleProperties,
      ...sectionData.topRated,
      ...sectionData.bestValue,
      ...sectionData.newListings,
      ...sectionData.trending,
      ...sectionData.dogFriendly,
      ...sectionData.catFriendly,
      ...recommendedProperties,
    ]) {
      map.set(prop.id, prop)
    }
    return map
  }, [
    visibleProperties,
    sectionData,
    recommendedProperties,
    extraRecentlyViewedMap,
  ])

  const coreFeedsSettled =
    !authLoading && !(!featured && isFeaturedLoading) && !isRecommendedLoading

  const missingRecentlyViewedIds = useMemo(() => {
    if (!coreFeedsSettled || recentlyViewedIds.length === 0) return []
    return recentlyViewedIds.filter(
      (id) => !loadedPoolMap.has(id) && !settledRecentlyViewedIds.has(id)
    )
  }, [
    coreFeedsSettled,
    recentlyViewedIds,
    loadedPoolMap,
    settledRecentlyViewedIds,
  ])

  const missingRecentlyViewedKey = useMemo(
    () => missingRecentlyViewedIds.join(','),
    [missingRecentlyViewedIds]
  )

  useEffect(() => {
    if (
      !coreFeedsSettled ||
      isFiltering ||
      missingRecentlyViewedIds.length === 0
    ) {
      return
    }

    let cancelled = false
    const idsToFetch = missingRecentlyViewedIds

    getPropertiesByIds(idsToFetch)
      .then((fetched) => {
        if (cancelled) return
        if (fetched.length > 0) {
          setExtraRecentlyViewedMap((prev) => {
            const next = new Map(prev)
            for (const prop of fetched) {
              next.set(prop.id, prop)
            }
            return next
          })
        }
        setSettledRecentlyViewedIds((prev) => {
          const next = new Set(prev)
          for (const id of idsToFetch) next.add(id)
          return next
        })
      })
      .catch((err) => {
        console.error('Error fetching recently viewed properties:', err)
        if (cancelled) return
        setSettledRecentlyViewedIds((prev) => {
          const next = new Set(prev)
          for (const id of idsToFetch) next.add(id)
          return next
        })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreFeedsSettled, isFiltering, missingRecentlyViewedKey])

  const resolvedRecentlyViewed = useMemo(() => {
    if (recentlyViewedIds.length === 0) return []
    return recentlyViewedIds
      .map((id) => loadedPoolMap.get(id))
      .filter((p): p is Property => p != null)
  }, [recentlyViewedIds, loadedPoolMap])

  // Unified initial loading gate: wait for auth, featured sections, recommended feed,
  // and any batch lookup for recently viewed IDs absent from the loaded pool.
  const isLoading =
    !coreFeedsSettled || (!isFiltering && missingRecentlyViewedIds.length > 0)

  return (
    <div>
      {/* Mobile only: heading text (desktop hero is in BrowseLayoutClient) */}
      <div className="px-5 lg:hidden">
        <PageHeader />
      </div>

      {/* IMPORTANT: use <div> not <main> — root layout already wraps in <main> */}
      <div className="px-5 lg:px-12 mt-6 lg:mt-0 pb-28 lg:pb-16">
        {(() => {
          const filterLabel = [
            searchQuery ? `"${searchQuery}"` : null,
            filters.petTypes.length > 0
              ? filters.petTypes
                  .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                  .join(' & ')
              : null,
            filters.minRating > 0 ? `${filters.minRating}★+` : null,
            filters.maxPrice
              ? `฿${Number(filters.maxPrice).toLocaleString()} max`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <>
              {/* Flat results header — shown when searching or filtering */}
              {isFiltering && (
                <div className="flex items-center justify-between mb-4 lg:mb-6 lg:pt-6">
                  <h5 className="text-lg lg:text-xl xl:text-2xl font-semibold text-deep-teal truncate mr-4">
                    {filterLabel}
                  </h5>
                  <AnimatePresence>
                    {!isFilterLoading && (
                      <motion.span
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm lg:text-base font-normal text-neutral-gray shrink-0"
                      >
                        {filterTotal} {filterTotal === 1 ? 'place' : 'places'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-0 lg:pt-2">
                  {Array.from({ length: 3 }).map((_, si) => (
                    <div
                      key={si}
                      className="mb-10 lg:mb-0 lg:py-10 lg:border-b lg:border-gray-100 animate-pulse"
                    >
                      {/* Section header */}
                      <div className="flex items-center gap-2 mb-4 lg:mb-6">
                        <div className="w-5 h-5 bg-gray-200 rounded-full" />
                        <div className="h-5 bg-gray-200 rounded w-28" />
                      </div>
                      {/* Cards row */}
                      <div className="flex gap-4 overflow-hidden -mx-5 px-5 lg:mx-0 lg:px-0">
                        {Array.from({ length: 7 }).map((_, ci) => (
                          <div
                            key={ci}
                            className="w-44 shrink-0 lg:w-[calc((100%-6*1rem)/7)]"
                          >
                            <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
                            <div className="mt-2 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-3/4" />
                              <div className="h-3 bg-gray-200 rounded w-1/2" />
                              <div className="h-3 bg-gray-200 rounded w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : isFiltering ? (
                /* Flat results — search or filter active */
                <div>
                  <AnimatePresence mode="wait">
                    {isFilterLoading ? (
                      <motion.div
                        key="filter-skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4"
                      >
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
                            <div className="mt-2 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-3/4" />
                              <div className="h-3 bg-gray-200 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    ) : filterResults.length === 0 ? (
                      <EmptyState
                        searchQuery={searchQuery}
                        hasFilters={hasActiveFilters}
                      />
                    ) : (
                      <motion.div
                        key="filter-results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <PropertyList
                          properties={filterResults}
                          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4"
                          showPetPolicyChip={true}
                          showHeartIcon={isAuthenticated}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Sectioned browse — no active search or filters */
                <div className="lg:pt-2">
                  {/* Recently Viewed */}
                  {resolvedRecentlyViewed.length > 0 && (
                    <BrowseSection
                      title="Recently Viewed"
                      icon={<Clock className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />}
                      properties={resolvedRecentlyViewed}
                      totalCount={resolvedRecentlyViewed.length}
                      showHeartIcon={isAuthenticated}
                      showPetPolicyChip={true}
                      seeAllHref={buildSeeAllUrl('/recently-viewed')}
                    />
                  )}

                    {/* Recommended slot — personalized when authenticated, cold-start picks for guests */}
                    {recommendedProperties.length > 0 && (
                      <BrowseSection
                        title={
                          isAuthenticated
                            ? 'Recommended for You'
                            : 'Popular Picks to Get Started'
                        }
                        subtitle={
                          isAuthenticated
                            ? undefined
                            : 'Top-rated pet-friendly stays across Thailand'
                        }
                        icon={
                          isAuthenticated ? (
                            <Heart
                              className="w-5 h-5 text-deep-teal/70"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <Compass
                              className="w-5 h-5 text-deep-teal/70"
                              strokeWidth={1.5}
                            />
                          )
                        }
                        properties={recommendedProperties}
                        totalCount={recommendedTotal}
                        showHeartIcon={isAuthenticated}
                        showPetPolicyChip={true}
                        showMatchReason={true}
                        seeAllHref={buildSeeAllUrl('/recommended')}
                      />
                    )}

                    {visibleProperties.length === 0 ? (
                      <EmptyState searchQuery="" hasFilters={false} />
                    ) : (
                      <>
                        {/* Near You */}
                        {nearYou.length > 0 && (
                          <BrowseSection
                            title="Near You"
                            icon={
                              <MapPin className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />
                            }
                            properties={nearYou}
                            totalCount={nearYou.length}
                            showHeartIcon={isAuthenticated}
                            showPetPolicyChip={true}
                            seeAllHref={buildSeeAllUrl('/near-you')}
                          />
                        )}

                        <BrowseSection
                          title="Top Rated"
                          icon={
                            <Star className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />
                          }
                          properties={topRatedItems}
                          totalCount={sectionData.topRatedTotal}
                          showHeartIcon={isAuthenticated}
                          showPetPolicyChip={true}
                          seeAllHref={buildSeeAllUrl('/top-rated')}
                        />
                        <BrowseSection
                          title="Best Value"
                          icon={<Tag className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />}
                          properties={bestValueItems}
                          totalCount={sectionData.bestValueTotal}
                          showHeartIcon={isAuthenticated}
                          showPetPolicyChip={true}
                          seeAllHref={buildSeeAllUrl('/best-value')}
                        />
                        <BrowseSection
                          title="New Listings"
                          icon={<Compass className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />}
                          properties={newListingsItems}
                          totalCount={sectionData.newListingsTotal}
                          showHeartIcon={isAuthenticated}
                          showPetPolicyChip={true}
                          seeAllHref={buildSeeAllUrl('/new-listings')}
                        />
                        <BrowseSection
                          title="Trending"
                          icon={
                            <TrendingUp className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />
                          }
                          properties={trendingItems}
                          totalCount={sectionData.trendingTotal}
                          showHeartIcon={isAuthenticated}
                          showPetPolicyChip={true}
                          seeAllHref={buildSeeAllUrl('/trending')}
                        />

                        {/* Dog-friendly */}
                        {dogFriendly.length > 0 && (
                          <BrowseSection
                            title="Dog-Friendly"
                            icon={<Dog className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />}
                            properties={dogFriendly}
                            totalCount={sectionData.dogFriendlyTotal}
                            showHeartIcon={isAuthenticated}
                            showPetPolicyChip={false}
                            seeAllHref={buildSeeAllUrl('/dog-friendly')}
                          />
                        )}

                        {/* Cat-friendly */}
                        {catFriendly.length > 0 && (
                          <BrowseSection
                            title="Cat-Friendly"
                            icon={<Cat className="w-5 h-5 text-deep-teal/70" strokeWidth={1.5} />}
                            properties={catFriendly}
                            totalCount={sectionData.catFriendlyTotal}
                            showHeartIcon={isAuthenticated}
                            showPetPolicyChip={false}
                            seeAllHref={buildSeeAllUrl('/cat-friendly')}
                          />
                        )}
                      </>
                    )}
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

function EmptyState({
  searchQuery,
  hasFilters,
}: {
  searchQuery: string
  hasFilters: boolean
}) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center min-h-[40vh] gap-4 lg:gap-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="w-20 h-20 lg:w-28 lg:h-28 rounded-full bg-gray-100 flex items-center justify-center"
      >
        <SearchX className="w-9 h-9 lg:w-12 lg:h-12 text-gray-300" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="space-y-1 lg:space-y-2"
      >
        <p className="font-semibold text-gray-700 lg:text-xl xl:text-2xl">
          No properties found
        </p>
        <p className="text-sm lg:text-lg xl:text-xl text-neutral-gray">
          {searchQuery || hasFilters
            ? 'Try adjusting your search or filters.'
            : 'No properties available right now.'}
        </p>
      </motion.div>
    </motion.div>
  )
}
