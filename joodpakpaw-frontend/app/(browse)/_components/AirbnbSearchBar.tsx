'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { addDays, format, parseISO, isValid } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Calendar as CalendarIcon,
  PawPrint,
  X,
  Plus,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { PetProfile } from '@/types'
import { assetPath, cn } from '@/lib/utils'
import type { BrowseParamUpdates } from '@/app/_hooks/useBrowseFilters'

const PROVINCE_QUICK_PICKS = [
  'Bangkok',
  'Chiang Mai',
  'Phuket',
  'Chonburi',
  'Hua Hin',
  'Nonthaburi',
  'Samut Prakan',
]

const GUEST_SPECIES = [
  {
    label: 'Dogs',
    values: ['dog'],
    icon: '/icons/species/clay-dog-transparent.webp',
  },
  {
    label: 'Cats',
    values: ['cat'],
    icon: '/icons/species/clay-cat-transparent.webp',
  },
  {
    label: 'Exotic & small',
    values: ['rabbit', 'bird', 'hamster', 'reptile'],
    icon: '/icons/species/clay-exotic-transparent.webp',
  },
]

const PET_SIZE_OPTIONS = [
  { id: '1', label: 'Small', range: 'Up to 5 kg' },
  { id: '2', label: 'Medium', range: 'Up to 15 kg' },
  { id: '3', label: 'Large', range: 'Up to 30 kg' },
  { id: '4', label: 'Giant', range: 'Over 30 kg' },
]

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function parseIsoSafe(raw: string): Date | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  return isValid(parsed) ? parsed : undefined
}

interface AirbnbSearchBarProps {
  searchQuery: string
  province: string
  checkIn: string
  checkOut: string
  petTypes: string[]
  petSizeCategoryId: string
  petProfileIds: number[]
  activeFilterCount: number
  isAuthenticated: boolean
  userPets: PetProfile[]
  onUpdateParams: (updates: BrowseParamUpdates) => void
  onFilterClick: () => void
}

