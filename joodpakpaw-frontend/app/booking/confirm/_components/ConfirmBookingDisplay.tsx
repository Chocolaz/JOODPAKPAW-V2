'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { RoomCategories, BookingDetail, PetProfile } from '@/types'
import { CalendarCheck, CalendarX, ArrowLeft, PawPrint, Moon } from 'lucide-react'
import Image from 'next/image'
import { cn, getApiImageUrl } from '@/lib/utils'
import PaymentSection from './PaymentSection'

interface ConfirmBookingDisplayProps {
  bookingDetails: BookingDetail
  fetchedRoomCategories: RoomCategories[]
  petProfiles: PetProfile[]
  isBookingLoading: boolean
  setIsBookingLoading: (loading: boolean) => void
}

export default function ConfirmBookingDisplay({
  bookingDetails,
  fetchedRoomCategories,
  petProfiles,
  isBookingLoading,
  setIsBookingLoading,
}: ConfirmBookingDisplayProps) {
  const router = useRouter()

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
      const price = (roomCategory?.availability?.totalPrice ?? 0) * roomCount
      return {
        id,
        count: roomCount,
        name: bookingDetails.roomNames[id] || `Room ${id}`,
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

  return (
    <div className="container mx-auto max-w-[500px] px-5 pb-64 pt-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-deep-teal" />
        </button>
        <h2 className="text-deep-teal font-semibold text-lg">
          Confirm Booking
        </h2>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 space-y-5">
        {/* Property */}
        <div>
          <h3 className="text-deep-teal text-xl font-semibold leading-tight">
            {fetchedRoomCategories[0]?.property?.title || 'Your Trip'}
          </h3>
          {fetchedRoomCategories[0]?.property?.address && (
            <p className="text-neutral-gray text-sm mt-1">
              {fetchedRoomCategories[0].property.address}
            </p>
          )}
        </div>

        <hr className="border-gray-100" />

        {/* Dates */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-gray mb-3">
            Dates
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-xl p-4 bg-off-white flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                <CalendarCheck className="w-5 h-5 text-deep-teal" />
              </div>
              <div>
                <p className="text-xs text-neutral-gray uppercase tracking-wide">
                  Check-in
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {format(checkInDate, 'EEE, MMM d')}
                </p>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-off-white flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                <CalendarX className="w-5 h-5 text-accent-orange" />
              </div>
              <div>
                <p className="text-xs text-neutral-gray uppercase tracking-wide">
                  Check-out
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {format(checkOutDate, 'EEE, MMM d')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3">
            <Moon className="w-3.5 h-3.5 text-neutral-gray" />
            <p className="text-sm text-gray-600">
              <span className="font-medium">{nights}</span>{' '}
              {nights === 1 ? 'night' : 'nights'}
            </p>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Selected Pets — read-only */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PawPrint className="w-4 h-4 text-accent-orange" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-gray">
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
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                    {getApiImageUrl(pet.image) ? (
                      <Image
                        src={getApiImageUrl(pet.image)!}
                        alt={pet.name}
                        width={24}
                        height={24}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <PawPrint className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-accent-orange">
                    {pet.name}
                  </span>
                </div>
              ))
            ) : (
              // Fallback: no profiles — show pet count
              <span className="text-sm text-gray-600">
                {bookingDetails.petCount} pet
                {bookingDetails.petCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Selected Rooms */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-gray mb-3">
            Selected Rooms
          </h4>
          <div className="space-y-2">
            {Object.entries(bookingDetails.selectedRooms).map(([id, count]) => (
              <div
                key={id}
                className="flex justify-between items-center p-3.5 bg-off-white rounded-xl border border-gray-200"
              >
                <span className="text-gray-800 font-medium text-sm">
                  {bookingDetails.roomNames[id] || `Room ${id}`}
                </span>
                <span className="text-sm font-semibold text-deep-teal">
                  &times; {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Price Summary */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-gray mb-3">
            Price Summary
            {nights > 0 && (
              <span className="ml-1 normal-case font-normal">
                ({nights} {nights === 1 ? 'night' : 'nights'})
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {priceDetails.map((detail) => (
              <div
                key={detail.id}
                className="flex justify-between text-sm text-gray-700"
              >
                <span>
                  {detail.name} &times; {detail.count}
                </span>
                <span>THB {detail.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 mt-3 flex justify-between items-baseline">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-deep-teal">
              THB {finalPrice.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <PaymentSection
        bookingDetails={bookingDetails}
        isBookingLoading={isBookingLoading}
        setIsBookingLoading={setIsBookingLoading}
        onCancel={handleCancel}
      />
    </div>
  )
}
