'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { getProperties, getPropertyById } from '@/lib/api'
import { Property } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
import { useRecentlyViewed } from '@/app/_hooks/useRecentlyViewed'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { BrowsePageLayout, PAGE_SIZE } from '../_components/BrowsePageLayout'

export default function RecentlyViewedPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { isAuthenticated } = useAuth()
  const { ids } = useRecentlyViewed()
  const { } = useBrowseFilters()

  useEffect(() => {
    if (ids.length === 0) {
      setProperties([])
      setIsLoading(false)
      return
    }

    const fetchProperties = async () => {
      setIsLoading(true)
      try {
        const promises = ids.map((id) => getPropertyById(String(id)))
        const results = await Promise.all(promises)
        setProperties(results.map((r) => r.property))
      } catch (err) {
        console.error('Failed to fetch recently viewed properties:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperties()
  }, [ids])

  const filtered = properties

  return (
    <BrowsePageLayout
      title="Recently Viewed"
      icon={<Clock className="w-5 h-5 text-neutral-gray" />}
      isLoading={isLoading}
      filtered={filtered}
      visibleCount={visibleCount}
      setVisibleCount={setVisibleCount}
      showHeartIcon={isAuthenticated}
      showPetPolicyChip={true}
      emptyState={
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <Clock className="w-10 h-10 text-gray-300" />
          <p className="font-medium text-gray-700">No recently viewed properties</p>
          <p className="text-sm text-neutral-gray">Properties you view will appear here.</p>
        </div>
      }
    />
  )
}