export function AirbnbSearchBar({
  searchQuery,
  province,
  checkIn,
  checkOut,
  petTypes,
  petSizeCategoryId,
  petProfileIds,
  activeFilterCount,
  isAuthenticated,
  userPets,
  onUpdateParams,
  onFilterClick,
}: AirbnbSearchBarProps) {
  const [whereOpen, setWhereOpen] = useState(false)
  const [datesOpen, setDatesOpen] = useState(false)
  const [petsOpen, setPetsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [draftWhere, setDraftWhere] = useState(province || searchQuery)
  const [draftProvince, setDraftProvince] = useState(province)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    return from ? { from, to } : undefined
  })
  const [draftPetTypes, setDraftPetTypes] = useState<string[]>(petTypes)
  const [draftSizeId, setDraftSizeId] = useState<string>(petSizeCategoryId)
  const [draftPetProfileIds, setDraftPetProfileIds] =
    useState<number[]>(petProfileIds)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const maxDate = useMemo(() => addDays(today, 180), [today])

  const syncDraftsFromProps = () => {
    setDraftWhere(province || searchQuery)
    setDraftProvince(province)
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    setDraftRange(from ? { from, to } : undefined)
    setDraftPetTypes(petTypes)
    setDraftSizeId(petSizeCategoryId)
    setDraftPetProfileIds(petProfileIds)
  }

  const commitSearch = (overrides?: {
    where?: string
    prov?: string
    range?: DateRange | undefined
    species?: string[]
    sizeId?: string
    profileIds?: number[]
  }) => {
    const w = (overrides?.where ?? draftWhere).trim()
    const prov = overrides?.prov !== undefined ? overrides.prov : draftProvince
    const r = overrides?.range !== undefined ? overrides.range : draftRange
    const sp = overrides?.species ?? draftPetTypes
    const sz = overrides?.sizeId !== undefined ? overrides.sizeId : draftSizeId
    const pIds = overrides?.profileIds ?? draftPetProfileIds

    const isExactProvince =
      prov && w.toLowerCase() === prov.toLowerCase()

    onUpdateParams({
      province: isExactProvince ? prov : null,
      q: isExactProvince ? null : w || null,
      checkIn: r?.from ? toIsoDate(r.from) : null,
      checkOut: r?.to ? toIsoDate(r.to) : null,
      petTypes: sp.length > 0 ? sp : null,
      petSizeCategoryId: sz || null,
      petProfileIds: pIds.length > 0 ? pIds : null,
    })

    setWhereOpen(false)
    setDatesOpen(false)
    setPetsOpen(false)
    setMobileOpen(false)
  }

  const toggleGuestSpecies = (values: string[]) => {
    const allPresent = values.every((v) => draftPetTypes.includes(v))
    const next = allPresent
      ? draftPetTypes.filter((t) => !values.includes(t))
      : Array.from(new Set([...draftPetTypes, ...values]))
    setDraftPetTypes(next)
    setDraftPetProfileIds([])
  }

  const toggleSavedPet = (pet: PetProfile) => {
    const exists = draftPetProfileIds.includes(pet.id)
    const nextIds = exists
      ? draftPetProfileIds.filter((id) => id !== pet.id)
      : [...draftPetProfileIds, pet.id]

    const derivedTypes = Array.from(
      new Set(
        userPets
          .filter((p) => nextIds.includes(p.id))
          .map((p) => p.petTypeName?.toLowerCase())
          .filter((t): t is string => Boolean(t))
      )
    )

    setDraftPetProfileIds(nextIds)
    setDraftPetTypes(derivedTypes)
  }

  const whereSummary = province || searchQuery || 'Search provinces or stays'

  const dateSummary = useMemo(() => {
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    if (from && to) {
      return `${format(from, 'MMM d')} – ${format(to, 'MMM d')}`
    }
    if (from) return `${format(from, 'MMM d')} – Add checkout`
    return 'Add dates'
  }, [checkIn, checkOut])

  const petSummary = useMemo(() => {
    if (petProfileIds.length > 0 && userPets.length > 0) {
      const names = userPets
        .filter((p) => petProfileIds.includes(p.id))
        .map((p) => p.name)
      if (names.length > 0) return names.join(', ')
    }
    const parts: string[] = []
    if (petTypes.length > 0) {
      const hasDog = petTypes.includes('dog')
      const hasCat = petTypes.includes('cat')
      const hasExotic = petTypes.some((t) =>
        ['rabbit', 'bird', 'hamster', 'reptile'].includes(t)
      )
      if (hasDog) parts.push('Dogs')
      if (hasCat) parts.push('Cats')
      if (hasExotic) parts.push('Exotic')
    }
    if (petSizeCategoryId) {
      const size = PET_SIZE_OPTIONS.find((s) => s.id === petSizeCategoryId)
      if (size) parts.push(size.label)
    }
    return parts.length > 0 ? parts.join(', ') : 'Add pets'
  }, [petProfileIds, userPets, petTypes, petSizeCategoryId])

  const renderPetsSelectorBody = () => (
    <div className="space-y-4">
      {isAuthenticated && userPets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-deep-teal">
              Your saved pets
            </p>
            <Link
              href="/profile/pets"
              className="text-xs font-medium text-accent-orange hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Manage pets
            </Link>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {userPets.map((pet) => {
              const checked = draftPetProfileIds.includes(pet.id)
              return (
                <label
                  key={pet.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors',
                    checked
                      ? 'border-deep-teal bg-off-white/70'
                      : 'border-gray-200 hover:border-deep-teal/50'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSavedPet(pet)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {pet.name}
                    </p>
                    <p className="text-xs text-neutral-gray truncate">
                      {[pet.petTypeName, pet.petSizeName]
                        .filter(Boolean)
                        .join(', ') || 'Pet profile'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {isAuthenticated && userPets.length === 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-off-white">
          <p className="text-xs text-deep-teal font-medium">
            Save your pets for 1-click safety matching
          </p>
          <Link
            href="/profile/pets"
            className="text-xs font-semibold text-accent-orange hover:underline shrink-0 ml-2"
          >
            Add pet
          </Link>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-deep-teal mb-2.5">
          {isAuthenticated && userPets.length > 0
            ? 'Or filter by species'
            : 'Pet species'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {GUEST_SPECIES.map((sp) => {
            const active = sp.values.every((v) => draftPetTypes.includes(v))
            return (
              <button
                key={sp.label}
                type="button"
                onClick={() => toggleGuestSpecies(sp.values)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-colors min-h-[76px]',
                  active
                    ? 'border-deep-teal bg-off-white text-deep-teal'
                    : 'border-gray-200 bg-white text-neutral-gray hover:border-deep-teal/50'
                )}
              >
                <div className="relative w-9 h-9">
                  <Image
                    src={assetPath(sp.icon)}
                    alt={sp.label}
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-center leading-tight">{sp.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-deep-teal mb-2">Pet size</p>
        <div className="grid grid-cols-2 gap-2">
          {PET_SIZE_OPTIONS.map((size) => {
            const active = draftSizeId === size.id
            return (
              <button
                key={size.id}
                type="button"
                onClick={() =>
                  setDraftSizeId((prev) => (prev === size.id ? '' : size.id))
                }
                className={cn(
                  'flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors min-h-[44px]',
                  active
                    ? 'border-deep-teal bg-deep-teal text-white'
                    : 'border-gray-200 text-foreground hover:border-deep-teal/50'
                )}
              >
                <span className="text-xs font-semibold">{size.label}</span>
                <span
                  className={cn(
                    'text-[11px]',
                    active ? 'text-white/85' : 'text-neutral-gray'
                  )}
                >
                  {size.range}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full">
      {/* Desktop 3-Part Airbnb Search Pill */}
      <div className="hidden lg:flex items-center justify-center gap-3">
        <div className="flex items-center bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow duration-200 p-1.5 pl-2 w-full max-w-[780px]">
          {/* Segment 1: Where */}
          <Popover
            open={whereOpen}
            onOpenChange={(open) => {
              if (open) syncDraftsFromProps()
              setWhereOpen(open)
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 text-left px-4 py-2 rounded-full hover:bg-off-white/70 transition-colors"
              >
                <span className="block text-xs font-semibold text-deep-teal leading-tight">
                  Where
                </span>
                <span
                  className={cn(
                    'block text-sm truncate mt-0.5',
                    province || searchQuery
                      ? 'text-foreground font-medium'
                      : 'text-neutral-gray'
                  )}
                >
                  {whereSummary}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-4 rounded-2xl">
              <div className="space-y-3">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-gray absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={draftWhere}
                    onChange={(e) => {
                      setDraftWhere(e.target.value)
                      setDraftProvince('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitSearch()
                    }}
                    placeholder="Search province, district, or stay"
                    className="w-full min-h-[42px] pl-9 pr-8 rounded-xl border border-gray-200 text-sm text-foreground"
                  />
                  {draftWhere && (
                    <button
                      type="button"
                      aria-label="Clear destination"
                      onClick={() => {
                        setDraftWhere('')
                        setDraftProvince('')
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-gray hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-deep-teal mb-2">
                    Popular provinces
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVINCE_QUICK_PICKS.map((prov) => {
                      const active =
                        draftProvince.toLowerCase() === prov.toLowerCase()
                      return (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => {
                            setDraftProvince(prov)
                            setDraftWhere(prov)
                            commitSearch({ where: prov, prov })
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-deep-teal text-white border-deep-teal'
                              : 'border-gray-200 text-foreground hover:border-deep-teal'
                          )}
                        >
                          {prov}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <span className="h-7 w-px bg-gray-200 shrink-0" aria-hidden="true" />

          {/* Segment 2: Dates */}
          <Popover
            open={datesOpen}
            onOpenChange={(open) => {
              if (open) syncDraftsFromProps()
              setDatesOpen(open)
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 text-left px-4 py-2 rounded-full hover:bg-off-white/70 transition-colors"
              >
                <span className="block text-xs font-semibold text-deep-teal leading-tight">
                  Dates
                </span>
                <span
                  className={cn(
                    'block text-sm truncate mt-0.5 tabular-nums',
                    checkIn
                      ? 'text-foreground font-medium'
                      : 'text-neutral-gray'
                  )}
                >
                  {dateSummary}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              className="w-auto p-4 rounded-2xl"
            >
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={setDraftRange}
                numberOfMonths={2}
                disabled={{ before: today, after: maxDate }}
                defaultMonth={draftRange?.from ?? today}
              />
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftRange(undefined)
                    commitSearch({ range: undefined })
                  }}
                  className="text-xs text-neutral-gray hover:text-deep-teal"
                >
                  Clear dates
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => commitSearch()}
                  className="rounded-full bg-deep-teal hover:bg-deep-teal/90 text-white px-4"
                >
                  Apply dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <span className="h-7 w-px bg-gray-200 shrink-0" aria-hidden="true" />

          {/* Segment 3: Who's staying */}
          <Popover
            open={petsOpen}
            onOpenChange={(open) => {
              if (open) syncDraftsFromProps()
              setPetsOpen(open)
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 text-left px-4 py-2 rounded-full hover:bg-off-white/70 transition-colors"
              >
                <span className="block text-xs font-semibold text-deep-teal leading-tight">
                  Who&apos;s staying
                </span>
                <span
                  className={cn(
                    'block text-sm truncate mt-0.5',
                    petTypes.length > 0 ||
                      petSizeCategoryId ||
                      petProfileIds.length > 0
                      ? 'text-foreground font-medium'
                      : 'text-neutral-gray'
                  )}
                >
                  {petSummary}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 rounded-2xl">
              {renderPetsSelectorBody()}
              <div className="flex items-center justify-between pt-3 mt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftPetTypes([])
                    setDraftSizeId('')
                    setDraftPetProfileIds([])
                    commitSearch({ species: [], sizeId: '', profileIds: [] })
                  }}
                  className="text-xs text-neutral-gray hover:text-deep-teal"
                >
                  Clear pets
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => commitSearch()}
                  className="rounded-full bg-deep-teal hover:bg-deep-teal/90 text-white px-4"
                >
                  Apply pets
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Circular Orange Search CTA */}
          <button
            type="button"
            aria-label="Search stays"
            onClick={() => commitSearch()}
            className="w-11 h-11 rounded-full bg-accent-orange hover:bg-accent-orange/90 active:scale-95 text-white flex items-center justify-center shrink-0 ml-1 transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
          >
            <Search className="w-4 h-4 stroke-[2.25]" />
          </button>
        </div>

        {/* Filters Button */}
        <button
          type="button"
          onClick={onFilterClick}
          className="relative flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-white border border-gray-200 hover:border-deep-teal text-sm font-medium text-foreground transition-colors shadow-xs shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-deep-teal" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-accent-orange text-white text-xs font-semibold flex items-center justify-center tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Compact Search Trigger Pill */}
      <div className="flex lg:hidden items-center gap-2">
        <button
          type="button"
          onClick={() => {
            syncDraftsFromProps()
            setMobileOpen(true)
          }}
          className="flex-1 min-w-0 flex items-center gap-3 min-h-[52px] px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-left"
        >
          <span className="w-9 h-9 rounded-full bg-accent-orange text-white flex items-center justify-center shrink-0">
            <Search className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {province || searchQuery || 'Where are you heading?'}
            </p>
            <p className="text-xs text-neutral-gray truncate">
              {dateSummary}
              {petSummary !== 'Add pets' ? `, ${petSummary}` : ''}
            </p>
          </div>
        </button>

        <button
          type="button"
          aria-label="Open filters"
          onClick={onFilterClick}
          className="relative w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-deep-teal" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent-orange text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Expandable Search Dialog */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-0 gap-0">
          <DialogHeader className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4">
            <DialogTitle className="text-deep-teal text-lg font-bold">
              Search pet-safe stays
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-5 py-4">
            {/* Mobile Where */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-deep-teal">
                <MapPin className="w-4 h-4" />
                Where
              </label>
              <input
                type="text"
                value={draftWhere}
                onChange={(e) => {
                  setDraftWhere(e.target.value)
                  setDraftProvince('')
                }}
                placeholder="Search province, district, or stay"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 text-sm text-foreground"
              />
              <div className="flex flex-wrap gap-1.5">
                {PROVINCE_QUICK_PICKS.map((prov) => {
                  const active =
                    draftProvince.toLowerCase() === prov.toLowerCase()
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        setDraftProvince(prov)
                        setDraftWhere(prov)
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        active
                          ? 'bg-deep-teal text-white border-deep-teal'
                          : 'border-gray-200 text-foreground'
                      )}
                    >
                      {prov}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mobile Dates */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-deep-teal">
                  <CalendarIcon className="w-4 h-4" />
                  Dates
                </span>
                {draftRange?.from && (
                  <button
                    type="button"
                    onClick={() => setDraftRange(undefined)}
                    className="text-xs text-neutral-gray hover:text-deep-teal"
                  >
                    Clear dates
                  </button>
                )}
              </div>
              <div className="flex justify-center">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={1}
                  disabled={{ before: today, after: maxDate }}
                  defaultMonth={draftRange?.from ?? today}
                />
              </div>
            </div>

            {/* Mobile Who's staying */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100">
              <span className="flex items-center gap-2 text-sm font-semibold text-deep-teal">
                <PawPrint className="w-4 h-4" />
                Who&apos;s staying
              </span>
              {renderPetsSelectorBody()}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white border-t border-gray-100 px-5 py-3.5 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraftWhere('')
                setDraftProvince('')
                setDraftRange(undefined)
                setDraftPetTypes([])
                setDraftSizeId('')
                setDraftPetProfileIds([])
              }}
              className="text-sm text-neutral-gray"
            >
              Clear all
            </Button>
            <Button
              type="button"
              onClick={() => commitSearch()}
              className="min-h-[44px] px-6 rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold"
            >
              <Search className="w-4 h-4 mr-1.5" />
              Search
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
