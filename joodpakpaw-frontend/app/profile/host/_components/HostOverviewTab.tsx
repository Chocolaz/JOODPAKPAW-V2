'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquareText,
  PawPrint,
  Plus,
  Receipt,
  Star,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Booking, HostReview, Property, User } from '@/types'
import { completeBooking, hostAcceptBooking } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { getDisplayName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { HostDeclineModal } from '../booking/[bookingId]/_components/HostDeclineModal'
import { PaymentSlipModal } from './PaymentSlipModal'
import type { HostWorkspaceTab } from './HostWorkspaceShell'

interface HostOverviewTabProps {
  user: User | null
  isHost: boolean
  properties: Property[]
  bookings: Booking[]
  bookingsLoading: boolean
  reviews: HostReview[]
  reviewsTotalRows: number
  isAccountBanned?: boolean
  onNavigateTab: (tab: HostWorkspaceTab, options?: { filterStatus?: string; reviewFilter?: 'all' | 'needs_reply' }) => void
  onDataMutated: () => Promise<void> | void
}

function isBookingCompletable(booking: Booking): boolean {
  if (booking.bookingStatus.toUpperCase() !== 'CONFIRMED') return false
  const cutoff = booking.canCompleteAt
    ? new Date(booking.canCompleteAt)
    : new Date(`${booking.checkOutDate.slice(0, 10)}T12:00:00+07:00`)
  return new Date() >= cutoff
}

export function HostOverviewTab({
  user,
  isHost,
  properties,
  bookings,
  bookingsLoading,
  reviews,
  reviewsTotalRows,
  isAccountBanned = false,
  onNavigateTab,
  onDataMutated,
}: HostOverviewTabProps) {
  const router = useRouter()

  const [slipBooking, setSlipBooking] = useState<Booking | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<Booking | null>(null)
  const [completeTarget, setCompleteTarget] = useState<Booking | null>(null)
  const [declineBookingId, setDeclineBookingId] = useState<number | null>(null)
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const displayName = getDisplayName(user) || 'Host'

  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.bookingStatus.toUpperCase() === 'PENDING')
        .sort((a, b) => {
          const slipA = a.paymentSlipUrl ? 0 : 1
          const slipB = b.paymentSlipUrl ? 0 : 1
          if (slipA !== slipB) return slipA - slipB
          return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
        }),
    [bookings]
  )

  const confirmedBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.bookingStatus.toUpperCase() === 'CONFIRMED')
        .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()),
    [bookings]
  )

  const publishedCount = useMemo(
    () => properties.filter((p) => p.isActive && !p.isBannedByAdmin).length,
    [properties]
  )

  const unrepliedCount = useMemo(
    () => reviews.filter((r) => !r.hostReply).length,
    [reviews]
  )

  const avgRating = useMemo(() => {
    const rated = properties.filter((p) => p.avgRating > 0)
    if (rated.length > 0) {
      const total = rated.reduce((sum, p) => sum + p.avgRating, 0)
      return (total / rated.length).toFixed(1)
    }
    if (reviews.length > 0) {
      const total = reviews.reduce((sum, r) => sum + r.rating, 0)
      return (total / reviews.length).toFixed(1)
    }
    return null
  }, [properties, reviews])

  const handleConfirmAccept = async () => {
    if (!acceptTarget) return
    const id = acceptTarget.id
    setSubmittingId(id)
    try {
      await hostAcceptBooking(id)
      toast.success(`Booking #${id} accepted successfully.`)
      setAcceptTarget(null)
      setSlipBooking(null)
      await onDataMutated()
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
      await onDataMutated()
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

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent-orange">
            Welcome back, {displayName}
          </p>
          <h1 className="text-deep-teal mt-0.5">Today in your Host Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.id && isHost && (
            <button
              type="button"
              onClick={() => router.push(`/hosts/${user.id}`)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Public profile
            </button>
          )}
          <button
            type="button"
            disabled={isAccountBanned}
            onClick={() => !isAccountBanned && router.push('/profile/host/add-property')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Property
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            isHost && onNavigateTab('bookings', { filterStatus: 'PENDING' })
          }
          className="text-left rounded-2xl border border-border bg-white p-4 hover:border-deep-teal/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-neutral-gray">
            <span>Pending requests</span>
            <Clock className="w-4 h-4 text-accent-orange" />
          </div>
          <p className="text-2xl font-bold text-accent-orange tabular-nums mt-1.5">
            {bookingsLoading ? '—' : pendingBookings.length}
          </p>
          <p className="text-xs text-neutral-gray mt-1">Across all months</p>
        </button>

        <button
          type="button"
          onClick={() =>
            isHost && onNavigateTab('bookings', { filterStatus: 'CONFIRMED' })
          }
          className="text-left rounded-2xl border border-border bg-white p-4 hover:border-deep-teal/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-neutral-gray">
            <span>Confirmed stays</span>
            <CalendarCheck2 className="w-4 h-4 text-deep-teal" />
          </div>
          <p className="text-2xl font-bold text-deep-teal tabular-nums mt-1.5">
            {bookingsLoading ? '—' : confirmedBookings.length}
          </p>
          <p className="text-xs text-neutral-gray mt-1">Active &amp; upcoming</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('properties')}
          className="text-left rounded-2xl border border-border bg-white p-4 hover:border-deep-teal/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-neutral-gray">
            <span>Published listings</span>
            <Building2 className="w-4 h-4 text-positive-green" />
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1.5">
            {publishedCount}/{properties.length}
          </p>
          <p className="text-xs text-neutral-gray mt-1">
            {properties.length - publishedCount} draft or paused
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            isHost &&
            onNavigateTab('reviews', {
              reviewFilter: unrepliedCount > 0 ? 'needs_reply' : 'all',
            })
          }
          className="text-left rounded-2xl border border-border bg-white p-4 hover:border-deep-teal/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-neutral-gray">
            <span>Rating &amp; replies</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-deep-teal tabular-nums mt-1.5">
            {avgRating ?? '—'}
          </p>
          <p className="text-xs text-neutral-gray mt-1 tabular-nums">
            {unrepliedCount > 0
              ? `${unrepliedCount} awaiting reply`
              : `${reviewsTotalRows} total reviews`}
          </p>
        </button>
      </div>

      {/* Urgent Pending Queue (all months) */}
      {isHost && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-foreground">Pending Requests Requiring Action</h2>
              <p className="text-xs text-neutral-gray mt-0.5">
                All pending reservations across future dates are pinned here for fast review.
              </p>
            </div>
            {bookings.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('bookings', { filterStatus: 'ALL' })}
                className="text-xs font-semibold text-deep-teal hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                Full Queue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {bookingsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse motion-reduce:animate-none rounded-2xl border border-border p-4 space-y-3"
                >
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="rounded-2xl border border-border bg-off-white/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-positive-green" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-deep-teal">
                    You are all caught up
                  </p>
                  <p className="text-xs text-neutral-gray mt-0.5">
                    No pending booking requests are waiting for approval right now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="px-4 py-2 rounded-xl bg-white border border-border text-xs font-semibold text-deep-teal hover:bg-off-white transition-colors cursor-pointer shrink-0"
              >
                Manage Availability
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBookings.slice(0, 5).map((booking) => {
                const roomLabel = booking.property?.roomCategories?.[0]?.name
                return (
                  <div
                    key={booking.id}
                    className="rounded-2xl border border-amber-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-neutral-gray tabular-nums">
                          #{booking.id}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {booking.property?.title || 'Property'}
                        </h3>
                        {booking.paymentSlipUrl ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Receipt className="w-3 h-3" />
                            Slip attached
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Awaiting slip
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-gray">
                        <span className="tabular-nums font-medium text-deep-teal">
                          {format(parseISO(booking.checkInDate), 'MMM d')} –{' '}
                          {format(parseISO(booking.checkOutDate), 'MMM d, yyyy')}
                        </span>
                        {roomLabel && <span>{roomLabel}</span>}
                        {booking.numberOfPets > 0 && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <PawPrint className="w-3.5 h-3.5" />
                            {booking.numberOfPets}{' '}
                            {booking.numberOfPets === 1 ? 'pet' : 'pets'}
                          </span>
                        )}
                        <span className="font-semibold text-foreground tabular-nums">
                          ฿{Number(booking.totalPrice).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {booking.paymentSlipUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSlipBooking(booking)}
                          className="rounded-xl text-xs border-border text-deep-teal hover:bg-off-white"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1.5" />
                          Inspect Slip
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={submittingId === booking.id}
                        onClick={() => setDeclineBookingId(booking.id)}
                        className="rounded-xl text-xs border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Decline
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={submittingId === booking.id}
                        onClick={() => setAcceptTarget(booking)}
                        className="rounded-xl text-xs bg-deep-teal hover:bg-deep-teal/90 text-white font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Accept
                      </Button>
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/host/booking/${booking.id}`)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Confirmed Stays & Unreplied Reviews Strip */}
      {isHost && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          <section className="rounded-2xl border border-border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground">Upcoming Confirmed Stays</h3>
              <button
                type="button"
                onClick={() => onNavigateTab('bookings', { filterStatus: 'CONFIRMED' })}
                className="text-xs font-medium text-deep-teal hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {confirmedBookings.length === 0 ? (
              <p className="text-xs text-neutral-gray py-3">
                No upcoming confirmed check-ins scheduled yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {confirmedBookings.slice(0, 3).map((booking) => {
                  const completable = isBookingCompletable(booking)
                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl bg-off-white/60 border border-border p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {booking.property?.title}
                        </p>
                        <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
                          #{booking.id} Check-in{' '}
                          {format(parseISO(booking.checkInDate), 'MMM d')} to{' '}
                          {format(parseISO(booking.checkOutDate), 'MMM d')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {completable && (
                          <button
                            type="button"
                            onClick={() => setCompleteTarget(booking)}
                            className="px-3 py-1.5 rounded-lg bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/profile/host/booking/${booking.id}`)
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground">Guest Reputation</h3>
                <MessageSquareText className="w-4 h-4 text-deep-teal" />
              </div>
              <p className="text-xs text-neutral-gray leading-relaxed">
                {unrepliedCount > 0
                  ? `You have ${unrepliedCount} guest ${unrepliedCount === 1 ? 'review' : 'reviews'} waiting for a public host reply.`
                  : 'All recent reviews have received a response. Responding warmly boosts booking trust.'}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-neutral-gray tabular-nums">
                <span className="font-semibold text-deep-teal text-sm">
                  {avgRating ?? '—'}
                </span>{' '}
                average across {reviewsTotalRows} reviews
              </div>
              <button
                type="button"
                onClick={() =>
                  onNavigateTab('reviews', {
                    reviewFilter: unrepliedCount > 0 ? 'needs_reply' : 'all',
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {unrepliedCount > 0 ? 'Reply Now' : 'View Reviews'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modals for inline queue actions */}
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
            ? `Confirm that Booking #${completeTarget.id} checked out smoothly? This opens the guest review window.`
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
            void onDataMutated()
          }}
        />
      )}
    </div>
  )
}
