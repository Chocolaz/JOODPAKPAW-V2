'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { searchRoomCategories, getAllPetProfiles } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import { RoomCategories, BookingDetail, PetProfile } from '@/types'
import ConfirmBookingDisplay from './ConfirmBookingDisplay'

export default function ConfirmBookingDataLoader() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()

  const [bookingDetails, setBookingDetails] = useState<BookingDetail | null>(null)
  const [fetchedRoomCategories, setFetchedRoomCategories] = useState<RoomCategories[]>([])
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isBookingLoading, setIsBookingLoading] = useState(false)

  useEffect(() => {
    const fetchBookingData = async () => {
      if (!isAuthenticated) {
        toast.error('Please login to continue')
        router.push('/authen')
        return
      }

      const propertyId = searchParams.get('propertyId')
      const start = searchParams.get('start')
      const end = searchParams.get('end')
      const petIdsParam = searchParams.get('petIds')
      const petsParam = searchParams.get('pets')
      const rooms = searchParams.get('rooms')
      const roomNames = searchParams.get('roomNames')

      if (!propertyId || !start || !end || (!petIdsParam && !petsParam) || !rooms || !roomNames) {
        toast.error('Missing booking details')
        router.push('/')
        return
      }

      try {
        // petIds = profile-based path, pets = number-only fallback
        const petProfileIds = petIdsParam
          ? petIdsParam.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)
          : []
        const petCount = petProfileIds.length > 0
          ? petProfileIds.length
          : Number(petsParam) || 0

        if (petCount === 0) {
          toast.error('No pets selected')
          router.push('/')
          return
        }

        const parsedRooms = JSON.parse(decodeURIComponent(rooms))
        const parsedRoomNames = JSON.parse(decodeURIComponent(roomNames))
        const propertyIdNum = Number(propertyId)

        setBookingDetails({
          propertyId: propertyIdNum,
          checkInDate: start,
          checkOutDate: end,
          petProfileIds,
          petCount,
          selectedRooms: parsedRooms,
          roomNames: parsedRoomNames,
        })

        const [roomResponse, petProfilesResponse] = await Promise.all([
          searchRoomCategories(propertyIdNum, start, end, petCount),
          getAllPetProfiles(),
        ])

        setFetchedRoomCategories(roomResponse.roomCategories)
        setPetProfiles(petProfilesResponse.petProfiles)
      } catch (err) {
        console.error('Error fetching booking data or parsing params:', err)
        toast.error('Invalid booking data or failed to fetch details.')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchBookingData()
  }, [isAuthenticated, searchParams, router])

  if (loading)
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Spinner />
      </div>
    )

  if (!bookingDetails)
    return (
      <div className="min-h-screen flex justify-center items-center">
        <p>No booking data found.</p>
      </div>
    )

  return (
    <ConfirmBookingDisplay
      bookingDetails={bookingDetails}
      fetchedRoomCategories={fetchedRoomCategories}
      petProfiles={petProfiles}
      isBookingLoading={isBookingLoading}
      setIsBookingLoading={setIsBookingLoading}
    />
  )
}
