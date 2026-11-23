'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, Star, ChevronDown, X } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  BookingRoomCard,
  getRoomIneligibilityReason,
} from './BookingRoomCard'
import {
  BookingSearchBar,
  InlinePanel,
  SearchParams,
} from './BookingSearchBar'
import { useBooking } from '@/app/_context/BookingContext'
import { useAuth } from '@/app/_components/AuthContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { RoomCategories } from '@/types'

const EMPTY_CATEGORIES: RoomCategories[] = []
const EMPTY_SELECTED_ROOMS: Record<number, number> = {}

interface BookingDrawerProps {
  propertyId: number
  /** Desktop sidebar mode — renders as sticky card, not fixed bottom bar */
  sidebarMode?: boolean
  startingPrice?: number
  avgRating?: number
  reviewCount?: number
  /** Controlled desktop inline panel */
  inlinePanel?: InlinePanel
  onInlinePanelChange?: (panel: InlinePanel) => void
}

export function BookingDrawer({
  propertyId,
  sidebarMode = false,
  startingPrice,
  avgRating,
  reviewCount,
  inlinePanel,
  onInlinePanelChange,
}: BookingDrawerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { requireAuth } = useAuth()

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
    petProfiles,
    petProfilesLoading,
    petSizeCategories,
    selectedPets,
    activePetCount,
    stayNights,
    handlePetSizeUpdated,
    handleSelectChange,
    handleSearch,
    currentPropertyData,
  } = useBooking()

  const {
    roomCategories = EMPTY_CATEGORIES,
    selectedRooms = EMPTY_SELECTED_ROOMS,
    searchedNumberOfNights = 0,
  } = currentPropertyData

  const [localDrawerOpen, setLocalDrawerOpen] = React.useState(false)
  const [uncontrolledPanel, setUncontrolledPanel] =
    React.useState<InlinePanel>(null)
  const [mobileInlinePanel, setMobileInlinePanel] =
    React.useState<InlinePanel>(null)

  const activeDesktopPanel =
    inlinePanel !== undefined ? inlinePanel : uncontrolledPanel
  const setDesktopPanel = onInlinePanelChange ?? setUncontrolledPanel

  const isDrawerOpen =
    !sidebarMode && (searchParams.get('drawer') === 'open' || localDrawerOpen)

  const handleOpenChange = (open: boolean) => {
    setLocalDrawerOpen(open)
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (open) {
      newSearchParams.set('drawer', 'open')
    } else {
      newSearchParams.delete('drawer')
    }
    const qs = newSearchParams.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const totalSelectedRooms = React.useMemo(() => {
    return Object.values(selectedRooms).reduce(
      (sum: number, count: number) => sum + count,
      0
    )
  }, [selectedRooms])

  const hasCompleteSearchContext = Boolean(
    date?.from && date?.to && stayNights > 0 && activePetCount > 0
  )

  const isReadyToReserve = Boolean(
    hasCompleteSearchContext && totalSelectedRooms > 0
  )

  const eligibleRoomCount = React.useMemo(() => {
    return roomCategories.filter(
      (cat) => getRoomIneligibilityReason(cat, selectedPets, petSizeId) === null
    ).length
  }, [roomCategories, selectedPets, petSizeId])

  const onSearch = React.useCallback(
    (params: SearchParams) => {
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
    },
    [handleSearch, propertyId]
  )

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
      const roomCategory = roomCategories.find(
        (cat) => cat.id.toString() === roomId
      )
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
        (currentSearchParams.toString()
          ? `&${currentSearchParams.toString()}`
          : '')
    )
  }

  // Clear rooms that become ineligible when dates or pets change
  React.useEffect(() => {
    Object.entries(selectedRooms).forEach(([id, count]) => {
      if (count <= 0) return
      const cat = roomCategories.find((c) => c.id === Number(id))
      if (
        cat &&
        getRoomIneligibilityReason(cat, selectedPets, petSizeId) !== null
      ) {
        handleSelectChange(cat.id, 0)
      }
    })
  }, [selectedPets, petSizeId, roomCategories, selectedRooms, handleSelectChange])

  const itemizedPricing = React.useMemo(() => {
    const nights =
      searchedNumberOfNights > 0 ? searchedNumberOfNights : stayNights
    const items = Object.entries(selectedRooms)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const category = roomCategories.find((cat) => cat.id.toString() === id)
        const baseNightly =
          category?.availability?.totalPrice && nights > 0
            ? Math.round(category.availability.totalPrice / nights)
            : (category?.basePrice ?? 0)
        const lineSubtotal =
          (category?.availability?.totalPrice ?? baseNightly * nights) * count
        return {
          id,
          name: category?.name || `Room ${id}`,
          count,
          nightlyRate: baseNightly,
          nights,
          lineSubtotal,
        }
      })

    const roomsSubtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0)
    const serviceFee = 0
    const totalPayable = roomsSubtotal + serviceFee

    return {
      items,
      nights,
      roomsSubtotal,
      serviceFee,
      totalPayable,
    }
  }, [selectedRooms, roomCategories, searchedNumberOfNights, stayNights])

  const handleDesktopSmartCta = () => {
    if (!date?.from || !date?.to) {
      setDesktopPanel('checkin')
      return
    }
    if (activePetCount === 0) {
      setDesktopPanel('pets')
      return
    }
    if (totalSelectedRooms === 0) {
      setDesktopPanel(null)
      document.getElementById('rooms')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }
    handleContinue()
  }

  const desktopCtaLabel = !date?.from || !date?.to || activePetCount === 0
    ? 'Check availability'
    : totalSelectedRooms === 0
      ? 'Choose a room'
      : 'Reserve'

  const priceBreakdownNode =
    itemizedPricing.items.length > 0 && itemizedPricing.nights > 0 ? (
      <div className="border-t border-border pt-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-neutral-gray">
          <span>Price breakdown</span>
          <span className="tabular-nums">
            {totalSelectedRooms} {totalSelectedRooms === 1 ? 'room' : 'rooms'},{' '}
            {itemizedPricing.nights}{' '}
            {itemizedPricing.nights === 1 ? 'night' : 'nights'}
          </span>
        </div>
        <div className="space-y-1.5">
          {itemizedPricing.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-2 text-xs text-foreground"
            >
              <span className="text-neutral-gray truncate">
                {item.name} (฿{item.nightlyRate.toLocaleString()} ×{' '}
                {item.nights}n{item.count > 1 ? ` × ${item.count}` : ''})
              </span>
              <span className="font-medium tabular-nums shrink-0">
                ฿{item.lineSubtotal.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-xs text-foreground">
            <span className="text-neutral-gray">Platform service fee</span>
            <span className="text-positive-green font-medium">
              ฿0 (Launch promo)
            </span>
          </div>
          <div className="flex justify-between text-xs text-foreground">
            <span className="text-neutral-gray">Cleaning &amp; pet care</span>
            <span className="text-neutral-gray">Included</span>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex justify-between items-baseline">
          <span className="text-sm font-semibold text-foreground">
            Total payable
          </span>
          <span className="text-xl font-bold text-deep-teal tabular-nums">
            ฿{itemizedPricing.totalPayable.toLocaleString()}
          </span>
        </div>
      </div>
    ) : null

  /* ── Desktop Sticky Booking Card ─────────────────────────────────────── */
  if (sidebarMode) {
    return (
      <div
        id="booking-sidebar"
        className="flex flex-col max-h-[calc(100dvh-3rem)] rounded-2xl border border-border shadow-sm bg-white overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border bg-off-white/40 flex items-center justify-between gap-3">
          {itemizedPricing.totalPayable > 0 && itemizedPricing.nights > 0 ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-deep-teal tabular-nums">
                  ฿{itemizedPricing.totalPayable.toLocaleString()}
                </span>
                <span className="text-xs text-neutral-gray">total</span>
              </div>
              <p className="text-xs text-neutral-gray tabular-nums">
                for {itemizedPricing.nights}{' '}
                {itemizedPricing.nights === 1 ? 'night' : 'nights'}
              </p>
            </div>
          ) : startingPrice ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-neutral-gray">from</span>
              <span className="text-2xl font-bold text-deep-teal tabular-nums">
                ฿{startingPrice.toLocaleString()}
              </span>
              <span className="text-xs text-neutral-gray">/ night</span>
            </div>
          ) : (
            <p className="text-base font-semibold text-deep-teal">
              Book a Stay
            </p>
          )}

          {avgRating != null && avgRating > 0 && (
            <div className="flex items-center gap-1 shrink-0 text-xs">
              <Star
                className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"
                strokeWidth={0}
              />
              <span className="font-semibold text-foreground tabular-nums">
                {avgRating.toFixed(1)}
              </span>
              {reviewCount != null && reviewCount > 0 && (
                <span className="text-neutral-gray tabular-nums">
                  ({reviewCount})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain modern-scrollbar px-5 py-4 flex flex-col gap-3.5">
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
            inlineOpen={activeDesktopPanel}
            onInlineOpenChange={setDesktopPanel}
          />

          {/* Compact unified room summary (no duplicate full room list) */}
          {activeDesktopPanel === null && hasCompleteSearchContext && (
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2 py-1">
                  <Skeleton className="h-4 w-44 bg-neutral-200 motion-reduce:animate-none" />
                  <Skeleton className="h-10 w-full rounded-xl bg-neutral-200 motion-reduce:animate-none" />
                </div>
              ) : error ? (
                <p className="text-red-600 text-xs">{error}</p>
              ) : totalSelectedRooms > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-neutral-gray">
                    <span>Selected rooms</span>
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById('rooms')?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                      className="text-deep-teal font-semibold hover:underline cursor-pointer"
                    >
                      Edit rooms
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {itemizedPricing.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-off-white/50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate capitalize">
                            {item.name}
                          </p>
                          <p className="text-neutral-gray tabular-nums">
                            {item.count} {item.count === 1 ? 'room' : 'rooms'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectChange(Number(item.id), 0)
                          }
                          aria-label={`Remove ${item.name}`}
                          className="w-6 h-6 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-gray hover:text-foreground transition-colors cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-off-white/50 px-3.5 py-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-foreground tabular-nums">
                    {eligibleRoomCount > 0
                      ? `${eligibleRoomCount} room ${eligibleRoomCount === 1 ? 'category fits' : 'categories fit'} your stay`
                      : 'No rooms fit the current filter'}
                  </p>
                  {eligibleRoomCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById('rooms')?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                      className="text-xs font-semibold text-deep-teal hover:underline shrink-0 cursor-pointer"
                    >
                      Select room
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {priceBreakdownNode}
        </div>

        {/* Pinned Primary CTA Footer */}
        <div className="shrink-0 border-t border-border bg-white px-5 py-3.5 space-y-2">
          <Button
            type="button"
            onClick={handleDesktopSmartCta}
            className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-white text-base font-semibold rounded-xl cursor-pointer"
          >
            {desktopCtaLabel}
          </Button>

          <div className="text-center space-y-0.5">
            <p className="text-xs text-neutral-gray">
              You won&apos;t be charged yet
            </p>
            <p className="text-[11px] text-neutral-gray">
              Free cancellation up to 24h before check-in
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Mobile Fixed Bottom Bar + Drawer ────────────────────────────────── */
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 z-30">
      <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full border border-border bg-off-white/60 flex items-center justify-center shrink-0">
              <CalendarIcon className="h-5 w-5 text-deep-teal" />
            </div>
            <div className="min-w-0">
              {itemizedPricing.totalPayable > 0 && itemizedPricing.nights > 0 ? (
                <>
                  <p className="text-sm font-bold text-deep-teal tabular-nums leading-tight">
                    ฿{itemizedPricing.totalPayable.toLocaleString()} total
                  </p>
                  <p className="text-xs text-neutral-gray truncate tabular-nums mt-0.5">
                    {date?.from && date?.to
                      ? `${format(date.from, 'MMM d')} – ${format(date.to, 'MMM d')} (${itemizedPricing.nights}n)`
                      : `${totalSelectedRooms} selected`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-deep-teal tabular-nums leading-tight">
                    {startingPrice
                      ? `from ฿${startingPrice.toLocaleString()} / night`
                      : 'Check availability'}
                  </p>
                  <p className="text-xs text-neutral-gray truncate tabular-nums mt-0.5">
                    {date?.from && date?.to
                      ? `${format(date.from, 'MMM d')} – ${format(date.to, 'MMM d')} (${stayNights}n)`
                      : 'Add dates & pets'}
                  </p>
                </>
              )}
            </div>
          </button>
        </DrawerTrigger>

        <DrawerContent>
          <div className="mx-auto w-full max-w-2xl h-[82vh] flex flex-col">
            <DrawerHeader className="relative flex flex-row items-center justify-center px-5 border-b border-border pb-3">
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close booking drawer"
                  className="absolute left-5 w-9 h-9 rounded-full flex items-center justify-center text-neutral-gray hover:text-foreground hover:bg-off-white transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </DrawerClose>
              <div className="text-center">
                <DrawerTitle className="text-base font-semibold text-deep-teal">
                  Select dates, pets &amp; rooms
                </DrawerTitle>
                <DrawerDescription className="text-xs text-neutral-gray">
                  Find the right room for your pet&apos;s stay
                </DrawerDescription>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
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
                inlineOpen={mobileInlinePanel}
                onInlineOpenChange={setMobileInlinePanel}
              />

              {mobileInlinePanel === null && (
                <>
                  {searchedNumberOfNights > 0 && (
                    <p className="text-sm font-semibold text-deep-teal tabular-nums">
                      Available rooms for {searchedNumberOfNights}{' '}
                      {searchedNumberOfNights === 1 ? 'night' : 'nights'}
                    </p>
                  )}
                  {loading && (
                    <div className="space-y-3">
                      <Skeleton className="h-28 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
                      <Skeleton className="h-28 w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
                    </div>
                  )}
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  {!loading && !error && (
                    <BookingRoomCard
                      categories={roomCategories}
                      selectedRooms={selectedRooms}
                      onSelectChange={handleSelectChange}
                      selectedPets={selectedPets}
                      petSizeId={petSizeId}
                    />
                  )}
                  {priceBreakdownNode}
                </>
              )}
            </div>

            <DrawerFooter className="border-t border-border pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                className="w-full h-12 bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold rounded-xl cursor-pointer"
                onClick={handleContinue}
                disabled={!isReadyToReserve}
              >
                {isReadyToReserve ? 'Reserve' : 'Select dates, pets & rooms'}
              </Button>
              <p className="text-xs text-center text-neutral-gray">
                You won&apos;t be charged yet
              </p>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Button
        type="button"
        className="px-5 h-11 bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold rounded-xl shrink-0 cursor-pointer"
        onClick={() => {
          if (isReadyToReserve) {
            handleContinue()
          } else {
            handleOpenChange(true)
          }
        }}
      >
        {isReadyToReserve ? 'Reserve' : 'Check availability'}
      </Button>
    </div>
  )
}
