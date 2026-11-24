import { PetProfile, RoomCategories } from '@/types'
import { RoomCategoryCard } from '@/app/_components/RoomCategoryCard'
import { getRoomIneligibilityReason } from './BookingRoomCard'

interface PropertyRoomCategoriesProps {
  roomCategories: RoomCategories[]
  propertyId: number
  onDeleteSuccess?: () => void
  showDeleteButton?: boolean
  fallbackImageUrl?: string
  onEdit?: (category: RoomCategories) => void
  onManageCalendar?: (category: RoomCategories) => void
  // Unified booking flow props
  bookingMode?: boolean
  liveRoomCategories?: RoomCategories[]
  selectedRooms?: Record<number, number>
  onSelectCountChange?: (categoryId: number, nextCount: number) => void
  selectedPets?: PetProfile[]
  petSizeId?: number | null
  stayNights?: number
  hasSearchContext?: boolean
  searchLoading?: boolean
  onPromptSelectDates?: () => void
}

export function PropertyRoomCategories({
  roomCategories,
  propertyId,
  onDeleteSuccess,
  showDeleteButton,
  fallbackImageUrl,
  onEdit,
  onManageCalendar,
  bookingMode = false,
  liveRoomCategories = [],
  selectedRooms = {},
  onSelectCountChange,
  selectedPets = [],
  petSizeId = null,
  stayNights = 0,
  hasSearchContext = false,
  searchLoading = false,
  onPromptSelectDates,
}: PropertyRoomCategoriesProps) {
  if (!roomCategories || roomCategories.length === 0) return null

  return (
    <section id="rooms" className="scroll-mt-24 border-t border-border pt-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-5">
        <h2 className="font-semibold text-deep-teal">
          {bookingMode ? 'Choose your room' : 'Room Categories'}
        </h2>
        {bookingMode && (
          <p className="text-xs text-neutral-gray tabular-nums">
            {hasSearchContext
              ? `Live availability for ${stayNights} ${stayNights === 1 ? 'night' : 'nights'}`
              : 'Select dates and pets to see live availability'}
          </p>
        )}
      </div>

      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {roomCategories.map((category) => {
          const liveCat = liveRoomCategories.find((l) => l.id === category.id)
          const ineligibilityReason =
            bookingMode && hasSearchContext && liveCat
              ? getRoomIneligibilityReason(liveCat, selectedPets, petSizeId)
              : null

          return (
            <RoomCategoryCard
              key={category.id}
              category={category}
              propertyId={propertyId}
              onDeleteSuccess={onDeleteSuccess}
              showDeleteButton={showDeleteButton}
              fallbackImageUrl={fallbackImageUrl}
              onEdit={onEdit}
              onManageCalendar={onManageCalendar}
              bookingMode={bookingMode}
              liveCategory={liveCat}
              selectedCount={selectedRooms[category.id] ?? 0}
              onSelectCountChange={onSelectCountChange}
              ineligibilityReason={ineligibilityReason}
              stayNights={stayNights}
              hasSearchContext={hasSearchContext}
              searchLoading={searchLoading}
              onPromptSelectDates={onPromptSelectDates}
            />
          )
        })}
      </div>
    </section>
  )
}
