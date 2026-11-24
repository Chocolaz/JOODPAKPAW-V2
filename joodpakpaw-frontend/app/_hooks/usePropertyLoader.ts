'use client'

import { useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { Property } from '@/types'
import { useParams, useRouter, notFound } from 'next/navigation'
import {
  classifyNavigationError,
  getSingleParam,
  isPositiveIntParam,
} from '@/lib/navigationGuard'

type FetcherFunc = (id: string) => Promise<{ property: Property }>
export type PropertyLoaderScope = 'public-property' | 'host-property'

export function usePropertyLoader(
  fetcher: FetcherFunc,
  cacheScope: PropertyLoaderScope = 'public-property'
) {
  const params = useParams()
  const router = useRouter()
  const propertyId = getSingleParam(params?.propertyId)
  const isValidId = isPositiveIntParam(propertyId)

  const {
    data,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(
    isValidId && propertyId ? [cacheScope, propertyId] : null,
    () => fetcher(propertyId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      shouldRetryOnError: (err) => classifyNavigationError(err) === 'error',
    }
  )

  const errorKind = swrError ? classifyNavigationError(swrError) : null
  const accessDenied = errorKind === 'forbidden'
  const unauthorized = errorKind === 'unauthorized'

  const refreshProperty = useCallback(() => {
    mutate()
  }, [mutate])

  useEffect(() => {
    if (accessDenied) {
      router.replace('/forbidden')
    } else if (unauthorized) {
      router.replace(cacheScope === 'host-property' ? '/profile' : '/authen')
    }
  }, [accessDenied, unauthorized, cacheScope, router])

  if (!isValidId || errorKind === 'not_found') {
    notFound()
  }

  const property = accessDenied || unauthorized ? null : data?.property ?? null
  const loading = isLoading && !property && !accessDenied && !unauthorized
  const isRefreshing = isValidating && Boolean(property)
  const error =
    swrError && errorKind === 'error'
      ? 'Failed to fetch property details. Please try again later.'
      : null

  return {
    property,
    loading,
    isRefreshing,
    error,
    accessDenied,
    unauthorized,
    refreshProperty,
  }
}
