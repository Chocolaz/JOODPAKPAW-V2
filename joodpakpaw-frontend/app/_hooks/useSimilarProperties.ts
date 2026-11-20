'use client'

import useSWR from 'swr'
import { getPropertyRecommendations } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import type { HostPropertiesResponse } from '@/types'

export function useSimilarProperties(
  propertyId: number | string | null | undefined,
  limit = 12
) {
  const { user, loading: authLoading } = useAuth()
  const userIdOrGuest = user?.id ?? 'guest'

  const key =
    !authLoading && propertyId != null && propertyId !== ''
      ? ['similar', String(propertyId), userIdOrGuest, limit]
      : null

  const { data, isLoading, isValidating, error, mutate } = useSWR<HostPropertiesResponse>(
    key,
    () => getPropertyRecommendations(propertyId!, limit),
    {
      dedupingInterval: 30000,
      revalidateOnFocus: false,
    }
  )

  return {
    properties: data?.properties ?? [],
    meta: data?.meta ?? null,
    isLoading: (propertyId != null && propertyId !== '' && authLoading) || isLoading,
    isValidating,
    error,
    mutate,
  }
}
