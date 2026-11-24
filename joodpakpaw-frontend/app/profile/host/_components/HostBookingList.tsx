'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  completeBooking,
  getHostBookingsPaginated,
  hostAcceptBooking,
} from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
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
import { toast } from 'sonner'
import { BookingCard } from '@/app/profile/bookings/_components/BookingCard'
import { cn } from '@/lib/utils'
import {
  CalendarX2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Receipt,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { HostDeclineModal } from '../booking/[bookingId]/_components/HostDeclineModal'
import { PaymentSlipModal } from './PaymentSlipModal'
import { PropertyFilterDropdown } from './PropertyFilterDropdown'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  {
    value: 'PENDING',
    label: 'Pending',
    color: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  {
    value: 'CONFIRMED',
    label: 'Confirmed',
    color: 'bg-deep-teal/10 text-deep-teal border-deep-teal/30',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    color: 'bg-red-50 text-red-700 border-red-200',
  },
] as const

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  ALL: {
    title: 'No active bookings found',
    description: 'Upcoming, pending, and recent cancelled reservations will appear here.',
  },
  CONFIRMED: {
    title: 'No confirmed bookings',
    description: 'Confirmed bookings will appear here.',
  },
  PENDING: {
    title: 'No pending bookings',
    description: 'You are all caught up! No reservations awaiting action.',
  },
  CANCELLED: {
    title: 'No cancellations',
    description: 'No cancelled reservations match your current filter.',
  },
}

type MonthItem = { type: 'month'; date: Date } | { type: 'year'; year: number }

interface HostBookingListProps {
  initialStatusFilter?: string
  onDataMutated?: () => Promise<void> | void
}

function isBookingCompletable(booking: Booking): boolean {
  if (booking.bookingStatus.toUpperCase() !== 'CONFIRMED') return false
  const cutoff = booking.canCompleteAt
    ? new Date(booking.canCompleteAt)
    : new Date(`${booking.checkOutDate.slice(0, 10)}T12:00:00+07:00`)
  return new Date() >= cutoff
}

