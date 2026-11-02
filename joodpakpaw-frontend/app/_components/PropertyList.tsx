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
}

export function PropertyList({
  properties,
  className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 px-5',
  buildHref,
  showRoomCount,
  showStatusIcon,
  showPetPolicyChip,
  showHeartIcon,
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
        />
      ))}
    </div>
  )
}
