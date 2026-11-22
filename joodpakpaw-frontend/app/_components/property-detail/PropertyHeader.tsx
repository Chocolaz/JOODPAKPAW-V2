'use client'

import { Star, MapPin, Clock } from 'lucide-react'
import { Property } from '@/types'

interface PropertyHeaderProps {
  property: Pick<
    Property,
    | 'title'
    | 'district'
    | 'province'
    | 'country'
    | 'avgRating'
    | 'reviewCount'
  >
  actions?: React.ReactNode
}

export function PropertyHeader({ property, actions }: PropertyHeaderProps) {
  const locationParts = [
    property.district,
    property.province,
    property.country,
  ].filter(Boolean)

  const handleScrollToReviews = () => {
    const el = document.getElementById('reviews')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className="space-y-2.5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-bold text-deep-teal leading-snug break-words min-w-0">
            {property.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-neutral-gray">
              <MapPin className="w-4 h-4 text-accent-orange shrink-0" />
              <span className="text-sm">{locationParts.join(', ')}</span>
            </div>

            {property.avgRating > 0 ? (
              <button
                type="button"
                onClick={handleScrollToReviews}
                className="inline-flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <Star
                  className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"
                  strokeWidth={0}
                />
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {property.avgRating.toFixed(1)}
                </span>
                <span className="text-xs text-neutral-gray tabular-nums">
                  ({property.reviewCount ?? 0}{' '}
                  {property.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1">
                <Clock
                  className="w-3.5 h-3.5 text-neutral-gray"
                  strokeWidth={1.5}
                />
                <span className="text-xs text-neutral-gray font-medium">
                  New listing
                </span>
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="hidden lg:flex items-center gap-2 shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
