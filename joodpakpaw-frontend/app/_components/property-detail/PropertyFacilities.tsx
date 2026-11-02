'use client'

import { CheckCircle } from 'lucide-react'
import { Property } from '@/types'

interface PropertyFacilitiesProps {
  facilities: Property['facilities']
  description: Property['description']
}

export function PropertyFacilities({
  facilities,
  description,
}: PropertyFacilitiesProps) {
  if (!facilities || facilities.length === 0) {
    return null
  }

  return (
    <div className="border-t pt-8 mb-10">
      <h3 className="text-lg lg:text-xl font-semibold text-deep-teal mb-5">
        What this place offers
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 mb-6">
        {facilities.map((f) => (
          <div key={f.id} className="flex items-center gap-2.5 py-1.5">
            <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-accent-orange shrink-0" />
            <span className="text-sm lg:text-base text-gray-700">{f.name}</span>
          </div>
        ))}
      </div>

      {description && (
        <p className="text-sm lg:text-base text-neutral-gray leading-relaxed border-t pt-4">
          {description}
        </p>
      )}
    </div>
  )
}
