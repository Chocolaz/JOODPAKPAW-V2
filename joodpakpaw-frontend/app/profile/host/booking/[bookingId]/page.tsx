'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getHostBookingById } from '@/lib/api'
import { HostBookingDetail } from '@/types'
import { toast } from 'sonner'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import HostBookingDetailDisplay from './_components/HostBookingDetailDisplay'

export default function HostBookingDetailPage() {
  const { bookingId } = useParams()
  const [bookingDetails, setBookingDetails] =
    useState<HostBookingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) return
    try {
      const data = await getHostBookingById(bookingId as string)
      setBookingDetails(data)
      setError(null)
    } catch {
      setError('Failed to load booking details.')
      toast.error('Failed to load booking details.')
    } finally {
      setIsLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void fetchBookingDetails()
  }, [fetchBookingDetails])

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
