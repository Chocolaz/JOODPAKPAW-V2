'use client'

import { ExternalLink, MapPin } from 'lucide-react'
import { Property } from '@/types'
import { getStaticMapUrl } from '@/lib/mapUtils'

interface PropertyLocationProps {
  property: Pick<Property, 'latitude' | 'longitude' | 'district' | 'province'>
}

export function PropertyLocation({ property }: PropertyLocationProps) {
  if (!property.latitude || !property.longitude) {
    return null
  }

  const mapUrl = getStaticMapUrl({
    latitude: property.latitude,
    longitude: property.longitude,
    width: 800,
    height: 400,
  })
  const googleMapsUrl = `https://www.google.com/maps?q=${property.latitude},${property.longitude}`

  if (!mapUrl) return null

  const areaLabel = [property.district, property.province]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="border-t border-border pt-8 space-y-4">
      <div>
        <h2 className="font-semibold text-deep-teal">Location</h2>
        <p className="text-sm text-neutral-gray mt-1 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-accent-orange shrink-0" />
          <span>{areaLabel}</span>
        </p>
      </div>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full overflow-hidden rounded-2xl border border-border bg-white hover:border-deep-teal/40 transition-colors"
      >
        <div className="overflow-hidden bg-off-white/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapUrl}
            alt={`Map of ${areaLabel || 'property location'}`}
            className="w-full h-auto block"
          />
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground truncate">
            {areaLabel || 'View exact location'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-deep-teal font-medium shrink-0 group-hover:underline underline-offset-2">
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </a>
    </section>
  )
}
