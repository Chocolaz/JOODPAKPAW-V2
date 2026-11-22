'use client'

import Image from 'next/image'
import {
  LayoutGrid,
  Waves,
  Stethoscope,
  Trees,
  Home,
  Tag,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assetPath, cn } from '@/lib/utils'
import type { BrowseParamUpdates } from '@/app/_hooks/useBrowseFilters'

type CategoryKey =
  | 'all'
  | 'dogs'
  | 'cats'
  | 'exotic'
  | 'pool'
  | 'vet'
  | 'resort'
  | 'homestay'
  | 'budget'

interface CategoryDef {
  key: CategoryKey
  label: string
  clayIcon?: string
  LucideIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: 'All stays', LucideIcon: LayoutGrid },
  {
    key: 'dogs',
    label: 'Dogs',
    clayIcon: '/icons/species/clay-dog-transparent.webp',
  },
  {
    key: 'cats',
    label: 'Cats',
    clayIcon: '/icons/species/clay-cat-transparent.webp',
  },
  {
    key: 'exotic',
    label: 'Exotic & small',
    clayIcon: '/icons/species/clay-exotic-transparent.webp',
  },
  { key: 'pool', label: 'Pool & play', LucideIcon: Waves },
  { key: 'vet', label: 'Vet care', LucideIcon: Stethoscope },
  { key: 'resort', label: 'Pet resorts', LucideIcon: Trees },
  { key: 'homestay', label: 'Homestays', LucideIcon: Home },
  { key: 'budget', label: 'Under ฿800', LucideIcon: Tag },
]

interface CategoryIconRailProps {
  petTypes: string[]
  facilities: string[]
  propertyType: string
  maxPrice: string
  sortBy: string
  showTotalPrice: boolean
  onToggleTotalPrice: (next: boolean) => void
  onUpdateParams: (updates: BrowseParamUpdates) => void
}

export function CategoryIconRail({
  petTypes,
  facilities,
  propertyType,
  maxPrice,
  sortBy,
  showTotalPrice,
  onToggleTotalPrice,
  onUpdateParams,
}: CategoryIconRailProps) {
  const activeKey: CategoryKey = (() => {
    if (facilities.includes('Swimming Pool')) return 'pool'
    if (facilities.includes('Nearby Vet')) return 'vet'
    if (propertyType === 'Pet Resort') return 'resort'
    if (propertyType === 'Pet Homestay') return 'homestay'
    if (maxPrice === '800') return 'budget'
    if (
      petTypes.length === 1 &&
      petTypes[0] === 'dog'
    ) {
      return 'dogs'
    }
    if (
      petTypes.length === 1 &&
      petTypes[0] === 'cat'
    ) {
      return 'cats'
    }
    if (
      petTypes.some((t) => ['rabbit', 'bird', 'hamster', 'reptile'].includes(t))
    ) {
      return 'exotic'
    }
    return 'all'
  })()

  const handleSelectCategory = (key: CategoryKey) => {
    const clearCategoryFields: BrowseParamUpdates = {
      petTypes: null,
      facilities: null,
      propertyType: null,
      maxPrice: null,
    }

    switch (key) {
      case 'all':
        onUpdateParams(clearCategoryFields)
        break
      case 'dogs':
        onUpdateParams({ ...clearCategoryFields, petTypes: ['dog'] })
        break
      case 'cats':
        onUpdateParams({ ...clearCategoryFields, petTypes: ['cat'] })
        break
      case 'exotic':
        onUpdateParams({
          ...clearCategoryFields,
          petTypes: ['rabbit', 'bird', 'hamster', 'reptile'],
        })
        break
      case 'pool':
        onUpdateParams({
          ...clearCategoryFields,
          facilities: ['Swimming Pool', 'Outdoor Play Area'],
        })
        break
      case 'vet':
        onUpdateParams({
          ...clearCategoryFields,
          facilities: ['Nearby Vet'],
        })
        break
      case 'resort':
        onUpdateParams({
          ...clearCategoryFields,
          propertyType: 'Pet Resort',
        })
        break
      case 'homestay':
        onUpdateParams({
          ...clearCategoryFields,
          propertyType: 'Pet Homestay',
        })
        break
      case 'budget':
        onUpdateParams({
          ...clearCategoryFields,
          maxPrice: '800',
        })
        break
    }
  }

  return (
    <div className="sticky top-0 lg:top-16 xl:top-[72px] z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        {/* Scrollable Category Strip */}
        <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-hide pt-2.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeKey === cat.key
            const IconComp = cat.LucideIcon
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleSelectCategory(cat.key)}
                className={cn(
                  'group flex flex-col items-center gap-1.5 pb-2.5 border-b-2 shrink-0 min-h-[44px] transition-colors duration-150',
                  isActive
                    ? 'border-deep-teal text-deep-teal'
                    : 'border-transparent text-neutral-gray hover:text-deep-teal hover:border-gray-200'
                )}
              >
                {cat.clayIcon ? (
                  <span className="relative w-7 h-7 block">
                    <Image
                      src={assetPath(cat.clayIcon)}
                      alt={cat.label}
                      fill
                      className="object-contain"
                    />
                  </span>
                ) : IconComp ? (
                  <span className="w-7 h-7 flex items-center justify-center">
                    <IconComp
                      className={cn(
                        'w-5 h-5 transition-colors',
                        isActive
                          ? 'text-deep-teal'
                          : 'text-neutral-gray group-hover:text-deep-teal'
                      )}
                      strokeWidth={1.75}
                    />
                  </span>
                ) : null}
                <span className="text-xs font-medium whitespace-nowrap">
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right Controls: Display Total Price Toggle + Sort */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 pb-2.5 md:pb-0 shrink-0">
          {/* Display Total Price Toggle (Airbnb Default: ON) */}
          <button
            type="button"
            role="switch"
            aria-checked={showTotalPrice}
            onClick={() => onToggleTotalPrice(!showTotalPrice)}
            className="flex items-center gap-2.5 min-h-[40px] px-3.5 py-1.5 rounded-full border border-gray-200 hover:border-deep-teal/60 bg-white text-xs font-medium text-foreground transition-colors"
          >
            <span className="whitespace-nowrap">Display total price</span>
            <span
              aria-hidden="true"
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
                showTotalPrice ? 'bg-deep-teal' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform motion-reduce:transition-none duration-150',
                  showTotalPrice ? 'translate-x-[18px]' : 'translate-x-[3px]'
                )}
              />
            </span>
          </button>

          {/* Sort Dropdown */}
          <Select
            value={sortBy || 'recommended'}
            onValueChange={(value) =>
              onUpdateParams({
                sortBy: value === 'recommended' ? null : value,
              })
            }
          >
            <SelectTrigger
              aria-label="Sort stays"
              className="h-10 min-w-[148px] rounded-full border-gray-200 bg-white text-xs font-medium text-foreground"
            >
              <SelectValue placeholder="Recommended" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="price_asc">Lowest price</SelectItem>
              <SelectItem value="rating">Highest rated</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
