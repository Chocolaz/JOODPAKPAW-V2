'use client'

import { Booking, BookingOrder } from '@/types/booking'
import {
  ArrowRight,
  BedDouble,
  Clock,
  PawPrint,
  Star,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BookingCardProps {
  booking: Booking
  onClick?: (bookingId: number) => void
  role?: 'guest' | 'host'
  isHost?: boolean
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    dot: 'bg-deep-teal',
    badge: 'bg-deep-teal/10 text-deep-teal border-deep-teal/20',
  },
  SUCCESSFUL: {
    label: 'Completed',
    dot: 'bg-positive-green',
    badge: 'bg-positive-green/10 text-positive-green border-positive-green/20',
  },
  PENDING: {
    label: 'Pending payment',
    dot: 'bg-amber-600',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-red-600',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  REJECTED: {
    label: 'Rejected',
    dot: 'bg-red-600',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
}

export function BookingCard({
  booking,
  onClick,
  role,
  isHost,
}: BookingCardProps) {
  const router = useRouter()

  const checkIn = new Date(booking.checkInDate)
  const checkOut = new Date(booking.checkOutDate)
  const nights = Math.max(1, differenceInDays(checkOut, checkIn))

  let totalRoomsBooked = 0
  let roomSummary = ''
  if (booking.property?.roomCategories?.length) {
    totalRoomsBooked = booking.property.roomCategories.reduce(
      (sum, c) => sum + (c.roomsBooked || 0),
      0
    )
    const firstRoom = booking.property.roomCategories[0]
    roomSummary =
      booking.property.roomCategories.length > 1
        ? `${firstRoom.name} +${booking.property.roomCategories.length - 1}`
        : firstRoom.name
  } else if ('bookingOrders' in booking) {
    const orders = (booking as unknown as { bookingOrders: BookingOrder[] })
      .bookingOrders
    if (Array.isArray(orders) && orders.length > 0) {
      totalRoomsBooked = orders.reduce(
        (sum, o) => sum + (o.roomsBooked || 0),
        0
      )
    }
  }

  const propertyTitle = booking.property?.title || 'Unknown property'
  const statusKey = booking.bookingStatus.toUpperCase()
  const cfg = STATUS_CONFIG[statusKey] ?? {
    label: booking.bookingStatus,
    dot: 'bg-neutral-gray',
    badge: 'bg-off-white text-neutral-gray border-border',
  }

  const isCancelled = statusKey === 'CANCELLED' || statusKey === 'REJECTED'
  const isPending = statusKey === 'PENDING'
  const isSuccessful = statusKey === 'SUCCESSFUL'
  const isHostView = role === 'host' || isHost
  const canReview = isSuccessful && !isHostView && !booking.rating

  const paymentDeadlineRaw = booking.paymentDeadlineAt || booking.paymentDeadline
  const deadlineLabel =
    isPending && paymentDeadlineRaw
      ? format(new Date(paymentDeadlineRaw), 'MMM d, HH:mm')
      : null

  const handleCardClick = () => {
    if (onClick) onClick(booking.id)
    else router.push(`/profile/bookings/${booking.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      className={cn(
        'group cursor-pointer rounded-2xl bg-white border p-5 transition-colors duration-150',
        'hover:border-deep-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-teal/30',
        isPending ? 'border-amber-200' : 'border-border',
        isCancelled && 'opacity-70 bg-off-white'
      )}
    >
      {/* Header: Booking reference + room summary + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-neutral-gray">
            <span className="font-mono tabular-nums">#{booking.id}</span>
            {roomSummary && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{roomSummary}</span>
              </>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground group-hover:text-deep-teal transition-colors truncate mt-1">
            {propertyTitle}
          </h3>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border shrink-0',
            cfg.badge
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          {cfg.label}
        </span>
      </div>

      {/* Boarding-pass stay timeline */}
      <div className="mt-4 rounded-xl bg-off-white border border-border px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-gray">Check-in</p>
          <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
            {format(checkIn, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-neutral-gray tabular-nums">
            {format(checkIn, 'EEE')} · 14:00
          </p>
        </div>

        <div className="flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-white border border-border text-xs font-medium text-deep-teal tabular-nums">
            {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        </div>

        <div className="min-w-0 text-right">
          <p className="text-xs text-neutral-gray">Check-out</p>
          <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
            {format(checkOut, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-neutral-gray tabular-nums">
            {format(checkOut, 'EEE')} · 12:00
          </p>
        </div>
      </div>

      {/* Footer: stay metadata, prompt, and total */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-gray min-w-0">
          {totalRoomsBooked > 0 && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <BedDouble className="w-4 h-4 stroke-[1.5]" />
              {totalRoomsBooked} {totalRoomsBooked === 1 ? 'room' : 'rooms'}
            </span>
          )}
          {booking.numberOfPets > 0 && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <PawPrint className="w-4 h-4 stroke-[1.5]" />
              {booking.numberOfPets}{' '}
              {booking.numberOfPets === 1 ? 'pet' : 'pets'}
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium tabular-nums">
              <Clock className="w-4 h-4 stroke-[1.5]" />
              {isHostView
                ? 'Awaiting guest'
                : deadlineLabel
                  ? `Pay by ${deadlineLabel}`
                  : 'Pay now'}
            </span>
          )}
          {isSuccessful && booking.rating ? (
            <span className="inline-flex items-center gap-1.5 text-foreground font-medium tabular-nums">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" strokeWidth={0} />
              {booking.rating}.0
            </span>
          ) : canReview ? (
            <span className="inline-flex items-center gap-1.5 text-deep-teal font-medium">
              <Star className="w-4 h-4 stroke-[1.5]" />
              Write a review
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-semibold text-deep-teal tabular-nums">
            ฿{Number(booking.totalPrice).toLocaleString()}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[1.5] text-neutral-gray group-hover:text-deep-teal transition-colors" />
        </div>
      </div>
    </div>
  )
}
