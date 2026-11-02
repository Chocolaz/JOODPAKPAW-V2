'use client'

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
      key={facility.id}
      onClick={() => onToggle(facility.id)}
      className={cn(
        'flex items-center gap-3 p-4 rounded-[14px] border shadow-sm text-left transition-all w-full min-h-16',
        selected
          ? 'border-positive-green bg-teal-50'
          : 'border-[ECEFF2] bg-white hover:border-deep-teal/50'
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full shrink-0 border flex items-center justify-center transition-all',
          selected
            ? 'border-positive-green bg-positive-green'
            : 'border-gray-300 bg-white'
        )}
      >
        {selected && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
      </div>

      <span className="text-sm font-medium text-neutral-dark truncate line-clamp-2">{facility.name}</span>
    </button>
  )
}
