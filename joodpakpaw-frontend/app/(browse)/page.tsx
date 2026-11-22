'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PropertyList } from '@/app/_components/PropertyList'
import { PropertyCard } from '@/app/_components/PropertyCard'
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { useFeaturedSections } from '@/app/_hooks/useFeaturedSections'
import { useRecommendedProperties } from '@/app/_hooks/useRecommendedProperties'
import { useBrowsePets } from './_components/BrowseLayoutClient'
import { CategoryIconRail } from './_components/CategoryIconRail'
import { BrowseHero } from './_components/BrowseHero'
import { HomeMapView } from './_components/HomeMapView'
import { cn, assetPath } from '@/lib/utils'

const RECOMMEND_LIMIT = 10
const RECENT_LIMIT = 12
const PAGE_SIZE = 20

function buildPageNumbers(
  current: number,
  total: number
): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('ellipsis')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function scrollToSectionTop(el: HTMLElement | null) {
  if (!el || typeof window === 'undefined') return
  const prefersReduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches
  const top = el.getBoundingClientRect().top + window.scrollY - 140
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReduced ? 'auto' : 'smooth',
  })
}

export default function Home() {
  const {
    featured,
    isLoading: isFeaturedLoading,
    mutate: mutateFeatured,
  } = useFeaturedSections()

  // Real backend pagination for "Explore verified stays" (limit = 12)
  const [explorePage, setExplorePage] = useState(1)
  const [exploreProperties, setExploreProperties] = useState<Property[]>([])
  const [exploreTotalPages, setExploreTotalPages] = useState(1)
  const [exploreTotalRows, setExploreTotalRows] = useState(0)
  const [isExploreLoading, setIsExploreLoading] = useState(true)
  const exploreRequestRef = useRef(0)
  const exploreSectionRef = useRef<HTMLElement | null>(null)
  const filteredSectionRef = useRef<HTMLElement | null>(null)

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

  // Real backend pagination for filtered search results (limit = 12)
  const [filterPage, setFilterPage] = useState(1)
  const [filterResults, setFilterResults] = useState<Property[]>([])
  const [filterTotal, setFilterTotal] = useState(0)
  const [filterTotalPages, setFilterTotalPages] = useState(1)
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

  // Fetch paginated "Explore verified stays"
  const fetchExplorePage = useCallback(async (targetPage: number) => {
    const reqId = ++exploreRequestRef.current
    setIsExploreLoading(true)
    try {
      const response = await getProperties(targetPage, PAGE_SIZE)
      if (reqId !== exploreRequestRef.current) return
      setExploreProperties(response.data)
      setExploreTotalPages(Math.max(1, response.totalPages || 1))
      setExploreTotalRows(response.totalRows ?? response.data.length)
    } catch (error) {
      console.error('Failed to load explore properties:', error)
    } finally {
      if (reqId === exploreRequestRef.current) setIsExploreLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExplorePage(explorePage)
  }, [explorePage, isAuthenticated, fetchExplorePage])

  // Geo cache for personalized recommendations & map default center
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

  // Reset pagination to page 1 whenever filters/category/search change
  const petTypesKey = petTypes.join(',')
  const petProfileIdsKey = petProfileIds.join(',')
  const facilitiesKey = facilities.join(',')

  useEffect(() => {
    setFilterPage(1)
    setExplorePage(1)
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

  // Fetch filtered stays whenever any search/category/date/pet filter is active
  useEffect(() => {
    if (!hasActiveSearchOrFilters) {
      setFilterResults([])
      setFilterTotal(0)
      setFilterTotalPages(1)
      return
    }
    const key = ++filterKeyRef.current
    setIsFilterLoading(true)
    getProperties(filterPage, PAGE_SIZE, {
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
        setFilterTotal(res.totalRows ?? res.data.length)
        setFilterTotalPages(Math.max(1, res.totalPages || 1))
      })
      .catch(console.error)
      .finally(() => {
        if (key === filterKeyRef.current) setIsFilterLoading(false)
      })
  }, [
    hasActiveSearchOrFilters,
    filterPage,
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
    const source =
      exploreProperties.length > 0
        ? exploreProperties
        : explorePage === 1
        ? featured?.allProperties || []
        : []
    if (!user) return source
    return source.filter((p) => p.hostId !== user.id)
  }, [exploreProperties, explorePage, featured?.allProperties, user])

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
      ...(featured?.allProperties || []),
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
    !authLoading &&
    !(!featured && isFeaturedLoading) &&
    !isRecommendedLoading &&
    !(explorePage === 1 && isExploreLoading && exploreProperties.length === 0)

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

  const handleExplorePageChange = (nextPage: number) => {
    if (nextPage === explorePage || nextPage < 1 || nextPage > exploreTotalPages)
      return
    setExplorePage(nextPage)
    scrollToSectionTop(exploreSectionRef.current)
  }

  const handleFilterPageChange = (nextPage: number) => {
    if (nextPage === filterPage || nextPage < 1 || nextPage > filterTotalPages)
      return
    setFilterPage(nextPage)
    scrollToSectionTop(filteredSectionRef.current)
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
        {/* 2. Warm Off-White Hospitality Banner */}
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
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {Array.from({ length: 10 }).map((_, idx) => (
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
              <EmptyState
                onReset={resetAllFilters}
                isFiltering={hasActiveSearchOrFilters}
              />
            ) : (
              <HomeMapView
                properties={activeMapProperties}
                showTotalPrice={showTotalPrice}
                checkIn={checkIn || undefined}
                checkOut={checkOut || undefined}
                showHeartIcon={isAuthenticated}
                userLocation={recommendedLocation}
              />
            )}
          </section>
        ) : hasActiveSearchOrFilters ? (
          /* Filtered Search Results Grid */
          <section ref={filteredSectionRef} className="space-y-5">
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
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full border border-border hover:border-deep-teal text-sm font-medium text-deep-teal transition-colors"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            </div>

            {isFilterLoading ? (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {Array.from({ length: 10 }).map((_, i) => (
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
              <>
                <PropertyList
                  properties={filterResults}
                  className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5"
                  showPetPolicyChip={true}
                  showHeartIcon={isAuthenticated}
                  showTotalPrice={showTotalPrice}
                  checkIn={checkIn || undefined}
                  checkOut={checkOut || undefined}
                />
                {filterTotalPages > 1 && (
                  <PaginationBar
                    currentPage={filterPage}
                    totalPages={filterTotalPages}
                    totalRows={filterTotal}
                    pageSize={PAGE_SIZE}
                    isLoading={isFilterLoading}
                    onPageChange={handleFilterPageChange}
                  />
                )}
              </>
            )}
          </section>
        ) : (
          /* Default Clean Airbnb Marketplace Home Flow */
          <div className="space-y-12">
            {/* 3. Recently Viewed (Horizontal Scrollable Rail + "See all") */}
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
                <div className="flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                  {resolvedRecentlyViewed.map((property) => (
                    <div
                      key={property.id}
                      className="w-[260px] sm:w-[280px] lg:w-[295px] shrink-0 snap-start"
                    >
                      <PropertyCard
                        property={property}
                        showPetPolicyChip={true}
                        showHeartIcon={isAuthenticated}
                        showTotalPrice={showTotalPrice}
                      />
                    </div>
                  ))}
                </div>
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
                  className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5"
                  showPetPolicyChip={true}
                  showHeartIcon={isAuthenticated}
                  showMatchReason={true}
                  showTotalPrice={showTotalPrice}
                />
              </section>
            )}

            {/* 5. Explore Verified Stays (Unified 5-Col Desktop Grid with Even 20-Item Pagination) */}
            <section ref={exploreSectionRef} className="space-y-5">
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

              {isExploreLoading ? (
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
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
              ) : visibleProperties.length === 0 ? (
                <EmptyState onReset={resetAllFilters} isFiltering={false} />
              ) : (
                <>
                  <PropertyList
                    properties={visibleProperties}
                    className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5"
                    showPetPolicyChip={true}
                    showHeartIcon={isAuthenticated}
                    showTotalPrice={showTotalPrice}
                  />

                  <PaginationBar
                    currentPage={explorePage}
                    totalPages={exploreTotalPages}
                    totalRows={exploreTotalRows || visibleProperties.length}
                    pageSize={PAGE_SIZE}
                    isLoading={isExploreLoading}
                    onPageChange={handleExplorePageChange}
                  />
                </>
              )}
            </section>

            {/* 6. Two-Sided Marketplace Host Onboarding Band (Zero invented metrics) */}
            <section className="rounded-3xl bg-deep-teal text-white px-6 py-7 sm:px-10 sm:py-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-3 max-w-xl min-w-0">
                  <div className="inline-flex items-center gap-2 text-off-white/90 text-sm font-medium">
                    <ShieldCheck className="w-4 h-4 text-positive-green shrink-0" />
                    <span>Identity-verified host community</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words min-w-0">
                    Open your home to travelling pets
                  </h2>
                  <p className="text-sm sm:text-base text-off-white/85 leading-relaxed">
                    Set your own room categories, daily availability calendar,
                    and pet safety rules as a verified JoodPakPaw host.
                  </p>
                  <div className="pt-1">
                    {isAuthenticated ? (
                      <Link
                        href="/profile/host"
                        className="inline-flex items-center justify-center min-h-[46px] px-7 rounded-full bg-accent-orange hover:bg-accent-orange/90 active:scale-[0.98] text-white font-semibold text-sm sm:text-base transition-colors"
                      >
                        Become a verified host
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          openAuthModal('login', { returnUrl: '/profile/host' })
                        }
                        className="inline-flex items-center justify-center min-h-[46px] px-7 rounded-full bg-accent-orange hover:bg-accent-orange/90 active:scale-[0.98] text-white font-semibold text-sm sm:text-base transition-colors"
                      >
                        Become a verified host
                      </button>
                    )}
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-[290px] lg:w-[340px]">
                  <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-off-white">
                    <Image
                      src={assetPath('/graphics/hero-clay-home.webp')}
                      alt="Miniature 3D clay pet homestay waiting for travelling pets"
                      fill
                      sizes="(max-width: 768px) 100vw, 340px"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Minimal Footer Colophon */}
            <footer className="border-t border-border pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-gray">
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

      {/* Floating Bottom-Right "Show map" / "Show list" Pill */}
      {!isInitialLoading && (
        <button
          type="button"
          onClick={() =>
            setViewMode((prev) => (prev === 'list' ? 'map' : 'list'))
          }
          className="fixed bottom-20 lg:bottom-8 right-4 sm:right-6 lg:right-10 z-40 inline-flex items-center gap-2 min-h-[46px] px-5 py-2.5 rounded-full bg-deep-teal text-white text-sm font-semibold shadow-lg hover:bg-deep-teal/95 active:scale-95 transition-transform motion-reduce:transition-none duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
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

function PaginationBar({
  currentPage,
  totalPages,
  totalRows,
  pageSize,
  isLoading,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalRows: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
}) {
  if (totalRows <= 0) return null
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(totalRows, currentPage * pageSize)
  const pages = buildPageNumbers(currentPage, totalPages)

  return (
    <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-neutral-gray tabular-nums">
        Showing {start} to {end} of {totalRows}{' '}
        {totalRows === 1 ? 'stay' : 'stays'}
      </p>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center gap-1.5 flex-wrap justify-center"
        >
          <button
            type="button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-full border border-border bg-white text-sm font-medium text-deep-teal hover:border-deep-teal active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {pages.map((item, idx) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-9 h-9 inline-flex items-center justify-center text-sm text-neutral-gray select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  disabled={isLoading}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                  className={cn(
                    'min-w-[40px] h-10 px-2 rounded-full text-sm font-semibold tabular-nums transition-colors active:scale-[0.97]',
                    item === currentPage
                      ? 'bg-deep-teal text-white'
                      : 'text-foreground hover:bg-off-white hover:text-deep-teal'
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-full border border-border bg-white text-sm font-medium text-deep-teal hover:border-deep-teal active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
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
    <div className="flex flex-col items-center justify-center min-h-[38vh] gap-4 text-center py-12 px-4 rounded-3xl bg-off-white/60 border border-border">
      <div className="w-16 h-16 rounded-full bg-white border border-border flex items-center justify-center">
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
