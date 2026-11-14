'use client'

import useSWR from 'swr'
import { getFeaturedSections, FeaturedSectionsData } from '@/lib/api'

export function useFeaturedSections() {
  const { data, isLoading, isValidating, error, mutate } = useSWR<FeaturedSectionsData>(
    'featured-sections',
    getFeaturedSections,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 60s
      revalidateIfStale: false,
    }
  )

  return {
    featured: data ?? null,
    isLoading,
    isValidating,
    error,
    mutate,
  }
}
