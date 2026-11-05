'use client'

import { Input } from '@/components/ui/input'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  value: string
  onFilterClick?: () => void
  activeFilterCount?: number
}

export function SearchBar({ onSearch, value, onFilterClick, activeFilterCount = 0 }: SearchBarProps) {
  const [internalSearchValue, setInternalSearchValue] = useState(value)

  useEffect(() => {
    setInternalSearchValue(value)
  }, [value])

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    onSearch(internalSearchValue.trim())
  }

  const handleClear = () => {
    setInternalSearchValue('')
    onSearch('')
  }

  return (
    <div className="sticky top-4 z-40 lg:static lg:top-auto lg:z-auto w-full lg:py-2">
      <form onSubmit={handleSearch} className="flex items-center gap-2 lg:max-w-xl">
        {/* Search input container */}
        <div className="flex-1 bg-white/95 lg:bg-white rounded-full backdrop-blur shadow-sm lg:shadow-md lg:border lg:border-gray-100 pr-1.5 focus-within:ring-2 focus-within:ring-deep-teal/20 transition-all">
          <div className="relative flex w-full h-12 md:h-14 items-center">
            {/* Search Icon button on left */}
            <button
              type="submit"
              aria-label="Submit search"
              className="absolute left-3.5 p-1 text-muted-foreground hover:text-deep-teal transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>

            <Input
              placeholder="Search properties…"
              className="pl-11 pr-20 h-full rounded-full border-0 bg-transparent focus-visible:ring-0 text-sm md:text-base"
              value={internalSearchValue}
              onChange={(e) => setInternalSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
            />

            {/* Clear button if text exists */}
            {internalSearchValue && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-12 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Clickable Search Action Button on the right */}
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 flex items-center justify-center h-9 w-9 md:h-10 md:w-10 rounded-full bg-deep-teal text-white hover:bg-deep-teal/90 transition-all shadow-sm hover:scale-105 active:scale-95"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter button */}
        {onFilterClick && (
          <button
            type="button"
            onClick={onFilterClick}
            className="relative flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-full bg-white/95 lg:bg-white shadow-sm lg:shadow-md lg:border lg:border-gray-100 backdrop-blur shrink-0 text-neutral-gray hover:text-deep-teal transition-colors"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-accent-orange rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-bold leading-none">{activeFilterCount}</span>
              </span>
            )}
          </button>
        )}
      </form>
    </div>
  )
}
