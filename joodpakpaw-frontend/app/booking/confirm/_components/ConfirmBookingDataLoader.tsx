'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import {
  searchRoomCategories,
  getAllPetProfiles,
  getPropertyById,
} from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import {
  RoomCategories,
  BookingDetail,
  PetProfile,
  Property,
} from '@/types'
import ConfirmBookingDisplay from './ConfirmBookingDisplay'

function CheckoutSkeleton() {
  return (
    <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-12 pt-4 lg:pt-8 space-y-6">
      <div className="hidden lg:block space-y-2">
        <Skeleton className="h-4 w-32 bg-neutral-200 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-56 bg-neutral-200 motion-reduce:animate-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-10 items-start">
        <div className="space-y-5">
          <Skeleton className="h-72 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="h-64 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}

export default function ConfirmBookingDataLoader() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [bookingDetails, setBookingDetails] = useState<BookingDetail | null>(
    null
  )
  const [fetchedRoomCategories, setFetchedRoomCategories] = useState<
    RoomCategories[]
  >([])
  const [fetchedProperty, setFetchedProperty] = useState<Property | null>(null)
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isBookingLoading, setIsBookingLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return

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

      if (
        !propertyId ||
        !start ||
        !end ||
        (!petIdsParam && !petsParam) ||
        !rooms ||
        !roomNames
      ) {
        toast.error('Missing booking details')
        router.push('/')
        return
      }

      try {
        const petProfileIds = petIdsParam
          ? petIdsParam
              .split(',')
              .map(Number)
              .filter((n) => !isNaN(n) && n > 0)
          : []
        const petCount =
          petProfileIds.length > 0
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

        const [roomResponse, petProfilesResponse, propertyResponse] =
          await Promise.all([
            searchRoomCategories(propertyIdNum, start, end, petCount),
            getAllPetProfiles(),
            getPropertyById(String(propertyIdNum)).catch(() => null),
          ])

        setFetchedRoomCategories(roomResponse.roomCategories)
        setPetProfiles(petProfilesResponse.petProfiles)
        setFetchedProperty(propertyResponse?.property ?? null)
      } catch (err) {
        console.error('Error fetching booking data or parsing params:', err)
        toast.error('Invalid booking data or failed to fetch details.')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchBookingData()
  }, [authLoading, isAuthenticated, searchParams, router])

  if (authLoading || loading) return <CheckoutSkeleton />

  if (!bookingDetails)
    return (
      <div className="min-h-screen flex justify-center items-center px-4 text-center">
        <p className="text-sm text-neutral-gray">No booking data found.</p>
      </div>
    )

  return (
    <ConfirmBookingDisplay
      bookingDetails={bookingDetails}
      fetchedRoomCategories={fetchedRoomCategories}
      petProfiles={petProfiles}
      property={fetchedProperty}
      isBookingLoading={isBookingLoading}
      setIsBookingLoading={setIsBookingLoading}
    />
  )
}
