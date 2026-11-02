'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, Star, ChevronDown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookingRoomCard } from './BookingRoomCard'
import { BookingSearchBar, SearchParams } from './BookingSearchBar'
import { useBooking } from '@/app/_context/BookingContext'
import { useAuth } from '@/app/_components/AuthContext'
import { getAllPetProfiles, getPetSizeCategories } from '@/lib/api'
import { PetProfile, PetSizeCategory } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface BookingDrawerProps {
  propertyId: number
  /** Desktop sidebar mode — renders as sticky card, not fixed bottom bar */
  sidebarMode?: boolean
  startingPrice?: number
  avgRating?: number
  reviewCount?: number
}

export function BookingDrawer({
  propertyId,
  sidebarMode = false,
  startingPrice,
  avgRating,
  reviewCount,
}: BookingDrawerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { requireAuth, isAuthenticated } = useAuth()

  const {
    loading,
    error,
    date,
    setDate,
    selectedPetIds,
    setSelectedPetIds,
    numberOfPets,
    setNumberOfPets,
    petSizeId,
    setPetSizeId,
    handleSelectChange,
    handleSearch,
    currentPropertyData,
  } = useBooking()

  const {
    roomCategories = [],
    selectedRooms = {},
    searchedNumberOfNights = 0,
  } = currentPropertyData

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [petProfiles, setPetProfiles] = React.useState<PetProfile[]>([])
  const [petProfilesLoading, setPetProfilesLoading] = React.useState(false)
  const [petSizeCategories, setPetSizeCategories] = React.useState<PetSizeCategory[]>([])
  const [inlinePanelOpen, setInlinePanelOpen] = React.useState(false)

  React.useEffect(() => {
    getPetSizeCategories()
      .then((res) => setPetSizeCategories(res.petSizeCategories))
      .catch(() => setPetSizeCategories([]))
  }, [])

  const handlePetSizeUpdated = (petId: number, newSizeCategoryId: number) => {
    setPetProfiles((prev) =>
      prev.map((p) =>
        p.id === petId ? { ...p, petSizeCategoryId: newSizeCategoryId } : p
      )
    )
  }

  React.useEffect(() => {
    if (!isAuthenticated) {
      setPetProfiles([])
      return
    }
    setPetProfilesLoading(true)
    getAllPetProfiles()
      .then((res) => setPetProfiles(res.petProfiles))
      .catch(() => setPetProfiles([]))
      .finally(() => setPetProfilesLoading(false))
  }, [isAuthenticated])

  React.useEffect(() => {
    if (sidebarMode) return
    if (searchParams.get('drawer') === 'open') {
      setIsDrawerOpen(true)
    } else {
      setIsDrawerOpen(false)
    }
  }, [searchParams, sidebarMode])

  const handleOpenChange = (open: boolean) => {
    setIsDrawerOpen(open)
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (open) {
      newSearchParams.set('drawer', 'open')
    } else {
      newSearchParams.delete('drawer')
    }
    router.replace(`?${newSearchParams.toString()}`, { scroll: false })
  }

  const totalSelectedRooms = React.useMemo(() => {
    return Object.values(selectedRooms).reduce(
      (sum: number, count: number) => sum + count,
      0
    )
  }, [selectedRooms])

  const activePetCount = selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets

  const isContinueDisabled = React.useMemo(() => {
    return totalSelectedRooms === 0 || !date?.from || !date?.to || activePetCount === 0
  }, [totalSelectedRooms, date, activePetCount])

  const onSearch = (params: SearchParams) => {
    if (!params.checkInDate || !params.checkOutDate) {
      toast.error('Please select check-in and check-out dates.')
      return
    }
    handleSearch(
      propertyId,
      params.checkInDate,
      params.checkOutDate,
      params.petCount,
      params.petSizeId
    )
  }

  const handleContinue = () => {
    if (!requireAuth()) return

    if (activePetCount === 0) {
      toast.error('Please select at least one pet.')
      return
    }
    if (totalSelectedRooms === 0) {
      toast.error('Please select at least one room.')
      return
    }
    if (!date?.from || !date?.to) {
      toast.error('Please select valid dates.')
      return
    }

    const roomNames: { [key: string]: string } = {}
    Object.keys(selectedRooms).forEach((roomId) => {
      const roomCategory = roomCategories.find((cat) => cat.id.toString() === roomId)
      if (roomCategory) roomNames[roomId] = roomCategory.name
    })

    const currentSearchParams = new URLSearchParams(searchParams.toString())
    if (isDrawerOpen) currentSearchParams.set('drawer', 'open')
    else currentSearchParams.delete('drawer')

    router.push(
      `/booking/confirm?propertyId=${propertyId}` +
        `&start=${format(date.from, 'yyyy-MM-dd')}` +
        `&end=${format(date.to, 'yyyy-MM-dd')}` +
        (selectedPetIds.length > 0
          ? `&petIds=${selectedPetIds.join(',')}`
          : `&pets=${numberOfPets}`) +
        `&rooms=${encodeURIComponent(JSON.stringify(selectedRooms))}` +
        `&roomNames=${encodeURIComponent(JSON.stringify(roomNames))}` +
        (currentSearchParams.toString() ? `&${currentSearchParams.toString()}` : '')
    )
  }

  const petCountText = React.useMemo(() => {
    if (selectedPetIds.length > 0) {
      const names = petProfiles.filter((p) => selectedPetIds.includes(p.id)).map((p) => p.name)
      if (names.length === 0) return `${selectedPetIds.length} pet${selectedPetIds.length > 1 ? 's' : ''}`
      if (names.length <= 2) return names.join(', ')
      return `${names[0]}, +${names.length - 1} more`
    }
    if (numberOfPets > 0) return `${numberOfPets} pet${numberOfPets > 1 ? 's' : ''}`
    return 'Select pets'
  }, [selectedPetIds, numberOfPets, petProfiles])

  const roomCountText = React.useMemo(() => {
    if (totalSelectedRooms > 0) return `${totalSelectedRooms} room${totalSelectedRooms > 1 ? 's' : ''}`
    return '0 rooms'
  }, [totalSelectedRooms])

  const combinedText = React.useMemo(() => {
    if (activePetCount === 0 && totalSelectedRooms === 0) return "When is your pet's stay?"
    return `${petCountText} • ${roomCountText}`
  }, [petCountText, roomCountText, activePetCount, totalSelectedRooms])

  const bookingForm = (
    <>
      <BookingSearchBar
        onSearch={onSearch}
        date={date}
        setDate={setDate}
        selectedPetIds={selectedPetIds}
        setSelectedPetIds={setSelectedPetIds}
        numberOfPets={numberOfPets}
        setNumberOfPets={setNumberOfPets}
        petSizeId={petSizeId}
        setPetSizeId={setPetSizeId}
        petProfiles={petProfiles}
        petProfilesLoading={petProfilesLoading}
        petSizeCategories={petSizeCategories}
        onPetSizeUpdated={handlePetSizeUpdated}
        inlineMode={true}
        onInlinePanelChange={setInlinePanelOpen}
      />
      {!inlinePanelOpen && (
        <>
          {searchedNumberOfNights > 0 && (
            <p className="text-sm font-medium text-deep-teal mt-1 mb-2">
              Select a Room for {searchedNumberOfNights} night{searchedNumberOfNights > 1 ? 's' : ''}
            </p>
          )}
          {loading && <div className="flex justify-center py-4"><Spinner /></div>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!loading && !error && (
            <BookingRoomCard
              categories={roomCategories}
              selectedRooms={selectedRooms}
              onSelectChange={handleSelectChange}
            />
          )}
        </>
      )}
    </>
  )

  /* ── Desktop sidebar card ─────────────────────────────────── */
  if (sidebarMode) {
    return (
      <div className="rounded-2xl border border-gray-200 shadow-xl bg-white overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-br from-deep-teal/5 to-transparent">
          {startingPrice ? (
            <div className="flex items-end gap-1.5">
              <span className="text-xs text-neutral-gray">from</span>
              <span className="text-2xl font-bold text-deep-teal">
                {startingPrice.toLocaleString()}
              </span>
              <span className="text-sm text-neutral-gray mb-0.5">THB / night</span>
            </div>
          ) : (
            <p className="text-lg font-semibold text-deep-teal">Book a Stay</p>
          )}
          {avgRating != null && avgRating > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" strokeWidth={0} />
              <span className="text-sm font-medium text-gray-700">{avgRating.toFixed(1)}</span>
              {reviewCount != null && reviewCount > 0 && (
                <span className="text-xs text-gray-400">({reviewCount} reviews)</span>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {bookingForm}

          {searchedNumberOfNights > 0 && totalSelectedRooms > 0 && (
            <div className="border-t pt-4 flex items-center justify-between text-sm">
              <span className="text-neutral-gray">
                {totalSelectedRooms} room{totalSelectedRooms > 1 ? 's' : ''} × {searchedNumberOfNights} night{searchedNumberOfNights > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <Button
            onClick={handleContinue}
            disabled={isContinueDisabled}
            className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white py-3 text-base font-semibold rounded-xl"
          >
            Book Now
          </Button>
        </div>
      </div>
    )
  }

  /* ── Mobile fixed bottom bar ──────────────────────────────── */
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-off-white border-t p-4 flex items-center justify-between z-10 max-w-5xl mx-auto rounded-t-[20px] shadow-lg">
      <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="p-2 border border-accent-orange rounded-full">
              <CalendarIcon className="h-6 w-6 text-accent-orange" />
            </div>
            <div>
              <h4 className="leading-none">
                {date?.from && date?.to
                  ? `${format(date.from, 'MMM dd')} - ${format(date.to, 'MMM dd')}`
                  : 'Pick your date'}
              </h4>
              <p className="text-neutral-gray">{combinedText}</p>
            </div>
          </div>
        </DrawerTrigger>

        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl h-[80vh] flex flex-col">
            <DrawerHeader className="relative flex flex-row items-center justify-center px-5">
              <DrawerClose asChild>
                <button className="absolute left-5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </DrawerClose>
              <div className="text-center">
                <DrawerTitle>Select Dates And Rooms</DrawerTitle>
                <DrawerDescription>Find the perfect room for your pet&apos;s stay.</DrawerDescription>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3">
              {bookingForm}
            </div>

            <DrawerFooter>
              <Button className="bg-positive-green" onClick={handleContinue} disabled={isContinueDisabled}>
                Continue
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Button
        variant="default"
        className="p-5 bg-accent-orange"
        onClick={handleContinue}
        disabled={isContinueDisabled}
      >
        Book Now
      </Button>
    </div>
  )
}
