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
  ChevronLeft,
  ChevronRight,
  XCircle,
  Hourglass,
  CalendarCheck,
  CalendarX,
  Send,
  Receipt,
  Eye,
  FileText,
  ClipboardList,
  MessageCircle,
} from 'lucide-react'
import { HostBookingDetail, HostBookingPetProfile } from '@/types'
import {
  completeBooking,
  replyToBookingReview,
  hostAcceptBooking,
  createChatRoom,
} from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { useRouter } from 'next/navigation'
import { cn, getApiImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { HostReplyBlock } from '@/app/_components/HostReplyBlock'
import { HostDeclineModal } from './HostDeclineModal'
import { PaymentSlipModal } from '@/app/profile/host/_components/PaymentSlipModal'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { useChat } from '@/app/_components/ChatContext'

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

function PetProfileCard({ pet }: { pet: HostBookingPetProfile }) {
  const energyRating = pet.petEnergy?.rating ?? 0

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border">
        <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
          <PawPrint className="w-[18px] h-[18px] text-accent-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground leading-tight">{pet.name}</p>
          <p className="text-xs text-neutral-gray capitalize mt-0.5">
            {pet.petTypeName} — {pet.breedName}
          </p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0 bg-off-white text-neutral-gray border border-border">
          {pet.sex}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-5 text-sm text-foreground/90">
          <span className="flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-neutral-gray" />
            <span className="capitalize">{pet.petSizeName}</span>
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <CalendarCheck className="w-3.5 h-3.5 text-neutral-gray" />
            {getPetAge(pet.birthDate)} old
          </span>
        </div>

        {energyRating > 0 && (
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
            <span className="text-xs text-neutral-gray">Energy level</span>
            <div className="flex gap-1" aria-label={`Energy ${energyRating} of 5`}>
              {[1, 2, 3, 4, 5].map((bar) => (
                <span
                  key={bar}
                  className={cn(
                    'w-4 h-1.5 rounded-sm',
                    bar <= energyRating ? 'bg-accent-orange' : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {energyRating}/5
            </span>
          </div>
        )}

        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray">
            <Contact className="w-3.5 h-3.5" />
            Emergency contact
          </p>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <User className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
            {pet.contactName || 'No contact specified'}
          </p>
          {pet.contactPhone && (
            <p className="flex items-center gap-1.5 text-sm text-foreground tabular-nums">
              <Phone className="w-3.5 h-3.5 text-neutral-gray shrink-0" />
              {pet.contactPhone}
            </p>
          )}
        </div>

        {pet.note && (
          <div className="border-t border-border pt-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-1.5">
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
  const { rooms, refreshRooms } = useChat()

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false)
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)

  // Message Guest dialog state
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)

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
          ? `Payment deadline ${format(new Date(bookingDetails.paymentDeadlineAt), 'MMM d, h:mm a')}`
          : `Requested ${format(new Date(bookingDetails.createdAt), 'MMM d, yyyy h:mm a')}`
      case 'SUCCESSFUL':
        return bookingDetails.successedAt
          ? `Completed on ${format(new Date(bookingDetails.successedAt), 'MMM d, yyyy')}`
          : null
      case 'CANCELLED': {
        const cancelledByActor =
          bookingDetails.cancelledBy === 'host'
            ? 'you (host)'
            : bookingDetails.cancelledBy === 'system'
            ? 'system (auto-expired)'
            : 'guest'
        return `Cancelled by ${cancelledByActor} on ${format(new Date(bookingDetails.updatedAt), 'MMM d, yyyy')}`
      }
      default:
        return null
    }
  }, [bookingDetails, statusKey])

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

  const guestInitials = `${bookingDetails.guest.firstName?.[0] ?? ''}${bookingDetails.guest.lastName?.[0] ?? ''}`.toUpperCase()

  const existingChatRoom = useMemo(
    () =>
      rooms.find((r) => r.otherUser?.id === bookingDetails.guest.userId) ??
      null,
    [rooms, bookingDetails.guest.userId]
  )

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
      router.push(
        `/profile/host/${bookingDetails.bookingOrders[0].property.id}`
      )
    }
  }

  const handleAcceptBooking = async () => {
    setIsAccepting(true)
    try {
      await hostAcceptBooking(bookingDetails.id)
      toast.success('Booking reservation accepted successfully.')
      setIsAcceptModalOpen(false)
      setIsSlipModalOpen(false)
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

  const handleMessageGuestClick = () => {
    if (existingChatRoom) {
      router.push(
        `/chat/${existingChatRoom.id}?from=${encodeURIComponent(`/profile/host/booking/${bookingDetails.id}`)}`
      )
      return
    }
    setChatMessage(
      `Hi Khun ${bookingDetails.guest.firstName}, regarding your stay (#${bookingDetails.id}) at ${bookingDetails.bookingOrders[0]?.property?.title || 'our property'}: `
    )
    setIsChatDialogOpen(true)
  }

  const handleSendInitialChat = async () => {
    if (!chatMessage.trim() || isSendingChat) return
    setIsSendingChat(true)
    try {
      const propertyId = bookingDetails.bookingOrders[0]?.property?.id
      const room = await createChatRoom(
        bookingDetails.guest.userId,
        chatMessage.trim(),
        propertyId
      )
      await refreshRooms()
      setIsChatDialogOpen(false)
      toast.success('Message sent to guest.')
      router.push(
        `/chat/${room.id}?from=${encodeURIComponent(`/profile/host/booking/${bookingDetails.id}`)}`
      )
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to message guest.'
      )
    } finally {
      setIsSendingChat(false)
    }
  }

  const property = bookingDetails.bookingOrders[0]?.property
  const { Icon: StatusIcon } = statusCfg
  const rawSlipUrl = bookingDetails.paymentSlipUrl
  const resolvedSlipUrl = rawSlipUrl
    ? getApiImageUrl(rawSlipUrl) || rawSlipUrl
    : null

  return (
    <>
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-16 space-y-5">
        {/* Desktop Editorial Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/profile/host?tab=bookings')}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Bookings Queue
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-deep-teal tabular-nums">
                  Booking #{bookingDetails.id}
                </h1>
                <span
                  className={cn(
                    'text-xs font-semibold px-2.5 py-0.5 rounded-full border border-border/50',
                    statusCfg.pillBg,
                    statusCfg.pillText
                  )}
                >
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
                Created{' '}
                {format(new Date(bookingDetails.createdAt), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleMessageGuestClick}
            className="hidden lg:inline-flex items-center gap-2 rounded-xl border-deep-teal/30 text-deep-teal hover:bg-off-white text-xs font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            {existingChatRoom ? 'Open Guest Chat' : 'Message Guest'}
          </Button>
        </div>

        {/* 2-Column Operations Workspace */}
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start space-y-5 lg:space-y-0">
          {/* LEFT COLUMN: Stay & Pet Care Information */}
          <div className="space-y-4 min-w-0">
            {/* Property Card */}
            {property && (
              <button
                type="button"
                onClick={handlePropertyClick}
                className="w-full text-left bg-white rounded-2xl border border-border p-4 flex items-center gap-3 hover:border-deep-teal/40 transition-colors group cursor-pointer"
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

            {/* Status Banner */}
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
                      ? 'Booking request pending approval'
                      : statusKey === 'CANCELLED'
                      ? 'Booking cancelled'
                      : statusCfg.label}
                  </p>
                  {statusSubtitle && (
                    <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
                      {statusSubtitle}
                    </p>
                  )}
                </div>
              </div>

              {statusKey === 'CANCELLED' && bookingDetails.cancellationReason && (
                <div className="mt-1 bg-white rounded-xl p-3 border border-red-200 text-xs text-red-900 leading-relaxed">
                  <span className="font-semibold">Reason provided: </span>
                  {bookingDetails.cancellationReason}
                </div>
              )}
            </div>

            {/* Quick Stats + ICT Check-in/out */}
            <div className="grid grid-cols-3 bg-white rounded-2xl border border-border overflow-hidden divide-x divide-border">
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

            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-deep-teal" />
                    Check-in
                  </div>
                  <p className="text-lg font-bold text-foreground leading-tight tabular-nums">
                    {format(new Date(bookingDetails.checkInDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-deep-teal font-medium mt-1 tabular-nums">
                    {format(new Date(bookingDetails.checkInDate), 'EEEE')} from 14:00 ICT
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-gray mb-1.5">
                    <CalendarX className="w-3.5 h-3.5 text-accent-orange" />
                    Check-out
                  </div>
                  <p className="text-lg font-bold text-foreground leading-tight tabular-nums">
                    {format(new Date(bookingDetails.checkOutDate), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-accent-orange font-medium mt-1 tabular-nums">
                    {format(new Date(bookingDetails.checkOutDate), 'EEEE')} by 12:00 ICT
                  </p>
                </div>
              </div>
            </div>

            {/* Guest Pet Care Notes */}
            {bookingDetails.guestNote && (
              <div className="bg-white rounded-2xl p-4 border border-border space-y-2">
                <div className="flex items-center gap-2 text-deep-teal">
                  <ClipboardList className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-semibold">
                    Guest pet care notes &amp; special instructions
                  </h4>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed bg-off-white/80 p-4 rounded-xl border border-border/60">
                  {bookingDetails.guestNote}
                </p>
              </div>
            )}

            {/* Guest Contact */}
            <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-gray">Guest</p>
                <button
                  type="button"
                  onClick={handleMessageGuestClick}
                  className="lg:hidden inline-flex items-center gap-1 text-xs font-semibold text-deep-teal hover:underline cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {existingChatRoom ? 'Open Chat' : 'Message Guest'}
                </button>
              </div>
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
                  <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-1 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {bookingDetails.guest.email}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-neutral-gray mt-0.5 tabular-nums">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {bookingDetails.guest.phone || 'No phone provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Pet Profiles */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-neutral-gray px-1 flex items-center gap-1.5 tabular-nums">
                <PawPrint className="w-3.5 h-3.5" />
                Pet profiles ({bookingDetails.numberOfPets})
              </p>

              {bookingDetails.petProfiles && bookingDetails.petProfiles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bookingDetails.petProfiles.map((pet) => (
                    <PetProfileCard key={pet.id} pet={pet} />
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">
                      No pet profiles attached
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5 tabular-nums">
                      The guest booked for {bookingDetails.numberOfPets}{' '}
                      {bookingDetails.numberOfPets > 1 ? 'pets' : 'pet'} without attaching profiles.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Guest Review & Reply */}
            {bookingDetails.rating != null && bookingDetails.rating > 0 && (
              <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
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
                  <span className="text-sm font-semibold text-foreground tabular-nums">
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
                      <span className="text-xs text-neutral-gray">
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
                          'text-xs tabular-nums',
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
          </div>

          {/* RIGHT STICKY RAIL: Payment Slip, Pricing Breakdown, Action CTAs */}
          <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto modern-scrollbar space-y-4">
            {/* Rooms & Pricing Summary */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-off-white/50 flex items-center justify-between">
                <p className="text-xs font-semibold text-deep-teal">
                  Rooms &amp; pricing summary
                </p>
                <span className="text-xs text-neutral-gray tabular-nums">
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
              </div>
              <div className="px-4 py-3.5 space-y-3">
                {priceSummary.breakdown.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
                        {item.quantity} {item.quantity > 1 ? 'rooms' : 'room'} x ฿
                        {item.pricePerRoom.toLocaleString()}
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

            {/* PromptPay Transfer Verification Card */}
            {resolvedSlipUrl ? (
              <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-deep-teal shrink-0" />
                    <h4 className="text-xs font-semibold text-foreground">
                      PromptPay slip
                    </h4>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Slip attached
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSlipModalOpen(true)}
                    className="relative group w-16 h-16 rounded-xl overflow-hidden border border-border bg-off-white shrink-0 cursor-pointer"
                    title="Inspect transfer slip"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedSlipUrl}
                      alt="PromptPay payment slip"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-gray">Expected amount</p>
                    <p className="text-sm font-bold text-deep-teal tabular-nums">
                      ฿{priceSummary.total.toLocaleString()}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSlipModalOpen(true)}
                      className="mt-2 h-8 px-3 rounded-xl text-xs font-medium border-border hover:bg-off-white text-foreground w-full"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-deep-teal" />
                      Inspect Zoom Slip
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-border p-4 flex items-center gap-3 text-neutral-gray">
                <div className="w-10 h-10 rounded-xl bg-off-white flex items-center justify-center shrink-0 border border-border/60">
                  <FileText className="w-5 h-5 text-neutral-gray" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    No payment slip uploaded
                  </p>
                  <p className="text-xs text-neutral-gray mt-0.5 leading-snug">
                    Guest has not attached a PromptPay transfer receipt yet.
                  </p>
                </div>
              </div>
            )}

            {/* Primary Operations Buttons */}
            {statusKey === 'PENDING' && (
              <div className="bg-white rounded-2xl border border-border p-4 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 text-xs font-semibold rounded-xl border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                    disabled={isAccepting}
                    onClick={() => setIsDeclineModalOpen(true)}
                  >
                    <XCircle className="size-4 mr-1.5 text-red-600" />
                    Decline
                  </Button>
                  <Button
                    type="button"
                    className="h-11 text-xs font-semibold rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white transition-colors"
                    disabled={isAccepting}
                    onClick={() => setIsAcceptModalOpen(true)}
                  >
                    {isAccepting ? (
                      <Spinner className="size-4 mr-1.5" />
                    ) : (
                      <CheckCircle2 className="size-4 mr-1.5" />
                    )}
                    {isAccepting ? 'Accepting...' : 'Accept Booking'}
                  </Button>
                </div>
                <p className="text-center text-xs text-neutral-gray leading-snug">
                  Declining releases reserved room dates back to your inventory.
                </p>
              </div>
            )}

            {statusKey === 'CONFIRMED' && (
              <div className="bg-white rounded-2xl border border-border p-4 space-y-2.5">
                <Button
                  type="button"
                  className="w-full h-11 text-sm font-semibold rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors disabled:bg-off-white disabled:text-neutral-gray/60"
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
                <p className="text-center text-xs text-neutral-gray leading-snug">
                  Auto-completes after 18:00 (UTC+7) on check-out day if not completed manually.
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleMessageGuestClick}
              className="w-full h-10 rounded-xl border-deep-teal/30 text-deep-teal hover:bg-off-white text-xs font-semibold"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              {existingChatRoom ? 'Open Guest Chat' : 'Message Guest'}
            </Button>
          </aside>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        onConfirm={handleAcceptBooking}
        title="Accept Booking Request"
        message="Are you sure you want to accept this reservation request? This will confirm the booking and notify the guest that their stay is secured."
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-deep-teal hover:bg-deep-teal/90 text-white"
      />

      <HostDeclineModal
        bookingId={bookingDetails.id}
        isOpen={isDeclineModalOpen}
        onClose={() => setIsDeclineModalOpen(false)}
        onSuccess={refreshBooking}
      />

      <ConfirmationModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={handleCompleteBooking}
        title="Complete Booking"
        message="Are you sure you want to mark this booking as completed? This confirms that the pet has checked out successfully and opens the 14-day verified review period for the guest."
        titleClassName="text-accent-orange"
        confirmButtonClassName="bg-accent-orange hover:bg-accent-orange/90 text-white"
      />

      <PaymentSlipModal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        slipUrl={resolvedSlipUrl}
        bookingId={bookingDetails.id}
        expectedTotal={priceSummary.total}
        isPending={statusKey === 'PENDING'}
        onAcceptBooking={handleAcceptBooking}
        isAccepting={isAccepting}
      />

      {/* Message Guest Dialog when no room exists yet */}
      <Dialog open={isChatDialogOpen} onOpenChange={setIsChatDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-deep-teal">
              Message {bookingDetails.guest.firstName}
            </DialogTitle>
            <DialogDescription>
              Start a conversation regarding Booking #{bookingDetails.id}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            rows={4}
            placeholder="Write a message to your guest..."
            className="resize-none rounded-xl border-border text-sm"
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsChatDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendInitialChat}
              disabled={!chatMessage.trim() || isSendingChat}
              className="bg-deep-teal hover:bg-deep-teal/90 text-white"
            >
              {isSendingChat ? (
                <Spinner className="w-4 h-4 mr-1.5" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              Send &amp; Open Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
