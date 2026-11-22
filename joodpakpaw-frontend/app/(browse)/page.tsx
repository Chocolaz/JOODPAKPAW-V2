'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { PropertyList } from '@/app/_components/PropertyList'
import { getProperties, getPropertiesByIds } from '@/lib/api'
import { readGeoCache, writeGeoCache } from '@/lib/geoCache'
import { PetProfile, Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import {
  SearchX,
  Map as MapIcon,
  List,
  ShieldCheck,
  X,
  Loader2,
} from 'lucide-react'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { useFeaturedSections } from '@/app/_hooks/useFeaturedSections'
import { useRecommendedProperties } from '@/app/_hooks/useRecommendedProperties'
import { useBrowsePets } from './_components/BrowseLayoutClient'
import { CategoryIconRail } from './_components/CategoryIconRail'
import { BrowseHero } from './_components/BrowseHero'
import { HomeMapView } from './_components/HomeMapView'

const RECOMMEND_LIMIT = 8
const RECENT_LIMIT = 4
const PAGE_SIZE = 24

export default function Home() {
  const {
    featured,
    isLoading: isFeaturedLoading,
    mutate: mutateFeatured,
  } = useFeaturedSections()

  const [pagedProperties, setPagedProperties] = useState<Property[]>([])
  const [page, setPage] = useState(1)
  const [pagedTotalPages, setPagedTotalPages] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // Airbnb default: Display total price is ON by default
  const [showTotalPrice, setShowTotalPrice] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  const { isAuthenticated, user, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { userPets } = useBrowsePets()
  const {
    searchQuery,
    province,
    checkIn,
    checkOut,
    petTypes,
    petSizeCategoryId,
    petProfileIds,
    facilities,
    propertyType,
    minRating,
    minPrice,
    maxPrice,
    sortBy,
    hasActiveSearchOrFilters,
    setParams,
    resetAllFilters,
    buildSeeAllUrl,
  } = useBrowseFilters()
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
    isLoading: isRecommendedLoading,
  } = useRecommendedProperties(1, RECOMMEND_LIMIT, recommendedLocation)

  const [filterResults, setFilterResults] = useState<Property[]>([])
  const [filterTotal, setFilterTotal] = useState(0)
  const [isFilterLoading, setIsFilterLoading] = useState(false)

  const filterKeyRef = useRef(0)

  // Revalidate featured sections when auth status genuinely changes
  const prevAuthRef = useRef(isAuthenticated)
  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated) {
      prevAuthRef.current = isAuthenticated
      mutateFeatured()
    }
  }, [isAuthenticated, mutateFeatured])

  const allProperties = useMemo(() => {
    const base = featured?.allProperties || []
    if (pagedProperties.length === 0) return base
    const seen = new Set(base.map((p) => p.id))
    return [...base, ...pagedProperties.filter((p) => !seen.has(p.id))]
  }, [featured?.allProperties, pagedProperties])

  const totalPages = pagedTotalPages ?? (featured?.allPropertiesTotalPages || 1)

  const fetchMoreProperties = useCallback(async (nextPage: number) => {
    setLoadingMore(true)
    try {
      const response = await getProperties(nextPage, PAGE_SIZE)
      setPagedProperties((prev) => [...prev, ...response.data])
      setPage(nextPage)
      setPagedTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to load more properties:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [])

  // Geo cache for personalized recommendations
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

  // Fetch filtered stays whenever any search/category/date/pet filter is active
  const petTypesKey = petTypes.join(',')
  const petProfileIdsKey = petProfileIds.join(',')
  const facilitiesKey = facilities.join(',')

  useEffect(() => {
    if (!hasActiveSearchOrFilters) {
      setFilterResults([])
      setFilterTotal(0)
      return
    }
    const key = ++filterKeyRef.current
    setIsFilterLoading(true)
    getProperties(1, 50, {
      search: searchQuery || undefined,
      province: province || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      petTypes: petTypesKey || undefined,
      petSizeCategoryId: petSizeCategoryId || undefined,
      petProfileIds: petProfileIdsKey || undefined,
      facilities: facilitiesKey || undefined,
      propertyType: propertyType || undefined,
      minRating: minRating || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      sortBy: sortBy || undefined,
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
  }, [
    hasActiveSearchOrFilters,
    searchQuery,
    province,
    checkIn,
    checkOut,
    petTypesKey,
    petSizeCategoryId,
    petProfileIdsKey,
    facilitiesKey,
    propertyType,
    minRating,
    minPrice,
    maxPrice,
    sortBy,
  ])

  // Exclude the current user's own properties from public browse
  const visibleProperties = useMemo(() => {
    if (!user) return allProperties
    return allProperties.filter((p) => p.hostId !== user.id)
  }, [allProperties, user])

  // Recently viewed batch hydration (preserving coordinated initial loading gate)
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
      ...(featured?.topRated || []),
      ...(featured?.bestValue || []),
      ...(featured?.newListings || []),
      ...(featured?.trending || []),
      ...recommendedProperties,
    ]) {
      map.set(prop.id, prop)
    }
    return map
  }, [visibleProperties, featured, recommendedProperties, extraRecentlyViewedMap])

  const coreFeedsSettled =
    !authLoading && !(!featured && isFeaturedLoading) && !isRecommendedLoading

  const missingRecentlyViewedIds = useMemo(() => {
    if (!coreFeedsSettled || recentlyViewedIds.length === 0) return []
    return recentlyViewedIds
      .slice(0, RECENT_LIMIT)
      .filter(
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
      hasActiveSearchOrFilters ||
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
            for (const prop of fetched) next.set(prop.id, prop)
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
  }, [coreFeedsSettled, hasActiveSearchOrFilters, missingRecentlyViewedKey])

  const resolvedRecentlyViewed = useMemo(() => {
    if (recentlyViewedIds.length === 0) return []
    return recentlyViewedIds
      .map((id) => loadedPoolMap.get(id))
      .filter((p): p is Property => p != null)
      .slice(0, RECENT_LIMIT)
  }, [recentlyViewedIds, loadedPoolMap])

  // Unified initial loading gate
  const isInitialLoading =
    !coreFeedsSettled ||
    (!hasActiveSearchOrFilters && missingRecentlyViewedIds.length > 0)

  const handleToggleHeroPetChip = (pet: PetProfile) => {
    const exists = petProfileIds.includes(pet.id)
    const nextIds = exists
      ? petProfileIds.filter((id) => id !== pet.id)
      : [...petProfileIds, pet.id]
    const nextTypes = Array.from(
      new Set(
        userPets
          .filter((p) => nextIds.includes(p.id))
          .map((p) => p.petTypeName?.toLowerCase())
          .filter((t): t is string => Boolean(t))
      )
    )
    setParams({
      petProfileIds: nextIds.length > 0 ? nextIds : null,
      petTypes: nextTypes.length > 0 ? nextTypes : null,
    })
  }

  const activeMapProperties = hasActiveSearchOrFilters
    ? filterResults
    : visibleProperties

  const showHero = !hasActiveSearchOrFilters && viewMode === 'list'

  return (
    <div className="min-h-screen bg-white">
      {/* 1. Sticky Category Icon Rail + Total Price Toggle + Sort */}
      <CategoryIconRail
        petTypes={petTypes}
        facilities={facilities}
        propertyType={propertyType}
        maxPrice={maxPrice}
        sortBy={sortBy}
        showTotalPrice={showTotalPrice}
        onToggleTotalPrice={setShowTotalPrice}
        onUpdateParams={setParams}
      />

      {/* Main Container */}
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 pt-5 pb-28 lg:pb-20 space-y-10">
        {/* 2. Compact Warm Off-White 3D Clay Hospitality Banner */}
        {showHero && (
          <BrowseHero
            isAuthenticated={isAuthenticated}
            userPets={userPets}
            selectedPetProfileIds={petProfileIds}
            onSelectPetChip={handleToggleHeroPetChip}
          />
        )}

        {/* Loading Gate */}
        {isInitialLoading ? (
          <div className="space-y-8">
            <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse motion-reduce:animate-none" />
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse motion-reduce:animate-none"
                >
                  <div className="aspect-square w-full bg-gray-200 rounded-2xl" />
                  <div className="mt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                    <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'map' ? (
          /* Split Map View Mode */
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-deep-teal break-words min-w-0">
                {hasActiveSearchOrFilters
                  ? 'Matching stays on map'
                  : 'Explore stays on map'}
              </h2>
              {hasActiveSearchOrFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-orange hover:underline"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear filters
                </button>
              )}
            </div>

            {isFilterLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse motion-reduce:animate-none"
                  >
                    <div className="aspect-square w-full bg-gray-200 rounded-2xl" />
                    <div className="mt-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeMapProperties.length === 0 ? (
              <EmptyState onReset={resetAllFilters} isFiltering={hasActiveSearchOrFilters} />
            ) : (
              <HomeMapView
                properties={activeMapProperties}
                showTotalPrice={showTotalPrice}
                checkIn={checkIn || undefined}
                checkOut={checkOut || undefined}
                showHeartIcon={isAuthenticated}
              />
            )}
          </section>
        ) : hasActiveSearchOrFilters ? (
          /* Filtered Search Results Grid */
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-deep-teal break-words min-w-0">
                  {province
                    ? `Stays in ${province}`
                    : searchQuery
                    ? `Results for "${searchQuery}"`
                    : 'Filtered stays'}
                </h2>
                {!isFilterLoading && (
                  <p className="text-sm text-neutral-gray mt-0.5 tabular-nums">
                    {filterTotal}{' '}
                    {filterTotal === 1 ? 'stay available' : 'stays available'}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full border border-gray-200 hover:border-deep-teal text-sm font-medium text-deep-teal transition-colors"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            </div>

            {isFilterLoading ? (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse motion-reduce:animate-none"
                  >
                    <div className="aspect-square w-full bg-gray-200 rounded-2xl" />
                    <div className="mt-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filterResults.length === 0 ? (
              <EmptyState onReset={resetAllFilters} isFiltering={true} />
            ) : (
              <PropertyList
                properties={filterResults}
                className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                showPetPolicyChip={true}
                showHeartIcon={isAuthenticated}
                showTotalPrice={showTotalPrice}
                checkIn={checkIn || undefined}
                checkOut={checkOut || undefined}
              />
            )}
          </section>
        ) : (
          /* Default Clean Airbnb Marketplace Home Flow */
          <div className="space-y-12">
            {/* 3. Recently Viewed (compact 4-col rail, only when history exists) */}
            {resolvedRecentlyViewed.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-deep-teal break-words min-w-0">
                    Recently viewed
                  </h2>
                  <Link
                    href={buildSeeAllUrl('/recently-viewed')}
                    className="text-sm font-semibold text-deep-teal hover:text-accent-orange underline-offset-4 hover:underline shrink-0"
                  >
                    See all
                  </Link>
                </div>
                <PropertyList
                  properties={resolvedRecentlyViewed}
                  className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  showPetPolicyChip={true}
                  showHeartIcon={isAuthenticated}
                  showTotalPrice={showTotalPrice}
                />
              </section>
            )}

            {/* 4. Recommended for You / Popular Picks (ML Hybrid Feed) */}
            {recommendedProperties.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-deep-teal break-words min-w-0">
                      {isAuthenticated
                        ? 'Recommended for you'
                        : 'Popular picks'}
                    </h2>
                    <p className="text-sm text-neutral-gray mt-0.5">
                      {isAuthenticated
                        ? 'Matched to your pet profiles and care preferences.'
                        : 'Well-reviewed pet-friendly stays across Thailand.'}
                    </p>
                  </div>
                  <Link
                    href={buildSeeAllUrl('/recommended')}
                    className="text-sm font-semibold text-deep-teal hover:text-accent-orange underline-offset-4 hover:underline shrink-0"
                  >
                    See all
                  </Link>
                </div>

                <PropertyList
                  properties={recommendedProperties.slice(0, RECOMMEND_LIMIT)}
                  className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  showPetPolicyChip={true}
                  showHeartIcon={isAuthenticated}
                  showMatchReason={true}
                  showTotalPrice={showTotalPrice}
                />
              </section>
            )}

            {/* 5. Explore Verified Stays (Unified 4-Col Airbnb Grid) */}
            <section className="space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-deep-teal break-words min-w-0">
                    Explore verified stays
                  </h2>
                  <p className="text-sm text-neutral-gray mt-0.5">
                    Browse pet hotels, homestays, and resorts ready to book.
                  </p>
                </div>
              </div>

              {visibleProperties.length === 0 ? (
                <EmptyState onReset={resetAllFilters} isFiltering={false} />
              ) : (
                <>
                  <PropertyList
                    properties={visibleProperties}
                    className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                    showPetPolicyChip={true}
                    showHeartIcon={isAuthenticated}
                    showTotalPrice={showTotalPrice}
                  />

                  {page < totalPages && (
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => fetchMoreProperties(page + 1)}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-7 rounded-full border border-deep-teal text-deep-teal font-semibold text-sm hover:bg-deep-teal hover:text-white transition-colors disabled:opacity-60"
                      >
                        {loadingMore && (
                          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                        )}
                        {loadingMore ? 'Loading stays' : 'Load more stays'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 6. Two-Sided Marketplace Host Onboarding Band (Zero invented metrics) */}
            <section className="rounded-3xl bg-deep-teal text-white px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2 max-w-xl min-w-0">
                  <div className="inline-flex items-center gap-2 text-off-white/90 text-sm font-medium">
                    <ShieldCheck className="w-4 h-4 text-positive-green shrink-0" />
                    <span>Identity-verified host community</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words min-w-0">
                    Open your home to travelling pets
                  </h2>
                  <p className="text-sm sm:text-base text-off-white/85 leading-relaxed">
                    Set your own room categories, daily availability calendar,
                    and pet safety rules as a verified JoodPakPaw host.
                  </p>
                </div>

                <div className="shrink-0">
                  {isAuthenticated ? (
                    <Link
                      href="/profile/host"
                      className="inline-flex items-center justify-center min-h-[48px] px-7 rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold text-sm sm:text-base transition-colors shadow-sm"
                    >
                      Become a verified host
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openAuthModal('login', { returnUrl: '/profile/host' })
                      }
                      className="inline-flex items-center justify-center min-h-[48px] px-7 rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold text-sm sm:text-base transition-colors shadow-sm"
                    >
                      Become a verified host
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Minimal Footer Colophon */}
            <footer className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-gray">
              <div>
                <p className="font-semibold text-deep-teal">JoodPakPaw</p>
                <p className="text-xs text-neutral-gray mt-0.5">
                  Trusted pet boarding and homestays across Thailand.
                </p>
              </div>
              <nav
                aria-label="Browse categories"
                className="flex items-center gap-5 flex-wrap text-xs sm:text-sm"
              >
                <Link
                  href="/top-rated"
                  className="hover:text-deep-teal transition-colors"
                >
                  Top rated
                </Link>
                <Link
                  href="/best-value"
                  className="hover:text-deep-teal transition-colors"
                >
                  Best value
                </Link>
                <Link
                  href="/dog-friendly"
                  className="hover:text-deep-teal transition-colors"
                >
                  Dog friendly
                </Link>
                <Link
                  href="/cat-friendly"
                  className="hover:text-deep-teal transition-colors"
                >
                  Cat friendly
                </Link>
                <Link
                  href="/profile/host"
                  className="hover:text-deep-teal transition-colors"
                >
                  Host dashboard
                </Link>
              </nav>
            </footer>
          </div>
        )}
      </div>

      {/* Floating Bottom-Center "Show map" / "Show list" Pill */}
      {!isInitialLoading && (
        <button
          type="button"
          onClick={() =>
            setViewMode((prev) => (prev === 'list' ? 'map' : 'list'))
          }
          className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 min-h-[46px] px-5 py-2.5 rounded-full bg-deep-teal text-white text-sm font-semibold shadow-lg hover:bg-deep-teal/95 active:scale-95 transition-transform motion-reduce:transition-none duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
        >
          {viewMode === 'list' ? (
            <>
              <MapIcon className="w-4 h-4" />
              <span>Show map</span>
            </>
          ) : (
            <>
              <List className="w-4 h-4" />
              <span>Show list</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

function EmptyState({
  isFiltering,
  onReset,
}: {
  isFiltering: boolean
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[38vh] gap-4 text-center py-12 px-4 rounded-3xl bg-off-white/60 border border-gray-100">
      <div className="w-16 h-16 rounded-full bg-white border border-gray-200 flex items-center justify-center">
        <SearchX className="w-7 h-7 text-neutral-gray" />
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="font-semibold text-deep-teal text-lg">
          No matching stays found
        </p>
        <p className="text-sm text-neutral-gray">
          {isFiltering
            ? 'Try adjusting your dates, pet filters, or price range.'
            : 'No verified stays are available right now.'}
        </p>
      </div>
      {isFiltering && (
        <button
          type="button"
          onClick={onReset}
          className="min-h-[42px] px-5 rounded-full bg-deep-teal text-white text-sm font-semibold hover:bg-deep-teal/90 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}
