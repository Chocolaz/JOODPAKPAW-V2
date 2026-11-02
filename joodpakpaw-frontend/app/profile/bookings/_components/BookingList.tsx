'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getBookings } from '@/lib/api'
import { Booking } from '@/types/booking'
import Image from 'next/image'
import { assetPath } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  CalendarCheck,
  History,
  AlertCircle,
  ChevronLeft,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const UPCOMING_FILTERS = [
  { value: 'ALL', label: 'All' },
  {
    value: 'CONFIRMED',
    label: 'Confirmed',
    color: 'bg-green-100 text-green-700 border-green-300',
  },
  {
    value: 'PENDING',
    label: 'Pending',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
  },
] as const

const PAST_FILTERS = [
  { value: 'ALL', label: 'All' },
  {
    value: 'SUCCESSFUL',
    label: 'Completed',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 border-red-300',
  },
] as const

function BookingCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 overflow-hidden">
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
            <div className="h-2.5 bg-gray-200 rounded w-20" />
          </div>
          <div className="w-12 bg-white" />
          <div className="flex-1 bg-gray-50 p-3 space-y-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-14 ml-auto" />
            <div className="h-4 bg-gray-200 rounded w-16 ml-auto" />
            <div className="h-2.5 bg-gray-200 rounded w-20 ml-auto" />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            <div className="h-3 bg-gray-200 rounded w-14" />
            <div className="h-3 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

