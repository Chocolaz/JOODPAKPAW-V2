# Browse Mode Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the home page browse mode into a Next.js route group with URL-based filter state, dedicated "see all" pages, mobile scroll peek, and a login CTA for the Recommended slot.

**Architecture:** A `(browse)` route group shares a `BrowseLayoutClient` (search bar + filter chips) across home and three "see all" pages via a server-component layout. All filter state lives in URL search params via a `useBrowseFilters` hook, making filters persistent across navigation.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/_hooks/useBrowseFilters.ts` | Read/write URL filter params, debounce search, buildSeeAllUrl |
| Create | `app/(browse)/layout.tsx` | Server component — wraps BrowseLayoutClient in Suspense |
| Create | `app/(browse)/_components/BrowseLayoutClient.tsx` | Client — search bar, chips, FilterPanel adapter |
| Create | `app/(browse)/_components/BrowseSection.tsx` | PropertySection with Link-based seeAllHref, mobile peek |
| Create | `app/(browse)/_components/RecommendedCTA.tsx` | Login prompt card for logged-out users |
| Create | `app/(browse)/page.tsx` | Home — 3 sections (Recommended/CTA, Top Rated, New Listings) |
| Create | `app/(browse)/top-rated/page.tsx` | Full Top Rated grid |
| Create | `app/(browse)/new-listings/page.tsx` | Full New Listings grid |
| Create | `app/(browse)/recommended/page.tsx` | Full Recommended grid |
| Delete | `app/page.tsx` | Replaced by `app/(browse)/page.tsx` |
| Modify | `app/_components/DesktopNav.tsx:19` | Add `/top-rated`, `/new-listings`, `/recommended` to VISIBLE_PATHS |

---

## Chunk 1: Foundation — Hook + BrowseSection + RecommendedCTA

### Task 1: `useBrowseFilters` hook

**Files:**
- Create: `app/_hooks/useBrowseFilters.ts`

- [ ] **Step 1: Create the hook**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add app/_hooks/useBrowseFilters.ts
git commit -m "feat: add useBrowseFilters hook for URL-based filter state"
```

---

### Task 2: `BrowseSection` component

**Files:**
- Create: `app/(browse)/_components/BrowseSection.tsx`

- [ ] **Step 1: Create the directory and component**

```tsx
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { Property } from '@/types'

const SECTION_LIMIT = 10

interface BrowseSectionProps {
  title: string
  icon?: React.ReactNode
  properties: Property[]
  totalCount?: number
  showHeartIcon?: boolean
  showPetPolicyChip?: boolean
  seeAllHref?: string
}

export function BrowseSection({
  title,
  icon,
  properties,
  totalCount,
  showHeartIcon,
  showPetPolicyChip,
  seeAllHref,
}: BrowseSectionProps) {
  if (properties.length === 0) return null
  const count = totalCount ?? properties.length
  const showSeeAll = seeAllHref && count > SECTION_LIMIT

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-10 lg:mb-0 lg:py-10 lg:border-b lg:border-gray-100"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          {icon}
          <h5 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-deep-teal">{title}</h5>
          <span className="text-sm lg:text-base xl:text-lg text-neutral-gray">({count})</span>
        </div>
        {showSeeAll && (
          <Link
            href={seeAllHref}
            className="text-sm font-medium text-accent-orange hover:underline shrink-0"
          >
            See all
          </Link>
        )}
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      {/* pr-10 on mobile clips the last card slightly — signals more content off-screen */}
      {/* Note: properties prop is the full array; BrowseSection slices at SECTION_LIMIT internally */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 pr-10 snap-x snap-mandatory lg:mx-0 lg:px-0 lg:pr-0 lg:overflow-x-visible lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
        {properties.slice(0, SECTION_LIMIT).map((property) => (
          <div key={property.id} className="w-44 shrink-0 snap-start lg:w-auto lg:shrink">
            <PropertyCard
              property={property}
              showPetPolicyChip={showPetPolicyChip}
              showHeartIcon={showHeartIcon}
            />
          </div>
        ))}
      </div>
    </motion.section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(browse)/_components/BrowseSection.tsx"
git commit -m "feat: add BrowseSection with mobile peek and Link-based see all"
```

---

### Task 3: `RecommendedCTA` component

**Files:**
- Create: `app/(browse)/_components/RecommendedCTA.tsx`

The CTA triggers the existing auth modal by emitting an `AuthRequiredError` via `authErrorEmitter`. Note: `AuthModalProvider` has no exported context/hook — `authErrorEmitter` is the only mechanism to open the modal programmatically. This is intentional.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Heart } from 'lucide-react'
import { authErrorEmitter, AuthRequiredError } from '@/lib/authErrors'

