'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { RoomCategories, BookingDetail, PetProfile } from '@/types'
import { CalendarCheck, CalendarX, PawPrint, Moon, ClipboardList } from 'lucide-react'
import Image from 'next/image'
import { cn, getApiImageUrl } from '@/lib/utils'
import PaymentSection from './PaymentSection'

interface ConfirmBookingDisplayProps {
  bookingDetails: BookingDetail
  fetchedRoomCategories: RoomCategories[]
  petProfiles: PetProfile[]
  isBookingLoading: boolean
  setIsBookingLoading: (loading: boolean) => void
  guestNote?: string
  onGuestNoteChange?: (note: string) => void
}

export default function ConfirmBookingDisplay({
  bookingDetails,
  fetchedRoomCategories,
  petProfiles,
  isBookingLoading,
  setIsBookingLoading,
  guestNote: controlledGuestNote,
  onGuestNoteChange,
}: ConfirmBookingDisplayProps) {
  const router = useRouter()
  const [internalGuestNote, setInternalGuestNote] = React.useState(
    bookingDetails.guestNote ?? ''
  )
  const guestNote = controlledGuestNote ?? internalGuestNote

  const handleGuestNoteChange = (nextNote: string) => {
    setInternalGuestNote(nextNote)
    onGuestNoteChange?.(nextNote)
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
      const price = (roomCategory?.availability?.totalPrice ?? (nightlyRate * nights)) * roomCount
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

  // Only show the profiles that were selected in the drawer
  const selectedPets = petProfiles.filter((p) =>
    bookingDetails.petProfileIds.includes(p.id)
  )

  const handleCancel = () => {
    router.push(`/${bookingDetails.propertyId}?drawer=open`)
  }

  const priceSummaryNode = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-neutral-gray">
          Price details
        </h4>
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
              {detail.name} (฿{detail.nightlyRate.toLocaleString()} × {nights} {nights === 1 ? 'night' : 'nights'}{detail.count > 1 ? ` × ${detail.count} rooms` : ''})
            </span>
            <span className="font-medium tabular-nums shrink-0">
              ฿{detail.price.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex justify-between text-sm text-foreground">
          <span className="text-neutral-gray">Platform service fee</span>
          <span className="text-positive-green font-medium">฿0 (0% Launch promo)</span>
        </div>
        <div className="flex justify-between text-sm text-foreground">
          <span className="text-neutral-gray">Cleaning & pet sanitization</span>
          <span className="text-neutral-gray">Included</span>
        </div>
      </div>
      <div className="border-t border-border pt-3 mt-3 flex justify-between items-baseline">
        <span className="font-semibold text-foreground">Total payable</span>
        <span className="text-xl font-bold text-deep-teal tabular-nums">
          ฿{finalPrice.toLocaleString()}
        </span>
      </div>

      {/* Pricing & cancellation terms */}
      <div className="mt-4 p-4 bg-off-white/80 rounded-xl border border-border text-xs space-y-1.5 text-neutral-gray">
        <p className="font-medium text-deep-teal">Transparent pricing & terms</p>
        <p>• Free cancellation up to 24 hours prior to check-in (14:00 ICT).</p>
        <p>• Zero hidden fees — pet care, boarding space, and platform support included.</p>
      </div>
    </div>
  )

  const stayDetailsNode = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border space-y-4">
      {/* Property */}
      <div>
        <h3 className="text-deep-teal text-xl font-semibold leading-tight">
          {fetchedRoomCategories[0]?.property?.title || 'Your stay'}
        </h3>
        {fetchedRoomCategories[0]?.property?.address && (
          <p className="text-neutral-gray text-sm mt-1">
            {fetchedRoomCategories[0].property.address}
          </p>
        )}
      </div>

      <hr className="border-border" />

      {/* Dates */}
      <div>
        <h4 className="text-xs font-medium text-neutral-gray mb-3">
          Dates
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded-xl p-4 bg-off-white flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0 border border-border/50">
              <CalendarCheck className="w-5 h-5 text-deep-teal" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray">
                Check-in
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {format(checkInDate, 'EEE, MMM d')}
              </p>
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 bg-off-white flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0 border border-border/50">
              <CalendarX className="w-5 h-5 text-accent-orange" />
            </div>
            <div>
              <p className="text-xs text-neutral-gray">
                Check-out
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {format(checkOutDate, 'EEE, MMM d')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <Moon className="w-3.5 h-3.5 text-neutral-gray" />
          <p className="text-sm text-neutral-gray">
            <span className="font-medium text-foreground">{nights}</span>{' '}
            {nights === 1 ? 'night' : 'nights'}
          </p>
        </div>
      </div>

      <hr className="border-border" />

      {/* Selected Pets — read-only */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PawPrint className="w-4 h-4 text-accent-orange" />
          <h4 className="text-xs font-medium text-neutral-gray">
            Pets
          </h4>
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
            // Fallback: no profiles — show pet count
            <span className="text-sm text-neutral-gray">
              {bookingDetails.petCount} pet
              {bookingDetails.petCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <hr className="border-border" />

      {/* Selected Rooms */}
      <div>
        <h4 className="text-xs font-medium text-neutral-gray mb-3">
          Selected rooms
        </h4>
        <div className="space-y-2">
          {Object.entries(bookingDetails.selectedRooms).map(([id, count]) => (
            <div
              key={id}
              className="flex justify-between items-center p-4 bg-off-white rounded-xl border border-border"
            >
              <span className="text-foreground font-medium text-sm">
                {bookingDetails.roomNames[id] || `Room ${id}`}
              </span>
              <span className="text-sm font-semibold text-deep-teal tabular-nums">
                &times; {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-border" />

      {/* Guest Care Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent-orange" />
            <h4 className="text-xs font-medium text-neutral-gray">
              Guest care notes
            </h4>
          </div>
          <span className="text-[11px] text-neutral-gray tabular-nums">
            {guestNote.length} / 500
          </span>
        </div>
        <p className="text-xs text-neutral-gray mb-2.5">
          Special instructions for the host regarding feeding schedule, medication, daily habits, or emergency contacts.
        </p>
        <textarea
          id="guest-note"
          name="guestNote"
          rows={3}
          maxLength={500}
          value={guestNote}
          onChange={(e) => handleGuestNoteChange(e.target.value)}
          placeholder="e.g., Feed Milo wet food at 08:00 and 18:00 daily. Takes joint supplement with breakfast. Friendly with calm dogs."
          className="w-full rounded-xl border border-border bg-white p-3 text-sm text-foreground placeholder:text-neutral-gray/60 focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/30 transition-colors resize-y min-h-[88px]"
        />
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-64 lg:pb-10 pt-4 space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-deep-teal font-semibold text-lg lg:text-xl">
          Confirm booking
        </h2>
      </div>

      <PaymentSection
        bookingDetails={bookingDetails}
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
