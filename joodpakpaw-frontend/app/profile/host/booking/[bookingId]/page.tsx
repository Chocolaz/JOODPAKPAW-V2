'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { getHostBookingById } from '@/lib/api'
import { HostBookingDetail } from '@/types'
import { toast } from 'sonner'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import {
  classifyNavigationError,
  parsePositiveIntParam,
} from '@/lib/navigationGuard'
import HostBookingDetailDisplay from './_components/HostBookingDetailDisplay'

export default function HostBookingDetailPage() {
  const { bookingId } = useParams()
  const router = useRouter()
  const validBookingId = parsePositiveIntParam(bookingId)
  const [bookingDetails, setBookingDetails] =
    useState<HostBookingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(validBookingId !== null)
  const [error, setError] = useState<string | null>(null)
  const [guardState, setGuardState] = useState<
    'ok' | 'forbidden' | 'unauthorized' | 'not_found'
  >('ok')

  const fetchBookingDetails = useCallback(async () => {
    if (validBookingId === null) return
    try {
      const data = await getHostBookingById(String(validBookingId))
      setBookingDetails(data)
      setError(null)
    } catch (err) {
      const kind = classifyNavigationError(err)
      if (kind === 'forbidden') {
        setGuardState('forbidden')
        router.replace('/forbidden')
        return
      }
      if (kind === 'unauthorized') {
        setGuardState('unauthorized')
        router.replace('/profile')
        return
      }
      if (kind === 'not_found') {
        setGuardState('not_found')
        return
      }
      setError('Failed to load booking details.')
      toast.error('Failed to load booking details.')
    } finally {
      setIsLoading(false)
    }
  }, [validBookingId, router])

  useEffect(() => {
    if (validBookingId !== null) {
      void fetchBookingDetails()
    }
  }, [validBookingId, fetchBookingDetails])

  if (validBookingId === null || guardState === 'not_found') {
    notFound()
  }

  if (guardState === 'forbidden' || guardState === 'unauthorized') {
    return null
  }

  if (isLoading) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-5">
        <div className="h-8 w-52 bg-gray-200 rounded-lg animate-pulse motion-reduce:animate-none" />
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 space-y-4 lg:space-y-0">
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
            <div className="h-36 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
            <div className="h-48 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-72 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  if (!bookingDetails) {
    return <ErrorState message="No booking details found." />
  }

  return (
    <HostBookingDetailDisplay
      bookingDetails={bookingDetails}
      refreshBooking={fetchBookingDetails}
    />
  )
}
