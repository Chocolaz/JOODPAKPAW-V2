'use client'

import { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react'

function subscribeDesktopCalendar(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(min-width: 768px)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getDesktopCalendarSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(min-width: 768px)').matches
}
import Image from 'next/image'
import Link from 'next/link'
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  isValid,
} from 'date-fns'
import type { DateRange, DayButton as DayButtonProps } from 'react-day-picker'
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Calendar as CalendarIcon,
  PawPrint,
  X,
  Plus,
  Check,
  Globe,
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
import { getProvinces, type ProvinceOption } from '@/lib/api'
import type { BrowseParamUpdates } from '@/app/_hooks/useBrowseFilters'

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

function AirbnbDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButtonProps>) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const isSingleSelected =
    Boolean(modifiers.selected) &&
    !modifiers.range_start &&
    !modifiers.range_end &&
    !modifiers.range_middle
  const isRangeCap = Boolean(modifiers.range_start || modifiers.range_end)
  const isRangeMiddle = Boolean(modifiers.range_middle)
  const isDisabled = Boolean(modifiers.disabled || modifiers.outside)

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSingleSelected}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'h-10 w-10 inline-flex items-center justify-center text-sm font-medium tabular-nums select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal',
        isDisabled && 'text-neutral-gray/35 cursor-not-allowed pointer-events-none',
        !isDisabled &&
          !isRangeCap &&
          !isSingleSelected &&
          !isRangeMiddle &&
          'rounded-full text-foreground hover:bg-off-white hover:text-deep-teal',
        modifiers.today &&
          !isRangeCap &&
          !isSingleSelected &&
          !isRangeMiddle &&
          'font-bold text-deep-teal ring-1 ring-inset ring-deep-teal/35',
        isRangeMiddle && 'rounded-none bg-deep-teal/10 text-deep-teal font-semibold',
        (isRangeCap || isSingleSelected) &&
          'rounded-full bg-deep-teal text-white font-semibold hover:bg-deep-teal/95',
        className
      )}
      {...props}
    />
  )
}

