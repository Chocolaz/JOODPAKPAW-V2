'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
} from '@vis.gl/react-google-maps'
import { Star, X, Plus, Minus, MapPin } from 'lucide-react'
import { Property } from '@/types'
import { PropertyCard } from '@/app/_components/PropertyCard'
import {
  assetPath,
  cn,
  getApiImageUrl,
  getLowestPrice,
} from '@/lib/utils'

interface HomeMapViewProps {
  properties: Property[]
  showTotalPrice: boolean
  checkIn?: string
  checkOut?: string
  showHeartIcon: boolean
}

function getPinPriceLabel(
  property: Property,
  showTotalPrice: boolean
): string {
  if (
    showTotalPrice &&
    property.stayTotalPrice != null &&
    property.stayNights != null &&
    property.stayNights > 0
  ) {
    return `฿${property.stayTotalPrice.toLocaleString()}`
  }
  if (
    !showTotalPrice &&
    property.stayTotalPrice != null &&
    property.stayNights != null &&
    property.stayNights > 0
  ) {
    return `฿${Math.round(
      property.stayTotalPrice / property.stayNights
    ).toLocaleString()}`
  }
  const lowest = getLowestPrice(property.roomCategories)
  return lowest !== null ? `฿${lowest.toLocaleString()}` : 'View'
}

function buildDetailHref(
  propertyId: number,
  checkIn?: string,
  checkOut?: string
): string {
  const base = `/detail/${propertyId}`
  if (checkIn && checkOut) {
    return `${base}?${new URLSearchParams({ checkIn, checkOut }).toString()}`
  }
  return base
}

