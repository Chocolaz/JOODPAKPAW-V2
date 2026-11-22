'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps'
import { Star, X, Plus, Minus, MapPin, Navigation } from 'lucide-react'
import { Property } from '@/types'
import { PropertyCard } from '@/app/_components/PropertyCard'
import {
  assetPath,
  cn,
  getApiImageUrl,
  getLowestPrice,
} from '@/lib/utils'

const BANGKOK_CENTER = { lat: 13.7563, lng: 100.5018 }

interface HomeMapViewProps {
  properties: Property[]
  showTotalPrice: boolean
  checkIn?: string
  checkOut?: string
  showHeartIcon: boolean
  userLocation?: { lat: number; lng: number } | null
}

function MapCenterSync({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  const { lat, lng } = center
  useEffect(() => {
    if (!map) return
    map.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
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
  userLocation,
}: HomeMapViewProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  )
  const [zoomScale, setZoomScale] = useState(1)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''

  const hasUserLocation = Boolean(
    userLocation &&
      Number.isFinite(userLocation.lat) &&
      Number.isFinite(userLocation.lng)
  )

  const center = useMemo(
    () => (hasUserLocation && userLocation ? userLocation : BANGKOK_CENTER),
    [hasUserLocation, userLocation]
  )

  const centerLabel = hasUserLocation
    ? 'Centered near you'
    : 'Centered on Bangkok'

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

  // Normalized 2D positions centered around `center` (50%, 50%) for fallback coordinate map
  const normalizedPins = useMemo(() => {
    if (mappable.length === 0) return []
    const maxLatDelta = Math.max(
      0.06,
      ...mappable.map((m) => Math.abs(m.lat - center.lat))
    )
    const maxLngDelta = Math.max(
      0.06,
      ...mappable.map((m) => Math.abs(m.lng - center.lng))
    )
    const latHalfSpan = maxLatDelta * 1.18
    const lngHalfSpan = maxLngDelta * 1.18

    return mappable.map((item, idx) => {
      const rawX = 50 + ((item.lng - center.lng) / lngHalfSpan) * 38
      const rawY = 50 - ((item.lat - center.lat) / latHalfSpan) * 36
      // Slight deterministic offset if multiple properties share exact coordinates
      const jitterX = ((idx % 3) - 1) * 1.1
      const jitterY = (Math.floor(idx / 3) % 2 === 0 ? -1 : 1) * 1.0
      return {
        ...item,
        x: Math.min(88, Math.max(12, rawX + jitterX)),
        y: Math.min(86, Math.max(14, rawY + jitterY)),
      }
    })
  }, [mappable, center.lat, center.lng])

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
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-20 rounded-2xl bg-white border border-border overflow-hidden">
        <button
          type="button"
          aria-label="Close preview"
          onClick={() => setSelectedProperty(null)}
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 text-foreground flex items-center justify-center hover:bg-off-white transition-colors"
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
                  {hasStayTotal ? 'total' : '/ night'}
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
          {/* Center Status Pill */}
          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-border text-xs font-medium text-deep-teal">
            <Navigation className="w-3.5 h-3.5 text-accent-orange" />
            <span>{centerLabel}</span>
          </div>

          <APIProvider apiKey={apiKey}>
            <GoogleMap
              defaultCenter={center}
              defaultZoom={11}
              mapId="joodpakpaw-home-map"
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <MapCenterSync center={center} />
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
                        'px-3 py-1.5 rounded-full text-xs font-bold tabular-nums border transition-transform motion-reduce:transition-none duration-150',
                        isActive
                          ? 'bg-deep-teal text-white border-deep-teal scale-110 z-10'
                          : 'bg-white text-foreground border-border hover:scale-105'
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

    // Graceful interactive coordinate pin map centered on user location or Bangkok
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
        {/* Map Header Pills */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap pr-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-border text-xs font-medium text-deep-teal">
            <Navigation className="w-3.5 h-3.5 text-accent-orange" />
            <span>{centerLabel}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-border text-xs font-medium text-deep-teal">
            <MapPin className="w-3.5 h-3.5 text-deep-teal" />
            <span className="tabular-nums">
              {mappable.length}{' '}
              {mappable.length === 1 ? 'stay on map' : 'stays on map'}
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomScale((z) => Math.min(1.4, z + 0.15))}
            className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-deep-teal hover:bg-off-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomScale((z) => Math.max(0.85, z - 0.15))}
            className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-deep-teal hover:bg-off-white transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Pins Layer */}
        <div
          className="relative w-full h-full transition-transform motion-reduce:transition-none duration-200"
          style={{ transform: `scale(${zoomScale})` }}
        >
          {/* Reference Center Marker */}
          <div
            style={{ left: '50%', top: '50%' }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-[5] flex flex-col items-center gap-1"
            aria-hidden="true"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-accent-orange ring-4 ring-accent-orange/25 border-2 border-white" />
            <span className="px-2 py-0.5 rounded-full bg-white/90 text-[11px] font-semibold text-deep-teal border border-border">
              {hasUserLocation ? 'You' : 'Bangkok'}
            </span>
          </div>

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
                  'absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full text-xs font-bold tabular-nums border transition-transform motion-reduce:transition-none duration-150',
                  isActive
                    ? 'bg-deep-teal text-white border-deep-teal scale-110 z-20'
                    : 'bg-white text-foreground border-border hover:border-deep-teal hover:scale-105 z-10'
                )}
              >
                {getPinPriceLabel(property, showTotalPrice)}
              </button>
            )
          })}
        </div>

        {mappable.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-deep-teal font-medium bg-white/90 px-4 py-2 rounded-full border border-border">
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
      <div className="lg:hidden w-full h-[64vh] min-h-[400px] rounded-2xl overflow-hidden border border-border">
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
      <div className="hidden lg:block lg:col-span-5 sticky top-36 h-[calc(100vh-11rem)] rounded-2xl overflow-hidden border border-border">
        {renderMapCanvas()}
      </div>
    </div>
  )
}
