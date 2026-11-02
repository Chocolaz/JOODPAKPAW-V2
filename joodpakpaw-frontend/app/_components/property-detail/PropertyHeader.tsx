'use client'

import { Star, MapPin, Sparkles } from 'lucide-react'
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
}

export function PropertyHeader({ property }: PropertyHeaderProps) {
  const locationParts = [
    property.district,
    property.province,
    property.country,
  ].filter(Boolean)

  return (
    <div className="mb-6">
      <h2 className="text-2xl lg:text-3xl font-bold text-deep-teal leading-snug mb-3">
        {property.title}
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-neutral-gray">
          <MapPin className="w-4 h-4 text-accent-orange shrink-0" />
          <span className="text-sm lg:text-base">
            {locationParts.join(', ')}
          </span>
        </div>

        {property.avgRating > 0 ? (
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
            <Star
              className="w-4 h-4 fill-yellow-400 text-yellow-400"
              strokeWidth={0}
            />
            <span className="text-sm font-semibold text-gray-800">
              {property.avgRating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">
              ({property.reviewCount}{' '}
              {property.reviewCount === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-xs">New listing</span>
          </div>
        )}
      </div>
    </div>
  )
}
