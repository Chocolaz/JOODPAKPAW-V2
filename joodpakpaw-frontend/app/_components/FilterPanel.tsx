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
}

export const defaultFilters: FilterState = {
  petTypes: [],
  minRating: 0,
  maxPrice: '',
}

interface FilterPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterState
  onApply: (filters: FilterState) => void
}

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '3★+', value: 3 },
  { label: '4★+', value: 4 },
  { label: '4.5★+', value: 4.5 },
]

const PET_TYPES = ['dog', 'cat']

const PRICE_CHIPS = [
  { label: '฿500', value: 500 },
  { label: '฿1,000', value: 1000 },
  { label: '฿2,000', value: 2000 },
  { label: '฿3,500', value: 3500 },
]

export function FilterPanel({ isOpen, onOpenChange, filters, onApply }: FilterPanelProps) {
  const sliderValue = filters.maxPrice === '' ? MAX_PRICE : Math.min(Number(filters.maxPrice), MAX_PRICE)
  const isAnyPrice = sliderValue >= MAX_PRICE

  const togglePet = (pet: string) => {
    const newPetTypes = filters.petTypes.includes(pet)
      ? filters.petTypes.filter((p) => p !== pet)
      : [...filters.petTypes, pet]
    onApply({ ...filters, petTypes: newPetTypes })
  }

  const handleRating = (value: number) => {
    onApply({ ...filters, minRating: value })
  }

  const handleMaxPrice = (value: string) => {
    onApply({ ...filters, maxPrice: value })
  }

  const handleReset = () => {
    onApply(defaultFilters)
  }

  const hasActiveFilters =
    filters.petTypes.length > 0 || filters.minRating > 0 || filters.maxPrice !== ''

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-deep-teal">Filters</DialogTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-neutral-gray hover:text-deep-teal h-auto py-1 px-2"
              >
                Reset all
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Pet type */}
          <div>
            <p className="text-sm font-semibold text-deep-teal mb-3">Pet type</p>
            <div className="flex gap-2">
              {PET_TYPES.map((pet) => (
                <button
                  key={pet}
                  type="button"
                  onClick={() => togglePet(pet)}
                  className={cn(
                    'px-4 py-2 rounded-full border text-sm font-medium capitalize transition-colors',
                    filters.petTypes.includes(pet)
                      ? 'bg-accent-orange text-white border-accent-orange'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {pet}
                </button>
              ))}
            </div>
          </div>

          {/* Min rating */}
          <div>
            <p className="text-sm font-semibold text-deep-teal mb-3">Minimum rating</p>
            <div className="flex gap-2 flex-wrap">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRating(opt.value)}
                  className={cn(
                    'px-3 py-2 rounded-full border text-sm font-medium transition-colors',
                    filters.minRating === opt.value
                      ? 'bg-accent-orange text-white border-accent-orange'
                      : 'border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max price */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-deep-teal">Max price per night</p>
              <span className={cn(
                'text-sm font-semibold transition-colors',
                isAnyPrice ? 'text-neutral-gray' : 'text-accent-orange'
              )}>
                {isAnyPrice ? 'Any price' : `฿${sliderValue.toLocaleString()}`}
              </span>
            </div>
            <Slider
              min={0}
              max={MAX_PRICE}
              step={PRICE_STEP}
              value={[sliderValue]}
              onValueChange={([v]) => handleMaxPrice(v >= MAX_PRICE ? '' : String(v))}
            />
            <div className="flex justify-between mt-2 text-xs text-neutral-gray">
              <span>฿0</span>
              <span>฿5,000+</span>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              {PRICE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => handleMaxPrice(sliderValue === chip.value ? '' : String(chip.value))}
                  className={cn(
                    'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
