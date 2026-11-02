'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { getProperties } from '@/lib/api'
import { Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowsePageLayout, PAGE_SIZE } from '../_components/BrowsePageLayout'

export default function TopRatedPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isAuthenticated } = useAuth()
  const { filters } = useBrowseFilters()

  useEffect(() => {
    setIsLoading(true)
    getProperties(1, 500, {
      minRating: Math.max(4.0, filters.minRating || 0),
      petTypes: filters.petTypes.length > 0 ? filters.petTypes.join(',') : undefined,
      maxPrice: filters.maxPrice || undefined,
    })
      .then((res) => setProperties(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, filters.minRating, filters.petTypes.join(','), filters.maxPrice])

  const filtered = properties

  return (
    <BrowsePageLayout
      title="Top Rated"
      icon={<Star className="w-5 h-5 fill-yellow-400 text-yellow-500" />}
      isLoading={isLoading}
      filtered={filtered}
      visibleCount={visibleCount}
      setVisibleCount={setVisibleCount}
      showHeartIcon={isAuthenticated}
      showPetPolicyChip={true}
    />
  )
}
