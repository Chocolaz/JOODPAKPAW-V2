'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { getBookings } from '@/lib/api'
import { Booking } from '@/types/booking'
import Image from 'next/image'
import { assetPath, cn } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import {
  CalendarCheck,
  History,
  AlertCircle,
  Loader2,
  Search,
  X,
} from 'lucide-react'

const UPCOMING_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PENDING', label: 'Pending payment' },
] as const

const PAST_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'SUCCESSFUL', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const

function BookingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-24" />
      </div>
      <div className="h-20 bg-off-white rounded-xl" />
      <div className="pt-3 border-t border-border flex justify-between items-center">
        <div className="h-3.5 bg-gray-100 rounded w-28" />
        <div className="h-5 bg-gray-100 rounded w-16" />
      </div>
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
    <div className="col-span-full flex flex-col items-center justify-center py-14 text-center px-6 rounded-2xl border border-dashed border-border bg-off-white">
      <Image
        src={assetPath('/graphics/no-booking.png')}
        alt="No bookings"
        width={112}
        height={112}
        className="mb-4 select-none"
      />
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="text-xs text-neutral-gray mt-1 max-w-xs leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const PAGE_LIMIT = 10

export function BookingList() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [upcomingFilter, setUpcomingFilter] = useState('ALL')
  const [pastFilter, setPastFilter] = useState('ALL')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')

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

  const upcomingBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const s = b.bookingStatus.toUpperCase()
        return s === 'CONFIRMED' || s === 'PENDING'
      }),
    [bookings]
  )

  const pastBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const s = b.bookingStatus.toUpperCase()
        return s === 'SUCCESSFUL' || s === 'CANCELLED' || s === 'REJECTED'
      }),
    [bookings]
  )

  const activeBookings =
    activeTab === 'upcoming' ? upcomingBookings : pastBookings
  const activeFilter = activeTab === 'upcoming' ? upcomingFilter : pastFilter
  const setActiveFilter =
    activeTab === 'upcoming' ? setUpcomingFilter : setPastFilter
  const filterDefs =
    activeTab === 'upcoming' ? UPCOMING_FILTERS : PAST_FILTERS

  const activeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: activeBookings.length }
    activeBookings.forEach((b) => {
      const s = b.bookingStatus.toUpperCase()
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [activeBookings])

  const pendingCount = useMemo(
    () =>
      upcomingBookings.filter(
        (b) => b.bookingStatus.toUpperCase() === 'PENDING'
      ).length,
    [upcomingBookings]
  )

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return activeBookings.filter((b) => {
      if (
        activeFilter !== 'ALL' &&
        b.bookingStatus.toUpperCase() !== activeFilter
      ) {
        return false
      }
      if (!q) return true
      const titleMatch = b.property?.title?.toLowerCase().includes(q)
      const idMatch = String(b.id).includes(q)
      const roomMatch = b.property?.roomCategories?.some((r) =>
        r.name?.toLowerCase().includes(q)
      )
      return Boolean(titleMatch || idMatch || roomMatch)
    })
  }, [activeBookings, activeFilter, searchQuery])

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-5">
      {/* Header + Segmented Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-deep-teal leading-tight">
            My bookings
          </h1>
          <p className="text-xs sm:text-sm text-neutral-gray mt-1">
            Pet stays, PromptPay payments, and reviews
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 bg-off-white p-1 rounded-xl border border-border">
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
          ).map(({ value, label, icon: Icon, count }) => {
            const isActive = activeTab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-white text-deep-teal border border-border'
                    : 'text-neutral-gray hover:text-foreground border border-transparent'
                )}
              >
                <Icon className="w-4 h-4 stroke-[1.5]" />
                <span>{label}</span>
                {!loading && count > 0 && (
                  <span className="text-xs font-mono text-neutral-gray tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Pending Payment Alert Banner */}
      {!loading &&
        activeTab === 'upcoming' &&
        pendingCount > 0 &&
        upcomingFilter === 'ALL' && (
          <button
            type="button"
            onClick={() => setUpcomingFilter('PENDING')}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 stroke-[1.5] text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900 tabular-nums">
                  {pendingCount} booking{pendingCount > 1 ? 's' : ''} awaiting
                  payment
                </p>
                <p className="text-xs text-amber-800 truncate">
                  Complete PromptPay transfer before the deadline to keep your
                  room
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-900 whitespace-nowrap shrink-0">
              View &rarr;
            </span>
          </button>
        )}

      {/* Filter Pills + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterDefs.map((filter) => {
            const isActive = activeFilter === filter.value
            const count = activeCounts[filter.value] ?? 0
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border whitespace-nowrap transition-colors cursor-pointer',
                  isActive
                    ? 'bg-deep-teal text-white border-deep-teal'
                    : 'bg-white text-neutral-gray border-border hover:border-deep-teal/40 hover:text-foreground'
                )}
              >
                <span>{filter.label}</span>
                {!loading && count > 0 && (
                  <span
                    className={cn(
                      'text-xs font-mono tabular-nums',
                      isActive ? 'text-white/80' : 'text-neutral-gray'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 stroke-[1.5] text-neutral-gray absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings"
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-white border border-border text-foreground placeholder:text-neutral-gray focus:outline-none focus:border-deep-teal transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-gray hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Bookings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          ) : activeBookings.length === 0 ? (
            <EmptyState
              title={
                activeTab === 'upcoming'
                  ? 'No upcoming stays'
                  : 'No past bookings yet'
              }
              description={
                activeTab === 'upcoming'
                  ? 'Book a pet boarding stay to see your upcoming reservations here'
                  : 'Completed and cancelled stays will appear here'
              }
            />
          ) : (
            <EmptyState
              title="No matching bookings"
              description="Try clearing your search or switching status filters"
            />
          )}
        </div>
      )}

      {/* Load More */}
      {!loading && page < totalPages && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-deep-teal bg-white border border-border rounded-xl hover:border-deep-teal/40 hover:bg-off-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loadingMore && <Loader2 className="w-4 h-4 stroke-[1.5] animate-spin" />}
            {loadingMore ? 'Loading' : 'Load more bookings'}
          </button>
        </div>
      )}
    </div>
  )
}
