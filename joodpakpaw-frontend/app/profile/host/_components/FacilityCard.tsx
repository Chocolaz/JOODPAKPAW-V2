'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Facility } from '@/types'

interface FacilityCardProps {
  facility: Facility
  selected: boolean
  onToggle: (id: number) => void
}

export function FacilityCard({
  facility,
  selected,
  onToggle,
}: FacilityCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(facility.id)}
      className={cn(
        'flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors w-full min-h-16 cursor-pointer',
        selected
          ? 'border-deep-teal bg-off-white text-deep-teal'
          : 'border-border bg-white hover:border-deep-teal/40'
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full shrink-0 border flex items-center justify-center transition-colors',
          selected
            ? 'border-deep-teal bg-deep-teal text-white'
            : 'border-border bg-white'
        )}
      >
        {selected && <Check className="w-3 h-3" strokeWidth={3} />}
      </div>

      <span className="text-sm font-medium text-foreground line-clamp-2">
        {facility.name}
      </span>
    </button>
  )
}
