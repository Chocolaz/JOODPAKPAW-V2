'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { getHostPropertyBookings } from '@/lib/api'
import { Booking } from '@/types/booking'
import { BookingCard } from '@/app/profile/bookings/_components/BookingCard'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useRouter } from 'next/navigation'
import { Loader2, CalendarX2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_LIMIT = 10

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'SUCCESSFUL', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const

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
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    getHostPropertyBookings(propertyId.toString(), 1, PAGE_LIMIT)
      .then((res) => {
        if (cancelled) return
        setBookings(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
        setPage(1)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch property bookings'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await getHostPropertyBookings(
        propertyId.toString(),
        nextPage,
        PAGE_LIMIT
      )
      setBookings((prev) => [...prev, ...res.data])
      setPage(nextPage)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: bookings.length }
    for (const b of bookings) {
      const st = b.bookingStatus.toUpperCase()
      map[st] = (map[st] || 0) + 1
    }
    return map
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const statusOrder = ['PENDING', 'CONFIRMED', 'SUCCESSFUL', 'CANCELLED']
    return bookings
      .filter(
        (b) =>
          statusFilter === 'ALL' ||
          b.bookingStatus.toUpperCase() === statusFilter
      )
      .sort((a, b) => {
        const orderA = statusOrder.indexOf(a.bookingStatus.toUpperCase())
        const orderB = statusOrder.indexOf(b.bookingStatus.toUpperCase())
        if (orderA !== -1 && orderB !== -1 && orderA !== orderB) {
          return orderA - orderB
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      })
  }, [bookings, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-deep-teal font-semibold tabular-nums">
          Property Bookings{totalRows > 0 ? ` (${totalRows})` : ''}
        </h3>
      </div>

      {!loading && !error && bookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const count = counts[opt.value] || 0
            if (opt.value !== 'ALL' && count === 0) return null
            const active = statusFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
                  active
                    ? 'bg-deep-teal text-white border-deep-teal'
                    : 'bg-white text-neutral-gray border-border hover:border-deep-teal'
                )}
              >
                {opt.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[11px] px-1.5 rounded-full',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-off-white text-neutral-gray'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse motion-reduce:animate-none rounded-2xl border border-border p-4 space-y-3 bg-white"
            >
              <div className="flex justify-between items-start">
                <div className="h-4 bg-gray-200 rounded w-2/5" />
                <div className="h-5 bg-gray-200 rounded-full w-24" />
              </div>
              <div className="h-16 rounded-xl bg-gray-100" />
              <div className="flex justify-between">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredBookings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-off-white/40 p-10 text-center space-y-2">
          <CalendarX2 className="w-8 h-8 text-neutral-gray/50 mx-auto" />
          <p className="text-sm font-medium text-foreground">
            {bookings.length === 0
              ? 'No bookings found for this property yet.'
              : 'No bookings match this filter.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={{
                  ...booking,
                  property: booking.property || {
                    id: propertyId,
                    title: propertyTitle,
                    roomCategories: [],
                  },
                }}
                role="host"
                onClick={(id) => router.push(`/profile/host/booking/${id}`)}
              />
            ))}
          </div>

          {page < totalPages && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-5 py-2 rounded-full border border-border text-xs font-medium text-neutral-gray hover:border-deep-teal hover:text-deep-teal transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
