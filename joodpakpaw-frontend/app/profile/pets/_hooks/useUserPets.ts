'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAllPetProfiles } from '@/lib/api'
import { PetProfile } from '@/types'

export function useUserPets(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {}
  const [pets, setPets] = useState<PetProfile[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchUserPets = useCallback(async () => {
    if (!enabled) {
      setPets([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const response = await getAllPetProfiles()
      const sortedPets = (response.petProfiles || []).sort(
        (a: PetProfile, b: PetProfile) => a.id - b.id
      )
      setPets(sortedPets)
      setError(null)
    } catch (err) {
      setError('Failed to fetch pet profiles. Please try again later.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchUserPets()
  }, [fetchUserPets])

  return { pets, loading, error, refetch: fetchUserPets }
}
