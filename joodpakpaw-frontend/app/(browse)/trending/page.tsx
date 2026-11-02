'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { getProperties } from '@/lib/api'
import { Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowsePageLayout, PAGE_SIZE } from '../_components/BrowsePageLayout'

export default function TrendingPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isAuthenticated } = useAuth()
  const { filters } = useBrowseFilters()

  useEffect(() => {
    setIsLoading(true)
    getProperties(1, 500, {
      sortBy: 'trending',
      petTypes: filters.petTypes.length > 0 ? filters.petTypes.join(',') : undefined,
      minRating: filters.minRating || undefined,
      maxPrice: filters.maxPrice || undefined,
    })
      .then((res) => setProperties(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, filters.petTypes.join(','), filters.minRating, filters.maxPrice])

  const filtered = properties

  return (
    <BrowsePageLayout
      title="Trending"
      icon={<TrendingUp className="w-5 h-5 text-accent-orange" />}
      isLoading={isLoading}
      filtered={filtered}
      visibleCount={visibleCount}
      setVisibleCount={setVisibleCount}
      showHeartIcon={isAuthenticated}
      showPetPolicyChip={true}
    />
  )
}
