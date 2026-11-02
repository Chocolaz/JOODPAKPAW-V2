'use client'

import { useFacilities } from '../add-property/_hooks/useFacilities'
import { Facility } from '@/types'
import { useMemo } from 'react'

export function useGroupedFacilities() {
  const { facilities, loading, error } = useFacilities()

  const groupedFacilities = useMemo(() => {
    if (!facilities) return {}

    return facilities
      .filter((facility) => facility.category.name !== 'indoor')
      .reduce(
        (acc, facility) => {
          const category = facility.category.name
          if (!acc[category]) {
            acc[category] = []
          }
          acc[category].push(facility)
          return acc
        },
        {} as Record<string, Facility[]>
      )
  }, [facilities])

  return { groupedFacilities, loading, error }
}
