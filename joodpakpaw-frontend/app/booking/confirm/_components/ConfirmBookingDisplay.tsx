'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  RoomCategories,
  BookingDetail,
  PetProfile,
  Property,
} from '@/types'
import {
  CalendarCheck,
  CalendarX,
  PawPrint,
  Moon,
  ClipboardList,
  ChevronLeft,
  Star,
  Check,
  Building2,
} from 'lucide-react'
import Image from 'next/image'
import { cn, getApiImageUrl } from '@/lib/utils'
import PaymentSection from './PaymentSection'

interface ConfirmBookingDisplayProps {
  bookingDetails: BookingDetail
  fetchedRoomCategories: RoomCategories[]
  petProfiles: PetProfile[]
  property?: Property | null
  isBookingLoading: boolean
  setIsBookingLoading: (loading: boolean) => void
  guestNote?: string
  onGuestNoteChange?: (note: string) => void
}

const GUEST_NOTE_MAX_LENGTH = 255

export default function ConfirmBookingDisplay({
  bookingDetails,
  fetchedRoomCategories,
  petProfiles,
  property,
  isBookingLoading,
  setIsBookingLoading,
  guestNote: controlledGuestNote,
  onGuestNoteChange,
}: ConfirmBookingDisplayProps) {
  const router = useRouter()
  const [internalGuestNote, setInternalGuestNote] = React.useState(
    (bookingDetails.guestNote ?? '').slice(0, GUEST_NOTE_MAX_LENGTH)
  )
  const guestNote = controlledGuestNote ?? internalGuestNote

  const handleGuestNoteChange = (nextNote: string) => {
    const clamped = nextNote.slice(0, GUEST_NOTE_MAX_LENGTH)
    setInternalGuestNote(clamped)
    onGuestNoteChange?.(clamped)
  }

  const checkInDate = new Date(bookingDetails.checkInDate)
  const checkOutDate = new Date(bookingDetails.checkOutDate)

  const nights =
    !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())
      ? Math.max(
          0,
          Math.round(
            (checkOutDate.getTime() - checkInDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0

  const priceDetails = Object.entries(bookingDetails.selectedRooms).map(
    ([id, count]) => {
      const roomCategory = fetchedRoomCategories.find(
        (rc) => rc.id === Number(id)
      )
      const roomCount = count ?? 0
      const nightlyRate =
        roomCategory?.availability?.totalPrice && nights > 0
          ? Math.round(roomCategory.availability.totalPrice / nights)
          : (roomCategory?.basePrice ?? 0)
      const price =
        (roomCategory?.availability?.totalPrice ?? nightlyRate * nights) *
        roomCount
      return {
        id,
        count: roomCount,
        name: bookingDetails.roomNames[id] || `Room ${id}`,
        nightlyRate,
        price,
      }
    }
  )

  const finalPrice = priceDetails.reduce((acc, d) => acc + d.price, 0)

  const selectedPets = petProfiles.filter((p) =>
    bookingDetails.petProfileIds.includes(p.id)
  )

  const backToPropertyHref = `/detail/${bookingDetails.propertyId}?drawer=open`

  const handleCancel = () => {
    router.push(backToPropertyHref)
  }

  const propertyTitle =
    property?.title || fetchedRoomCategories[0]?.property?.title || 'Your stay'
  const propertyLocation = property
    ? [property.district, property.province].filter(Boolean).join(', ')
    : fetchedRoomCategories[0]?.property?.address || ''
  const coverImage = getApiImageUrl(property?.images?.[0]?.filePath)

  const priceSummaryNode = (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Airbnb-style Property Snapshot */}
      <div className="p-5 border-b border-border flex items-center gap-3.5 bg-off-white/30">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border bg-off-white shrink-0 flex items-center justify-center">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={propertyTitle}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <Building2 className="w-6 h-6 text-neutral-gray" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-sm text-deep-teal line-clamp-2 leading-snug">
            {propertyTitle}
          </p>
          {propertyLocation && (
            <p className="text-xs text-neutral-gray truncate">
              {propertyLocation}
            </p>
          )}
          {property && property.avgRating > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Star
                className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"
                strokeWidth={0}
              />
              <span className="font-semibold text-foreground tabular-nums">
                {property.avgRating.toFixed(1)}
              </span>
              {property.reviewCount != null && property.reviewCount > 0 && (
                <span className="text-neutral-gray tabular-nums">
                  ({property.reviewCount})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Price Details */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Price details</h3>
          {nights > 0 && (
            <span className="text-xs text-neutral-gray tabular-nums">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {priceDetails.map((detail) => (
            <div
              key={detail.id}
              className="flex justify-between gap-3 text-sm text-foreground"
            >
              <span className="text-neutral-gray">
                {detail.name} (฿{detail.nightlyRate.toLocaleString()} × {nights}{' '}
                {nights === 1 ? 'night' : 'nights'}
                {detail.count > 1 ? ` × ${detail.count} rooms` : ''})
              </span>
              <span className="font-medium tabular-nums shrink-0">
                ฿{detail.price.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-foreground">
            <span className="text-neutral-gray">Platform service fee</span>
            <span className="text-positive-green font-medium">
              ฿0 (0% Launch promo)
            </span>
          </div>
          <div className="flex justify-between text-sm text-foreground">
            <span className="text-neutral-gray">
              Cleaning &amp; pet sanitization
            </span>
            <span className="text-neutral-gray">Included</span>
          </div>
        </div>

        <div className="border-t border-border pt-3.5 flex justify-between items-baseline">
          <span className="font-semibold text-foreground">Total payable</span>
          <span className="text-xl font-bold text-deep-teal tabular-nums">
            ฿{finalPrice.toLocaleString()}
          </span>
        </div>

        {/* Transparent Terms */}
        <div className="p-3.5 bg-off-white/70 rounded-xl border border-border text-xs space-y-1.5 text-neutral-gray">
          <p className="font-semibold text-deep-teal">
            Transparent pricing &amp; terms
          </p>
          <p className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-deep-teal shrink-0 mt-0.5" />
            <span>
              Free cancellation up to 24 hours prior to check-in (14:00 ICT).
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-deep-teal shrink-0 mt-0.5" />
            <span>
              Zero hidden fees — pet care, boarding space, and platform support
              included.
            </span>
          </p>
        </div>
      </div>
    </div>
  )

  const stayDetailsNode = (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-border space-y-5">
      <div>
        <h2 className="font-semibold text-deep-teal">Your trip</h2>
        <p className="text-sm text-neutral-gray mt-0.5">{propertyTitle}</p>
      </div>

      <hr className="border-border" />

      {/* Dates */}
      <div>
        <h3 className="text-xs font-semibold text-neutral-gray mb-3">Dates</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded-xl p-3.5 bg-off-white/60 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shrink-0 border border-border">
              <CalendarCheck className="w-4 h-4 text-deep-teal" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray">Check-in</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                {format(checkInDate, 'EEE, MMM d')}
              </p>
            </div>
          </div>

          <div className="border border-border rounded-xl p-3.5 bg-off-white/60 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shrink-0 border border-border">
              <CalendarX className="w-4 h-4 text-accent-orange" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray">Check-out</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                {format(checkOutDate, 'EEE, MMM d')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <Moon className="w-3.5 h-3.5 text-neutral-gray" />
          <p className="text-sm text-neutral-gray tabular-nums">
            <span className="font-semibold text-foreground">{nights}</span>{' '}
            {nights === 1 ? 'night' : 'nights'}
          </p>
        </div>
      </div>

      <hr className="border-border" />

      {/* Selected Pets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PawPrint className="w-4 h-4 text-accent-orange" />
          <h3 className="text-xs font-semibold text-neutral-gray">Pets</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedPets.length > 0 ? (
            selectedPets.map((pet) => (
              <div
                key={pet.id}
                className={cn(
                  'flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full',
                  'border border-accent-orange/30 bg-accent-orange/5'
                )}
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-off-white shrink-0 flex items-center justify-center">
                  {getApiImageUrl(pet.image) ? (
                    <Image
                      src={getApiImageUrl(pet.image)!}
                      alt={pet.name}
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <PawPrint className="w-3.5 h-3.5 text-neutral-gray" />
                  )}
                </div>
                <span className="text-sm font-medium text-accent-orange">
                  {pet.name}
                </span>
              </div>
            ))
          ) : (
            <span className="text-sm text-neutral-gray tabular-nums">
              {bookingDetails.petCount}{' '}
              {bookingDetails.petCount === 1 ? 'pet' : 'pets'}
            </span>
          )}
        </div>
      </div>

      <hr className="border-border" />

      {/* Selected Rooms */}
      <div>
        <h3 className="text-xs font-semibold text-neutral-gray mb-3">
          Selected rooms
        </h3>
        <div className="space-y-2">
          {Object.entries(bookingDetails.selectedRooms).map(([id, count]) => (
            <div
              key={id}
              className="flex justify-between items-center p-3.5 bg-off-white/60 rounded-xl border border-border"
            >
              <span className="text-foreground font-medium text-sm capitalize">
                {bookingDetails.roomNames[id] || `Room ${id}`}
              </span>
              <span className="text-sm font-semibold text-deep-teal tabular-nums">
                × {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-border" />

      {/* Guest Care Notes — aligned to DB VARCHAR(255) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent-orange" />
            <label
              htmlFor="guest-note"
              className="text-xs font-semibold text-neutral-gray"
            >
              Guest care notes
            </label>
          </div>
          <span className="text-xs text-neutral-gray tabular-nums">
            {guestNote.length} / {GUEST_NOTE_MAX_LENGTH}
          </span>
        </div>
        <p className="text-xs text-neutral-gray mb-2.5">
          Special instructions for feeding schedule, medication, daily habits,
          or emergency contacts.
        </p>
        <textarea
          id="guest-note"
          name="guestNote"
          rows={3}
          maxLength={GUEST_NOTE_MAX_LENGTH}
          value={guestNote}
          onChange={(e) => handleGuestNoteChange(e.target.value)}
          placeholder="e.g., Feed Milo wet food at 08:00 and 18:00 daily. Takes joint supplement with breakfast."
          className="w-full rounded-xl border border-border bg-white p-3 text-sm text-foreground placeholder:text-neutral-gray/70 focus:border-deep-teal focus:outline-none focus:ring-1 focus:ring-deep-teal/20 transition-colors resize-y min-h-[88px]"
        />
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pb-44 lg:pb-12 pt-4 lg:pt-8 space-y-5">
      {/* Desktop Editorial Back Link + Page Heading */}
      <div className="hidden lg:block space-y-2">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-gray hover:text-deep-teal transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to property</span>
        </button>
        <h1 className="font-bold text-deep-teal">Confirm and pay</h1>
      </div>

      <PaymentSection
        bookingDetails={bookingDetails}
        totalAmount={finalPrice}
        guestNote={guestNote.trim() || null}
        isBookingLoading={isBookingLoading}
        setIsBookingLoading={setIsBookingLoading}
        onCancel={handleCancel}
        stayDetailsNode={stayDetailsNode}
        priceSummaryNode={priceSummaryNode}
      />
    </div>
  )
}
