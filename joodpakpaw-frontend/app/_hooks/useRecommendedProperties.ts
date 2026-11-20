'use client'

import useSWR from 'swr'
import { getRecommendedProperties } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import type { PropertiesResponse } from '@/types'

export function useRecommendedProperties(page = 1, limit = 10) {
  const { user, loading: authLoading } = useAuth()
  const userIdOrGuest = user?.id ?? 'guest'

  const { data, isLoading, isValidating, error, mutate } = useSWR<PropertiesResponse>(
    authLoading ? null : ['recommended', userIdOrGuest, page, limit],
    () => getRecommendedProperties(page, limit),
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