export function RecommendedCTA() {
  const handleLogin = () => {
    authErrorEmitter.emit(new AuthRequiredError('no_token'))
  }

  return (
    <div className="mb-10 lg:mb-0 lg:py-10 lg:border-b lg:border-gray-100">
      <div className="flex items-center gap-2 mb-4 lg:mb-6">
        <Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />
        <h5 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-deep-teal">
          Recommended for You
        </h5>
      </div>

      {/* CTA card — w-44 matches property card width in mobile scroll row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 lg:mx-0 lg:px-0 lg:overflow-x-visible">
        <div className="w-44 shrink-0 lg:w-64">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full h-full min-h-[200px] rounded-[20px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 p-4 text-center hover:border-deep-teal transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center group-hover:bg-accent-orange/20 transition-colors">
              <Heart className="w-6 h-6 text-accent-orange" />
            </div>
            <p className="text-sm text-neutral-gray leading-snug">
              Log in to see picks for you
            </p>
            <span className="text-sm font-semibold text-white bg-deep-teal rounded-full px-4 py-1.5">
              Log in
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(browse)/_components/RecommendedCTA.tsx"
git commit -m "feat: add RecommendedCTA card for logged-out users in Recommended slot"
```

---

## Chunk 2: Browse Layout + DesktopNav

### Task 4: `(browse)/layout.tsx` and `BrowseLayoutClient`

**Files:**
- Create: `app/(browse)/layout.tsx`
- Create: `app/(browse)/_components/BrowseLayoutClient.tsx`

- [ ] **Step 1: Create `BrowseLayoutClient`**

```tsx
'use client'

import { useState } from 'react'
import { SearchBar } from '@/app/_components/SearchBar'
import { FilterPanel } from '@/app/_components/FilterPanel'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { Dog, Cat, Star, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'

const QUICK_PET_CHIPS = [
  { label: 'Dog', value: 'dog', Icon: Dog },
  { label: 'Cat', value: 'cat', Icon: Cat },
]
const QUICK_RATING_CHIPS = [
  { label: '4★+', value: 4 },
  { label: '4.5★+', value: 4.5 },
]
const QUICK_PRICE_CHIPS = [
  { label: '฿500', value: 500 },
  { label: '฿1,000', value: 1000 },
  { label: '฿2,000', value: 2000 },
  { label: '฿3,500', value: 3500 },
]

const chipBase = 'flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors shadow-sm'
const chipActive = 'bg-accent-orange text-white border-accent-orange'
const chipInactive = 'bg-white border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'

interface BrowseLayoutClientProps {
  children: React.ReactNode
}

export function BrowseLayoutClient({ children }: BrowseLayoutClientProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const { searchQuery, filters, activeFilterCount, setFilter, applyFilters, setSearchQuery } = useBrowseFilters()

  return (
    <>
      {/* Hero: search bar */}
      <div className="px-5 lg:px-12 lg:border-b lg:border-gray-100 lg:bg-gradient-to-br lg:from-white lg:to-off-white/40">
        <SearchBar
          onSearch={setSearchQuery}
          value={searchQuery}
          onFilterClick={() => setIsFilterOpen(true)}
          activeFilterCount={activeFilterCount}
        />
      </div>

      <FilterPanel
        isOpen={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onApply={applyFilters}
      />

      {/* Quick filter chip strip */}
      <div className="bg-white border-b border-gray-100">
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 px-5 lg:px-12 lg:flex-wrap">
            {QUICK_PET_CHIPS.map(({ label, value, Icon }) => {
              const active = filters.petTypes.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(
                      'petTypes',
                      active
                        ? filters.petTypes.filter((p) => p !== value)
                        : [...filters.petTypes, value]
                    )
                  }
                  className={cn(chipBase, active ? chipActive : chipInactive)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              )
            })}

            <span className="shrink-0 self-center w-px h-4 bg-gray-200 mx-0.5" />

            {QUICK_RATING_CHIPS.map(({ label, value }) => {
              const active = filters.minRating === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter('minRating', active ? 0 : value)}
                  className={cn(chipBase, active ? chipActive : chipInactive)}
                >
                  <Star className="w-3.5 h-3.5" />
                  {label}
                </button>
              )
            })}

            <span className="shrink-0 self-center w-px h-4 bg-gray-200 mx-0.5" />

            {QUICK_PRICE_CHIPS.map(({ label, value }) => {
              const active = filters.maxPrice === String(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter('maxPrice', active ? '' : String(value))}
                  className={cn(chipBase, active ? chipActive : chipInactive)}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Right-edge fade for mobile scroll */}
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent pointer-events-none lg:hidden" />
        </div>
      </div>

      {/* Page content */}
      {children}
    </>
  )
}
```

- [ ] **Step 2: Create `(browse)/layout.tsx`**

```tsx
import { Suspense } from 'react'
import { BrowseLayoutClient } from './_components/BrowseLayoutClient'

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <BrowseLayoutClient>{children}</BrowseLayoutClient>
    </Suspense>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(browse)/_components/BrowseLayoutClient.tsx" "app/(browse)/layout.tsx"
