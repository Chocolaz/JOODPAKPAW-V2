'use client'

import { Booking, BookingOrder } from '@/types/booking'
import { Moon, Home, PawPrint, Star, ChevronRight, Hourglass } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BookingCardProps {
  booking: Booking
  onClick?: (bookingId: number) => void
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; bar: string }> = {
  CONFIRMED:  { label: 'Confirmed',       pill: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
  SUCCESSFUL: { label: 'Completed',       pill: 'bg-gray-100 text-gray-500',       bar: 'bg-positive-green' },
  PENDING:    { label: 'Pending Payment', pill: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-400' },
  CANCELLED:  { label: 'Cancelled',       pill: 'bg-red-50 text-red-400',          bar: 'bg-gray-200' },
}

export function BookingCard({ booking, onClick }: BookingCardProps) {
  const router = useRouter()

  const nights = Math.max(1, differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)))

  let totalRoomsBooked = 0
  if (booking.property?.roomCategories) {
    totalRoomsBooked = booking.property.roomCategories.reduce((sum, c) => sum + (c.roomsBooked || 0), 0)
  } else if ('bookingOrders' in booking) {
    const orders = (booking as unknown as { bookingOrders: BookingOrder[] }).bookingOrders
    if (Array.isArray(orders)) {
      totalRoomsBooked = orders.reduce((sum, o) => sum + (o.roomsBooked || 0), 0)
    }
  }

  const propertyTitle = booking.property?.title || 'Unknown Property'
  const statusKey = booking.bookingStatus.toUpperCase()
  const cfg = STATUS_CONFIG[statusKey] ?? { label: booking.bookingStatus, pill: 'bg-gray-100 text-gray-500', bar: 'bg-gray-200' }
  const isCancelled = statusKey === 'CANCELLED'
  const isPending   = statusKey === 'PENDING'
  const isSuccessful = statusKey === 'SUCCESSFUL'

  const handleCardClick = () => {
    if (onClick) onClick(booking.id)
    else router.push(`/profile/bookings/${booking.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'cursor-pointer group rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden',
        'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99]',
        isCancelled && 'opacity-55',
        isPending && 'border-amber-200/70'
      )}
    >
      {/* Status colour bar */}
      <div className={cn('h-[3px] w-full', cfg.bar)} />

      <div className="p-4">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-900 leading-snug flex-1 min-w-0 truncate">
            {propertyTitle}
          </p>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full', cfg.pill)}>
              {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {cfg.label}
            </span>
            {isSuccessful && (
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    strokeWidth={0}
                    className={cn(
                      'w-3 h-3',
                      booking.rating && s <= booking.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Date range hero ── */}
        <div className="flex items-stretch rounded-xl overflow-hidden border border-gray-100 mb-3">
          {/* Check-in */}
          <div className="flex-1 bg-deep-teal/[0.05] px-3 py-2.5">
            <p className="text-[10px] font-semibold text-deep-teal uppercase tracking-wider mb-0.5">Check-in</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {format(new Date(booking.checkInDate), 'MMM d')}
            </p>
            <p className="text-[11px] text-neutral-gray">
              {format(new Date(booking.checkInDate), 'EEE · yyyy')}
            </p>
          </div>

          {/* Nights divider */}
          <div className="flex flex-col items-center justify-center px-2.5 bg-white gap-0.5">
            <div className="w-px flex-1 bg-gray-100" />
            <div className="flex flex-col items-center gap-0.5 py-1">
              <Moon className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-[11px] font-bold text-gray-500 leading-none">{nights}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider leading-none">
                {nights === 1 ? 'night' : 'nights'}
              </p>
            </div>
            <div className="w-px flex-1 bg-gray-100" />
          </div>

          {/* Check-out */}
          <div className="flex-1 bg-accent-orange/[0.05] px-3 py-2.5 text-right">
            <p className="text-[10px] font-semibold text-accent-orange uppercase tracking-wider mb-0.5">Check-out</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {format(new Date(booking.checkOutDate), 'MMM d')}
            </p>
            <p className="text-[11px] text-neutral-gray">
              {format(new Date(booking.checkOutDate), 'EEE · yyyy')}
            </p>
          </div>
        </div>

        {/* ── Footer: meta + price ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-neutral-gray">
            {totalRoomsBooked > 0 && (
              <span className="flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                {totalRoomsBooked} {totalRoomsBooked === 1 ? 'room' : 'rooms'}
              </span>
            )}
            {booking.numberOfPets > 0 && (
              <span className="flex items-center gap-1">
                <PawPrint className="w-3.5 h-3.5" />
                {booking.numberOfPets} {booking.numberOfPets === 1 ? 'pet' : 'pets'}
              </span>
            )}
            {isPending && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Hourglass className="w-3.5 h-3.5" />
                Pay now
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <p className="text-sm font-bold text-deep-teal">
              ฿{booking.totalPrice.toLocaleString()}
            </p>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-deep-teal transition-colors" />
          </div>
        </div>
      </div>
    </div>
  )
}
