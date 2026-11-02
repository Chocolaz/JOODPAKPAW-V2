'use client'

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

  return (
    <div className="mt-10 border-t pt-8">
      <div className="mb-4">
        <h3 className="text-lg lg:text-xl font-semibold text-deep-teal">
          Location
        </h3>
        <p className="text-neutral-gray">
          {property.district}, {property.province}
        </p>
      </div>
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-xl shadow-md border border-gray-200/60 hover:shadow-lg transition-shadow"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt="Map of property location"
          className="w-full h-auto block"
        />
      </a>
    </div>
  )
}
