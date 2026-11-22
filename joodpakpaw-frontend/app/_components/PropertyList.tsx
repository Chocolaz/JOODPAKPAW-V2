'use client'

import { Property } from '@/types'
import { PropertyCard } from './PropertyCard'

interface PropertyListProps {
  properties: Property[]
  className?: string
  buildHref?: (property: Property) => string
  showRoomCount?: boolean
  showStatusIcon?: boolean
  showPetPolicyChip?: boolean
  showHeartIcon?: boolean
  showMatchReason?: boolean
  showTotalPrice?: boolean
  checkIn?: string
  checkOut?: string
  highlightedPropertyId?: number | null
  onPropertyHover?: (id: number | null) => void
}

export function PropertyList({
  properties,
  className = 'grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6',
  buildHref,
  showRoomCount,
  showStatusIcon,
  showPetPolicyChip,
  showHeartIcon,
  showMatchReason,
  showTotalPrice = true,
  checkIn,
  checkOut,
  highlightedPropertyId,
  onPropertyHover,
}: PropertyListProps) {
  return (
    <div className={className}>
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          href={buildHref ? buildHref(property) : undefined}
          showRoomCount={showRoomCount}
          showStatusIcon={showStatusIcon}
          showPetPolicyChip={showPetPolicyChip}
          showHeartIcon={showHeartIcon}
          showMatchReason={showMatchReason}
          showTotalPrice={showTotalPrice}
          checkIn={checkIn}
          checkOut={checkOut}
          isHighlighted={highlightedPropertyId === property.id}
          onHoverChange={onPropertyHover}
        />
      ))}
    </div>
  )
}
