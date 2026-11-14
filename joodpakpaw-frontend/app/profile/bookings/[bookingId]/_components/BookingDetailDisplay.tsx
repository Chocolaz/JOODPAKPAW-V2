'use client'

import React, { useMemo, useState } from 'react'
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
  FileText,
  Eye,
  X,
  ClipboardList,
  Receipt,
  Download,
} from 'lucide-react'
import Image from 'next/image'
import { FullBookingDetail } from '@/types'
import { useRouter } from 'next/navigation'
import { cn, getApiImageUrl } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
    color: 'text-deep-teal',
    bg: 'bg-deep-teal/10',
    border: 'border-deep-teal/20',
  },
  PENDING: {
    label: 'Pending Payment',
    icon: Hourglass,
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  SUCCESSFUL: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-positive-green',
    bg: 'bg-positive-green/10',
    border: 'border-positive-green/20',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
}

export default function BookingDetailDisplay({
  bookingDetails,
}: BookingDetailDisplayProps) {
  const router = useRouter()
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)

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

  // Payment slip resolution
  const resolvedSlipUrl = useMemo(() => {
    if (!bookingDetails.paymentSlipUrl) return null
    return getApiImageUrl(bookingDetails.paymentSlipUrl) || bookingDetails.paymentSlipUrl
  }, [bookingDetails.paymentSlipUrl])

  return (
    <div className="container mx-auto max-w-[560px] px-4 sm:px-5 pb-4 pt-4 space-y-4">
      {/* Status banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-2xl border transition-colors',
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
            <p className="text-xs text-amber-700 mt-0.5">
              Complete payment before the deadline to confirm your reservation.
            </p>
          )}
          {status === 'CONFIRMED' && bookingDetails.confirmedAt && (
            <p className="text-xs text-deep-teal/80 mt-0.5">
              Confirmed on {format(new Date(bookingDetails.confirmedAt), 'MMM d, yyyy')}
            </p>
          )}
          {status === 'SUCCESSFUL' && bookingDetails.successedAt && (
            <p className="text-xs text-emerald-700/80 mt-0.5">
              Completed on {format(new Date(bookingDetails.successedAt), 'MMM d, yyyy')}
            </p>
          )}
          {status === 'CANCELLED' && bookingDetails.cancellationReason && (
            <p className="text-xs text-red-600/90 mt-0.5">
              Reason: {bookingDetails.cancellationReason}
            </p>
          )}
        </div>
      </div>

      {/* Property card */}
      <button
        onClick={handlePropertyClick}
        className="w-full text-left group cursor-pointer"
      >
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-center gap-3 hover:border-deep-teal/40 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-deep-teal/10 flex items-center justify-center shrink-0">
            <Home className="w-5 h-5 text-deep-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {property?.title || 'Pet Boarding Property'}
            </p>
            {fullAddress && (
              <p className="text-xs text-neutral-gray flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {fullAddress}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-gray group-hover:text-deep-teal transition-colors shrink-0" />
        </div>
      </button>

      {/* Stay details card with Bangkok ICT cutoffs */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Check-in / Check-out with Bangkok ICT Cutoffs */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 bg-deep-teal/10 rounded-lg shrink-0">
              <CalendarCheck className="w-4 h-4 text-deep-teal" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray font-medium">
                Check-in
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {format(new Date(bookingDetails.checkInDate), 'EEE, MMM d, yyyy')}
              </p>
              <p className="text-[11px] text-deep-teal font-medium mt-0.5">
                From 14:00 ICT
              </p>
            </div>
          </div>
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 bg-accent-orange/10 rounded-lg shrink-0">
              <CalendarX className="w-4 h-4 text-accent-orange" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray font-medium">
                Check-out
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {format(new Date(bookingDetails.checkOutDate), 'EEE, MMM d, yyyy')}
              </p>
              <p className="text-[11px] text-accent-orange font-medium mt-0.5">
                By 12:00 ICT
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center divide-x divide-border border-t border-border bg-off-white/40">
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs">
            <Moon className="w-3.5 h-3.5 text-deep-teal" />
            <span className="font-semibold text-foreground">{nights}</span>
            <span className="text-neutral-gray">{nights === 1 ? 'night' : 'nights'}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs">
            <PawPrint className="w-3.5 h-3.5 text-accent-orange" />
            <span className="font-semibold text-foreground">{bookingDetails.numberOfPets}</span>
            <span className="text-neutral-gray">{bookingDetails.numberOfPets === 1 ? 'pet' : 'pets'}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs">
            <Home className="w-3.5 h-3.5 text-deep-teal" />
            <span className="font-semibold text-foreground">
              {bookingDetails.bookingOrders.reduce((s, o) => s + o.roomsBooked, 0)}
            </span>
            <span className="text-neutral-gray">
              {bookingDetails.bookingOrders.reduce((s, o) => s + o.roomsBooked, 0) === 1 ? 'room' : 'rooms'}
            </span>
          </div>
        </div>
      </div>

      {/* Guest care notes card (Feature 6 & 11) */}
      {bookingDetails.guestNote && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-2">
          <div className="flex items-center gap-2 text-deep-teal">
            <ClipboardList className="w-4 h-4" />
            <h4 className="text-xs font-semibold text-deep-teal">
              Special care instructions & notes
            </h4>
          </div>
          <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed bg-off-white/50 p-3 rounded-xl border border-border/60">
            {bookingDetails.guestNote}
          </p>
        </div>
      )}

      {/* Payment Slip Receipt Card (Feature 8, 9, 10, 11) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-deep-teal">
            <Receipt className="w-4 h-4" />
            <h4 className="text-xs font-semibold text-deep-teal">
              Payment transfer slip
            </h4>
          </div>
          {resolvedSlipUrl && (
            <span className="text-[11px] font-medium text-deep-teal bg-deep-teal/10 px-2 py-0.5 rounded-full">
              Slip verified
            </span>
          )}
        </div>

        {resolvedSlipUrl ? (
          <div className="flex items-center justify-between p-3 bg-off-white/40 rounded-xl border border-border gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsSlipModalOpen(true)}
                className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 bg-white relative group cursor-pointer"
                title="Click to preview slip"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedSlipUrl}
                  alt="Payment slip thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </button>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  Bank payment receipt
                </p>
                <p className="text-[11px] text-neutral-gray mt-0.5">
                  WebP verified receipt image
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSlipModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-teal bg-white rounded-lg border border-border hover:bg-deep-teal/5 transition-colors cursor-pointer shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View slip</span>
            </button>
          </div>
        ) : (
          /* Placeholder icon for missing slip (TC-T2-F11-03) */
          <div className="flex items-center gap-3 p-4 bg-off-white/40 rounded-xl border border-dashed border-border text-neutral-gray">
            <div className="w-10 h-10 rounded-lg bg-off-white flex items-center justify-center shrink-0 text-neutral-gray">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">
                No payment slip uploaded
              </p>
              <p className="text-[11px] text-neutral-gray mt-0.5">
                {status === 'PENDING'
                  ? 'Payment slip can be uploaded below.'
                  : 'Reservation confirmed without uploaded transfer slip.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pets card — only shown when pet profiles are attached */}
      {bookingDetails.petProfiles && bookingDetails.petProfiles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-3">
          <div className="flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-accent-orange" />
            <h4 className="text-xs font-semibold text-neutral-gray">
              Pets
            </h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {bookingDetails.petProfiles.map((pet) => (
              <div
                key={pet.id}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-accent-orange/30 bg-accent-orange/5"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-off-white shrink-0 flex items-center justify-center">
                  {pet.image ? (
                    <Image
                      src={pet.image}
                      alt={pet.name}
                      width={28}
                      height={28}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <PawPrint className="w-3.5 h-3.5 text-neutral-gray" />
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
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-4">
        <h4 className="text-xs font-semibold text-neutral-gray">
          Rooms & pricing
        </h4>

        <div className="space-y-2.5">
          {priceSummary.breakdown.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-off-white/40 rounded-xl border border-border/60"
            >
              <div>
                <p className="text-xs font-medium text-foreground capitalize">
                  {item.name}
                </p>
                <p className="text-[11px] text-neutral-gray mt-0.5">
                  {item.quantity} {item.quantity > 1 ? 'rooms' : 'room'} × <span className="tabular-nums">฿{item.pricePerRoom.toLocaleString()}</span>/night
                </p>
              </div>
              <p className="text-xs font-semibold text-foreground tabular-nums">
                ฿{item.total.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Total</p>
            <p className="text-[11px] text-neutral-gray">
              for {nights} {nights === 1 ? 'night' : 'nights'}
            </p>
          </div>
          <p className="text-lg font-bold text-deep-teal tabular-nums">
            ฿{bookingDetails.totalPrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Booking meta */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-gray">
        <Clock className="w-3 h-3 shrink-0" />
        <span>Booking #{bookingDetails.id}</span>
        <span className="text-border">·</span>
        <span>Booked on {format(new Date(bookingDetails.createdAt), 'MMM d, yyyy')}</span>
      </div>

      {/* Slip Image Fullscreen Preview Modal */}
      <AnimatePresence>
        {isSlipModalOpen && resolvedSlipUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSlipModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-sm border border-border z-10 flex flex-col"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-deep-teal" />
                  <span className="text-sm font-semibold text-foreground">
                    Payment Transfer Slip
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={resolvedSlipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-off-white rounded-lg text-neutral-gray hover:text-foreground transition-colors"
                    title="Open original"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setIsSlipModalOpen(false)}
                    className="p-1.5 hover:bg-off-white rounded-lg text-neutral-gray hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal image container */}
              <div className="p-4 overflow-auto flex items-center justify-center bg-off-white/50 flex-1 max-h-[70vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedSlipUrl}
                  alt="Full payment slip"
                  className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-sm border border-border bg-white"
                />
              </div>

              {/* Modal footer */}
              <div className="px-5 py-3 border-t border-border bg-white flex items-center justify-between text-xs text-neutral-gray">
                <span>Booking #{bookingDetails.id}</span>
                <span>PromptPay Transfer</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
