'use client'

import { useEffect, useState } from 'react'
import { Cat } from 'lucide-react'
import { getProperties } from '@/lib/api'
import { Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowsePageLayout, PAGE_SIZE } from '../_components/BrowsePageLayout'

export default function CatFriendlyPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isAuthenticated } = useAuth()
  const { filters } = useBrowseFilters()

  useEffect(() => {
    setIsLoading(true)
    getProperties(1, 500, {
      petTypes: 'cat',
      minRating: filters.minRating || undefined,
      maxPrice: filters.maxPrice || undefined,
    })
      .then((res) => setProperties(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, filters.minRating, filters.maxPrice])

  return (
    <BrowsePageLayout
      title="Cat-Friendly"
      icon={<Cat className="w-5 h-5 text-purple-400" />}
      isLoading={isLoading}
      filtered={properties}
      visibleCount={visibleCount}
      setVisibleCount={setVisibleCount}
      showHeartIcon={isAuthenticated}
      showPetPolicyChip={false}
    />
  )
}
