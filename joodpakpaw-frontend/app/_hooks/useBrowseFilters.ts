'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { FilterState } from '@/app/_components/FilterPanel'

export function useBrowseFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse filter state from URL
  const searchQuery = searchParams.get('q') ?? ''
  const petTypes = searchParams.get('petTypes')?.split(',').filter(Boolean) ?? []
  const minRating = (() => {
    const raw = searchParams.get('minRating')
    if (!raw) return 0
    const parsed = parseFloat(raw)
    return isNaN(parsed) ? 0 : parsed
  })()
  const maxPrice = searchParams.get('maxPrice') ?? ''

  const filters: FilterState = { petTypes, minRating, maxPrice }

  // Write a single filter key back to URL
  const setFilter = useCallback(
    (key: keyof FilterState, value: string | string[] | number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (key === 'petTypes') {
        const arr = value as string[]
        if (arr.length === 0) params.delete('petTypes')
        else params.set('petTypes', arr.join(','))
      } else if (key === 'minRating') {
        const n = value as number
        if (n === 0) params.delete('minRating')
        else params.set('minRating', String(n))
      } else if (key === 'maxPrice') {
        const s = value as string
        if (s === '') params.delete('maxPrice')
        else params.set('maxPrice', s)
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  // Apply a full FilterState at once (used by FilterPanel onApply adapter)
  const applyFilters = useCallback(
    (fs: FilterState) => {
      const params = new URLSearchParams(searchParams.toString())
      if (fs.petTypes.length === 0) params.delete('petTypes')
      else params.set('petTypes', fs.petTypes.join(','))
      if (fs.minRating === 0) params.delete('minRating')
      else params.set('minRating', String(fs.minRating))
      if (fs.maxPrice === '') params.delete('maxPrice')
      else params.set('maxPrice', fs.maxPrice)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  // Debounced search query writer (300ms)
  const setSearchQuery = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (q === '') params.delete('q')
        else params.set('q', q)
        router.replace(`?${params.toString()}`, { scroll: false })
      }, 300)
    },
    [searchParams, router]
  )

  // Build a URL for "see all" links — appends current params to a base path
  const buildSeeAllUrl = useCallback(
    (base: string): string => {
      const qs = searchParams.toString()
      return qs ? `${base}?${qs}` : base
    },
    [searchParams]
  )

  // Count active filters (for badge display)
  const activeFilterCount =
    (petTypes.length > 0 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (maxPrice !== '' ? 1 : 0)

  return {
    searchQuery,
    filters,
    activeFilterCount,
    setFilter,
    applyFilters,
    setSearchQuery,
    buildSeeAllUrl,
  }
}