git commit -m "feat: add (browse) layout with shared search bar and filter chips"
```

---

### Task 5: Update `DesktopNav` VISIBLE_PATHS

**Files:**
- Modify: `app/_components/DesktopNav.tsx:19`

- [ ] **Step 1: Add new routes to VISIBLE_PATHS**

In `app/_components/DesktopNav.tsx`, change line 19:

```ts
// Before
const VISIBLE_PATHS = ['/', '/profile', '/favorites', '/notifications', '/chat']

// After
const VISIBLE_PATHS = ['/', '/profile', '/favorites', '/notifications', '/chat', '/top-rated', '/new-listings', '/recommended']
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/DesktopNav.tsx
git commit -m "feat: add see-all browse routes to DesktopNav VISIBLE_PATHS"
```

---

## Chunk 3: Browse Pages

### Task 6: `(browse)/page.tsx` — home

**Files:**
- Create: `app/(browse)/page.tsx`

Note: This replaces `app/page.tsx`. The outer wrapper changes from `<div className="...min-h-screen flex flex-col">` to a plain `<div>` — the root `app/layout.tsx` already wraps children in `<main className="flex-1">`. Do NOT add another `<main>` tag. `PageHeader` is placed in its own hero div inside the page (below the layout's search bar + chips), which is visually correct — header text appears after the chip strip.

- [ ] **Step 1: Create the new home page**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/app/_components/PageHeader'
import { PropertyList } from '@/app/_components/PropertyList'
import { getProperties, getRecommendedProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { PropertiesResponse, Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchX, Sparkles, Star, Heart } from 'lucide-react'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowseSection } from './_components/BrowseSection'
import { RecommendedCTA } from './_components/RecommendedCTA'

const SKELETON_COUNT = 12
const RECOMMEND_LIMIT = 10
const TOP_RATED_MIN = 4.0

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [recommendedProperties, setRecommendedProperties] = useState<Property[]>([])
  const [recommendedTotal, setRecommendedTotal] = useState(0)
  const { isAuthenticated } = useAuth()
  const { searchQuery, filters, buildSeeAllUrl } = useBrowseFilters()

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setIsLoading(true)
        const response = (await getProperties(
          1,
          1000,
          searchQuery || undefined,
          searchQuery ? 'title' : undefined
        )) as PropertiesResponse
        setProperties(response.data)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProperties()
  }, [searchQuery, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setRecommendedProperties([])
      setRecommendedTotal(0)
      return
    }
    getRecommendedProperties(1, RECOMMEND_LIMIT)
      .then((res) => {
        setRecommendedProperties(res.data)
        setRecommendedTotal(res.totalRows)
      })
      .catch(() => {
        setRecommendedProperties([])
        setRecommendedTotal(0)
      })
  }, [isAuthenticated])

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (filters.petTypes.length > 0) {
        const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
        if (!filters.petTypes.some((t) => names.includes(t))) return false
      }
      if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
      if (filters.maxPrice !== '') {
        const price = getLowestPrice(p.roomCategories)
        if (price !== null && price > Number(filters.maxPrice)) return false
      }
      return true
    })
  }, [properties, filters])

  const topRated = useMemo(
    () =>
      [...filteredProperties]
        .filter((p) => p.avgRating >= TOP_RATED_MIN)
        .sort((a, b) => b.avgRating - a.avgRating),
    [filteredProperties]
  )

  const newListings = useMemo(
    () =>
      [...filteredProperties].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [filteredProperties]
  )

  return (
    <div>
      {/* Hero header */}
      <div className="px-5 lg:px-12 lg:border-b lg:border-gray-100 lg:bg-gradient-to-br lg:from-white lg:to-off-white/40">
        <PageHeader />
      </div>

      <div className="px-5 lg:px-12 mt-6 lg:mt-0 pb-28 lg:pb-16">
        {/* Search results header */}
        {searchQuery && (
          <div className="flex items-center justify-between mb-4 lg:mb-8 lg:pt-10">
            <h5 className="text-xl lg:text-3xl xl:text-4xl font-medium text-deep-teal">
              Results for &ldquo;{searchQuery}&rdquo;
            </h5>
            <AnimatePresence>
              {!isLoading && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm lg:text-lg xl:text-xl text-neutral-gray"
                >
                  {filteredProperties.length}{' '}
                  {filteredProperties.length === 1 ? 'place' : 'places'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 lg:pt-10"
            >
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
                  <div className="mt-2 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : searchQuery ? (
            /* Flat search results */
            <motion.div
              key="search-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {filteredProperties.length === 0 ? (
                <EmptyState searchQuery={searchQuery} hasFilters={false} />
              ) : (
                <PropertyList
                  properties={filteredProperties}
                  className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
                  showPetPolicyChip={true}
                  showHeartIcon={isAuthenticated}
                />
              )}
            </motion.div>
          ) : (
            /* Sectioned browse */
            <motion.div
              key="sections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:pt-2"
            >
              {/* Recommended slot — always renders (CTA for logged-out, cards for logged-in) */}
              {isAuthenticated ? (
                recommendedProperties.length > 0 && (
                  <BrowseSection
                    title="Recommended for You"
                    icon={<Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />}
                    properties={recommendedProperties}
                    totalCount={recommendedTotal}
                    showHeartIcon={true}
                    showPetPolicyChip={true}
                    seeAllHref={buildSeeAllUrl('/recommended')}
                  />
                )
              ) : (
                <RecommendedCTA />
              )}

              {filteredProperties.length === 0 ? (
                <EmptyState searchQuery="" hasFilters={filters.petTypes.length > 0 || filters.minRating > 0 || filters.maxPrice !== ''} />
              ) : (
                <>
                  <BrowseSection
                    title="Top Rated"
                    icon={<Star className="w-5 h-5 fill-yellow-400 text-yellow-500" />}
                    properties={topRated}
                    totalCount={topRated.length}
                    showHeartIcon={isAuthenticated}
                    showPetPolicyChip={true}
                    seeAllHref={buildSeeAllUrl('/top-rated')}
                  />
                  <BrowseSection
                    title="New Listings"
                    icon={<Sparkles className="w-5 h-5 text-deep-teal" />}
                    properties={newListings}
                    totalCount={newListings.length}
                    showHeartIcon={isAuthenticated}
                    showPetPolicyChip={true}
                    seeAllHref={buildSeeAllUrl('/new-listings')}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function EmptyState({ searchQuery, hasFilters }: { searchQuery: string; hasFilters: boolean }) {
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
        <p className="font-semibold text-gray-700 lg:text-xl xl:text-2xl">No properties found</p>
        <p className="text-sm lg:text-lg xl:text-xl text-neutral-gray">
          {searchQuery || hasFilters
            ? 'Try adjusting your search or filters.'
            : 'No properties available right now.'}
        </p>
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(browse)/page.tsx"
git commit -m "feat: add (browse)/page.tsx with sectioned browse and URL filter state"
```

