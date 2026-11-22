'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef } from 'react'
import { FilterState } from '@/app/_components/FilterPanel'

export type BrowseParamUpdates = Partial<{
  q: string | null
  province: string | null
  checkIn: string | null
  checkOut: string | null
  petTypes: string[] | null
  petSizeCategoryId: string | number | null
  petProfileIds: number[] | null
  facilities: string[] | null
  propertyType: string | null
  minRating: number | null
  minPrice: string | null
  maxPrice: string | null
  sortBy: string | null
}>

export function useBrowseFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse filter state from URL
  const searchQuery = searchParams.get('q') ?? ''
  const province = searchParams.get('province') ?? ''
  const checkIn = searchParams.get('checkIn') ?? ''
  const checkOut = searchParams.get('checkOut') ?? ''
  const petTypes = useMemo(
    () => searchParams.get('petTypes')?.split(',').filter(Boolean) ?? [],
    [searchParams]
  )
  const petSizeCategoryId = searchParams.get('petSizeCategoryId') ?? ''
  const petProfileIds = useMemo(
    () =>
      searchParams
        .get('petProfileIds')
        ?.split(',')
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0) ?? [],
    [searchParams]
  )
  const facilities = useMemo(
    () => searchParams.get('facilities')?.split(',').filter(Boolean) ?? [],
    [searchParams]
  )
  const propertyType = searchParams.get('propertyType') ?? ''
  const minRating = (() => {
    const raw = searchParams.get('minRating')
    if (!raw) return 0
    const parsed = parseFloat(raw)
    return Number.isNaN(parsed) ? 0 : parsed
  })()
  const minPrice = searchParams.get('minPrice') ?? ''
  const maxPrice = searchParams.get('maxPrice') ?? ''
  const sortBy = searchParams.get('sortBy') ?? ''

  const filters: FilterState = useMemo(
    () => ({
      petTypes,
      minRating,
      maxPrice,
      minPrice,
      facilities,
      propertyType,
    }),
    [petTypes, minRating, maxPrice, minPrice, facilities, propertyType]
  )

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [router]
  )

  // Atomic batch updater for multiple query parameters
  const setParams = useCallback(
    (updates: BrowseParamUpdates) => {
      const params = new URLSearchParams(searchParams.toString())

      const setOrDelete = (key: string, val: string | null | undefined) => {
        if (val === undefined) return
        if (!val || val.trim() === '') params.delete(key)
        else params.set(key, val.trim())
      }

      if ('q' in updates) setOrDelete('q', updates.q)
      if ('province' in updates) setOrDelete('province', updates.province)
      if ('checkIn' in updates) setOrDelete('checkIn', updates.checkIn)
      if ('checkOut' in updates) setOrDelete('checkOut', updates.checkOut)
      if ('propertyType' in updates)
        setOrDelete('propertyType', updates.propertyType)
      if ('minPrice' in updates) setOrDelete('minPrice', updates.minPrice)
      if ('maxPrice' in updates) setOrDelete('maxPrice', updates.maxPrice)
      if ('sortBy' in updates) setOrDelete('sortBy', updates.sortBy)

      if ('petSizeCategoryId' in updates) {
        const v = updates.petSizeCategoryId
        if (v === null || v === undefined || String(v).trim() === '') {
          params.delete('petSizeCategoryId')
        } else {
          params.set('petSizeCategoryId', String(v))
        }
      }

      if ('minRating' in updates) {
        const n = updates.minRating
        if (!n || n <= 0) params.delete('minRating')
        else params.set('minRating', String(n))
      }

      if ('petTypes' in updates) {
        const arr = updates.petTypes
        if (!arr || arr.length === 0) params.delete('petTypes')
        else params.set('petTypes', arr.join(','))
      }

      if ('petProfileIds' in updates) {
        const arr = updates.petProfileIds
        if (!arr || arr.length === 0) params.delete('petProfileIds')
        else params.set('petProfileIds', arr.join(','))
      }

      if ('facilities' in updates) {
        const arr = updates.facilities
        if (!arr || arr.length === 0) params.delete('facilities')
        else params.set('facilities', arr.join(','))
      }

      navigateWithParams(params)
    },
    [searchParams, navigateWithParams]
  )

  // Write a single filter key back to URL
  const setFilter = useCallback(
    (key: keyof FilterState, value: string | string[] | number) => {
      if (key === 'petTypes') {
        setParams({ petTypes: value as string[] })
      } else if (key === 'minRating') {
        setParams({ minRating: value as number })
      } else if (key === 'maxPrice') {
        setParams({ maxPrice: value as string })
      } else if (key === 'minPrice') {
        setParams({ minPrice: value as string })
      } else if (key === 'facilities') {
        setParams({ facilities: value as string[] })
      } else if (key === 'propertyType') {
        setParams({ propertyType: value as string })
      }
    },
    [setParams]
  )

  // Apply a full FilterState at once (used by FilterPanel onApply adapter)
  const applyFilters = useCallback(
    (fs: FilterState) => {
      setParams({
        petTypes: fs.petTypes,
        minRating: fs.minRating,
        maxPrice: fs.maxPrice,
        minPrice: fs.minPrice ?? '',
        facilities: fs.facilities ?? [],
        propertyType: fs.propertyType ?? '',
      })
    },
    [setParams]
  )

  const setSearchQuery = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setParams({ q: q.trim() || null })
    },
    [setParams]
  )

  const resetAllFilters = useCallback(() => {
    router.replace('?', { scroll: false })
  }, [router])

  // Build a URL for "see all" links — appends current params to a base path
  const buildSeeAllUrl = useCallback(
    (base: string): string => {
      const qs = searchParams.toString()
      return qs ? `${base}?${qs}` : base
    },
    [searchParams]
  )

  // Count active modal/pill filters (for badge display)
  const activeFilterCount =
    (petTypes.length > 0 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (maxPrice !== '' ? 1 : 0) +
    (minPrice !== '' ? 1 : 0) +
    (facilities.length > 0 ? 1 : 0) +
    (propertyType !== '' ? 1 : 0)

  const hasActiveSearchOrFilters =
    Boolean(searchQuery) ||
    Boolean(province) ||
    Boolean(checkIn && checkOut) ||
    petTypes.length > 0 ||
    Boolean(petSizeCategoryId) ||
    petProfileIds.length > 0 ||
    facilities.length > 0 ||
    Boolean(propertyType) ||
    minRating > 0 ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    Boolean(sortBy)

  return {
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
    filters,
    activeFilterCount,
    hasActiveSearchOrFilters,
    setFilter,
    setParams,
    applyFilters,
    setSearchQuery,
    resetAllFilters,
    buildSeeAllUrl,
  }
}
