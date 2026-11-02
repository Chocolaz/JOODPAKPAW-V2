'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { SearchBar } from '@/app/_components/SearchBar'
import { FilterPanel } from '@/app/_components/FilterPanel'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { Dog, Cat, Star, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrowseHero } from './BrowseHero'

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

const chipBase =
  'flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors shadow-sm'
const chipActive = 'bg-accent-orange text-white border-accent-orange'
const chipInactive =
  'bg-white border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'

interface BrowseLayoutClientProps {
  children: React.ReactNode
}

export function BrowseLayoutClient({ children }: BrowseLayoutClientProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const {
    searchQuery,
    filters,
    activeFilterCount,
    setFilter,
    applyFilters,
    setSearchQuery,
  } = useBrowseFilters()
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  const SEE_ALL_PATHS = ['/top-rated', '/new-listings', '/recommended', '/best-value', '/near-you', '/dog-friendly', '/cat-friendly', '/recently-viewed']
  const isSeeAllPage = SEE_ALL_PATHS.includes(pathname)

  return (
    <>
      {/* Hero section */}
      <div className="px-5 pt-3 lg:px-12 lg:border-b lg:border-gray-100">
        {/* Mobile: search bar + hero on see-all pages */}
        <div className="lg:hidden">
          <SearchBar
            onSearch={setSearchQuery}
            value={searchQuery}
            onFilterClick={() => setIsFilterOpen(true)}
            activeFilterCount={activeFilterCount}
          />
          {isSeeAllPage && <BrowseHero layout="column" />}
        </div>

        {/* Desktop: unified hero with heading + search bar + graphic */}
        <div className="hidden lg:block">
          <BrowseHero
            layout="row"
            searchBar={
              <SearchBar
                onSearch={setSearchQuery}
                value={searchQuery}
                onFilterClick={() => setIsFilterOpen(true)}
                activeFilterCount={activeFilterCount}
              />
            }
          />
        </div>
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
                  onClick={() =>
                    setFilter('maxPrice', active ? '' : String(value))
                  }
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

      {/* Page content with route transition */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </>
  )
}
