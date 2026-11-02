'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getHostBookingsPaginated } from '@/lib/api'
import { Booking } from '@/types/booking'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useRouter } from 'next/navigation'
import {
  format,
  getYear,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { BookingCard } from '@/app/profile/bookings/_components/BookingCard'
import { cn } from '@/lib/utils'
import { CalendarX2, AlertCircle, Loader2 } from 'lucide-react'
import { PropertyFilterDropdown } from './PropertyFilterDropdown'

// { 'yyyy-MM': bookingCount } — how many bookings the user last saw for that month
const SEEN_KEY = 'host-bookings-seen'

function loadSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveSeen(seen: Record<string, number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {}
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'PENDING', label: 'Pending', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-300' },
] as const

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  ALL: { title: 'No bookings this month', description: 'Bookings for this month will appear here.' },
  CONFIRMED: { title: 'No confirmed bookings', description: 'Confirmed bookings for this month will appear here.' },
  PENDING: { title: 'No pending bookings', description: "You're all caught up! No bookings waiting for action." },
  CANCELLED: { title: 'No cancellations', description: 'No cancelled bookings for this month.' },
}

type MonthItem = { type: 'month'; date: Date } | { type: 'year'; year: number }

export function HostBookingList() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [seen, setSeen] = useState<Record<string, number>>(loadSeen)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [propertyFilter, setPropertyFilter] = useState('ALL')
  const monthScrollRef = useRef<HTMLDivElement>(null)
  const monthButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
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

  const scrollToMonth = useCallback((date: Date) => {
    const key = format(date, 'yyyy-MM')
    const button = monthButtonRefs.current.get(key)
    if (button && monthScrollRef.current) {
      const container = monthScrollRef.current
      const scrollLeft = button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      setTimeout(() => scrollToMonth(selectedMonth), 100)
    }
  }, [loading, scrollToMonth, selectedMonth])

  // Derive month range from actual booking check-in dates so past/future years are reachable
  const months = useMemo(() => {
    const now = new Date()
    const activeDates = bookings
      .filter((b) => b.bookingStatus.toUpperCase() !== 'SUCCESSFUL')
      .map((b) => parseISO(b.checkInDate))
    const dates = activeDates.length > 0 ? activeDates : [now]
    const earliest = dates.reduce((a, b) => (a < b ? a : b))
    const latest = dates.reduce((a, b) => (a > b ? a : b))
    return eachMonthOfInterval({
      start: startOfYear(earliest < now ? earliest : now),
      end: endOfYear(latest > now ? latest : now),
    })
  }, [bookings])

  // Flat list with year-label separators when bookings span multiple years
  const monthItems = useMemo((): MonthItem[] => {
    const spansYears = months.length > 0 && getYear(months[0]) !== getYear(months[months.length - 1])
    if (!spansYears) return months.map((date) => ({ type: 'month', date }))

    const items: MonthItem[] = []
    let lastYear = -1
    for (const date of months) {
      const y = getYear(date)
      if (y !== lastYear) {
        items.push({ type: 'year', year: y })
        lastYear = y
      }
      items.push({ type: 'month', date })
    }
    return items
  }, [months])

  // Map of 'yyyy-MM' → booking count (active only) for dot + unread logic
  const monthBookingCounts = useMemo(() => {
    const map = new Map<string, number>()
    bookings.forEach((b) => {
      if (b.bookingStatus.toUpperCase() === 'SUCCESSFUL') return
      const key = format(parseISO(b.checkInDate), 'yyyy-MM')
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [bookings])

  const propertyNames = useMemo(() => {
    const names = new Set(
      bookings
        .filter((b) => b.bookingStatus.toUpperCase() !== 'SUCCESSFUL')
        .map((b) => b.property?.title)
        .filter(Boolean)
    )
    return Array.from(names).sort() as string[]
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const statusOrder = ['CONFIRMED', 'PENDING', 'SUCCESSFUL', 'CANCELLED']
    return bookings
      .filter((booking) => {
        const status = booking.bookingStatus.toUpperCase()
        const inMonth = isSameMonth(parseISO(booking.checkInDate), selectedMonth)
        const notSuccessful = status !== 'SUCCESSFUL'
        const matchesFilter = statusFilter === 'ALL' || status === statusFilter
        const matchesProperty = propertyFilter === 'ALL' || booking.property?.title === propertyFilter
        return inMonth && notSuccessful && matchesFilter && matchesProperty
      })
      .sort((a, b) => {
        const orderA = statusOrder.indexOf(a.bookingStatus.toUpperCase())
        const orderB = statusOrder.indexOf(b.bookingStatus.toUpperCase())
        if (orderA !== orderB) return orderA - orderB
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
      })
  }, [bookings, selectedMonth, statusFilter, propertyFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    bookings.forEach((booking) => {
      const status = booking.bookingStatus.toUpperCase()
      if (status === 'SUCCESSFUL') return
      if (!isSameMonth(parseISO(booking.checkInDate), selectedMonth)) return
      counts.ALL = (counts.ALL || 0) + 1
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [bookings, selectedMonth])

  const markMonthSeen = useCallback((month: Date) => {
    const key = format(month, 'yyyy-MM')
    const count = monthBookingCounts.get(key) ?? 0
    setSeen((prev) => {
      if (prev[key] === count) return prev
      const updated = { ...prev, [key]: count }
      saveSeen(updated)
      return updated
    })
  }, [monthBookingCounts])

  // Auto-mark the currently viewed month as seen whenever bookings load/change
  useEffect(() => {
    if (!loading) markMonthSeen(selectedMonth)
  }, [loading, selectedMonth, markMonthSeen])

  const handleMonthSelect = (month: Date) => {
    setSelectedMonth(month)
    setStatusFilter('ALL')
    setPropertyFilter('ALL')
    markMonthSeen(month)
  }

  if (error) return <ErrorState message={error} />

  const pendingCount = statusCounts.PENDING || 0
  const emptyMsg = EMPTY_MESSAGES[statusFilter] || EMPTY_MESSAGES.ALL

  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full"
        >
          <div className="flex gap-4 p-3 sm:p-4 border-b overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-8 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-3 sm:px-4 py-2.5 border-b border-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 rounded-full bg-gray-200" style={{ width: `${60 + i * 16}px` }} />
              </div>
            ))}
          </div>
          <div className="p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-4 sm:p-5 space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded-full w-16" />
                </div>
                <div className="flex gap-3">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-200 rounded w-14" />
                </div>
                <div className="grid grid-cols-2 gap-3 bg-gray-100 rounded-lg p-3">
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-12" />
                    <div className="h-3.5 bg-gray-200 rounded w-20" />
                  </div>
                  <div className="space-y-1.5">
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
          {/* Pending alert */}
          {pendingCount > 0 && statusFilter === 'ALL' && (
            <div className="flex items-center gap-2.5 mx-3 sm:mx-4 mt-3 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl shrink-0">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              <p className="text-xs sm:text-sm text-amber-800 min-w-0">
                <span className="font-semibold">{pendingCount}</span> booking{pendingCount > 1 ? 's' : ''} awaiting response
              </p>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className="ml-auto text-xs sm:text-sm font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
              >
                View
              </button>
            </div>
          )}

          {/* Month selector */}
          <div
            ref={monthScrollRef}
            className="overflow-x-auto whitespace-nowrap hide-scrollbar border-b shrink-0"
          >
            <div className="inline-flex items-end gap-1 px-3 sm:px-4 pt-2 pb-0 md:justify-center md:w-full">
              {monthItems.map((item, idx) => {
                if (item.type === 'year') {
                  return (
                    <span
                      key={`year-${item.year}`}
                      className="text-[10px] font-semibold text-gray-300 px-2 pb-2.5 tracking-wider self-end"
                    >
                      {item.year}
                    </span>
                  )
                }

                const monthStr = format(item.date, 'yyyy-MM')
                const count = monthBookingCounts.get(monthStr) ?? 0
                const hasBooking = count > 0
                const isUnread = hasBooking && (seen[monthStr] ?? -1) < count
                const isSelected = isSameMonth(item.date, selectedMonth)

                return (
                  <button
                    key={monthStr}
                    ref={(el) => { if (el) monthButtonRefs.current.set(monthStr, el) }}
                    onClick={() => handleMonthSelect(item.date)}
                    className={cn(
                      'relative px-2.5 pt-1 pb-2.5 text-sm font-medium transition-colors duration-200',
                      isSelected
                        ? 'text-deep-teal border-b-2 border-deep-teal'
                        : hasBooking
                        ? 'text-gray-700 hover:text-deep-teal'
                        : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {format(item.date, 'MMM')}
                    {isUnread && !isSelected && (
                      <span className="absolute top-0.5 right-0 h-1.5 w-1.5 rounded-full bg-accent-orange" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filter bar — chips + property dropdown in one row */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 overflow-x-auto hide-scrollbar shrink-0 border-b border-gray-100">
            {STATUS_FILTERS.map((filter) => {
              const count = statusCounts[filter.value] || 0
              const isActive = statusFilter === filter.value
              return (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-95',
                    isActive
                      ? filter.value === 'ALL'
                        ? 'bg-deep-teal text-white border-deep-teal shadow-sm'
                        : filter.color + ' shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 hover:scale-105'
                  )}
                >
                  {filter.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5',
                        isActive
                          ? filter.value === 'ALL' ? 'bg-white/20' : 'bg-black/10'
                          : 'bg-gray-100'
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

          {/* Scrollable card area */}
          <div className="grow min-h-0 overflow-y-auto scrollbar-modern p-3 sm:p-4 md:p-6">
            {filteredBookings.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <CalendarX2 className="w-12 h-12 text-gray-300 mb-3" />
                <h4 className="text-base font-semibold text-gray-600">{emptyMsg.title}</h4>
                <p className="text-sm text-gray-400 mt-1 max-w-[240px]">{emptyMsg.description}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
