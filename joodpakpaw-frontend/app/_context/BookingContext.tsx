'use client'

import * as React from 'react'
import { DateRange } from 'react-day-picker'
import { PetProfile, PetSizeCategory, RoomCategories } from '@/types'
import {
  getAllPetProfiles,
  getPetSizeCategories,
  searchRoomCategories,
} from '@/lib/api'
import { normalizeRoomCategories } from '@/lib/utils'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'

interface BookingData {
  roomCategories: RoomCategories[]
  selectedRooms: Record<number, number>
  searchedNumberOfNights: number
}

interface BookingContextType {
  // Shared State
  date: DateRange | undefined
  selectedPetIds: number[]
  numberOfPets: number
  petSizeId: number | undefined
  loading: boolean
  error: string | null

  // Shared Pet Data
  petProfiles: PetProfile[]
  petProfilesLoading: boolean
  petSizeCategories: PetSizeCategory[]
  selectedPets: PetProfile[]
  activePetCount: number
  stayNights: number

  // Property-specific State (for the current property)
  currentPropertyData: Partial<BookingData>

  // Setters & Handlers
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>
  setSelectedPetIds: React.Dispatch<React.SetStateAction<number[]>>
  setNumberOfPets: React.Dispatch<React.SetStateAction<number>>
  setPetSizeId: React.Dispatch<React.SetStateAction<number | undefined>>
  handleSelectChange: (
    categoryId: number,
    value: number,
    overridePropertyId?: string | number
  ) => void
  handleSearch: (
    propertyId: number,
    checkInDate: string,
    checkOutDate: string,
    petCount: number,
    petSizeId?: number
  ) => Promise<void>
  handlePetSizeUpdated: (petId: number, newSizeCategoryId: number) => void
  hydrateDatesFromQuery: (
    checkIn?: string | null,
    checkOut?: string | null
  ) => void
  clearBookingState: () => void
}

const BookingContext = React.createContext<BookingContextType | undefined>(
  undefined
)

