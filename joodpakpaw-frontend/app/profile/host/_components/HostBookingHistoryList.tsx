'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { getHostBookingsPaginated } from '@/lib/api'
import { Booking } from '@/types/booking'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useRouter } from 'next/navigation'
import { BookingCard } from '@/app/profile/bookings/_components/BookingCard'
import { cn } from '@/lib/utils'
import { History, Check, Loader2 } from 'lucide-react'
import { PropertyFilterDropdown } from './PropertyFilterDropdown'

const HISTORY_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'SUCCESSFUL', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const

export function HostBookingHistoryList() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [propertyFilter, setPropertyFilter] = useState('ALL')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    getHostBookingsPaginated(1, 30)
      .then((res) => {
        if (cancelled) return
        setBookings(res.data)
        setTotalPages(res.totalPages)
        setPage(1)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch booking history'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await getHostBookingsPaginated(nextPage, 30)
      setBookings((prev) => [...prev, ...res.data])
      setPage(nextPage)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  const historyBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const status = booking.bookingStatus.toUpperCase()
      return status === 'SUCCESSFUL' || status === 'CANCELLED'
    })
  }, [bookings])

  const propertyNames = useMemo(() => {
    const names = new Set(
      historyBookings.map((b) => b.property?.title).filter(Boolean)
    )
    return Array.from(names).sort() as string[]
  }, [historyBookings])

  const filteredBookings = useMemo(() => {
    const statusOrder = ['SUCCESSFUL', 'CANCELLED']
    return historyBookings
      .filter((booking) => {
        const status = booking.bookingStatus.toUpperCase()
        const matchesStatus =
          statusFilter === 'ALL' || status === statusFilter
        const matchesProperty =
          propertyFilter === 'ALL' ||
          booking.property?.title === propertyFilter
        return matchesStatus && matchesProperty
      })
      .sort((a, b) => {
        const orderA = statusOrder.indexOf(a.bookingStatus.toUpperCase())
        const orderB = statusOrder.indexOf(b.bookingStatus.toUpperCase())
        if (orderA !== -1 && orderB !== -1 && orderA !== orderB) {
          return orderA - orderB
        }
        return (
          new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime()
        )
      })
  }, [historyBookings, statusFilter, propertyFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    historyBookings.forEach((booking) => {
      const status = booking.bookingStatus.toUpperCase()
      counts.ALL = (counts.ALL || 0) + 1
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [historyBookings])

  const completedRevenue = useMemo(
    () =>
      historyBookings
        .filter((b) => b.bookingStatus.toUpperCase() === 'SUCCESSFUL')
        .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0),
    [historyBookings]
  )

  const filterStyle = (value: string, isActive: boolean) => {
    if (value === 'ALL') {
      return isActive
        ? 'bg-deep-teal text-white border-deep-teal'
        : 'bg-white text-deep-teal border-border hover:border-deep-teal'
    }
    if (value === 'SUCCESSFUL') {
      return isActive
        ? 'bg-emerald-700 text-white border-emerald-700'
        : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-500'
    }
    return isActive
      ? 'bg-red-600 text-white border-red-600'
      : 'bg-white text-red-700 border-red-200 hover:border-red-400'
  }

  if (error) return <ErrorState message={error} />

  const completedCount = statusCounts.SUCCESSFUL || 0
  const cancelledCount = statusCounts.CANCELLED || 0

  return (
    <div className="space-y-5">
      {/* Header + Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-deep-teal">Booking History</h1>
          <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
            {historyBookings.length} past bookings ({completedCount} completed, {cancelledCount} cancelled)
          </p>
        </div>

        {completedCount > 0 && (
          <div className="px-4 py-2 rounded-xl bg-off-white border border-border text-xs">
            <span className="text-neutral-gray">Completed stay volume </span>
            <span className="font-bold text-deep-teal tabular-nums text-sm ml-1">
              ฿{completedRevenue.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      {!loading && historyBookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {HISTORY_FILTERS.map((filter) => {
            const count = statusCounts[filter.value] || 0
            const isActive = statusFilter === filter.value
            if (filter.value !== 'ALL' && count === 0) return null
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  filterStyle(filter.value, isActive)
                )}
              >
                {isActive && <Check className="w-3.5 h-3.5" />}
                {filter.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[11px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 tabular-nums',
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-off-white text-neutral-gray'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          <PropertyFilterDropdown
            value={propertyFilter}
            onChange={setPropertyFilter}
            propertyNames={propertyNames}
            className="ml-auto shrink-0"
          />
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse motion-reduce:animate-none rounded-2xl border border-border p-5 space-y-3"
            >
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-5 bg-gray-200 rounded-full w-20" />
              </div>
              <div className="h-20 bg-gray-100 rounded-xl" />
              <div className="flex justify-between pt-2">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBookings.length > 0 ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
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
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6 rounded-2xl border border-border bg-off-white/40">
          <History className="w-10 h-10 text-neutral-gray/50 mb-3" />
          <h4 className="text-foreground">No booking history yet</h4>
          <p className="text-xs text-neutral-gray mt-1 max-w-[260px]">
            Completed and cancelled reservations will appear here once processed.
          </p>
        </div>
      )}
    </div>
  )
}