export function HostBookingList({
  initialStatusFilter = 'ALL',
  onDataMutated,
}: HostBookingListProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'queue' | 'month'>('queue')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [propertyFilter, setPropertyFilter] = useState('ALL')

  const [slipBooking, setSlipBooking] = useState<Booking | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<Booking | null>(null)
  const [completeTarget, setCompleteTarget] = useState<Booking | null>(null)
  const [declineBookingId, setDeclineBookingId] = useState<number | null>(null)
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const monthScrollRef = useRef<HTMLDivElement>(null)
  const monthButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const router = useRouter()

  const reloadBookings = useCallback(async () => {
    try {
      const res = await getHostBookingsPaginated(1, 30)
      setBookings(res.data)
      setTotalPages(res.totalPages)
      setPage(1)
      setError(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch host bookings'
      )
    } finally {
      setLoading(false)
    }
  }, [])

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
            err instanceof Error ? err.message : 'Failed to fetch host bookings'
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

  const scrollToMonth = useCallback((date: Date) => {
    const key = format(date, 'yyyy-MM')
    const button = monthButtonRefs.current.get(key)
    if (button && monthScrollRef.current) {
      const container = monthScrollRef.current
      const scrollLeft =
        button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (!loading && viewMode === 'month') {
      const id = setTimeout(() => scrollToMonth(selectedMonth), 80)
      return () => clearTimeout(id)
    }
  }, [loading, viewMode, scrollToMonth, selectedMonth])

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

  const monthItems = useMemo((): MonthItem[] => {
    const spansYears =
      months.length > 0 &&
      getYear(months[0]) !== getYear(months[months.length - 1])
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

  const activeBookingsScope = useMemo(() => {
    return bookings.filter((booking) => {
      const status = booking.bookingStatus.toUpperCase()
      if (status === 'SUCCESSFUL') return false
      if (
        viewMode === 'month' &&
        !isSameMonth(parseISO(booking.checkInDate), selectedMonth)
      ) {
        return false
      }
      return true
    })
  }, [bookings, viewMode, selectedMonth])

  const filteredBookings = useMemo(() => {
    const statusOrder = ['PENDING', 'CONFIRMED', 'CANCELLED']
    return activeBookingsScope
      .filter((booking) => {
        const status = booking.bookingStatus.toUpperCase()
        const matchesFilter = statusFilter === 'ALL' || status === statusFilter
        const matchesProperty =
          propertyFilter === 'ALL' ||
          booking.property?.title === propertyFilter
        return matchesFilter && matchesProperty
      })
      .sort((a, b) => {
        const statusA = a.bookingStatus.toUpperCase()
        const statusB = b.bookingStatus.toUpperCase()
        const orderA = statusOrder.indexOf(statusA)
        const orderB = statusOrder.indexOf(statusB)
        if (orderA !== orderB) return orderA - orderB
        if (statusA === 'PENDING') {
          const slipA = a.paymentSlipUrl ? 0 : 1
          const slipB = b.paymentSlipUrl ? 0 : 1
          if (slipA !== slipB) return slipA - slipB
        }
        return (
          new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
        )
      })
  }, [activeBookingsScope, statusFilter, propertyFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    activeBookingsScope.forEach((booking) => {
      const status = booking.bookingStatus.toUpperCase()
      counts.ALL = (counts.ALL || 0) + 1
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [activeBookingsScope])

  const handleConfirmAccept = async () => {
    if (!acceptTarget) return
    const id = acceptTarget.id
    setSubmittingId(id)
    try {
      await hostAcceptBooking(id)
      toast.success(`Booking #${id} accepted successfully.`)
      setAcceptTarget(null)
      setSlipBooking(null)
      await reloadBookings()
      await onDataMutated?.()
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to accept booking.'
      )
    } finally {
      setSubmittingId(null)
    }
  }

  const handleConfirmComplete = async () => {
    if (!completeTarget) return
    const id = completeTarget.id
    setSubmittingId(id)
    try {
      await completeBooking(id)
      toast.success(`Booking #${id} marked as completed.`)
      setCompleteTarget(null)
      await reloadBookings()
      await onDataMutated?.()
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to complete booking.'
      )
    } finally {
      setSubmittingId(null)
    }
  }

  if (error) return <ErrorState message={error} />

  const pendingCount = statusCounts.PENDING || 0
  const emptyMsg = EMPTY_MESSAGES[statusFilter] || EMPTY_MESSAGES.ALL

  return (
    <div className="space-y-5">
      {/* Header + View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-deep-teal">Bookings Operations</h1>
          <p className="text-xs text-neutral-gray mt-0.5">
            {viewMode === 'queue'
              ? 'Showing all active and pending reservations across all months.'
              : `Filtering stays checking in during ${format(selectedMonth, 'MMMM yyyy')}.`}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-border p-1 bg-off-white">
          <button
            type="button"
            onClick={() => setViewMode('queue')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
              viewMode === 'queue'
                ? 'bg-white text-deep-teal shadow-xs'
                : 'text-neutral-gray hover:text-deep-teal'
            )}
          >
            Active Queue
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
              viewMode === 'month'
                ? 'bg-white text-deep-teal shadow-xs'
                : 'text-neutral-gray hover:text-deep-teal'
            )}
          >
            By Month
          </button>
        </div>
      </div>

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
      ) : (
        <>
          {/* Pending action banner */}
          {pendingCount > 0 && statusFilter === 'ALL' && (
            <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
              <p className="text-xs sm:text-sm text-amber-900 min-w-0">
                <span className="font-semibold tabular-nums">{pendingCount}</span>{' '}
                {pendingCount === 1 ? 'reservation is' : 'reservations are'} waiting for your approval
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className="ml-auto px-3 py-1 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                Filter Pending
              </button>
            </div>
          )}

          {/* Optional Month Selector */}
          {viewMode === 'month' && (
            <div
              ref={monthScrollRef}
              className="overflow-x-auto whitespace-nowrap hide-scrollbar border-b border-border"
            >
              <div className="inline-flex items-end gap-1 pb-0">
                {monthItems.map((item) => {
                  if (item.type === 'year') {
                    return (
                      <span
                        key={`year-${item.year}`}
                        className="text-xs font-semibold text-neutral-gray px-2 pb-3"
                      >
                        {item.year}
                      </span>
                    )
                  }
                  const monthStr = format(item.date, 'yyyy-MM')
                  const count = monthBookingCounts.get(monthStr) ?? 0
                  const isSelected = isSameMonth(item.date, selectedMonth)
                  return (
                    <button
                      key={monthStr}
                      type="button"
                      ref={(el) => {
                        if (el) monthButtonRefs.current.set(monthStr, el)
                      }}
                      onClick={() => setSelectedMonth(item.date)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 pt-1 pb-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'text-deep-teal border-b-2 border-deep-teal font-semibold'
                          : 'text-neutral-gray hover:text-deep-teal'
                      )}
                    >
                      <span>{format(item.date, 'MMM')}</span>
                      {count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-off-white border border-border text-deep-teal tabular-nums">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => {
              const count = statusCounts[filter.value] || 0
              const isActive = statusFilter === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer',
                    isActive
                      ? filter.value === 'ALL'
                        ? 'bg-deep-teal text-white border-deep-teal'
                        : filter.color
                      : 'bg-white text-neutral-gray border-border hover:border-deep-teal/40 hover:text-foreground'
                  )}
                >
                  {filter.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-[11px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 tabular-nums',
                        isActive
                          ? filter.value === 'ALL'
                            ? 'bg-white/20 text-white'
                            : 'bg-black/10'
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

          {/* Booking Cards Grid */}
          {filteredBookings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredBookings.map((booking) => {
                  const status = booking.bookingStatus.toUpperCase()
                  const completable = isBookingCompletable(booking)
                  const hasActions =
                    status === 'PENDING' ||
                    (status === 'CONFIRMED' && completable)

                  return (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      role="host"
                      onClick={(id) => router.push(`/profile/host/booking/${id}`)}
                      actions={
                        hasActions ? (
                          <>
                            {booking.paymentSlipUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSlipBooking(booking)}
                                className="h-8 rounded-xl text-xs border-border text-deep-teal hover:bg-off-white"
                              >
                                <Receipt className="w-3.5 h-3.5 mr-1" />
                                Inspect Slip
                              </Button>
                            )}
                            {status === 'PENDING' && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={submittingId === booking.id}
                                  onClick={() => setDeclineBookingId(booking.id)}
                                  className="h-8 rounded-xl text-xs border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  Decline
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={submittingId === booking.id}
                                  onClick={() => setAcceptTarget(booking)}
                                  className="h-8 rounded-xl text-xs bg-deep-teal hover:bg-deep-teal/90 text-white font-semibold"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Accept
                                </Button>
                              </>
                            )}
                            {status === 'CONFIRMED' && completable && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={submittingId === booking.id}
                                onClick={() => setCompleteTarget(booking)}
                                className="h-8 rounded-xl text-xs bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Mark Completed
                              </Button>
                            )}
                          </>
                        ) : undefined
                      }
                    />
                  )
                })}
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
              <CalendarX2 className="w-10 h-10 text-neutral-gray/50 mb-3" />
              <h4 className="text-foreground">{emptyMsg.title}</h4>
              <p className="text-xs text-neutral-gray mt-1 max-w-[260px]">
                {emptyMsg.description}
              </p>
            </div>
          )}
        </>
      )}

      <PaymentSlipModal
        isOpen={!!slipBooking}
        onClose={() => setSlipBooking(null)}
        slipUrl={slipBooking?.paymentSlipUrl}
        bookingId={slipBooking?.id ?? 0}
        expectedTotal={Number(slipBooking?.totalPrice ?? 0)}
        isPending={slipBooking?.bookingStatus.toUpperCase() === 'PENDING'}
        onAcceptBooking={() => {
          if (slipBooking) setAcceptTarget(slipBooking)
        }}
        isAccepting={submittingId === slipBooking?.id}
      />

      <ConfirmationModal
        isOpen={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onConfirm={handleConfirmAccept}
        title="Accept Booking Request"
        message={
          acceptTarget
            ? `Are you sure you want to confirm Booking #${acceptTarget.id} at "${acceptTarget.property?.title}"?`
            : ''
        }
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-deep-teal hover:bg-deep-teal/90 text-white"
      />

      <ConfirmationModal
        isOpen={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleConfirmComplete}
        title="Mark Stay as Completed"
        message={
          completeTarget
            ? `Confirm that Booking #${completeTarget.id} checked out successfully? This opens the guest review window.`
            : ''
        }
        titleClassName="text-accent-orange"
        confirmButtonClassName="bg-accent-orange hover:bg-accent-orange/90 text-white"
      />

      {declineBookingId !== null && (
        <HostDeclineModal
          bookingId={declineBookingId}
          isOpen={declineBookingId !== null}
          onClose={() => setDeclineBookingId(null)}
          onSuccess={() => {
            setDeclineBookingId(null)
            void reloadBookings()
            void onDataMutated?.()
          }}
        />
      )}
    </div>
  )
}