function parseIsoDay(raw?: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [y, m, d] = raw.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null
  }
  return parsed
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const getInitialBookingState = () => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('booking_state')
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState)
          if (parsedState.date?.from)
            parsedState.date.from = new Date(parsedState.date.from)
          if (parsedState.date?.to)
            parsedState.date.to = new Date(parsedState.date.to)
          return parsedState
        } catch (e) {
          console.error(
            'Failed to parse saved booking state from sessionStorage',
            e
          )
        }
      }
    }
    return {
      date: undefined,
      selectedPetIds: [],
      numberOfPets: 0,
      petSizeId: undefined,
      bookingData: {},
    }
  }

  const initialState = React.useRef(getInitialBookingState()).current

  const [date, setDate] = React.useState<DateRange | undefined>(
    initialState.date
  )
  const [selectedPetIds, setSelectedPetIds] = React.useState<number[]>(
    initialState.selectedPetIds ?? []
  )
  const [numberOfPets, setNumberOfPets] = React.useState<number>(
    initialState.numberOfPets ?? 0
  )
  const [petSizeId, setPetSizeId] = React.useState<number | undefined>(
    initialState.petSizeId
  )

  const [bookingData, setBookingData] = React.useState<
    Record<string, Partial<BookingData>>
  >(initialState.bookingData)

  const [petProfiles, setPetProfiles] = React.useState<PetProfile[]>([])
  const [petProfilesLoading, setPetProfilesLoading] = React.useState(false)
  const [petSizeCategories, setPetSizeCategories] = React.useState<
    PetSizeCategory[]
  >([])

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const params = useParams()
  const { isAuthenticated } = useAuth()
  const currentPropertyId = params.propertyId as string | undefined
  const prevAuthRef = React.useRef(isAuthenticated)

  const clearBookingState = React.useCallback(() => {
    setBookingData({})
    setDate(undefined)
    setSelectedPetIds([])
    setNumberOfPets(0)
    setPetSizeId(undefined)
    setError(null)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('booking_state')
    }
  }, [])

  React.useEffect(() => {
    let active = true
    getPetSizeCategories()
      .then((res) => {
        if (active) setPetSizeCategories(res.petSizeCategories)
      })
      .catch(() => {
        if (active) setPetSizeCategories([])
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    const wasAuth = prevAuthRef.current
    prevAuthRef.current = isAuthenticated

    if (!isAuthenticated) {
      if (wasAuth) {
        queueMicrotask(() => {
          setPetProfiles([])
          setPetProfilesLoading(false)
          clearBookingState()
        })
      }
      return
    }

    let active = true
    Promise.resolve().then(() => {
      if (active) setPetProfilesLoading(true)
    })

    getAllPetProfiles()
      .then((res) => {
        if (active) setPetProfiles(res.petProfiles)
      })
      .catch(() => {
        if (active) setPetProfiles([])
      })
      .finally(() => {
        if (active) setPetProfilesLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAuthenticated, clearBookingState])

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stateToSave = {
        date,
        selectedPetIds,
        numberOfPets,
        petSizeId,
        bookingData,
      }
      sessionStorage.setItem('booking_state', JSON.stringify(stateToSave))
    }
  }, [date, selectedPetIds, numberOfPets, petSizeId, bookingData])

  const handlePetSizeUpdated = React.useCallback(
    (petId: number, newSizeCategoryId: number) => {
      setPetProfiles((prev) =>
        prev.map((p) =>
          p.id === petId ? { ...p, petSizeCategoryId: newSizeCategoryId } : p
        )
      )
    },
    []
  )

  const hydrateDatesFromQuery = React.useCallback(
    (checkIn?: string | null, checkOut?: string | null) => {
      const from = parseIsoDay(checkIn)
      const to = parseIsoDay(checkOut)
      if (!from || !to || differenceInDays(to, from) < 1) return

      const now = new Date()
      const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const todayBangkok = new Date(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate()
      )
      if (from < todayBangkok) return

      setDate((prev) => {
        if (
          prev?.from?.getTime() === from.getTime() &&
          prev?.to?.getTime() === to.getTime()
        ) {
          return prev
        }
        return { from, to }
      })
    },
    []
  )

  const handleSelectChange = React.useCallback(
    (
      categoryId: number,
      value: number,
      overridePropertyId?: string | number
    ) => {
      const targetKey =
        overridePropertyId !== undefined
          ? String(overridePropertyId)
          : currentPropertyId
      if (!targetKey) return

      setBookingData((prev) => {
        const currentPropertyBookingData = prev[targetKey] ?? {}
        const currentSelectedRooms =
          currentPropertyBookingData.selectedRooms ?? {}

        const newSelectedRooms = { ...currentSelectedRooms }
        if (value <= 0) {
          delete newSelectedRooms[categoryId]
        } else {
          newSelectedRooms[categoryId] = value
        }

        return {
          ...prev,
          [targetKey]: {
            ...currentPropertyBookingData,
            selectedRooms: newSelectedRooms,
          },
        }
      })
    },
    [currentPropertyId]
  )

  const handleSearch = React.useCallback(
    async (
      searchPropertyId: number,
      checkInDate: string,
      checkOutDate: string,
      petCount: number,
      searchPetSizeId?: number
    ) => {
      if (!checkInDate || !checkOutDate) {
        toast.error('Please select check-in and check-out dates.')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const response = await searchRoomCategories(
          searchPropertyId,
          checkInDate,
          checkOutDate,
          petCount,
          searchPetSizeId
        )
        const normalizedCategories = normalizeRoomCategories(
          response.roomCategories
        )

        const fromDate = parseIsoDay(checkInDate)
        const toDate = parseIsoDay(checkOutDate)
        const nights =
          fromDate && toDate
            ? Math.max(0, differenceInDays(toDate, fromDate))
            : 0

        setBookingData((prev) => ({
          ...prev,
          [String(searchPropertyId)]: {
            ...prev[String(searchPropertyId)],
            roomCategories: normalizedCategories,
            searchedNumberOfNights: nights,
          },
        }))
      } catch {
        setError('Failed to search for rooms.')
        toast.error('Failed to search for rooms.')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const visiblePetProfiles = React.useMemo(
    () => (isAuthenticated ? petProfiles : []),
    [isAuthenticated, petProfiles]
  )

  const selectedPets = React.useMemo(
    () => visiblePetProfiles.filter((p) => selectedPetIds.includes(p.id)),
    [visiblePetProfiles, selectedPetIds]
  )

  const activePetCount =
    selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets

  const stayNights = React.useMemo(() => {
    if (!date?.from || !date?.to) return 0
    return Math.max(0, differenceInDays(date.to, date.from))
  }, [date])

  const currentPropertyData = React.useMemo(
    () => (currentPropertyId ? (bookingData[currentPropertyId] ?? {}) : {}),
    [bookingData, currentPropertyId]
  )

  const value: BookingContextType = React.useMemo(
    () => ({
      date,
      selectedPetIds,
      numberOfPets,
      petSizeId,
      loading,
      error,
      petProfiles: visiblePetProfiles,
      petProfilesLoading,
      petSizeCategories,
      selectedPets,
      activePetCount,
      stayNights,
      currentPropertyData,
      setDate,
      setSelectedPetIds,
      setNumberOfPets,
      setPetSizeId,
      handleSelectChange,
      handleSearch,
      handlePetSizeUpdated,
      hydrateDatesFromQuery,
      clearBookingState,
    }),
    [
      date,
      selectedPetIds,
      numberOfPets,
      petSizeId,
      loading,
      error,
      visiblePetProfiles,
      petProfilesLoading,
      petSizeCategories,
      selectedPets,
      activePetCount,
      stayNights,
      currentPropertyData,
      handleSelectChange,
      handleSearch,
      handlePetSizeUpdated,
      hydrateDatesFromQuery,
      clearBookingState,
    ]
  )

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  )
}

export function useBooking() {
  const context = React.useContext(BookingContext)
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider')
  }
  return context
}
