// app/profile/host/add-property/_hooks/useFacilities.ts
import { useState, useEffect } from 'react'
import { getFacilities } from '@/lib/api'
import { Facility } from '@/types'

export function useFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFacilities() {
      try {
        setLoading(true)
        const data = await getFacilities()
        setFacilities(data.facilities)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to fetch facilities')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchFacilities()
  }, [])

  return { facilities, loading, error }
}