function FilterChips({
  filters,
  activeFilter,
  counts,
  onFilterChange,
}: {
  filters: readonly { value: string; label: string; color?: string }[]
  activeFilter: string
  counts: Record<string, number>
  onFilterChange: (value: string) => void
}) {
  return (
    <div className="flex gap-2 px-3 sm:px-4 py-2.5 overflow-x-auto hide-scrollbar">
      {filters.map((filter) => {
        const count = counts[filter.value] || 0
        const isActive = activeFilter === filter.value

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all duration-200',
              isActive
                ? filter.value === 'ALL'
                  ? 'bg-deep-teal text-white border-deep-teal'
                  : filter.color
                : 'bg-white text-gray-500 border-gray-200'
            )}
          >
            {filter.label}
            {count > 0 && (
              <span
                className={cn(
                  'text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5',
                  isActive
                    ? filter.value === 'ALL'
                      ? 'bg-white/20'
                      : 'bg-black/10'
                    : 'bg-gray-100'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <Image
        src={assetPath('/graphics/no-booking.png')}
        alt="No bookings"
        width={120}
        height={120}
        className="mb-4 select-none"
      />
      <h4 className="text-sm font-semibold text-gray-600">{title}</h4>
      <p className="text-xs text-gray-400 mt-1 max-w-[220px] leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const PAGE_LIMIT = 10

export function BookingList() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [upcomingFilter, setUpcomingFilter] = useState('ALL')
  const [pastFilter, setPastFilter] = useState('ALL')

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true)
        const res = await getBookings(1, PAGE_LIMIT)
        setBookings(res.data)
        setTotalPages(res.totalPages)
        setPage(1)
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch bookings'
        )
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
      const res = await getBookings(nextPage, PAGE_LIMIT)
      setBookings((prev) => [...prev, ...res.data])
      setPage(nextPage)
      setTotalPages(res.totalPages)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoadingMore(false)
    }
  }

  // Split bookings into upcoming and past
  const upcomingBookings = useMemo(() => {
    return bookings.filter((b) => {
      const status = b.bookingStatus.toUpperCase()
      return status === 'CONFIRMED' || status === 'PENDING'
    })
  }, [bookings])

  const pastBookings = useMemo(() => {
    return bookings.filter((b) => {
      const status = b.bookingStatus.toUpperCase()
      return status === 'SUCCESSFUL' || status === 'CANCELLED'
    })
  }, [bookings])

  // Counts
  const upcomingCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: upcomingBookings.length }
    upcomingBookings.forEach((b) => {
      const status = b.bookingStatus.toUpperCase()
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [upcomingBookings])

  const pastCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: pastBookings.length }
    pastBookings.forEach((b) => {
      const status = b.bookingStatus.toUpperCase()
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [pastBookings])

  // Filtered & sorted
  const filteredUpcoming = useMemo(() => {
    return upcomingBookings
      .filter((b) => {
        const status = b.bookingStatus.toUpperCase()
        return upcomingFilter === 'ALL' || status === upcomingFilter
      })
      .sort((a, b) => {
        // Pending first, then confirmed
        const statusOrder = ['PENDING', 'CONFIRMED']
        const orderA = statusOrder.indexOf(a.bookingStatus.toUpperCase())
        const orderB = statusOrder.indexOf(b.bookingStatus.toUpperCase())
        if (orderA !== orderB) return orderA - orderB
        // Soonest check-in first
        return (
          new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
        )
      })
  }, [upcomingBookings, upcomingFilter])

  const filteredPast = useMemo(() => {
    return pastBookings
      .filter((b) => {
        const status = b.bookingStatus.toUpperCase()
        return pastFilter === 'ALL' || status === pastFilter
      })
      .sort((a, b) => {
        // Most recent first
        return (
          new Date(b.checkOutDate).getTime() -
          new Date(a.checkOutDate).getTime()
        )
      })
  }, [pastBookings, pastFilter])

  const pendingCount = upcomingCounts.PENDING || 0

  if (error) {
    return <ErrorState message={error} />
  }

  // Default tab: show upcoming if there are any, otherwise past
  const defaultTab =
    upcomingBookings.length > 0 || pastBookings.length === 0
      ? 'upcoming'
      : 'past'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>(
    defaultTab as 'upcoming' | 'past'
  )

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full"
        >
          {/* Skeleton tabs — mobile */}
          <div className="md:hidden flex border-b border-gray-100 py-2 px-4 gap-6 justify-center">
            <div className="animate-pulse h-5 bg-gray-200 rounded w-20" />
            <div className="animate-pulse h-5 bg-gray-200 rounded w-14" />
          </div>
          {/* Skeleton header — desktop */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full" />
              <div className="w-px h-5 bg-gray-200" />
              <div className="animate-pulse h-5 bg-gray-200 rounded w-28" />
            </div>
            <div className="animate-pulse h-10 bg-gray-200 rounded-xl w-52" />
          </div>
          {/* Skeleton filter chips */}
          <div className="flex gap-2 px-3 sm:px-4 py-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div
                  className="h-8 rounded-full bg-gray-200"
                  style={{ width: `${52 + i * 16}px` }}
                />
              </div>
            ))}
          </div>
          {/* Skeleton booking cards */}
          <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
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
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}
            className="w-full flex flex-col flex-1"
          >
            {/* ── Mobile tab bar ── */}
            <TabsList className="md:hidden grid w-full grid-cols-2 sticky top-14 z-10 rounded-none h-11 bg-gray-50/80 backdrop-blur-sm">
              <TabsTrigger value="upcoming" className="text-sm gap-1.5">
                <CalendarCheck className="w-4 h-4" />
                Upcoming
                {upcomingBookings.length > 0 && (
                  <span className="text-[10px] bg-deep-teal/10 text-deep-teal rounded-full px-1.5 py-0.5 font-semibold">
                    {upcomingBookings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="past" className="text-sm gap-1.5">
                <History className="w-4 h-4" />
                Past
                {pastBookings.length > 0 && (
                  <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 font-semibold">
                    {pastBookings.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Desktop header ── */}
            <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-500 hover:text-gray-800"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-px h-5 bg-gray-200" />
                <h1 className="text-base font-semibold text-gray-900">
                  My Bookings
                </h1>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {(
                  [
                    {
                      value: 'upcoming',
                      label: 'Upcoming',
                      icon: CalendarCheck,
                      count: upcomingBookings.length,
                    },
                    {
                      value: 'past',
                      label: 'Past',
                      icon: History,
                      count: pastBookings.length,
                    },
                  ] as const
                ).map(({ value, label, icon: Icon, count }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      activeTab === value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {count > 0 && (
                      <span
                        className={cn(
                          'text-[11px] font-semibold rounded-full px-1.5 py-0.5 leading-none',
                          activeTab === value
                            ? value === 'upcoming'
                              ? 'bg-deep-teal/10 text-deep-teal'
                              : 'bg-gray-100 text-gray-500'
                            : 'bg-gray-200/80 text-gray-500'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ===== UPCOMING TAB ===== */}
            <TabsContent value="upcoming" className="mt-0 flex-1 flex flex-col">
              {/* Pending alert */}
              {pendingCount > 0 && upcomingFilter === 'ALL' && (
                <button
                  onClick={() => setUpcomingFilter('PENDING')}
                  className="mx-3 sm:mx-4 mt-3 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl hover:bg-amber-100 transition text-left"
                >
                  <span className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </span>
                  <p className="text-sm text-amber-800 flex-1 min-w-0">
                    <span className="font-semibold">{pendingCount}</span>{' '}
                    booking{pendingCount > 1 ? 's' : ''} awaiting payment
                  </p>
                  <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                    View →
                  </span>
                </button>
              )}

              <FilterChips
                filters={UPCOMING_FILTERS}
                activeFilter={upcomingFilter}
                counts={upcomingCounts}
                onFilterChange={setUpcomingFilter}
              />

              <div className="grow overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 max-w-xl mx-auto w-full">
                {filteredUpcoming.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {filteredUpcoming.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                ) : upcomingBookings.length === 0 ? (
                  <EmptyState
                    title="No upcoming bookings"
                    description="When you book a pet hotel, your upcoming stays will appear here."
                  />
                ) : (
                  <EmptyState
                    title={
                      upcomingFilter === 'CONFIRMED'
                        ? 'No confirmed bookings'
                        : 'No pending bookings'
                    }
                    description={
                      upcomingFilter === 'CONFIRMED'
                        ? 'Your confirmed bookings will show up here.'
                        : 'No bookings awaiting payment right now.'
                    }
                  />
                )}
              </div>
            </TabsContent>

            {/* ===== PAST TAB ===== */}
            <TabsContent value="past" className="mt-0 flex-1 flex flex-col">
              <FilterChips
                filters={PAST_FILTERS}
                activeFilter={pastFilter}
                counts={pastCounts}
                onFilterChange={setPastFilter}
              />

              <div className="grow overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 max-w-xl mx-auto w-full">
                {filteredPast.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {filteredPast.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                ) : pastBookings.length === 0 ? (
                  <EmptyState
                    title="No past bookings"
                    description="Your completed and cancelled stays will appear here."
                  />
                ) : (
                  <EmptyState
                    title={
                      pastFilter === 'SUCCESSFUL'
                        ? 'No completed stays'
                        : 'No cancellations'
                    }
                    description={
                      pastFilter === 'SUCCESSFUL'
                        ? 'Your completed stays will appear here.'
                        : 'You have no cancelled bookings.'
                    }
                  />
                )}
              </div>
            </TabsContent>

            {/* Load more — only shown on Past tab since upcoming bookings fit in first page */}
            {activeTab === 'past' && page < totalPages && (
              <div className="flex justify-center py-4 px-4">
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
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
