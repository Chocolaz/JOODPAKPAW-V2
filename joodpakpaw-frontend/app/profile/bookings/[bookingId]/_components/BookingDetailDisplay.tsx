'use client'

import React, { useMemo } from 'react'
import { format, differenceInDays } from 'date-fns'
import {
  CalendarCheck,
  CalendarX,
  MapPin,
  PawPrint,
  Moon,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  Home,
} from 'lucide-react'
import Image from 'next/image'
import { FullBookingDetail } from '@/types'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BookingDetailDisplayProps {
  bookingDetails: FullBookingDetail
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    icon: CheckCircle2,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  PENDING: {
    label: 'Pending Payment',
    icon: Hourglass,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  SUCCESSFUL: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
}

export default function BookingDetailDisplay({
  bookingDetails,
}: BookingDetailDisplayProps) {
  const router = useRouter()
  const status = bookingDetails.bookingStatus.toUpperCase()
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.CONFIRMED
  const StatusIcon = statusInfo.icon

  const property = bookingDetails.bookingOrders[0]?.property
  const nights = differenceInDays(
    new Date(bookingDetails.checkOutDate),
    new Date(bookingDetails.checkInDate)
  )

  const priceSummary = useMemo(() => {
    const breakdown = bookingDetails.bookingOrders.map((order) => ({
      name: order.roomCategory.name,
      quantity: order.roomsBooked,
      pricePerRoom: order.pricePerRoom,
      total: order.pricePerRoom * order.roomsBooked,
    }))
    const subtotal = breakdown.reduce((sum, item) => sum + item.total, 0)
    return { subtotal, breakdown }
  }, [bookingDetails])

  const fullAddress = [property?.address, property?.district, property?.province]
    .filter(Boolean)
    .join(', ')

  const handlePropertyClick = () => {
    if (property?.id) {
      router.push(`/detail/${property.id}?fromBookings=true&bookingId=${bookingDetails.id}`)
    }
  }

  return (
    <div className="container mx-auto max-w-[550px] px-5 pb-4 pt-4 space-y-4">
      {/* Status banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-3.5 rounded-2xl border',
          statusInfo.bg,
          statusInfo.border
        )}
      >
        <StatusIcon className={cn('w-5 h-5 shrink-0', statusInfo.color)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', statusInfo.color)}>
            {statusInfo.label}
          </p>
          {status === 'PENDING' && (
            <p className="text-xs text-amber-600/80 mt-0.5">
              Complete payment to confirm your booking
            </p>
          )}
          {status === 'CONFIRMED' && bookingDetails.confirmedAt && (
            <p className="text-xs text-green-600/80 mt-0.5">
              Confirmed on {format(new Date(bookingDetails.confirmedAt), 'MMM d, yyyy')}
            </p>
          )}
          {status === 'SUCCESSFUL' && bookingDetails.successedAt && (
            <p className="text-xs text-emerald-600/80 mt-0.5">
              Completed on {format(new Date(bookingDetails.successedAt), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>

      {/* Property card */}
      <button
        onClick={handlePropertyClick}
        className="w-full text-left group"
      >
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200/60 flex items-center gap-3 hover:shadow-lg transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-deep-teal/10 flex items-center justify-center shrink-0">
            <Home className="w-5 h-5 text-deep-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-deep-teal truncate">
              {property?.title}
            </p>
            {fullAddress && (
              <p className="text-xs text-neutral-gray flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {fullAddress}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
        </div>
      </button>

      {/* Stay details card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200/60 overflow-hidden">
        {/* Check-in / Check-out */}
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 bg-deep-teal/10 rounded-lg shrink-0">
              <CalendarCheck className="w-4 h-4 text-deep-teal" />
            </div>
            <div>
              <p className="text-[10px] text-neutral-gray uppercase tracking-wide font-medium">
                Check-in
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {format(new Date(bookingDetails.checkInDate), 'EEE, MMM d')}
              </p>
              <p className="text-[11px] text-neutral-gray">
                {format(new Date(bookingDetails.checkInDate), 'yyyy')}
              </p>
            </div>
          </div>
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 bg-accent-orange/10 rounded-lg shrink-0">
              <CalendarX className="w-4 h-4 text-accent-orange" />
            </div>
            <div>
              <p className="text-[10px] text-neutral-gray uppercase tracking-wide font-medium">
                Check-out
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {format(new Date(bookingDetails.checkOutDate), 'EEE, MMM d')}
              </p>
              <p className="text-[11px] text-neutral-gray">
                {format(new Date(bookingDetails.checkOutDate), 'yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/50">
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm">
            <Moon className="w-3.5 h-3.5 text-deep-teal" />
            <span className="font-semibold text-gray-800">{nights}</span>
            <span className="text-neutral-gray">{nights === 1 ? 'night' : 'nights'}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm">
            <PawPrint className="w-3.5 h-3.5 text-accent-orange" />
            <span className="font-semibold text-gray-800">{bookingDetails.numberOfPets}</span>
            <span className="text-neutral-gray">{bookingDetails.numberOfPets === 1 ? 'pet' : 'pets'}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm">
            <Home className="w-3.5 h-3.5 text-positive-green" />
            <span className="font-semibold text-gray-800">
              {bookingDetails.bookingOrders.reduce((s, o) => s + o.roomsBooked, 0)}
            </span>
            <span className="text-neutral-gray">
              {bookingDetails.bookingOrders.reduce((s, o) => s + o.roomsBooked, 0) === 1 ? 'room' : 'rooms'}
            </span>
          </div>
        </div>
      </div>

      {/* Pets card — only shown when pet profiles are attached */}
      {bookingDetails.petProfiles && bookingDetails.petProfiles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200/60 space-y-3">
          <div className="flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-accent-orange" />
            <h4 className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">
              Pets
            </h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {bookingDetails.petProfiles.map((pet) => (
              <div
                key={pet.id}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-accent-orange/30 bg-accent-orange/5"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                  {pet.image ? (
                    <Image
                      src={pet.image}
                      alt={pet.name}
                      width={28}
                      height={28}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <PawPrint className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-accent-orange leading-none">
                    {pet.name}
                  </p>
                  {pet.petTypeName && (
                    <p className="text-[11px] text-neutral-gray capitalize leading-none mt-0.5">
                      {pet.petTypeName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rooms & pricing card */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200/60 space-y-4">
        <h4 className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">
          Rooms & Pricing
        </h4>

        <div className="space-y-2.5">
          {priceSummary.breakdown.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div>
                <p className="text-sm font-medium text-gray-800 capitalize">
                  {item.name}
                </p>
                <p className="text-xs text-neutral-gray mt-0.5">
                  {item.quantity} {item.quantity > 1 ? 'rooms' : 'room'} x ฿{item.pricePerRoom.toLocaleString()}/night
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-800">
                ฿{item.total.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Total</p>
            <p className="text-[11px] text-neutral-gray">
              for {nights} {nights === 1 ? 'night' : 'nights'}
            </p>
          </div>
          <p className="text-xl font-bold text-deep-teal">
            ฿{bookingDetails.totalPrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Booking meta */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-gray">
        <Clock className="w-3 h-3 shrink-0" />
        <span>Booking #{bookingDetails.id}</span>
        <span className="text-gray-300">·</span>
        <span>Booked on {format(new Date(bookingDetails.createdAt), 'MMM d, yyyy')}</span>
      </div>
    </div>
  )
}
