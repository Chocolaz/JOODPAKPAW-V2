'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react'
import { useAuth } from '@/app/_components/AuthContext'
import { useHostProperties } from './host/_hooks/useHostProperties'
import { useUserPets } from './pets/_hooks/useUserPets'
import { getBookings } from '@/lib/api'
import { Property, PetProfile } from '@/types'
import { Booking } from '@/types/booking'

interface HostPropertiesState {
  properties: Property[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface PetProfilesState {
  pets: PetProfile[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface BookingsSummaryState {
  upcomingStay: Booking | null
  upcomingCount: number
  loading: boolean
  refetch: () => Promise<void>
}

interface ProfileContextType {
  setMenu: (menu: ReactNode) => void
  menu: ReactNode | null
  hostProperties: HostPropertiesState
  petProfiles: PetProfilesState
  bookingsSummary: BookingsSummaryState
}

const ProfileContext = createContext<ProfileContextType>({
  setMenu: () => {},
  menu: null,
  hostProperties: {
    properties: [],
    loading: true,
    error: null,
    refetch: async () => {},
  },
  petProfiles: {
    pets: [],
    loading: true,
    error: null,
    refetch: async () => {},
  },
  bookingsSummary: {
    upcomingStay: null,
    upcomingCount: 0,
    loading: true,
    refetch: async () => {},
  },
})

export const useProfileContext = () => useContext(ProfileContext)

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const isHost = user?.role?.some((role) => role.name === 'host')

  const [menu, setMenu] = useState<ReactNode | null>(null)
  const hostProperties = useHostProperties({ enabled: !!isHost })
  const petProfiles = useUserPets({ enabled: !!user })

  const [upcomingStay, setUpcomingStay] = useState<Booking | null>(null)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const fetchBookingsSummary = useCallback(async () => {
    if (!user?.id) {
      setUpcomingStay(null)
      setUpcomingCount(0)
      setBookingsLoading(false)
      return
    }
    setBookingsLoading(true)
    try {
      const res = await getBookings(1, 10)
      const upcoming = res.data
        .filter((b) => {
          const status = b.bookingStatus.toUpperCase()
          return status === 'CONFIRMED' || status === 'PENDING'
        })
        .sort(
          (a, b) =>
            new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
        )
      setUpcomingStay(upcoming[0] ?? null)
      setUpcomingCount(upcoming.length)
    } catch {
      setUpcomingStay(null)
      setUpcomingCount(0)
    } finally {
      setBookingsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setUpcomingStay(null)
      setUpcomingCount(0)
      setBookingsLoading(false)
      return
    }

    const load = async () => {
      setBookingsLoading(true)
      try {
        const res = await getBookings(1, 10)
        if (cancelled) return
        const upcoming = res.data
          .filter((b) => {
            const status = b.bookingStatus.toUpperCase()
            return status === 'CONFIRMED' || status === 'PENDING'
          })
          .sort(
            (a, b) =>
              new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
          )
        setUpcomingStay(upcoming[0] ?? null)
        setUpcomingCount(upcoming.length)
      } catch {
        if (!cancelled) {
          setUpcomingStay(null)
          setUpcomingCount(0)
        }
      } finally {
        if (!cancelled) setBookingsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const bookingsSummary = useMemo<BookingsSummaryState>(
    () => ({
      upcomingStay,
      upcomingCount,
      loading: bookingsLoading,
      refetch: fetchBookingsSummary,
    }),
    [upcomingStay, upcomingCount, bookingsLoading, fetchBookingsSummary]
  )

  const value = useMemo<ProfileContextType>(
    () => ({
      menu,
      setMenu,
      hostProperties,
      petProfiles,
      bookingsSummary,
    }),
    [menu, hostProperties, petProfiles, bookingsSummary]
  )

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}
