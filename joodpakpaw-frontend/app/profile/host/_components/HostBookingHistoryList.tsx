'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getHostBookingsPaginated } from '@/lib/api'
import { Booking } from '@/types/booking'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useRouter } from 'next/navigation'
import { parseISO } from 'date-fns'
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
    const fetchBookings = async () => {
      try {
        setLoading(true)
        const res = await getHostBookingsPaginated(1, 20)
        setBookings(res.data)
        setTotalPages(res.totalPages)
        setPage(1)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch host bookings')
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await getHostBookingsPaginated(nextPage, 20)
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
    const names = new Set(historyBookings.map((b) => b.property?.title).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [historyBookings])

  const filteredBookings = useMemo(() => {
    const statusOrder = ['SUCCESSFUL', 'CANCELLED']
    return historyBookings
      .filter((booking) => {
        const status = booking.bookingStatus.toUpperCase()
        const matchesStatus = statusFilter === 'ALL' || status === statusFilter
        const matchesProperty = propertyFilter === 'ALL' || booking.property?.title === propertyFilter
        return matchesStatus && matchesProperty
      })
      .sort((a, b) => {
        const statusA = a.bookingStatus.toUpperCase()
        const statusB = b.bookingStatus.toUpperCase()
        const orderA = statusOrder.indexOf(statusA)
        const orderB = statusOrder.indexOf(statusB)
        if (orderA !== -1 && orderB !== -1 && orderA !== orderB) return orderA - orderB
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime()
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

  const completedCount = statusCounts.SUCCESSFUL || 0
  const cancelledCount = statusCounts.CANCELLED || 0

  const filterStyle = (value: string, isActive: boolean) => {
    if (value === 'ALL') {
      return isActive
        ? 'bg-deep-teal text-white border-deep-teal shadow-sm'
        : 'bg-white text-deep-teal border-deep-teal/40 hover:border-deep-teal hover:bg-deep-teal/10 hover:scale-105'
    }
    if (value === 'SUCCESSFUL') {
      return isActive
        ? 'bg-positive-green text-white border-positive-green shadow-sm'
        : 'bg-white text-positive-green border-positive-green/40 hover:border-positive-green hover:bg-positive-green/10 hover:scale-105'
    }
    return isActive
      ? 'bg-red-500 text-white border-red-500 shadow-sm'
      : 'bg-white text-red-600 border-red-300 hover:border-red-500 hover:bg-red-50 hover:scale-105'
  }

  if (error) return <ErrorState message={error} />

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full overflow-y-auto px-4 md:px-6 lg:px-12 pt-6 pb-12"
        >
          {/* Skeleton header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
            </div>
            <div className="flex gap-2">
              {[80, 100, 90].map((w, i) => (
                <div key={i} className="h-8 rounded-full bg-gray-200 animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>
          {/* Mobile skeleton chips */}
          <div className="flex gap-2 mb-4 lg:hidden">
            {[80, 100, 90].map((w, i) => (
              <div key={i} className="h-8 rounded-full bg-gray-200 animate-pulse" style={{ width: w }} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-5 space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded-full w-20" />
                </div>
                <div className="flex gap-3">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-12" />
                    <div className="h-3.5 bg-gray-200 rounded w-20" />
                  </div>
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-14" />
                    <div className="h-3.5 bg-gray-200 rounded w-20" />
                  </div>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <div className="h-3 bg-gray-200 rounded w-24" />
                  <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex flex-col h-full"
        >
          {/* Desktop header + filters — fixed, not scrollable */}
          <div className="shrink-0 px-4 md:px-6 lg:px-12 pt-4 lg:pt-8">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-deep-teal">Booking History</h2>
              <p className="text-sm text-neutral-gray mt-0.5">
                {historyBookings.length} total
                {completedCount > 0 && ` · ${completedCount} completed`}
                {cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
              </p>
            </div>

            {historyBookings.length > 0 && (
              <div className="flex items-center gap-3">
                <PropertyFilterDropdown
                  value={propertyFilter}
                  onChange={setPropertyFilter}
                  propertyNames={propertyNames}
                />

                {/* Status chips */}
                <div className="flex items-center gap-2">
                  {HISTORY_FILTERS.map((filter) => {
                    const count = statusCounts[filter.value] || 0
                    const isActive = statusFilter === filter.value
                    if (filter.value !== 'ALL' && count === 0) return null
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setStatusFilter(filter.value)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                          filterStyle(filter.value, isActive)
                        )}
                      >
                        {isActive && <Check className="w-3.5 h-3.5" />}
                        {filter.label}
                        {count > 0 && (
                          <span className={cn(
                            'text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5',
                            isActive ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Mobile filter row */}
          {historyBookings.length > 0 && (
            <div className="flex flex-col gap-2 mb-4 lg:hidden">
              <PropertyFilterDropdown
                value={propertyFilter}
                onChange={setPropertyFilter}
                propertyNames={propertyNames}
                className="w-fit"
              />

              {/* Status chips */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {HISTORY_FILTERS.map((filter) => {
                  const count = statusCounts[filter.value] || 0
                  const isActive = statusFilter === filter.value
                  if (filter.value !== 'ALL' && count === 0) return null
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-95',
                        filterStyle(filter.value, isActive)
                      )}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      {filter.label}
                      {count > 0 && (
                        <span className={cn(
                          'text-xs rounded-full min-w-[18px] flex items-center justify-center px-1',
                          isActive ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          </div>{/* end fixed header */}

          {/* Scrollable card area */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-modern px-4 md:px-6 lg:px-12 pb-28 lg:pb-8">
          <AnimatePresence mode="wait">
            {filteredBookings.length > 0 ? (
              <motion.div
                key={`${statusFilter}-${propertyFilter}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                  {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onClick={(id) => router.push(`/profile/host/booking/${id}`)}
                    />
                  ))}
                </div>
                {page < totalPages && (
                  <div className="flex justify-center mt-5">
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
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-20 text-center px-6"
              >
                <History className="w-12 h-12 text-gray-300 mb-3" />
                <h4 className="text-base font-semibold text-gray-600">No history yet</h4>
                <p className="text-sm text-gray-400 mt-1 max-w-[240px]">
                  Completed and cancelled bookings will appear here.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          </div>{/* end scrollable area */}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
