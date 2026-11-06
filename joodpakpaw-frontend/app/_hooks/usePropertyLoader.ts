'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { Property } from '@/types'
import { useParams, notFound } from 'next/navigation'

type FetcherFunc = (id: string) => Promise<{ property: Property }>

export function usePropertyLoader(fetcher: FetcherFunc) {
  const params = useParams()
  const rawId = params?.propertyId
  const propertyId = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined)

  const isValidId = Boolean(propertyId && !isNaN(Number(propertyId)))

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(
    isValidId && propertyId ? ['property', propertyId] : null,
    () => fetcher(propertyId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  const is404 =
    !isValidId ||
    Boolean(
      swrError &&
        (swrError.message === 'Resource not found.' ||
          (swrError as any)?.status === 404 ||
          (swrError as any)?.statusCode === 404)
    )

  if (is404) {
    notFound()
  }

  const property = data?.property ?? null
  const loading = isLoading && !property
  const isRefreshing = isValidating && Boolean(property)
  const error = swrError
    ? 'Failed to fetch property details. Please try again later.'
    : null

  const refreshProperty = useCallback(() => {
    mutate()
  }, [mutate])

  return { property, loading, isRefreshing, error, refreshProperty }
}
