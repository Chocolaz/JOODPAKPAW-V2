'use client'

import useSWR from 'swr'
import { getRecommendedProperties } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import type { PropertiesResponse } from '@/types'

export function useRecommendedProperties(
  page = 1,
  limit = 10,
  location?: { lat: number; lng: number } | null
) {
  const { user, loading: authLoading } = useAuth()
  const userIdOrGuest = user?.id ?? 'guest'

  const hasValidLocation =
    location != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  const quantizedLat = hasValidLocation ? Number(location.lat.toFixed(2)) : null
  const quantizedLng = hasValidLocation ? Number(location.lng.toFixed(2)) : null

  const { data, isLoading, isValidating, error, mutate } = useSWR<PropertiesResponse>(
    authLoading
      ? null
      : ['recommended', userIdOrGuest, page, limit, quantizedLat, quantizedLng],
    () =>
      getRecommendedProperties(
        page,
        limit,
        quantizedLat != null && quantizedLng != null
          ? { lat: quantizedLat, lng: quantizedLng }
          : undefined
      ),
    {
      dedupingInterval: 30000,
      revalidateOnFocus: false,
    }
  )

  return {
    properties: data?.data ?? [],
    totalRows: data?.totalRows ?? 0,
    totalPages: data?.totalPages ?? 0,
    meta: data?.meta ?? null,
    isLoading: authLoading || isLoading,
    isValidating,
    error,
    mutate,
  }
}