---

### Task 7: "See all" pages

**Files:**
- Create: `app/(browse)/top-rated/page.tsx`
- Create: `app/(browse)/new-listings/page.tsx`
- Create: `app/(browse)/recommended/page.tsx`

All three pages share the same structure. Create a shared skeleton helper inline.

- [ ] **Step 1: Create `/top-rated` page**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { getProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { PropertiesResponse, Property } from '@/types'
import { PropertyList } from '@/app/_components/PropertyList'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'

const TOP_RATED_MIN = 4.0
const SKELETON_COUNT = 12

export default function TopRatedPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated } = useAuth()
  const { filters, buildSeeAllUrl } = useBrowseFilters()

  useEffect(() => {
    getProperties(1, 1000)
      .then((res) => setProperties((res as PropertiesResponse).data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = useMemo(() => {
    return properties
      .filter((p) => {
        if (filters.petTypes.length > 0) {
          const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
          if (!filters.petTypes.some((t) => names.includes(t))) return false
        }
        if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
        if (filters.maxPrice !== '') {
          const price = getLowestPrice(p.roomCategories)
          if (price !== null && price > Number(filters.maxPrice)) return false
        }
        return p.avgRating >= TOP_RATED_MIN
      })
      .sort((a, b) => b.avgRating - a.avgRating)
  }, [properties, filters])

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={buildSeeAllUrl('/')} className="text-neutral-gray hover:text-deep-teal transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 fill-yellow-400 text-yellow-500" />
          <h1 className="text-xl lg:text-3xl font-semibold text-deep-teal">Top Rated</h1>
          {!isLoading && (
            <span className="text-sm lg:text-base text-neutral-gray">({filtered.length})</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton count={SKELETON_COUNT} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <PropertyList
            properties={filtered}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
            showPetPolicyChip={true}
            showHeartIcon={isAuthenticated}
          />
        </motion.div>
      )}
    </div>
  )
}

function BrowseSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
          <div className="mt-2 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `/new-listings` page**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { getProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { PropertiesResponse, Property } from '@/types'
import { PropertyList } from '@/app/_components/PropertyList'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'

const SKELETON_COUNT = 12

export default function NewListingsPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated } = useAuth()
  const { filters, buildSeeAllUrl } = useBrowseFilters()

  useEffect(() => {
    getProperties(1, 1000)
      .then((res) => setProperties((res as PropertiesResponse).data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = useMemo(() => {
    return properties
      .filter((p) => {
        if (filters.petTypes.length > 0) {
          const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
          if (!filters.petTypes.some((t) => names.includes(t))) return false
        }
        if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
        if (filters.maxPrice !== '') {
          const price = getLowestPrice(p.roomCategories)
          if (price !== null && price > Number(filters.maxPrice)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [properties, filters])

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={buildSeeAllUrl('/')} className="text-neutral-gray hover:text-deep-teal transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-deep-teal" />
          <h1 className="text-xl lg:text-3xl font-semibold text-deep-teal">New Listings</h1>
          {!isLoading && (
            <span className="text-sm lg:text-base text-neutral-gray">({filtered.length})</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton count={SKELETON_COUNT} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <PropertyList
            properties={filtered}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
            showPetPolicyChip={true}
            showHeartIcon={isAuthenticated}
          />
        </motion.div>
      )}
    </div>
  )
}

function BrowseSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
          <div className="mt-2 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `/recommended` page**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { getRecommendedProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { Property } from '@/types'
import { PropertyList } from '@/app/_components/PropertyList'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'

const SKELETON_COUNT = 12

export default function RecommendedPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated } = useAuth()
  const { filters, buildSeeAllUrl } = useBrowseFilters()

  useEffect(() => {
    if (!isAuthenticated) {
      setProperties([])
      setIsLoading(false)
      return
    }
    getRecommendedProperties(1, 1000)
      .then((res) => setProperties(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (filters.petTypes.length > 0) {
        const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
        if (!filters.petTypes.some((t) => names.includes(t))) return false
      }
      if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
      if (filters.maxPrice !== '') {
        const price = getLowestPrice(p.roomCategories)
        if (price !== null && price > Number(filters.maxPrice)) return false
      }
      return true
    })
  }, [properties, filters])

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={buildSeeAllUrl('/')} className="text-neutral-gray hover:text-deep-teal transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />
          <h1 className="text-xl lg:text-3xl font-semibold text-deep-teal">Recommended for You</h1>
          {!isLoading && (
            <span className="text-sm lg:text-base text-neutral-gray">({filtered.length})</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton count={SKELETON_COUNT} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <PropertyList
            properties={filtered}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
            showPetPolicyChip={true}
            showHeartIcon={isAuthenticated}
          />
        </motion.div>
      )}
    </div>
  )
}

function BrowseSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
          <div className="mt-2 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(browse)/top-rated/page.tsx" "app/(browse)/new-listings/page.tsx" "app/(browse)/recommended/page.tsx"
git commit -m "feat: add top-rated, new-listings, recommended see-all pages"
```

---

## Chunk 4: Cleanup

### Task 8: Delete old `app/page.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm app/page.tsx
git commit -m "chore: remove old app/page.tsx replaced by (browse)/page.tsx"
```

---

### Task 9: Final verification

- [ ] **Step 1: Build to check for TypeScript errors**

```bash
npm run build
```

Expected: no type errors, build succeeds.

- [ ] **Step 2: Start dev server and verify manually**

```bash
npm run dev
```

Check:
- `/` loads the home page with search bar, filter chips, 3 sections
- Filter chips update URL params (`?petTypes=dog` etc.)
- "See all" on Top Rated navigates to `/top-rated` with filters preserved in URL
- Back arrow on `/top-rated` returns to `/` with filters intact
- Logged-out users see the `RecommendedCTA` card in the Recommended slot
- Desktop nav shows on `/top-rated`, `/new-listings`, `/recommended`
- Mobile: horizontal scroll shows partial clip of next card on all sections
