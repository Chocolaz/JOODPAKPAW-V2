import { RoomCategories } from '@/types'
import { RoomCategoryCard } from '@/app/_components/RoomCategoryCard'

interface PropertyRoomCategoriesProps {
  roomCategories: RoomCategories[]
  propertyId: number
  onDeleteSuccess?: () => void
  showDeleteButton?: boolean
  fallbackImageUrl?: string
  onEdit?: (category: RoomCategories) => void
}

export function PropertyRoomCategories({
  roomCategories,
  propertyId,
  onDeleteSuccess,
  showDeleteButton,
  fallbackImageUrl,
  onEdit,
}: PropertyRoomCategoriesProps) {
  if (!roomCategories || roomCategories.length === 0) return null

  return (
    <div className="border-t pt-8 mt-10">
      <h3 className="text-lg lg:text-xl font-semibold text-deep-teal mb-5">Room Categories</h3>
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {roomCategories.map((category) => (
          <RoomCategoryCard
            key={category.id}
            category={category}
            propertyId={propertyId}
            onDeleteSuccess={onDeleteSuccess}
            showDeleteButton={showDeleteButton}
            fallbackImageUrl={fallbackImageUrl}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}