const SPACIOUS_CALENDAR_CLASSNAMES = {
  root: 'w-full',
  months: 'relative flex flex-col md:flex-row gap-6 justify-center',
  month: 'flex flex-col gap-3 w-full',
  nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between z-10 pointer-events-none',
  button_previous:
    'pointer-events-auto h-9 w-9 rounded-full border border-border bg-white text-deep-teal hover:bg-off-white inline-flex items-center justify-center transition-colors disabled:opacity-40',
  button_next:
    'pointer-events-auto h-9 w-9 rounded-full border border-border bg-white text-deep-teal hover:bg-off-white inline-flex items-center justify-center transition-colors disabled:opacity-40',
  month_caption: 'flex h-9 w-full items-center justify-center px-10',
  caption_label: 'text-base font-semibold text-deep-teal select-none',
  table: 'w-full border-collapse',
  weekdays: 'grid grid-cols-7 mb-1',
  weekday:
    'h-8 flex items-center justify-center text-xs font-medium text-neutral-gray select-none',
  week: 'grid grid-cols-7 mt-1',
  day: 'flex items-center justify-center p-0 relative',
  range_start: 'bg-deep-teal/10 rounded-l-full',
  range_middle: 'bg-deep-teal/10 rounded-none',
  range_end: 'bg-deep-teal/10 rounded-r-full',
  today: '',
  outside: 'opacity-0 pointer-events-none',
  disabled: 'opacity-40',
  hidden: 'invisible',
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

  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [provinceFilter, setProvinceFilter] = useState('')
  const [draftProvince, setDraftProvince] = useState(province)

  const isDesktopCalendar = useSyncExternalStore(
    subscribeDesktopCalendar,
    getDesktopCalendarSnapshot,
    () => true
  )
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    return from ? { from, to } : undefined
  })
  const [draftPetTypes, setDraftPetTypes] = useState<string[]>(petTypes)
  const [draftSizeId, setDraftSizeId] = useState<string>(petSizeCategoryId)
  const [draftPetProfileIds, setDraftPetProfileIds] =
    useState<number[]>(petProfileIds)

  // Load all 77 Thai provinces once (API with automatic geothai fallback)
  useEffect(() => {
    let active = true
    getProvinces()
      .then((list) => {
        if (active) setProvinces(list)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const sortedProvinces = useMemo(() => {
    return [...provinces].sort((a, b) => {
      const aHas = a.propertyCount > 0 ? 1 : 0
      const bHas = b.propertyCount > 0 ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
      if (a.propertyCount !== b.propertyCount)
        return b.propertyCount - a.propertyCount
      return a.nameEn.localeCompare(b.nameEn)
    })
  }, [provinces])

  const filteredProvinces = useMemo(() => {
    const q = provinceFilter.trim().toLowerCase()
    if (!q) return sortedProvinces
    return sortedProvinces.filter(
      (p) =>
        p.nameEn.toLowerCase().includes(q) ||
        p.nameTh.toLowerCase().includes(q)
    )
  }, [sortedProvinces, provinceFilter])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const maxDate = useMemo(() => addDays(today, 180), [today])

  const syncDraftsFromProps = () => {
    setDraftProvince(province)
    setProvinceFilter('')
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    setDraftRange(from ? { from, to } : undefined)
    setDraftPetTypes(petTypes)
    setDraftSizeId(petSizeCategoryId)
    setDraftPetProfileIds(petProfileIds)
  }

  const commitSearch = (overrides?: {
    prov?: string
    range?: DateRange | undefined
    species?: string[]
    sizeId?: string
    profileIds?: number[]
  }) => {
    const prov = (
      overrides?.prov !== undefined ? overrides.prov : draftProvince
    ).trim()
    const r = overrides?.range !== undefined ? overrides.range : draftRange
    const sp = overrides?.species ?? draftPetTypes
    const sz = overrides?.sizeId !== undefined ? overrides.sizeId : draftSizeId
    const pIds = overrides?.profileIds ?? draftPetProfileIds

    // Strict 77-province enforcement: only submit valid province names, never raw free-text q
    onUpdateParams({
      province: prov || null,
      q: null,
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

  const selectedProvinceOption = useMemo(() => {
    if (!province) return null
    return (
      provinces.find(
        (p) =>
          p.nameEn.toLowerCase() === province.toLowerCase() ||
          p.nameTh === province
      ) ?? null
    )
  }, [provinces, province])

  const whereSummary = selectedProvinceOption
    ? selectedProvinceOption.nameEn
    : province || 'Anywhere in Thailand'

  const dateSummary = useMemo(() => {
    const from = parseIsoSafe(checkIn)
    const to = parseIsoSafe(checkOut)
    if (from && to) {
      return `${format(from, 'MMM d')} – ${format(to, 'MMM d')}`
    }
    if (from) return `${format(from, 'MMM d')} – Checkout`
    return 'Add dates'
  }, [checkIn, checkOut])

  const draftNightCount = useMemo(() => {
    if (!draftRange?.from || !draftRange?.to) return 0
    const diff = differenceInCalendarDays(draftRange.to, draftRange.from)
    return diff > 0 ? diff : 0
  }, [draftRange])

  const draftDateRangeLabel = useMemo(() => {
    if (draftRange?.from && draftRange?.to) {
      return `${format(draftRange.from, 'MMM d, yyyy')} – ${format(draftRange.to, 'MMM d, yyyy')}`
    }
    if (draftRange?.from) {
      return `${format(draftRange.from, 'MMM d, yyyy')} – Select checkout`
    }
    return 'Select check-in and check-out dates'
  }, [draftRange])

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

  const handleProvinceKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    autoCommit: boolean
  ) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!provinceFilter.trim()) {
      setDraftProvince('')
      if (autoCommit) commitSearch({ prov: '' })
      return
    }
    if (filteredProvinces.length > 0) {
      const top = filteredProvinces[0]
      setDraftProvince(top.nameEn)
      setProvinceFilter('')
      if (autoCommit) commitSearch({ prov: top.nameEn })
    }
  }

  const renderProvincePickerBody = (autoCommitOnSelect: boolean) => (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-gray absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          onKeyDown={(e) => handleProvinceKeyDown(e, autoCommitOnSelect)}
          placeholder="Search 77 provinces (EN / ไทย)"
          aria-label="Filter Thai provinces"
          className="w-full min-h-[42px] pl-9 pr-8 rounded-xl border border-border text-sm text-foreground bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
        />
        {provinceFilter && (
          <button
            type="button"
            aria-label="Clear search text"
            onClick={() => setProvinceFilter('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-gray hover:text-foreground rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        role="listbox"
        aria-label="Thai provinces"
        className="max-h-72 overflow-y-auto scrollbar-modern divide-y divide-border/50 rounded-xl border border-border bg-white"
      >
        {/* Anywhere in Thailand */}
        <button
          type="button"
          role="option"
          aria-selected={!draftProvince}
          onClick={() => {
            setDraftProvince('')
            setProvinceFilter('')
            if (autoCommitOnSelect) commitSearch({ prov: '' })
          }}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors',
            !draftProvince
              ? 'bg-off-white text-deep-teal font-semibold'
              : 'hover:bg-off-white/60 text-foreground'
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-4 h-4 text-deep-teal shrink-0" />
            <span className="text-sm truncate">Anywhere in Thailand</span>
          </span>
          {!draftProvince && (
            <Check className="w-4 h-4 text-deep-teal shrink-0" />
          )}
        </button>

        {filteredProvinces.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-gray">
            No matching Thai province. Choose one of the 77 provinces.
          </div>
        ) : (
          filteredProvinces.map((prov) => {
            const isSelected =
              draftProvince.toLowerCase() === prov.nameEn.toLowerCase() ||
              draftProvince === prov.nameTh
            return (
              <button
                key={prov.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setDraftProvince(prov.nameEn)
                  setProvinceFilter('')
                  if (autoCommitOnSelect) commitSearch({ prov: prov.nameEn })
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'bg-off-white text-deep-teal'
                    : 'hover:bg-off-white/50 text-foreground'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <MapPin
                    className={cn(
                      'w-4 h-4 shrink-0',
                      isSelected ? 'text-deep-teal' : 'text-neutral-gray'
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {prov.nameEn}
                    </span>
                    <span className="block text-xs text-neutral-gray truncate">
                      {prov.nameTh}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {prov.propertyCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-deep-teal/10 text-deep-teal text-xs font-medium tabular-nums">
                      {prov.propertyCount}{' '}
                      {prov.propertyCount === 1 ? 'stay' : 'stays'}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-4 h-4 text-deep-teal shrink-0" />
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

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
                      : 'border-border hover:border-deep-teal/50'
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
                    : 'border-border bg-white text-neutral-gray hover:border-deep-teal/50'
                )}
              >
                <div className="relative w-9 h-9">
                  <Image
                    src={assetPath(sp.icon)}
                    alt={sp.label}
                    fill
                    sizes="28px"
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
                    : 'border-border text-foreground hover:border-deep-teal/50'
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
        <div className="flex items-center bg-white border border-border rounded-full p-1.5 pl-2 w-full max-w-[780px]">
          {/* Segment 1: Where (Strict 77-Province Selector) */}
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
                    province ? 'text-foreground font-medium' : 'text-neutral-gray'
                  )}
                >
                  {whereSummary}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[340px] p-4 rounded-2xl">
              {renderProvincePickerBody(true)}
            </PopoverContent>
          </Popover>

          <span className="h-7 w-px bg-border shrink-0" aria-hidden="true" />

          {/* Segment 2: Dates (Spacious 2-Month Airbnb Calendar) */}
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
                    checkIn ? 'text-foreground font-medium' : 'text-neutral-gray'
                  )}
                >
                  {dateSummary}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              className="w-[min(94vw,660px)] p-5 rounded-2xl"
            >
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={setDraftRange}
                numberOfMonths={isDesktopCalendar ? 2 : 1}
                showOutsideDays={false}
                disabled={{ before: today, after: maxDate }}
                defaultMonth={draftRange?.from ?? today}
                className="p-0 [--cell-size:2.5rem] w-full"
                classNames={SPACIOUS_CALENDAR_CLASSNAMES}
                components={{ DayButton: AirbnbDayButton }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-deep-teal tabular-nums">
                    {draftDateRangeLabel}
                  </p>
                  {draftNightCount > 0 && (
                    <p className="text-xs text-neutral-gray tabular-nums">
                      {draftNightCount}{' '}
                      {draftNightCount === 1 ? 'night' : 'nights'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                    className="rounded-full bg-deep-teal hover:bg-deep-teal/90 text-white px-5 min-h-[38px]"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <span className="h-7 w-px bg-border shrink-0" aria-hidden="true" />

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
              <div className="flex items-center justify-between pt-3 mt-4 border-t border-border">
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
            className="w-11 h-11 rounded-full bg-accent-orange hover:bg-accent-orange/90 active:scale-95 text-white flex items-center justify-center shrink-0 ml-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
          >
            <Search className="w-4 h-4 stroke-[2.25]" />
          </button>
        </div>

        {/* Filters Button */}
        <button
          type="button"
          onClick={onFilterClick}
          className="relative flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-white border border-border hover:border-deep-teal text-sm font-medium text-foreground transition-colors shrink-0"
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
          className="flex-1 min-w-0 flex items-center gap-3 min-h-[52px] px-4 py-2 rounded-full bg-white border border-border text-left"
        >
          <span className="w-9 h-9 rounded-full bg-accent-orange text-white flex items-center justify-center shrink-0">
            <Search className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {province || 'Anywhere in Thailand'}
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
          className="relative w-12 h-12 rounded-full bg-white border border-border flex items-center justify-center shrink-0"
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
          <DialogHeader className="sticky top-0 z-10 bg-white border-b border-border px-5 py-4">
            <DialogTitle className="text-deep-teal text-lg font-bold">
              Search pet-safe stays
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-5 py-4">
            {/* Mobile Where (Strict 77-Province Picker) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-deep-teal">
                  <MapPin className="w-4 h-4" />
                  Where
                </span>
                {draftProvince && (
                  <span className="text-xs font-medium text-deep-teal">
                    {draftProvince}
                  </span>
                )}
              </div>
              {renderProvincePickerBody(false)}
            </div>

            {/* Mobile Dates */}
            <div className="space-y-2.5 pt-4 border-t border-border">
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
              <p className="text-xs text-neutral-gray tabular-nums">
                {draftDateRangeLabel}
                {draftNightCount > 0
                  ? ` (${draftNightCount} ${draftNightCount === 1 ? 'night' : 'nights'})`
                  : ''}
              </p>
              <div className="flex justify-center">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={1}
                  showOutsideDays={false}
                  disabled={{ before: today, after: maxDate }}
                  defaultMonth={draftRange?.from ?? today}
                  className="p-0 [--cell-size:2.5rem] w-full max-w-[320px]"
                  classNames={SPACIOUS_CALENDAR_CLASSNAMES}
                  components={{ DayButton: AirbnbDayButton }}
                />
              </div>
            </div>

            {/* Mobile Who's staying */}
            <div className="space-y-2.5 pt-4 border-t border-border">
              <span className="flex items-center gap-2 text-sm font-semibold text-deep-teal">
                <PawPrint className="w-4 h-4" />
                Who&apos;s staying
              </span>
              {renderPetsSelectorBody()}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white border-t border-border px-5 py-3.5 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraftProvince('')
                setProvinceFilter('')
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
