import { Input } from '@/components/ui/input'
import { Search, SlidersHorizontal } from 'lucide-react'
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

  return (
    <div className="sticky top-4 z-40 lg:static lg:top-auto lg:z-auto w-full lg:py-2">
      <div className="flex items-center gap-2 lg:max-w-xl">
        {/* Search input */}
        <div className="flex-1 bg-white/95 lg:bg-white rounded-full backdrop-blur shadow-sm lg:shadow-md lg:border lg:border-gray-100">
          <div className="relative flex w-full h-12 md:h-14 items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search properties…"
              className="pl-11 pr-4 h-full rounded-full border-0 bg-transparent focus-visible:ring-0 text-sm md:text-base"
              value={internalSearchValue}
              onChange={(e) => {
                setInternalSearchValue(e.target.value)
                onSearch(e.target.value)
              }}
            />
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
      </div>
    </div>
  )
}
