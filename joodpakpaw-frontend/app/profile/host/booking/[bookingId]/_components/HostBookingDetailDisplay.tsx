'use client'

import React, { useMemo } from 'react'
import { format, differenceInYears, differenceInMonths } from 'date-fns'
import {
  User,
  Mail,
  Phone,
  CheckCircle,
  CheckCircle2,
  Star,
  PawPrint,
  Zap,
  Ruler,
  Contact,
  NotebookText,
  AlertCircle,
  Moon,
  Home,
  MapPin,
  ChevronRight,
  XCircle,
  Hourglass,
  CalendarCheck,
  CalendarX,
} from 'lucide-react'
import { HostBookingDetail, HostBookingPetProfile } from '@/types'
import { completeBooking } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useProfileContext } from '@/app/profile/ProfileContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPetAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  const years = differenceInYears(now, birth)
  if (years >= 1) return `${years} yr${years > 1 ? 's' : ''}`
  const months = differenceInMonths(now, birth)
  return `${months} mo${months !== 1 ? 's' : ''}`
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    Icon: React.ElementType
    iconColor: string
    textColor: string
    bg: string
    border: string
    pillBg: string
    pillText: string
  }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    Icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-900',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    pillBg: 'bg-emerald-100',
    pillText: 'text-emerald-700',
  },
  PENDING: {
    label: 'Pending',
    Icon: Hourglass,
    iconColor: 'text-amber-500',
    textColor: 'text-amber-900',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    pillBg: 'bg-amber-100',
    pillText: 'text-amber-700',
  },
  SUCCESSFUL: {
    label: 'Completed',
    Icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-900',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    pillBg: 'bg-emerald-100',
    pillText: 'text-emerald-700',
  },
  CANCELLED: {
    label: 'Cancelled',
    Icon: XCircle,
    iconColor: 'text-red-500',
    textColor: 'text-red-900',
    bg: 'bg-red-50',
    border: 'border-red-200',
    pillBg: 'bg-red-100',
    pillText: 'text-red-700',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PetProfileCard
// ─────────────────────────────────────────────────────────────────────────────

function PetProfileCard({ pet }: { pet: HostBookingPetProfile }) {
  const energyDots = pet.petEnergy?.rating ?? 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
          <PawPrint className="w-[18px] h-[18px] text-accent-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-tight">{pet.name}</p>
          <p className="text-xs text-neutral-gray capitalize mt-0.5">
            {pet.petTypeName} · {pet.breedName}
          </p>
        </div>
        <span
          className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0',
            pet.sex === 'male'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-pink-100 text-pink-700'
          )}
        >
          {pet.sex}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5 space-y-3">
        {/* Size + Age */}
        <div className="flex items-center gap-5 text-sm text-gray-700">
          <span className="flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-gray-400" />
            <span className="capitalize">{pet.petSizeName}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-gray-400" />
            {getPetAge(pet.birthDate)} old
          </span>
        </div>

        {/* Energy level */}
        {energyDots > 0 && (
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-neutral-gray">Energy</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((d) => (
                <span
                  key={d}
                  className={cn(
                    'w-2 h-2 rounded-full',
                    d <= energyDots ? 'bg-accent-orange' : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Emergency contact */}
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-gray uppercase tracking-wider">
            <Contact className="w-3 h-3" />
            Emergency Contact
          </p>
          <p className="flex items-center gap-1.5 text-sm text-gray-800">
            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {pet.contactName}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-gray-800">
            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {pet.contactPhone}
          </p>
        </div>

        {/* Note */}
        {pet.note && (
          <div className="border-t border-gray-100 pt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-gray uppercase tracking-wider mb-2">
              <NotebookText className="w-3 h-3" />
              Note
            </p>
            <p className="text-sm text-gray-600 bg-off-white rounded-xl px-3 py-2.5 leading-relaxed">
              {pet.note}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface HostBookingDetailDisplayProps {
  bookingDetails: HostBookingDetail
  refreshBooking: () => void
}

export default function HostBookingDetailDisplay({
  bookingDetails,
  refreshBooking,
}: HostBookingDetailDisplayProps) {
  const router = useRouter()
  const { setMenu } = useProfileContext()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(bookingDetails.checkOutDate).getTime() -
        new Date(bookingDetails.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  const totalRooms = bookingDetails.bookingOrders.reduce(
    (sum, o) => sum + o.roomsBooked,
    0
  )

  const priceSummary = useMemo(() => {
    let subtotal = 0
    const breakdown: {
      name: string
      quantity: number
      pricePerRoom: number
      total: number
    }[] = []
    bookingDetails.bookingOrders.forEach((order) => {
      const roomTotal = order.pricePerRoom * order.roomsBooked
      subtotal += roomTotal
      breakdown.push({
        name: order.roomCategory.name,
        quantity: order.roomsBooked,
        pricePerRoom: order.pricePerRoom,
        total: roomTotal,
      })
    })
    return { subtotal, total: subtotal, breakdown }
  }, [bookingDetails])

  const statusKey = bookingDetails.bookingStatus.toUpperCase()

  const statusCfg = STATUS_CONFIG[statusKey] ?? {
    label: bookingDetails.bookingStatus,
    Icon: Hourglass,
    iconColor: 'text-gray-500',
    textColor: 'text-gray-900',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    pillBg: 'bg-gray-100',
    pillText: 'text-gray-700',
  }

  const statusSubtitle = useMemo(() => {
    switch (statusKey) {
      case 'CONFIRMED':
        return bookingDetails.confirmedAt
          ? `Confirmed on ${format(new Date(bookingDetails.confirmedAt), 'MMM d, yyyy')}`
          : null
      case 'PENDING':
        return `Created ${format(new Date(bookingDetails.createdAt), 'MMM d, yyyy · h:mm a')}`
      case 'SUCCESSFUL':
        return bookingDetails.successedAt
          ? `Completed on ${format(new Date(bookingDetails.successedAt), 'MMM d, yyyy')}`
          : null
      case 'CANCELLED':
        return `Updated ${format(new Date(bookingDetails.updatedAt), 'MMM d, yyyy')}`
      default:
        return null
    }
  }, [bookingDetails, statusKey])

  // Inject status pill into the layout header's right slot
  useEffect(() => {
    setMenu(
      <span
        className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full',
          statusCfg.pillBg,
          statusCfg.pillText
        )}
      >
        {statusCfg.label}
      </span>
    )
    return () => setMenu(null)
  }, [statusCfg.label, statusCfg.pillBg, statusCfg.pillText, setMenu])

  const guestInitials = `${bookingDetails.guest.firstName?.[0] ?? ''}${bookingDetails.guest.lastName?.[0] ?? ''}`.toUpperCase()

  const canComplete = useMemo(() => {
    if (statusKey !== 'CONFIRMED') {
      return { allowed: false, reason: 'Booking is not confirmed' }
    }
    const checkOutDate = new Date(bookingDetails.checkOutDate)
    checkOutDate.setHours(12, 0, 0, 0)
    if (new Date() < checkOutDate) {
      return {
        allowed: false,
        reason: `Available after 12:00 PM on ${format(new Date(bookingDetails.checkOutDate), 'MMM d')}`,
      }
    }
    return { allowed: true, reason: '' }
  }, [bookingDetails, statusKey])

  const handlePropertyClick = () => {
    if (bookingDetails.bookingOrders[0]?.property?.id) {
      router.push(
        `/profile/host/${bookingDetails.bookingOrders[0].property.id}`
      )
    }
  }

  const handleCompleteBooking = async () => {
    setIsCompleting(true)
    try {
      await completeBooking(bookingDetails.id)
      toast.success('Booking marked as completed successfully.')
      setIsModalOpen(false)
      refreshBooking()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to complete booking.'
      )
    } finally {
      setIsCompleting(false)
    }
  }

  const property = bookingDetails.bookingOrders[0]?.property
  const { Icon: StatusIcon } = statusCfg

  return (
    <>
      {/* ── PAGE BODY ─────────────────────────────────────────────────────── */}
      <div className="max-w-[560px] mx-auto px-4 pt-5 pb-10 space-y-4">

        {/* PROPERTY CARD */}
        {property && (
          <button
            onClick={handlePropertyClick}
            className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
          >
            <div className="w-10 h-10 rounded-xl bg-deep-teal/10 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-deep-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate group-hover:text-deep-teal transition-colors">
                {property.title}
              </p>
              <p className="text-xs text-neutral-gray flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {[property.address, property.district, property.province]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-deep-teal transition-colors" />
          </button>
        )}

        {/* STATUS BANNER */}
        <div
          className={cn(
            'flex items-center gap-3 p-4 rounded-2xl border',
            statusCfg.bg,
            statusCfg.border
          )}
        >
          <StatusIcon className={cn('w-5 h-5 shrink-0', statusCfg.iconColor)} />
          <div>
            <p className={cn('text-sm font-semibold', statusCfg.textColor)}>
              {statusCfg.label}
            </p>
            {statusSubtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{statusSubtitle}</p>
            )}
          </div>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-x divide-gray-100">
          {(
            [
              {
                Icon: Moon,
                label: 'Nights',
                value: nights,
                color: 'text-deep-teal',
              },
              {
                Icon: PawPrint,
                label: 'Pets',
                value: bookingDetails.numberOfPets,
                color: 'text-accent-orange',
              },
              {
                Icon: Home,
                label: 'Rooms',
                value: totalRooms,
                color: 'text-positive-green',
              },
            ] as const
          ).map(({ Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-4">
              <Icon className={cn('w-4 h-4', color)} />
              <p className="text-xl font-bold text-gray-900 leading-none">
                {value}
              </p>
              <p className="text-[10px] text-neutral-gray uppercase tracking-wide">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* DATES */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-gray uppercase tracking-wider mb-2">
                <CalendarCheck className="w-3 h-3 text-deep-teal" />
                Check-in
              </div>
              <p className="text-lg font-bold text-gray-900 leading-tight">
                {format(new Date(bookingDetails.checkInDate), 'MMM d')}
              </p>
              <p className="text-xs text-neutral-gray mt-0.5">
                {format(new Date(bookingDetails.checkInDate), 'EEE · yyyy')}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-gray uppercase tracking-wider mb-2">
                <CalendarX className="w-3 h-3 text-accent-orange" />
                Check-out
              </div>
              <p className="text-lg font-bold text-gray-900 leading-tight">
                {format(new Date(bookingDetails.checkOutDate), 'MMM d')}
              </p>
              <p className="text-xs text-neutral-gray mt-0.5">
                {format(new Date(bookingDetails.checkOutDate), 'EEE · yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* GUEST */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-[10px] font-semibold text-neutral-gray uppercase tracking-wider">
            Guest
          </p>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-deep-teal/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-deep-teal">
                {guestInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {bookingDetails.guest.firstName} {bookingDetails.guest.lastName}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-1">
                <Mail className="w-3 h-3 shrink-0" />
                {bookingDetails.guest.email}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-0.5">
                <Phone className="w-3 h-3 shrink-0" />
                {bookingDetails.guest.phone}
              </p>
            </div>
          </div>
        </div>

        {/* PET PROFILES */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-neutral-gray uppercase tracking-wider px-1 flex items-center gap-1.5">
            <PawPrint className="w-3 h-3" />
            Pet Profiles ({bookingDetails.numberOfPets})
          </p>

          {bookingDetails.petProfiles && bookingDetails.petProfiles.length > 0 ? (
            bookingDetails.petProfiles.map((pet) => (
              <PetProfileCard key={pet.id} pet={pet} />
            ))
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  No pet profiles attached
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  The guest booked for {bookingDetails.numberOfPets}{' '}
                  {bookingDetails.numberOfPets > 1 ? 'pets' : 'pet'} but did
                  not attach any pet profiles.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ROOMS & PRICING */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-neutral-gray uppercase tracking-wider">
              Rooms & Pricing · {nights} {nights > 1 ? 'nights' : 'night'}
            </p>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-3">
            {priceSummary.breakdown.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-neutral-gray mt-0.5">
                    {item.quantity} {item.quantity > 1 ? 'rooms' : 'room'} ×{' '}
                    ฿{item.pricePerRoom.toLocaleString()}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 shrink-0">
                  ฿{item.total.toLocaleString()}
                </p>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <p className="font-semibold text-gray-900">Total</p>
              <p className="text-lg font-bold text-deep-teal">
                ฿{priceSummary.total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* GUEST REVIEW */}
        {bookingDetails.rating != null && bookingDetails.rating > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[10px] font-semibold text-neutral-gray uppercase tracking-wider">
              Guest Review
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'w-4 h-4',
                      star <= bookingDetails.rating!
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-200'
                    )}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {bookingDetails.rating}/5
              </span>
              <span className="text-xs text-neutral-gray">
                by {bookingDetails.guest.firstName}{' '}
                {bookingDetails.guest.lastName}
              </span>
            </div>
            {bookingDetails.comment && (
              <p className="text-sm text-gray-600 bg-off-white rounded-xl px-3 py-3 leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                &quot;{bookingDetails.comment}&quot;
              </p>
            )}
          </div>
        )}

        {/* ACTION BUTTON */}
        {statusKey === 'CONFIRMED' && (
          <div className="pt-2 space-y-1.5">
            <Button
              className="w-full h-12 text-base font-semibold rounded-2xl"
              disabled={!canComplete.allowed || isCompleting}
              onClick={() => setIsModalOpen(true)}
            >
              {isCompleting ? (
                <Spinner className="size-4 mr-2" />
              ) : (
                <CheckCircle className="size-4 mr-2" />
              )}
              Mark as Completed
            </Button>
            {!canComplete.allowed && (
              <p className="text-center text-[11px] text-neutral-gray">
                {canComplete.reason}
              </p>
            )}
          </div>
        )}

        {/* BOOKING META */}
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-gray">
          <span>Booking #{bookingDetails.id}</span>
          <span>·</span>
          <span>
            {format(
              new Date(bookingDetails.createdAt),
              'MMM d, yyyy · h:mm a'
            )}
          </span>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCompleteBooking}
        title="Complete Booking"
        message="Are you sure you want to mark this booking as successful? This action cannot be undone."
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-deep-teal hover:bg-deep-teal/90"
      />

    </>
  )
}
