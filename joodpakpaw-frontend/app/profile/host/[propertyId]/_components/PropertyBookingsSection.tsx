'use client'

import React, { useEffect, useState } from 'react'
import { getHostPropertyBookings } from '@/lib/api'
import { Booking } from '@/types/booking'
import { BookingCard } from '@/app/profile/bookings/_components/BookingCard'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const PAGE_LIMIT = 10

interface PropertyBookingsSectionProps {
  propertyId: number
  propertyTitle: string
}

export function PropertyBookingsSection({
  propertyId,
  propertyTitle,
}: PropertyBookingsSectionProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true)
        const res = await getHostPropertyBookings(propertyId.toString(), 1, PAGE_LIMIT)
        setBookings(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
        setPage(1)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch property bookings')
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [propertyId])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await getHostPropertyBookings(propertyId.toString(), nextPage, PAGE_LIMIT)
      setBookings((prev) => [...prev, ...res.data])
      setPage(nextPage)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  const sortedBookings = [...bookings].sort((a, b) => {
    const aIsCancelled = a.bookingStatus.toUpperCase() === 'CANCELLED'
    const bIsCancelled = b.bookingStatus.toUpperCase() === 'CANCELLED'
    if (aIsCancelled && !bIsCancelled) return 1
    if (!aIsCancelled && bIsCancelled) return -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="border-t pt-8 mt-10">
      <h3 className="mb-4 text-deep-teal font-semibold">
        Bookings{totalRows > 0 ? ` (${totalRows})` : ''}
      </h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 overflow-hidden">
              <div className="h-[3px] bg-gray-200 w-full" />
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-gray-200 rounded w-2/5" />
                  <div className="h-5 bg-gray-200 rounded-full w-24" />
                </div>
                <div className="flex rounded-xl overflow-hidden border border-gray-100">
                  <div className="flex-1 bg-gray-50 p-3 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-14" />
                    <div className="h-4 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="w-12 bg-white" />
                  <div className="flex-1 bg-gray-50 p-3 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-14 ml-auto" />
                    <div className="h-4 bg-gray-200 rounded w-16 ml-auto" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : sortedBookings.length === 0 ? (
        <p className="text-neutral-gray text-sm">No bookings found for this property.</p>
      ) : (
        <>
          <div className="space-y-3">
            {sortedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={{
                  ...booking,
                  property: booking.property || { title: propertyTitle, roomCategories: [] },
                }}
                onClick={(id) => router.push(`/profile/host/booking/${id}`)}
              />
            ))}
          </div>

          {page < totalPages && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-deep-teal/40 hover:text-deep-teal transition disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
