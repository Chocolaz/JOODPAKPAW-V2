'use client'

import { Property } from '@/types'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { useAuth } from '@/app/_components/AuthContext'

export function HostPropertiesSection({
  properties,
}: {
  properties: Property[]
}) {
  const { isAuthenticated } = useAuth()

  return (
    <section className="px-5 lg:px-12 mt-2 border-t border-gray-100 pt-7 lg:pt-9">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-accent-orange shrink-0" />
        <h2 className="text-lg font-bold text-deep-teal font-baloo2">
          Properties
          <span className="ml-2 text-sm font-medium text-neutral-gray">({properties.length})</span>
        </h2>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-neutral-gray">
          <p className="text-sm">No properties listed yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              showPetPolicyChip
              showHeartIcon={isAuthenticated}
            />
          ))}
        </div>
      )}
    </section>
  )
}