export function HomeMapView({
  properties,
  showTotalPrice,
  checkIn,
  checkOut,
  showHeartIcon,
}: HomeMapViewProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  )
  const [zoomScale, setZoomScale] = useState(1)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''

  const mappable = useMemo(
    () =>
      properties
        .map((p) => ({
          property: p,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
        }))
        .filter(
          (item) =>
            Number.isFinite(item.lat) &&
            Number.isFinite(item.lng) &&
            (item.lat !== 0 || item.lng !== 0)
        ),
    [properties]
  )

  const center = useMemo(() => {
    if (mappable.length === 0) return { lat: 13.7563, lng: 100.5018 }
    const avgLat =
      mappable.reduce((sum, item) => sum + item.lat, 0) / mappable.length
    const avgLng =
      mappable.reduce((sum, item) => sum + item.lng, 0) / mappable.length
    return { lat: avgLat, lng: avgLng }
  }, [mappable])

  // Normalized 2D positions (12%..88%) for fallback coordinate map
  const normalizedPins = useMemo(() => {
    if (mappable.length === 0) return []
    const lats = mappable.map((m) => m.lat)
    const lngs = mappable.map((m) => m.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const latSpan = maxLat - minLat || 0.08
    const lngSpan = maxLng - minLng || 0.08

    return mappable.map((item, idx) => {
      const rawX =
        mappable.length === 1
          ? 50
          : 14 + ((item.lng - minLng) / lngSpan) * 72
      const rawY =
        mappable.length === 1
          ? 50
          : 84 - ((item.lat - minLat) / latSpan) * 68
      // Slight deterministic offset if multiple properties share exact coordinates
      const jitterX = ((idx % 3) - 1) * 1.4
      const jitterY = (Math.floor(idx / 3) % 2 === 0 ? -1 : 1) * 1.2
      return {
        ...item,
        x: Math.min(88, Math.max(12, rawX + jitterX)),
        y: Math.min(86, Math.max(14, rawY + jitterY)),
      }
    })
  }, [mappable])

  const renderPreviewPopup = () => {
    if (!selectedProperty) return null
    const imgSrc =
      getApiImageUrl(selectedProperty.images?.[0]?.filePath) ||
      assetPath('/graphics/welcome.svg')
    const priceLabel = getPinPriceLabel(selectedProperty, showTotalPrice)
    const hasStayTotal =
      showTotalPrice &&
      selectedProperty.stayTotalPrice != null &&
      selectedProperty.stayNights != null &&
      selectedProperty.stayNights > 0

    return (
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-20 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
        <button
          type="button"
          aria-label="Close preview"
          onClick={() => setSelectedProperty(null)}
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 text-foreground shadow-sm flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <Link
          href={buildDetailHref(selectedProperty.id, checkIn, checkOut)}
          className="flex items-stretch gap-3 p-2.5 hover:bg-off-white/40 transition-colors"
        >
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-off-white shrink-0">
            <Image
              src={imgSrc}
              alt={selectedProperty.title}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 py-0.5 flex flex-col justify-between pr-6">
            <div>
              <p className="text-sm font-semibold text-foreground truncate">
                {selectedProperty.title}
              </p>
              <p className="text-xs text-neutral-gray truncate mt-0.5">
                {selectedProperty.district
                  ? `${selectedProperty.district}, ${selectedProperty.province}`
                  : selectedProperty.province}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-sm font-bold text-deep-teal tabular-nums">
                {priceLabel}
                <span className="text-xs font-normal text-neutral-gray ml-1">
                  {hasStayTotal
                    ? `total`
                    : `/ night`}
                </span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground tabular-nums">
                <Star className="w-3.5 h-3.5 fill-foreground text-foreground" />
                {selectedProperty.avgRating > 0
                  ? selectedProperty.avgRating.toFixed(1)
                  : 'New'}
              </span>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  const renderMapCanvas = () => {
    if (apiKey) {
      return (
        <div className="relative w-full h-full">
          <APIProvider apiKey={apiKey}>
            <GoogleMap
              defaultCenter={center}
              defaultZoom={11}
              mapId="joodpakpaw-home-map"
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              {mappable.map(({ property, lat, lng }) => {
                const isActive =
                  hoveredId === property.id ||
                  selectedProperty?.id === property.id
                return (
                  <AdvancedMarker
                    key={property.id}
                    position={{ lat, lng }}
                    onClick={() => setSelectedProperty(property)}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredId(property.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-bold tabular-nums shadow-md border transition-transform duration-150',
                        isActive
                          ? 'bg-deep-teal text-white border-deep-teal scale-110 z-10'
                          : 'bg-white text-foreground border-gray-200 hover:scale-105'
                      )}
                    >
                      {getPinPriceLabel(property, showTotalPrice)}
                    </button>
                  </AdvancedMarker>
                )
              })}
            </GoogleMap>
          </APIProvider>
          {renderPreviewPopup()}
        </div>
      )
    }

    // Graceful interactive coordinate pin map when Google Maps key is not set
    return (
      <div
        className="relative w-full h-full overflow-hidden select-none"
        style={{
          backgroundColor: 'var(--map-canvas)',
          backgroundImage:
            'radial-gradient(circle at 20% 25%, rgba(28, 79, 74, 0.08) 0%, transparent 45%), radial-gradient(circle at 80% 75%, rgba(255, 111, 60, 0.08) 0%, transparent 45%), linear-gradient(to right, rgba(28, 79, 74, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(28, 79, 74, 0.06) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
        }}
      >
        {/* Map Header Pill */}
        <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-xs text-xs font-medium text-deep-teal">
          <MapPin className="w-3.5 h-3.5 text-accent-orange" />
          <span className="tabular-nums">
            {mappable.length}{' '}
            {mappable.length === 1 ? 'stay on map' : 'stays on map'}
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomScale((z) => Math.min(1.4, z + 0.15))}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-xs flex items-center justify-center text-deep-teal hover:bg-off-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomScale((z) => Math.max(0.85, z - 0.15))}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-xs flex items-center justify-center text-deep-teal hover:bg-off-white transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Pins Layer */}
        <div
          className="relative w-full h-full transition-transform duration-200"
          style={{ transform: `scale(${zoomScale})` }}
        >
          {normalizedPins.map(({ property, x, y }) => {
            const isActive =
              hoveredId === property.id ||
              selectedProperty?.id === property.id
            return (
              <button
                key={property.id}
                type="button"
                onClick={() => setSelectedProperty(property)}
                onMouseEnter={() => setHoveredId(property.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full text-xs font-bold tabular-nums shadow-md border transition-transform duration-150',
                  isActive
                    ? 'bg-deep-teal text-white border-deep-teal scale-110 z-20'
                    : 'bg-white text-foreground border-gray-200 hover:border-deep-teal hover:scale-105 z-10'
                )}
              >
                {getPinPriceLabel(property, showTotalPrice)}
              </button>
            )
          })}
        </div>

        {mappable.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-deep-teal font-medium bg-white/90 px-4 py-2 rounded-full border border-gray-200">
              No map coordinates available for these stays.
            </p>
          </div>
        )}

        {renderPreviewPopup()}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Mobile: Map on top so users immediately explore pins */}
      <div className="lg:hidden w-full h-[64vh] min-h-[400px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        {renderMapCanvas()}
      </div>

      {/* Left 7 Cols: Property Cards */}
      <div className="lg:col-span-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              showPetPolicyChip={true}
              showHeartIcon={showHeartIcon}
              showTotalPrice={showTotalPrice}
              checkIn={checkIn}
              checkOut={checkOut}
              isHighlighted={
                hoveredId === property.id ||
                selectedProperty?.id === property.id
              }
              onHoverChange={setHoveredId}
            />
          ))}
        </div>
      </div>

      {/* Right 5 Cols: Desktop Sticky Map */}
      <div className="hidden lg:block lg:col-span-5 sticky top-36 h-[calc(100vh-11rem)] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        {renderMapCanvas()}
      </div>
    </div>
  )
}
