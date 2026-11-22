'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const MAX_PRICE = 5000
const PRICE_STEP = 100

export interface FilterState {
  petTypes: string[]
  minRating: number
  maxPrice: string
  minPrice?: string
  facilities?: string[]
  propertyType?: string
}

export const defaultFilters: FilterState = {
  petTypes: [],
  minRating: 0,
  maxPrice: '',
  minPrice: '',
  facilities: [],
  propertyType: '',
}

interface FilterPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterState
  onApply: (filters: FilterState) => void
}

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '3+ stars', value: 3 },
  { label: '4+ stars', value: 4 },
  { label: '4.5+ stars', value: 4.5 },
]

const PET_TYPES = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
  { label: 'Rabbit', value: 'rabbit' },
  { label: 'Bird', value: 'bird' },
  { label: 'Hamster', value: 'hamster' },
  { label: 'Reptile', value: 'reptile' },
]

const FACILITY_OPTIONS = [
  'Swimming Pool',
  'Outdoor Play Area',
  'Nearby Vet',
  'Separated Zones',
  'CCTV Monitoring',
  'Air Conditioning',
]

const PROPERTY_TYPE_OPTIONS = [
  { label: 'Any type', value: '' },
  { label: 'Pet Hotel', value: 'Pet Hotel' },
  { label: 'Pet Homestay', value: 'Pet Homestay' },
  { label: 'Pet Resort', value: 'Pet Resort' },
  { label: 'Pet Condo', value: 'Pet Condo' },
]

const PRICE_CHIPS = [
  { label: 'Under ฿500', value: 500 },
  { label: 'Under ฿800', value: 800 },
  { label: 'Under ฿1,500', value: 1500 },
  { label: 'Under ฿3,000', value: 3000 },
]

export function FilterPanel({
  isOpen,
  onOpenChange,
  filters,
  onApply,
}: FilterPanelProps) {
  const sliderValue =
    filters.maxPrice === ''
      ? MAX_PRICE
      : Math.min(Number(filters.maxPrice), MAX_PRICE)
  const isAnyPrice = sliderValue >= MAX_PRICE
  const selectedFacilities = filters.facilities ?? []
  const selectedPropertyType = filters.propertyType ?? ''

  const togglePet = (pet: string) => {
    const newPetTypes = filters.petTypes.includes(pet)
      ? filters.petTypes.filter((p) => p !== pet)
      : [...filters.petTypes, pet]
    onApply({ ...filters, petTypes: newPetTypes })
  }

  const toggleFacility = (facility: string) => {
    const next = selectedFacilities.includes(facility)
      ? selectedFacilities.filter((f) => f !== facility)
      : [...selectedFacilities, facility]
    onApply({ ...filters, facilities: next })
  }

  const handleRating = (value: number) => {
    onApply({ ...filters, minRating: value })
  }

  const handleMaxPrice = (value: string) => {
    onApply({ ...filters, maxPrice: value })
  }

  const handleMinPrice = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '')
    onApply({ ...filters, minPrice: cleaned })
  }

  const handlePropertyType = (value: string) => {
    onApply({ ...filters, propertyType: value })
  }

  const handleReset = () => {
    onApply(defaultFilters)
  }

  const hasActiveFilters =
    filters.petTypes.length > 0 ||
    filters.minRating > 0 ||
    filters.maxPrice !== '' ||
    Boolean(filters.minPrice) ||
    selectedFacilities.length > 0 ||
    Boolean(selectedPropertyType)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-0 gap-0">
        <DialogHeader className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-deep-teal text-lg font-bold">
              Filters
            </DialogTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-neutral-gray hover:text-deep-teal h-auto py-1.5 px-2.5"
              >
                Clear all
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          {/* Pet type */}
          <div>
            <p className="text-sm font-semibold text-deep-teal mb-3">
              Pet species
            </p>
            <div className="flex gap-2 flex-wrap">
              {PET_TYPES.map((pet) => (
                <button
                  key={pet.value}
                  type="button"
                  onClick={() => togglePet(pet.value)}
                  className={cn(
                    'min-h-[40px] px-4 py-2 rounded-full border text-sm font-medium transition-colors',
                    filters.petTypes.includes(pet.value)
                      ? 'bg-deep-teal text-white border-deep-teal'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {pet.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property type */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-deep-teal mb-3">
              Stay style
            </p>
            <div className="flex gap-2 flex-wrap">
              {PROPERTY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handlePropertyType(opt.value)}
                  className={cn(
                    'min-h-[40px] px-4 py-2 rounded-full border text-sm font-medium transition-colors',
                    selectedPropertyType === opt.value
                      ? 'bg-deep-teal text-white border-deep-teal'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-deep-teal">
                Price range per night
              </p>
              <span
                className={cn(
                  'text-sm font-semibold transition-colors tabular-nums',
                  isAnyPrice && !filters.minPrice
                    ? 'text-neutral-gray'
                    : 'text-accent-orange'
                )}
              >
                {filters.minPrice ? `฿${Number(filters.minPrice).toLocaleString()}` : '฿0'}
                {' – '}
                {isAnyPrice ? '฿5,000+' : `฿${sliderValue.toLocaleString()}`}
              </span>
            </div>
            <Slider
              min={0}
              max={MAX_PRICE}
              step={PRICE_STEP}
              value={[sliderValue]}
              onValueChange={([v]) =>
                handleMaxPrice(v >= MAX_PRICE ? '' : String(v))
              }
            />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <label className="flex flex-col gap-1 text-xs text-neutral-gray">
                <span>Minimum (THB)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={filters.minPrice ?? ''}
                  onChange={(e) => handleMinPrice(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-gray-200 px-3 text-sm text-foreground tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-gray">
                <span>Maximum (THB)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Any"
                  value={filters.maxPrice}
                  onChange={(e) =>
                    handleMaxPrice(e.target.value.replace(/[^0-9]/g, ''))
                  }
                  className="min-h-[40px] rounded-xl border border-gray-200 px-3 text-sm text-foreground tabular-nums"
                />
              </label>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              {PRICE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() =>
                    handleMaxPrice(
                      sliderValue === chip.value ? '' : String(chip.value)
                    )
                  }
                  className={cn(
                    'min-h-[36px] px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    sliderValue === chip.value
                      ? 'bg-accent-orange text-white border-accent-orange'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Facilities */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-deep-teal mb-3">
              Care facilities
            </p>
            <div className="flex gap-2 flex-wrap">
              {FACILITY_OPTIONS.map((facility) => {
                const active = selectedFacilities.includes(facility)
                return (
                  <button
                    key={facility}
                    type="button"
                    onClick={() => toggleFacility(facility)}
                    className={cn(
                      'min-h-[40px] px-3.5 py-2 rounded-full border text-sm font-medium transition-colors',
                      active
                        ? 'bg-deep-teal text-white border-deep-teal'
                        : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                    )}
                  >
                    {facility}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Min rating */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-deep-teal mb-3">
              Minimum rating
            </p>
            <div className="flex gap-2 flex-wrap">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRating(opt.value)}
                  className={cn(
                    'min-h-[40px] px-3.5 py-2 rounded-full border text-sm font-medium transition-colors',
                    filters.minRating === opt.value
                      ? 'bg-deep-teal text-white border-deep-teal'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="text-sm text-neutral-gray hover:text-deep-teal"
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-6 rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold"
          >
            Show stays
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
