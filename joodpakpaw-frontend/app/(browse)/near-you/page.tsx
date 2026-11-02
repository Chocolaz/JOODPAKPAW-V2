'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { getProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { PropertiesResponse, Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowsePageLayout, PAGE_SIZE } from '../_components/BrowsePageLayout'

const MAX_DISTANCE_KM = 50

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function NearYouPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isAuthenticated } = useAuth()
  const { filters } = useBrowseFilters()

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    getProperties(1, 1000)
      .then((res) => setProperties((res as PropertiesResponse).data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = useMemo(() => {
    if (!userLocation) return []
    return properties
      .filter((p) => {
        if (p.latitude == null || p.longitude == null) return false
        if (haversineDistance(userLocation.lat, userLocation.lon, Number(p.latitude), Number(p.longitude)) > MAX_DISTANCE_KM) return false
        if (filters.petTypes.length > 0) {
          const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
          if (!filters.petTypes.some((t) => names.includes(t))) return false
        }
        if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
        if (filters.maxPrice !== '') {
          const price = getLowestPrice(p.roomCategories)
          if (price !== null && price > Number(filters.maxPrice)) return false
        }
        return true
      })
      .sort((a, b) => {
        const distA = haversineDistance(userLocation.lat, userLocation.lon, Number(a.latitude), Number(a.longitude))
        const distB = haversineDistance(userLocation.lat, userLocation.lon, Number(b.latitude), Number(b.longitude))
        return distA - distB
      })
  }, [properties, userLocation, filters])

  return (
    <BrowsePageLayout
      title="Near You"
      icon={<MapPin className="w-5 h-5 text-accent-orange" />}
      isLoading={isLoading}
      filtered={filtered}
      visibleCount={visibleCount}
      setVisibleCount={setVisibleCount}
      showHeartIcon={isAuthenticated}
      showPetPolicyChip={true}
      emptyState={
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <MapPin className="w-10 h-10 text-gray-300" />
          <p className="font-medium text-gray-700">Location access required</p>
          <p className="text-sm text-neutral-gray">Please allow location permission to see properties near you.</p>
        </div>
      }
    />
  )
}
