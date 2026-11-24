'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Property } from '@/types'

interface PropertyFacilitiesProps {
  facilities: Property['facilities']
  description: Property['description']
}

const INITIAL_FACILITY_LIMIT = 9

export function PropertyFacilities({
  facilities,
  description,
}: PropertyFacilitiesProps) {
  const [expanded, setExpanded] = useState(false)
  const hasFacilities = Boolean(facilities && facilities.length > 0)
  const hasDescription = Boolean(description && description.trim().length > 0)

  if (!hasFacilities && !hasDescription) {
    return null
  }

  const visibleFacilities =
    hasFacilities && !expanded
      ? facilities!.slice(0, INITIAL_FACILITY_LIMIT)
      : (facilities ?? [])
  const hasMoreFacilities =
    hasFacilities && facilities!.length > INITIAL_FACILITY_LIMIT

  return (
    <section className="border-t border-border pt-8 space-y-6">
      {hasDescription && (
        <div className="space-y-2.5">
          <h2 className="font-semibold text-deep-teal">About this stay</h2>
          <p className="text-sm lg:text-base text-foreground/85 leading-relaxed whitespace-pre-line">
            {description}
          </p>
        </div>
      )}

      {hasFacilities && (
        <div className="space-y-4">
          <h2 className="font-semibold text-deep-teal">
            What this place offers
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-2.5">
            {visibleFacilities.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 py-1 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-deep-teal shrink-0" />
                <span className="text-sm text-foreground truncate">{f.name}</span>
              </div>
            ))}
          </div>

          {hasMoreFacilities && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium text-deep-teal hover:bg-off-white/70 transition-colors cursor-pointer"
            >
              {expanded
                ? 'Show fewer amenities'
                : `Show all ${facilities!.length} amenities`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
