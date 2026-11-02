'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getHostBookingById } from '@/lib/api'
import { HostBookingDetail } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
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
      setIsLoading(true)
      const data = await getHostBookingById(bookingId as string)
      setBookingDetails(data)
    } catch (err) {
      console.error('Failed to fetch booking details:', err)
      setError('Failed to load booking details.')
      toast.error('Failed to load booking details.')
    } finally {
      setIsLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    fetchBookingDetails()
  }, [fetchBookingDetails])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 mt-10">
        <p>{error}</p>
      </div>
    )
  }

  if (!bookingDetails) {
    return (
      <div className="text-center text-gray-500 mt-10">
        <p>No booking details found.</p>
      </div>
    )
  }

  return (
    <>
      <HostBookingDetailDisplay
        bookingDetails={bookingDetails}
        refreshBooking={fetchBookingDetails}
      />
    </>
  )
}
