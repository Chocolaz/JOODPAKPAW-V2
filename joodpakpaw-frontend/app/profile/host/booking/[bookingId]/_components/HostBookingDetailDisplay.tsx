'use client'

import React, { useMemo, useState, useEffect } from 'react'
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
  Send,
  Receipt,
  Eye,
  FileText,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import { HostBookingDetail, HostBookingPetProfile } from '@/types'
import { completeBooking, replyToBookingReview, hostAcceptBooking } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { useRouter } from 'next/navigation'
import { cn, getApiImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { HostReplyBlock } from '@/app/_components/HostReplyBlock'
import { HostDeclineModal } from './HostDeclineModal'
import { toast } from 'sonner'
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
    iconColor: 'text-deep-teal',
    textColor: 'text-deep-teal',
    bg: 'bg-deep-teal/10',
    border: 'border-deep-teal/20',
    pillBg: 'bg-deep-teal/10',
    pillText: 'text-deep-teal',
  },
  PENDING: {
    label: 'Pending Action',
    Icon: Hourglass,
    iconColor: 'text-amber-800',
    textColor: 'text-amber-950',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-800',
  },
  SUCCESSFUL: {
    label: 'Completed',
    Icon: CheckCircle2,
    iconColor: 'text-positive-green',
    textColor: 'text-foreground',
    bg: 'bg-positive-green/10',
    border: 'border-positive-green/20',
    pillBg: 'bg-positive-green/10',
    pillText: 'text-positive-green',
  },
  CANCELLED: {
    label: 'Cancelled',
    Icon: XCircle,
    iconColor: 'text-red-700',
    textColor: 'text-red-950',
    bg: 'bg-red-50',
    border: 'border-red-200',
    pillBg: 'bg-red-50',
    pillText: 'text-red-700',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PetProfileCard
// ─────────────────────────────────────────────────────────────────────────────

function PetProfileCard({ pet }: { pet: HostBookingPetProfile }) {
  const energyDots = pet.petEnergy?.rating ?? 0

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border">
        <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
          <PawPrint className="w-[18px] h-[18px] text-accent-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground leading-tight">{pet.name}</p>
          <p className="text-xs text-neutral-gray capitalize mt-0.5">
            {pet.petTypeName} · {pet.breedName}
          </p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0 bg-off-white text-neutral-gray border border-border">
          {pet.sex}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-3">
        {/* Size + Age */}
        <div className="flex items-center gap-5 text-sm text-foreground/90">
          <span className="flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-neutral-gray" />
            <span className="capitalize">{pet.petSizeName}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-neutral-gray" />
            {getPetAge(pet.birthDate)} old
          </span>
        </div>

        {/* Energy level */}
        {energyDots > 0 && (
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
            <span className="text-xs text-neutral-gray">Energy level</span>
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
        <div className="border-t border-border pt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray">
            <Contact className="w-3.5 h-3.5" />
            Emergency contact
          </p>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <User className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
            {pet.contactName || 'No contact specified'}
          </p>
          {pet.contactPhone && (
            <p className="flex items-center gap-1.5 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
              {pet.contactPhone}
            </p>
          )}
        </div>

        {/* Note */}
        {pet.note && (
          <div className="border-t border-border pt-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-2">
              <NotebookText className="w-3.5 h-3.5" />
              Special notes
            </p>
            <p className="text-xs text-foreground/90 bg-off-white/80 rounded-xl px-3 py-2 leading-relaxed border border-border/60">
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

  // Modals & Action states
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false)

  // Payment slip inspection modal states (Feature 14)
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [imageError, setImageError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // Review reply state
  const [replyText, setReplyText] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

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
    iconColor: 'text-neutral-gray',
    textColor: 'text-foreground',
    bg: 'bg-off-white/80',
    border: 'border-border',
    pillBg: 'bg-off-white',
    pillText: 'text-foreground',
  }

  const statusSubtitle = useMemo(() => {
    switch (statusKey) {
      case 'CONFIRMED':
        return bookingDetails.confirmedAt
          ? `Confirmed on ${format(new Date(bookingDetails.confirmedAt), 'MMM d, yyyy')}`
          : null
      case 'PENDING':
        return bookingDetails.paymentDeadlineAt
          ? `Payment window open · Deadline ${format(new Date(bookingDetails.paymentDeadlineAt), 'MMM d, h:mm a')}`
          : `Created ${format(new Date(bookingDetails.createdAt), 'MMM d, yyyy · h:mm a')}`
      case 'SUCCESSFUL':
        return bookingDetails.successedAt
          ? `Completed on ${format(new Date(bookingDetails.successedAt), 'MMM d, yyyy')}`
          : null
      case 'CANCELLED':
        const cancelledByActor =
          bookingDetails.cancelledBy === 'host'
            ? 'you (host)'
            : bookingDetails.cancelledBy === 'system'
              ? 'system (auto-expired)'
              : 'guest'
        return `Cancelled by ${cancelledByActor} · ${format(new Date(bookingDetails.updatedAt), 'MMM d, yyyy')}`
      default:
        return null
    }
  }, [bookingDetails, statusKey])

  // Inject status pill into the layout header's right slot
  useEffect(() => {
    setMenu(
      <span
        className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full border border-border/50',
          statusCfg.pillBg,
          statusCfg.pillText
        )}
      >
        {statusCfg.label}
      </span>
    )
    return () => setMenu(null)
  }, [statusCfg.label, statusCfg.pillBg, statusCfg.pillText, setMenu])

  // Reset slip modal zoom & error state upon opening
  useEffect(() => {
    if (isSlipModalOpen) {
      setZoomLevel(1)
      setImageError(false)
    }
  }, [isSlipModalOpen])

  // Feature 14: Esc key dismisses slip inspection modal
  useEffect(() => {
    if (!isSlipModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSlipModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSlipModalOpen])

  const guestInitials = `${bookingDetails.guest.firstName?.[0] ?? ''}${bookingDetails.guest.lastName?.[0] ?? ''}`.toUpperCase()

  const canComplete = useMemo(() => {
    if (statusKey !== 'CONFIRMED') {
      return { allowed: false, reason: 'Booking is not confirmed' }
    }
    const completeCutoff = bookingDetails.canCompleteAt
      ? new Date(bookingDetails.canCompleteAt)
      : new Date(`${bookingDetails.checkOutDate.slice(0, 10)}T12:00:00+07:00`)
    if (new Date() < completeCutoff) {
      const bkkDateLabel = completeCutoff.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Bangkok',
      })
      return {
        allowed: false,
        reason: `Available after 12:00 PM (UTC+7) on ${bkkDateLabel}`,
      }
    }
    return { allowed: true, reason: '' }
  }, [bookingDetails.canCompleteAt, bookingDetails.checkOutDate, statusKey])

  const handlePropertyClick = () => {
    if (bookingDetails.bookingOrders[0]?.property?.id) {
      router.push(`/profile/host/${bookingDetails.bookingOrders[0].property.id}`)
    }
  }

  // Feature 12: Host accepts pending booking
  const handleAcceptBooking = async () => {
    setIsAccepting(true)
    try {
      await hostAcceptBooking(bookingDetails.id)
      toast.success('Booking reservation accepted successfully.')
      setIsAcceptModalOpen(false)
      refreshBooking()
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to accept booking.'
      )
    } finally {
      setIsAccepting(false)
    }
  }

  // Feature 15: Host marks stay as completed
  const handleCompleteBooking = async () => {
    setIsCompleting(true)
    try {
      await completeBooking(bookingDetails.id)
      toast.success('Booking marked as completed successfully.')
      setIsCompleteModalOpen(false)
      refreshBooking()
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to complete booking.'
      )
    } finally {
      setIsCompleting(false)
    }
  }

  const handleReplySubmit = async () => {
    const trimmed = replyText.trim()
    if (!trimmed) {
      toast.error('Please enter a reply.')
      return
    }
    setIsSubmittingReply(true)
    try {
      await replyToBookingReview(bookingDetails.id, trimmed)
      toast.success('Reply posted successfully.')
      setReplyText('')
      refreshBooking()
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to post reply.'
      )
    } finally {
      setIsSubmittingReply(false)
    }
  }

  // Feature 14 zoom controls clamped strictly between 1x and 4x
  const handleZoomIn = () => setZoomLevel((z) => Math.min(4, Number((z + 0.5).toFixed(1))))
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1, Number((z - 0.5).toFixed(1))))
  const handleZoomReset = () => setZoomLevel(1)

  const property = bookingDetails.bookingOrders[0]?.property
  const { Icon: StatusIcon } = statusCfg

  // Resolve slip URL via getApiImageUrl utility
  const rawSlipUrl = bookingDetails.paymentSlipUrl
  const resolvedSlipUrl = rawSlipUrl ? (getApiImageUrl(rawSlipUrl) || rawSlipUrl) : null

  return (
    <>
      {/* ── PAGE BODY ─────────────────────────────────────────────────────── */}
      <div className="max-w-[560px] mx-auto px-4 pt-5 pb-10 space-y-4">

        {/* PROPERTY CARD */}
        {property && (
          <button
            onClick={handlePropertyClick}
            className="w-full text-left bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3 hover:border-deep-teal/40 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-deep-teal/10 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-deep-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate group-hover:text-deep-teal transition-colors">
                {property.title}
              </p>
              <p className="text-xs text-neutral-gray flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {[property.address, property.district, property.province]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-gray shrink-0 group-hover:text-deep-teal transition-colors" />
          </button>
        )}

        {/* STATUS BANNER */}
        <div
          className={cn(
            'flex flex-col gap-2 p-4 rounded-2xl border',
            statusCfg.bg,
            statusCfg.border
          )}
        >
          <div className="flex items-center gap-3">
            <StatusIcon className={cn('w-5 h-5 shrink-0', statusCfg.iconColor)} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', statusCfg.textColor)}>
                {statusKey === 'PENDING'
                  ? 'Booking request pending'
                  : statusKey === 'CANCELLED'
                    ? 'Booking cancelled'
                    : statusCfg.label}
              </p>
              {statusSubtitle && (
                <p className="text-xs text-neutral-gray mt-0.5">{statusSubtitle}</p>
              )}
            </div>
          </div>

          {/* Cancellation reason note banner */}
          {statusKey === 'CANCELLED' && bookingDetails.cancellationReason && (
            <div className="mt-1 bg-white/80 rounded-xl p-3 border border-red-200/80 text-xs text-red-900 leading-relaxed">
              <span className="font-medium">Reason provided: </span>
              {bookingDetails.cancellationReason}
            </div>
          )}
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-3 bg-white rounded-2xl border border-border shadow-sm overflow-hidden divide-x divide-border">
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
              <p className="text-xl font-bold text-foreground leading-none tabular-nums">
                {value}
              </p>
              <p className="text-xs font-medium text-neutral-gray">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* DATES WITH BANGKOK (ICT) CUTOFFS (Feature 15) */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-deep-teal" />
                Check-in
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">
                {format(new Date(bookingDetails.checkInDate), 'MMM d')}
              </p>
              <p className="text-xs text-neutral-gray mt-0.5">
                {format(new Date(bookingDetails.checkInDate), 'EEE · yyyy')}
              </p>
              <p className="text-[11px] text-deep-teal font-medium mt-1.5">
                From 14:00 ICT
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-1.5">
                <CalendarX className="w-3.5 h-3.5 text-accent-orange" />
                Check-out
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">
                {format(new Date(bookingDetails.checkOutDate), 'MMM d')}
              </p>
              <p className="text-xs text-neutral-gray mt-0.5">
                {format(new Date(bookingDetails.checkOutDate), 'EEE · yyyy')}
              </p>
              <p className="text-[11px] text-accent-orange font-medium mt-1.5">
                By 12:00 ICT
              </p>
            </div>
          </div>
        </div>

        {/* GUEST PET CARE NOTES (Feature 11 & 15 / TC-T1-F06-04) */}
        {bookingDetails.guestNote && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border space-y-2">
            <div className="flex items-center gap-2 text-deep-teal">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <h4 className="text-xs font-semibold">
                Guest pet care notes & special instructions
              </h4>
            </div>
            <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed bg-off-white/80 p-4 rounded-xl border border-border/60">
              {bookingDetails.guestNote}
            </p>
          </div>
        )}

        {/* PAYMENT SLIP VERIFICATION CARD (Feature 14) */}
        {resolvedSlipUrl ? (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-deep-teal shrink-0" />
                <h4 className="text-xs font-semibold text-foreground">
                  PromptPay transfer receipt
                </h4>
              </div>
              <span className="text-[11px] font-medium text-deep-teal bg-deep-teal/10 px-2.5 py-0.5 rounded-full border border-deep-teal/20">
                Slip attached
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Slip thumbnail */}
              <button
                type="button"
                onClick={() => setIsSlipModalOpen(true)}
                className="relative group w-14 h-14 rounded-xl overflow-hidden border border-border bg-off-white shrink-0 focus:outline-none focus:ring-2 focus:ring-deep-teal focus:ring-offset-1"
                title="Click to inspect transfer slip"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedSlipUrl}
                  alt="PromptPay payment slip"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-gray">
                  PromptPay transfer verification
                </p>
                <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                  Expected total: ฿{priceSummary.total.toLocaleString()}
                </p>
                <p className="text-[11px] text-neutral-gray mt-0.5">
                  WebP format · Uploaded receipt
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSlipModalOpen(true)}
                className="h-9 px-3 rounded-xl text-xs font-medium border-border hover:bg-off-white text-foreground shrink-0"
              >
                <Eye className="w-3.5 h-3.5 mr-1 text-deep-teal" />
                Inspect slip
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-border p-4 shadow-sm flex items-center gap-4 text-neutral-gray">
            <div className="w-10 h-10 rounded-xl bg-off-white flex items-center justify-center shrink-0 border border-border/60">
              <FileText className="w-5 h-5 text-neutral-gray" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                No payment slip uploaded
              </p>
              <p className="text-[11px] text-neutral-gray mt-0.5 leading-normal">
                The guest has not uploaded a bank transfer slip for this booking.
              </p>
            </div>
          </div>
        )}

        {/* GUEST */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-gray">
            Guest
          </p>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-deep-teal/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-deep-teal">
                {guestInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {bookingDetails.guest.firstName} {bookingDetails.guest.lastName}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-1">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {bookingDetails.guest.email}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-0.5">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {bookingDetails.guest.phone || 'No phone provided'}
              </p>
            </div>
          </div>
        </div>

        {/* PET PROFILES */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-neutral-gray px-1 flex items-center gap-1.5">
            <PawPrint className="w-3.5 h-3.5" />
            Pet profiles ({bookingDetails.numberOfPets})
          </p>

          {bookingDetails.petProfiles && bookingDetails.petProfiles.length > 0 ? (
            bookingDetails.petProfiles.map((pet) => (
              <PetProfileCard key={pet.id} pet={pet} />
            ))
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  No pet profiles attached
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  The guest booked for {bookingDetails.numberOfPets}{' '}
                  {bookingDetails.numberOfPets > 1 ? 'pets' : 'pet'} but did
                  not attach any pet profiles.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ROOMS & PRICING */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <p className="text-xs font-semibold text-neutral-gray">
              Rooms & pricing · {nights} {nights > 1 ? 'nights' : 'night'}
            </p>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-3">
            {priceSummary.breakdown.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-neutral-gray mt-0.5">
                    {item.quantity} {item.quantity > 1 ? 'rooms' : 'room'} ×{' '}
                    <span className="tabular-nums">฿{item.pricePerRoom.toLocaleString()}</span>
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                  ฿{item.total.toLocaleString()}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <p className="font-semibold text-foreground">Total</p>
              <p className="text-lg font-bold text-deep-teal tabular-nums">
                ฿{priceSummary.total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* GUEST REVIEW */}
        {bookingDetails.rating != null && bookingDetails.rating > 0 && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-gray">
              Guest review
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'w-4 h-4',
                      star <= bookingDetails.rating!
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-200'
                    )}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {bookingDetails.rating}/5
              </span>
              <span className="text-xs text-neutral-gray">
                by {bookingDetails.guest.firstName} {bookingDetails.guest.lastName}
              </span>
            </div>
            {bookingDetails.comment && (
              <p
                className="text-xs text-foreground/90 bg-off-white/80 rounded-xl px-4 py-3 leading-relaxed border border-border/60"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                &quot;{bookingDetails.comment}&quot;
              </p>
            )}

            {bookingDetails.hostReply ? (
              <HostReplyBlock
                hostReply={bookingDetails.hostReply}
                hostRepliedAt={bookingDetails.hostRepliedAt}
                className="space-y-1.5"
                textClassName="text-xs"
              />
            ) : (
              <div className="border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="host-review-reply"
                    className="text-xs font-semibold text-deep-teal"
                  >
                    Reply to review
                  </label>
                  <span className="text-[11px] text-neutral-gray">
                    One-time public reply
                  </span>
                </div>
                <Textarea
                  id="host-review-reply"
                  placeholder="Write a warm, helpful response to your guest..."
                  value={replyText}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setReplyText(e.target.value)
                    }
                  }}
                  disabled={isSubmittingReply}
                  rows={3}
                  className="resize-none border-border focus-visible:ring-deep-teal text-xs text-foreground bg-white"
                />
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-[11px]',
                      replyText.length >= 500
                        ? 'text-red-500 font-medium'
                        : 'text-neutral-gray'
                    )}
                  >
                    {replyText.length}/500
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleReplySubmit}
                    disabled={!replyText.trim() || isSubmittingReply}
                    className="bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl h-9 px-4 text-xs font-medium"
                  >
                    {isSubmittingReply ? (
                      <Spinner className="size-3.5 mr-1.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isSubmittingReply ? 'Posting...' : 'Post reply'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEATURE 12: HOST PENDING ACTION CONTROLS */}
        {statusKey === 'PENDING' && (
          <div className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Decline / Reject Button */}
              <Button
                type="button"
                variant="outline"
                className="h-12 text-sm font-semibold rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 transition-colors shadow-sm"
                disabled={isAccepting}
                onClick={() => setIsDeclineModalOpen(true)}
              >
                <XCircle className="size-4 mr-1.5 text-red-600" />
                Decline Request
              </Button>

              {/* Confirm / Accept Button */}
              <Button
                type="button"
                className="h-12 text-sm font-semibold rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white shadow-sm transition-colors"
                disabled={isAccepting}
                onClick={() => setIsAcceptModalOpen(true)}
              >
                {isAccepting ? (
                  <Spinner className="size-4 mr-1.5" />
                ) : (
                  <CheckCircle2 className="size-4 mr-1.5" />
                )}
                {isAccepting ? 'Confirming...' : 'Accept Booking'}
              </Button>
            </div>

            <p className="text-center text-[11px] text-neutral-gray leading-normal">
              Accepting confirms this stay and notifies the guest. Declining releases reserved room dates back to your inventory.
            </p>
          </div>
        )}

        {/* STAY COMPLETION CTA BUTTON (Feature 15) */}
        {statusKey === 'CONFIRMED' && (
          <div className="pt-2 space-y-2">
            <Button
              className="w-full h-12 text-sm font-semibold rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white shadow-sm transition-colors disabled:bg-off-white disabled:text-neutral-gray/50 disabled:shadow-none"
              disabled={!canComplete.allowed || isCompleting}
              onClick={() => setIsCompleteModalOpen(true)}
            >
              {isCompleting ? (
                <Spinner className="size-4 mr-2" />
              ) : (
                <CheckCircle className="size-4 mr-2" />
              )}
              Mark as Completed
            </Button>
            {!canComplete.allowed && (
              <p className="text-center text-xs text-neutral-gray">
                {canComplete.reason}
              </p>
            )}
            <p className="text-center text-[11px] text-neutral-gray leading-normal">
              If not manually completed, the booking auto-completes after 18:00 (UTC+7) on check-out day.
            </p>
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

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      {/* 1. Feature 12 Accept Confirmation Modal */}
      <ConfirmationModal
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        onConfirm={handleAcceptBooking}
        title="Accept Booking Request"
        message="Are you sure you want to accept this reservation request? This will confirm the booking and notify the guest that their stay is secured."
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-deep-teal hover:bg-deep-teal/90 text-white"
      />

      {/* 2. Feature 13 Host Decline Reason Modal */}
      <HostDeclineModal
        bookingId={bookingDetails.id}
        isOpen={isDeclineModalOpen}
        onClose={() => setIsDeclineModalOpen(false)}
        onSuccess={refreshBooking}
      />

      {/* 3. Feature 15 Complete Booking Modal */}
      <ConfirmationModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={handleCompleteBooking}
        title="Complete Booking"
        message="Are you sure you want to mark this booking as completed? This confirms that the pet has checked out successfully and opens the 14-day verified review period for the guest."
        titleClassName="text-accent-orange"
        confirmButtonClassName="bg-accent-orange hover:bg-accent-orange/90 text-white"
      />

      {/* 4. Feature 14 Payment Slip Inspection Modal (TC-T1-F14-01..05 & TC-T2-F14-01..05) */}
      {isSlipModalOpen && resolvedSlipUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSlipModalOpen(false)
            }
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-sm border border-border flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-deep-teal" />
                <span className="text-xs font-semibold text-foreground">
                  Payment transfer slip inspection
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Download / Open original */}
                <a
                  href={resolvedSlipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-foreground bg-off-white hover:bg-off-white/80 rounded-lg border border-border transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Open original
                </a>
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setIsSlipModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-gray hover:text-foreground hover:bg-off-white transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Zoom toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-off-white/80 border-b border-border text-xs text-neutral-gray shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="p-1 rounded border border-border bg-white hover:bg-off-white disabled:opacity-40 transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="tabular-nums font-medium text-foreground px-1.5">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                  className="p-1 rounded border border-border bg-white hover:bg-off-white disabled:opacity-40 transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded border border-border bg-white hover:bg-off-white text-[11px] font-medium transition-colors"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <span className="text-[11px] text-neutral-gray hidden sm:inline">
                Scroll to pan · Clamped 1x to 4x zoom
              </span>
            </div>

            {/* Image viewport */}
            <div className="relative flex-1 min-h-[300px] max-h-[65vh] overflow-auto bg-off-white/40 p-4 flex items-center justify-center">
              {imageError ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <p className="text-xs font-semibold text-foreground">
                    Unable to load transfer slip image
                  </p>
                  <p className="text-xs text-neutral-gray max-w-sm">
                    The image file could not be loaded from storage. Please verify connection and retry.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setImageError(false)
                      setRetryNonce((n) => n + 1)
                    }}
                    className="h-8 text-xs rounded-xl"
                  >
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="transition-transform duration-150 ease-out flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={retryNonce}
                    src={resolvedSlipUrl}
                    alt="PromptPay transfer slip inspection"
                    onError={() => setImageError(true)}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                    className="max-h-[60vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Footer verification bar */}
            <div className="px-4 py-3 border-t border-border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-gray">Expected total:</span>
                <span className="font-bold text-deep-teal tabular-nums text-sm">
                  ฿{priceSummary.total.toLocaleString()}
                </span>
                <span className="text-neutral-gray">·</span>
                <span className="text-neutral-gray">Booking #{bookingDetails.id}</span>
              </div>
              <p className="text-[11px] text-neutral-gray">
                Cross-check transfer account name, date, and amount before approving.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
