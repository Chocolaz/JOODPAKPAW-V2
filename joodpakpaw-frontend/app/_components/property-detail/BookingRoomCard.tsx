'use client'

import { PetProfile, RoomCategories } from '@/types'
import { getPetPolicy, assetPath, formatPetSizeRange, cn } from '@/lib/utils'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

const EXOTIC_SPECIES = new Set([
  'rabbit',
  'hamster',
  'bird',
  'reptile',
  'exotic',
])

function normalizeSpecies(raw?: string | null): string {
  const value = (raw || '').trim().toLowerCase()
  if (!value) return ''

  const parenMatch = value.match(/\(([^)]+)\)/)
  if (parenMatch?.[1]) {
    return parenMatch[1].trim().toLowerCase()
  }

  if (value.includes('dog') || value.includes('สุนัข') || value.includes('หมา'))
    return 'dog'
  if (value.includes('cat') || value.includes('แมว')) return 'cat'
  if (value.includes('rabbit') || value.includes('กระต่าย')) return 'rabbit'
  if (value.includes('hamster') || value.includes('แฮมสเตอร์')) return 'hamster'
  if (value.includes('bird') || value.includes('นก')) return 'bird'
  if (value.includes('reptile') || value.includes('เลื้อยคลาน')) return 'reptile'
  if (value.includes('exotic') || value.includes('พิเศษ')) return 'exotic'

  return value
}

export function getRoomIneligibilityReason(
  cat: RoomCategories,
  selectedPets: PetProfile[] = [],
  petSizeId?: number | null
): string | null {
  if (!cat.isAvailable) {
    if (cat.isBooked || cat.availability.availableRooms === 0) {
      return 'Sold out for selected dates'
    }
    if (cat.isCapacityInsufficient) {
      return 'Not enough room capacity for your selected pets'
    }
    return 'Unavailable for selected dates'
  }

  for (const pet of selectedPets) {
    const petSpecies = normalizeSpecies(pet.petTypeName)
    const speciesMatch =
      petSpecies.length > 0 &&
      (cat.pets || []).some((rp) => {
        const roomSpecies = normalizeSpecies(rp.name)
        if (roomSpecies === petSpecies) return true
        return EXOTIC_SPECIES.has(petSpecies) && EXOTIC_SPECIES.has(roomSpecies)
      })

    if (!speciesMatch) {
      const accepted =
        cat.pets && cat.pets.length > 0
          ? cat.pets.map((p) => p.name).join(', ')
          : 'no pet types configured'
      return `Does not accept ${pet.name} (${pet.petTypeName || 'Unknown type'}), accepts ${accepted}`
    }

    const maxSizeId = cat.petSizeCategory?.id
    if (
      maxSizeId &&
      pet.petSizeCategoryId &&
      pet.petSizeCategoryId > maxSizeId
    ) {
      return `${pet.name} exceeds room max size (${cat.petSizeCategory?.name})`
    }
  }

  if (
    selectedPets.length === 0 &&
    petSizeId &&
    cat.petSizeCategory?.id &&
    petSizeId > cat.petSizeCategory.id
  ) {
    return `Selected pet size exceeds room limit (${cat.petSizeCategory.name})`
  }

  return null
}

interface BookingRoomCardProps {
  categories: RoomCategories[]
  selectedRooms: Record<number, number>
  onSelectChange: (categoryId: number, value: number) => void
  selectedPets?: PetProfile[]
  petSizeId?: number | null
  isSummary?: boolean
}

export function BookingRoomCard({
  categories,
  selectedRooms,
  onSelectChange,
  selectedPets = [],
  petSizeId = null,
  isSummary = false,
}: BookingRoomCardProps) {
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Image
          src={assetPath('/graphics/search-room.png')}
          alt="Search Rooms"
          width={180}
          height={180}
        />
        <p className="text-sm text-neutral-gray mt-2">
          Select dates &amp; pets to see available rooms
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const totalNights = cat.availability.dates.length
        const averagePricePerNight =
          totalNights > 0
            ? Math.round(cat.availability.totalPrice / totalNights)
            : 0
        const ineligibilityReason = isSummary
          ? null
          : getRoomIneligibilityReason(cat, selectedPets, petSizeId)
        const isRoomDisabled = Boolean(ineligibilityReason)
        const count = selectedRooms[cat.id] ?? 0

        return (
          <div
            key={cat.id}
            className={cn(
              'border rounded-2xl p-4 transition-colors',
              isRoomDisabled
                ? 'border-border bg-off-white/70 opacity-80'
                : count > 0
                  ? 'border-deep-teal bg-white ring-1 ring-deep-teal/15'
                  : 'border-border bg-white'
            )}
          >
            <div className="flex gap-3">
              {/* Left: Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <h4 className="capitalize font-semibold text-foreground truncate">
                  {cat.name}
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-gray">
                  {getPetPolicy(cat.pets) && (
                    <span className="bg-deep-teal/10 text-deep-teal rounded-full px-2 py-0.5 text-xs font-semibold">
                      {getPetPolicy(cat.pets)}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {cat.numberOfPets} pets max
                  </span>
                  {cat.petSizeCategory && (
                    <span className="capitalize">
                      {cat.petSizeCategory.name}
                      {!cat.petSizeCategory.name.includes('(') &&
                        ` (${formatPetSizeRange(
                          cat.petSizeCategory.min,
                          cat.petSizeCategory.max
                        )})`}
                    </span>
                  )}
                </div>

                {(cat.facilities || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cat.facilities?.map((facility) => (
                      <span
                        key={facility.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-off-white text-neutral-gray border border-border"
                      >
                        {facility.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Price & Select */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-base font-bold text-foreground tabular-nums">
                    ฿{cat.availability.totalPrice.toLocaleString()}
                  </div>
                  {totalNights > 0 && (
                    <p className="text-xs text-neutral-gray tabular-nums">
                      ฿{averagePricePerNight.toLocaleString()} / night
                    </p>
                  )}
                </div>

                {isSummary ? (
                  <div className="text-center">
                    <span className="text-base font-semibold text-foreground tabular-nums">
                      {selectedRooms[cat.id]}
                    </span>
                    <p className="text-xs text-neutral-gray">rooms</p>
                  </div>
                ) : (
                  <>
                    <Select
                      disabled={isRoomDisabled}
                      value={isRoomDisabled ? '0' : String(count)}
                      onValueChange={(v) => onSelectChange(cat.id, Number(v))}
                    >
                      <SelectTrigger className="w-20 h-10 text-sm font-medium hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed tabular-nums">
                        <SelectValue>{isRoomDisabled ? 0 : count}</SelectValue>
                      </SelectTrigger>

                      <SelectContent>
                        {Array.from(
                          { length: cat.availability.availableRooms + 1 },
                          (_, i) => {
                            const num = i
                            const roomsNeeded = cat.availability.roomsNeeded
                            const isDisabled =
                              roomsNeeded > 0
                                ? num > 0 && num < roomsNeeded
                                : false
                            return (
                              <SelectItem
                                key={num}
                                value={String(num)}
                                disabled={isDisabled}
                              >
                                {num}
                              </SelectItem>
                            )
                          }
                        )}
                      </SelectContent>
                    </Select>

                    {!isRoomDisabled && count > 0 ? (
                      <span className="text-xs font-semibold text-deep-teal tabular-nums">
                        ฿{(cat.availability.totalPrice * count).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-gray tabular-nums">
                        {cat.availability.availableRooms} available
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {ineligibilityReason && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{ineligibilityReason}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
