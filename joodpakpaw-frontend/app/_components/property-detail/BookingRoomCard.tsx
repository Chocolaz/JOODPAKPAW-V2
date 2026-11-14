'use client'

import { RoomCategories } from '@/types'
import { getPetPolicy, assetPath, formatPetSizeRange } from '@/lib/utils'
import Image from 'next/image'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

interface BookingRoomCardProps {
  categories: RoomCategories[]
  selectedRooms: Record<number, number>
  onSelectChange: (categoryId: number, value: number) => void
  isSummary?: boolean
}

export function BookingRoomCard({
  categories,
  selectedRooms,
  onSelectChange,
  isSummary = false,
}: BookingRoomCardProps) {
  const availableCategories = categories.filter((cat) => cat.isAvailable)

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Image src={assetPath("/graphics/search-room.png")} alt="Search Rooms" width={200} height={200} />{' '}
        <p className="text-neutral-500">
          Select dates & pets to see available rooms
        </p>
      </div>
    )
  }

  if (availableCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Image src={assetPath("/graphics/no-room.png")} alt="No Rooms" width={200} height={200} />{' '}
        <p className="text-neutral-500 mt-4">
          No rooms are available for the selected dates and pets
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {availableCategories.map((cat) => {
        const totalNights = cat.availability.dates.length
        const averagePricePerNight =
          totalNights > 0
            ? Math.round(cat.availability.totalPrice / totalNights)
            : 0

        return (
          <div
            key={cat.id}
            className="border border-border rounded-2xl p-4 shadow-sm bg-white mb-4"
          >
            <div className="flex gap-3">
              {/* Left: Details */}
              <div className="flex-1 min-w-0">
                <h4 className="capitalize font-semibold text-foreground">{cat.name}</h4>
                <p className="text-xs text-neutral-gray mt-0.5">
                  <span className="bg-deep-teal/10 text-deep-teal rounded-full px-2 py-0.5 text-xs font-semibold mr-2">
                    {getPetPolicy(cat.pets)}
                  </span>
                  {cat.numberOfPets} pets max{' '}
                  {cat.petSizeCategory && (
                    <span className="ml-1 capitalize">
                      · {cat.petSizeCategory.name} ({formatPetSizeRange(cat.petSizeCategory.min, cat.petSizeCategory.max)})
                    </span>
                  )}
                </p>

                {/* Facilities */}
                {(cat.facilities || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cat.facilities?.map((facility) => (
                      <span
                        key={facility.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-off-white text-neutral-gray border border-border/50"
                      >
                        {facility.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Price & Select */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {/* Price */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-foreground tabular-nums">
                    ฿{cat.availability.totalPrice.toLocaleString()}
                  </div>
                  {totalNights > 0 && (
                    <p className="text-xs text-neutral-gray tabular-nums">
                      ฿{averagePricePerNight.toLocaleString()}/night
                    </p>
                  )}
                </div>

                {/* Select */}
                {isSummary ? (
                  <div className="text-center">
                    <span className="text-lg font-semibold text-foreground tabular-nums">
                      {selectedRooms[cat.id]}
                    </span>
                    <p className="text-xs text-neutral-gray">rooms</p>
                  </div>
                ) : (
                  <>
                    <Select
                      value={String(selectedRooms[cat.id] ?? 0)}
                      onValueChange={(v) => onSelectChange(cat.id, Number(v))}
                    >
                      <SelectTrigger className="w-20 h-10 text-sm font-medium hover:bg-off-white">
                        <SelectValue>{selectedRooms[cat.id] ?? 0}</SelectValue>
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

                    {/* Total Price or Available Count */}
                    {selectedRooms[cat.id] && selectedRooms[cat.id] > 0 ? (
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        ฿
                        {(
                          cat.availability.totalPrice * selectedRooms[cat.id]
                        ).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-gray">
                        {cat.availability.availableRooms} available
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
