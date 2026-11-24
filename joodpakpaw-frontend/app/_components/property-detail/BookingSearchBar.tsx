'use client'

import * as React from 'react'
import { format, differenceInDays } from 'date-fns'
import { DateRange } from 'react-day-picker'
import Image from 'next/image'
import Link from 'next/link'
import {
  PawPrint,
  CheckCircle2,
  Hash,
  AlertTriangle,
  Pencil,
  ChevronRight,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { getPetProfileById, updatePetProfile } from '@/lib/api'
import { cn, formatPetSizeRange, getApiImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { PetProfile, PetSizeCategory } from '@/types'

export interface SearchParams {
  checkInDate: string | undefined
  checkOutDate: string | undefined
  petCount: number
  petSizeId?: number
}

export type InlinePanel = 'checkin' | 'checkout' | 'pets' | null

interface BookingSearchBarProps {
  onSearch: (params: SearchParams) => void
  date: DateRange | undefined
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>
  selectedPetIds: number[]
  setSelectedPetIds: React.Dispatch<React.SetStateAction<number[]>>
  numberOfPets: number
  setNumberOfPets: React.Dispatch<React.SetStateAction<number>>
  petSizeId: number | undefined
  setPetSizeId: React.Dispatch<React.SetStateAction<number | undefined>>
  petProfiles: PetProfile[]
  petProfilesLoading: boolean
  petSizeCategories: PetSizeCategory[]
  onPetSizeUpdated: (petId: number, newSizeCategoryId: number) => void
  /** Controlled inline panel state (optional) */
  inlineOpen?: InlinePanel
  onInlineOpenChange?: (panel: InlinePanel) => void
  /** Callback whenever an inline panel opens/closes */
  onInlinePanelChange?: (isOpen: boolean) => void
}

type PetMode = 'profiles' | 'count'

interface PetSelectionBodyProps {
  selectedPetIds: number[]
  numberOfPets: number
  petSizeId: number | undefined
  petProfiles: PetProfile[]
  petProfilesLoading: boolean
  petSizeCategories: PetSizeCategory[]
  onPetSizeUpdated: (petId: number, newSizeCategoryId: number) => void
  onCommit: (
    mode: PetMode,
    draftIds: number[],
    draftCount: number,
    draftSize: number | undefined
  ) => void
  onResearchAfterSizeEdit: (editedSizeId: number) => void
}

function PetSelectionBody({
  selectedPetIds,
  numberOfPets,
  petSizeId,
  petProfiles,
  petProfilesLoading,
  petSizeCategories,
  onPetSizeUpdated,
  onCommit,
  onResearchAfterSizeEdit,
}: PetSelectionBodyProps) {
  const [petMode, setPetMode] = React.useState<PetMode>(() => {
    if (selectedPetIds.length > 0) return 'profiles'
    if (numberOfPets > 0) return 'count'
    return petProfiles.length > 0 ? 'profiles' : 'count'
  })
  const [draftPetIds, setDraftPetIds] = React.useState<number[]>(
    () => selectedPetIds
  )
  const [draftNumberOfPets, setDraftNumberOfPets] = React.useState<number>(
    () => numberOfPets
  )
  const [draftPetSizeId, setDraftPetSizeId] = React.useState<
    number | undefined
  >(() => petSizeId)

  const [editingPetId, setEditingPetId] = React.useState<number | null>(null)
  const [editingPetDetail, setEditingPetDetail] =
    React.useState<PetProfile | null>(null)
  const [editingPetDetailLoading, setEditingPetDetailLoading] =
    React.useState(false)
  const [selectedEditSizeId, setSelectedEditSizeId] = React.useState<
    number | undefined
  >(undefined)
  const [savingSize, setSavingSize] = React.useState(false)

  const handleEditPetSize = async (pet: PetProfile) => {
    setEditingPetId(pet.id)
    setSelectedEditSizeId(pet.petSizeCategoryId)
    setEditingPetDetailLoading(true)
    try {
      const detail = await getPetProfileById(pet.id.toString())
      setEditingPetDetail(detail)
    } catch {
      toast.error('Failed to load pet details.')
      setEditingPetId(null)
    } finally {
      setEditingPetDetailLoading(false)
    }
  }

  const handleSavePetSize = async () => {
    if (!editingPetDetail || selectedEditSizeId === undefined) return
    setSavingSize(true)
    try {
      const formPayload = new FormData()
      formPayload.append('name', editingPetDetail.name)
      formPayload.append('contactName', editingPetDetail.contactName || '')
      formPayload.append('contactPhone', editingPetDetail.contactPhone || '')
      formPayload.append('note', editingPetDetail.note || '')
      formPayload.append('petSizeId', String(selectedEditSizeId))
      formPayload.append(
        'petActivityLevel',
        String(editingPetDetail.rating || 1)
      )
      await updatePetProfile(editingPetDetail.id.toString(), formPayload)
      toast.success(`${editingPetDetail.name}'s size updated!`)
      onPetSizeUpdated(editingPetDetail.id, selectedEditSizeId)
      setEditingPetId(null)
      setEditingPetDetail(null)
      onResearchAfterSizeEdit(selectedEditSizeId)
    } catch {
      toast.error('Failed to update pet size.')
    } finally {
      setSavingSize(false)
    }
  }

  const toggleDraft = (id: number) => {
    setDraftPetIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleDraftNumberChange = (delta: number) => {
    setDraftNumberOfPets((prev) => Math.min(10, Math.max(0, prev + delta)))
  }

  const confirmedCount =
    petMode === 'profiles' ? draftPetIds.length : draftNumberOfPets
  const isConfirmDisabled =
    confirmedCount === 0 ||
    (petMode === 'count' &&
      petSizeCategories.length > 0 &&
      draftPetSizeId === undefined)

  return (
    <div className="space-y-3">
      {petProfilesLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {petProfiles.length > 0 && (
            <div
              className={cn(
                'rounded-2xl border overflow-hidden transition-colors',
                petMode === 'profiles'
                  ? 'border-deep-teal'
                  : 'border-border'
              )}
            >
              <button
                type="button"
                onClick={() => setPetMode('profiles')}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      petMode === 'profiles'
                        ? 'bg-deep-teal/10'
                        : 'bg-neutral-100'
                    )}
                  >
                    <PawPrint
                      className={cn(
                        'w-4 h-4 transition-colors',
                        petMode === 'profiles'
                          ? 'text-deep-teal'
                          : 'text-neutral-gray'
                      )}
                    />
                  </div>
                  <div className="text-left">
                    <p
                      className={cn(
                        'font-semibold text-sm',
                        petMode === 'profiles'
                          ? 'text-deep-teal'
                          : 'text-foreground'
                      )}
                    >
                      My Pets
                    </p>
                    <p className="text-xs text-neutral-gray mt-0.5">
                      Select from your pet profiles
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                    petMode === 'profiles'
                      ? 'border-deep-teal bg-deep-teal'
                      : 'border-neutral-300'
                  )}
                >
                  {petMode === 'profiles' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </button>

              {petMode === 'profiles' && (
                <div className="border-t border-border bg-off-white/40 px-3.5 py-3.5 space-y-2">
                  {petProfiles.map((pet) => {
                    const isSelected = draftPetIds.includes(pet.id)
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => toggleDraft(pet.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left bg-white cursor-pointer',
                          isSelected
                            ? 'border-accent-orange bg-accent-orange/5'
                            : 'border-border hover:border-foreground/25'
                        )}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-off-white shrink-0 flex items-center justify-center">
                          {getApiImageUrl(pet.image) ? (
                            <Image
                              src={getApiImageUrl(pet.image)!}
                              alt={pet.name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <PawPrint className="w-5 h-5 text-neutral-gray" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'font-semibold text-sm truncate',
                              isSelected
                                ? 'text-accent-orange'
                                : 'text-foreground'
                            )}
                          >
                            {pet.name}
                          </p>
                          {pet.petTypeName && (
                            <p className="text-xs text-neutral-gray truncate tabular-nums">
                              {pet.petTypeName}
                              {pet.age ? `, ${pet.age}y` : ''}
                            </p>
                          )}
                        </div>
                        <CheckCircle2
                          className={cn(
                            'w-5 h-5 shrink-0 transition-colors',
                            isSelected
                              ? 'text-accent-orange'
                              : 'text-neutral-200'
                          )}
                        />
                      </button>
                    )
                  })}

                  {draftPetIds.length > 0 && (
                    <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs font-semibold text-amber-800">
                          Pets grow — verify their sizes
                        </p>
                      </div>
                      <div className="space-y-2">
                        {petProfiles
                          .filter((p) => draftPetIds.includes(p.id))
                          .map((pet) => {
                            const sizeCategory = petSizeCategories.find(
                              (s) => s.id === pet.petSizeCategoryId
                            )
                            const isEditing = editingPetId === pet.id
                            return (
                              <div key={pet.id}>
                                {isEditing ? (
                                  <div className="rounded-lg bg-white border border-amber-200 p-2.5 space-y-2.5">
                                    <p className="text-xs font-semibold text-amber-800">
                                      Update {pet.name}&apos;s size
                                    </p>
                                    {editingPetDetailLoading ? (
                                      <div className="flex justify-center py-2">
                                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex gap-1.5">
                                          {petSizeCategories.map((size) => (
                                            <button
                                              key={size.id}
                                              type="button"
                                              onClick={() =>
                                                setSelectedEditSizeId(size.id)
                                              }
                                              className={cn(
                                                'flex-1 rounded-lg border py-1.5 px-1 text-center transition-colors cursor-pointer',
                                                selectedEditSizeId === size.id
                                                  ? 'border-accent-orange bg-accent-orange/10'
                                                  : 'border-border bg-white hover:border-foreground/30'
                                              )}
                                            >
                                              <PawPrint
                                                className={cn(
                                                  'mx-auto mb-0.5',
                                                  size.name.toLowerCase() ===
                                                    'small'
                                                    ? 'w-3.5 h-3.5'
                                                    : size.name.toLowerCase() ===
                                                        'medium'
                                                      ? 'w-5 h-5'
                                                      : 'w-6 h-6',
                                                  selectedEditSizeId === size.id
                                                    ? 'text-accent-orange'
                                                    : 'text-neutral-gray'
                                                )}
                                              />
                                              <p
                                                className={cn(
                                                  'text-xs font-semibold capitalize',
                                                  selectedEditSizeId === size.id
                                                    ? 'text-accent-orange'
                                                    : 'text-foreground'
                                                )}
                                              >
                                                {size.name}
                                              </p>
                                              <p className="text-[10px] text-neutral-gray tabular-nums">
                                                {formatPetSizeRange(
                                                  size.min,
                                                  size.max
                                                )}
                                              </p>
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-7 text-xs"
                                            onClick={() => {
                                              setEditingPetId(null)
                                              setEditingPetDetail(null)
                                            }}
                                            disabled={savingSize}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="flex-1 h-7 text-xs bg-accent-orange hover:bg-accent-orange/90 text-white"
                                            onClick={handleSavePetSize}
                                            disabled={
                                              savingSize ||
                                              selectedEditSizeId === undefined
                                            }
                                          >
                                            {savingSize ? (
                                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              'Save'
                                            )}
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span className="text-xs font-medium text-amber-900">
                                        {pet.name}
                                      </span>
                                      {sizeCategory ? (
                                        <span className="text-xs text-amber-700 capitalize tabular-nums">
                                          {sizeCategory.name} (
                                          {formatPetSizeRange(
                                            sizeCategory.min,
                                            sizeCategory.max
                                          )}
                                          )
                                        </span>
                                      ) : (
                                        <span className="text-xs text-amber-600">
                                          no size set
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleEditPetSize(pet)}
                                      className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-950 shrink-0 cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Enter Number */}
          <div
            className={cn(
              'rounded-2xl border overflow-hidden transition-colors',
              petMode === 'count' ? 'border-deep-teal' : 'border-border'
            )}
          >
            <button
              type="button"
              onClick={() => setPetMode('count')}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 bg-white cursor-pointer',
                petMode === 'count' ? 'bg-off-white/40' : 'hover:bg-off-white/40'
              )}
            >
              <div className="flex items-center gap-3">
                <Hash
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    petMode === 'count'
                      ? 'text-deep-teal'
                      : 'text-neutral-gray'
                  )}
                />
                <div className="text-left">
                  <p
                    className={cn(
                      'text-sm font-semibold transition-colors',
                      petMode === 'count'
                        ? 'text-deep-teal'
                        : 'text-foreground'
                    )}
                  >
                    Enter number of pets
                  </p>
                  <p className="text-xs text-neutral-gray">
                    {petProfiles.length > 0
                      ? 'Without using pet profiles'
                      : 'How many pets are joining?'}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  petMode === 'count'
                    ? 'border-deep-teal bg-deep-teal'
                    : 'border-neutral-300'
                )}
              >
                {petMode === 'count' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </button>

            {petMode === 'count' && (
              <div className="border-t border-border bg-off-white/40 px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-deep-teal">
                    Number of pets
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleDraftNumberChange(-1)}
                      disabled={draftNumberOfPets === 0}
                    >
                      -
                    </Button>
                    <span className="w-6 text-center font-semibold tabular-nums">
                      {draftNumberOfPets}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleDraftNumberChange(1)}
                      disabled={draftNumberOfPets === 10}
                    >
                      +
                    </Button>
                  </div>
                </div>
                {petSizeCategories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-deep-teal">
                      Pet size
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {petSizeCategories.map((size) => (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() =>
                            setDraftPetSizeId((prev) =>
                              prev === size.id ? undefined : size.id
                            )
                          }
                          className={cn(
                            'rounded-xl border px-2.5 py-2 text-center transition-colors cursor-pointer',
                            draftPetSizeId === size.id
                              ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                              : 'border-border bg-white text-foreground hover:border-foreground/30'
                          )}
                        >
                          <p className="text-xs font-semibold capitalize">
                            {size.name}
                          </p>
                          <p className="text-[11px] text-neutral-gray tabular-nums">
                            {formatPetSizeRange(size.min, size.max)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {petProfiles.length === 0 && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-off-white/70 border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <PawPrint className="w-4 h-4 text-deep-teal shrink-0" />
                <p className="text-xs text-neutral-gray">
                  Save pet profiles for faster size checks
                </p>
              </div>
              <Link
                href="/profile/pets"
                className="inline-flex items-center gap-1 text-xs font-semibold text-deep-teal hover:underline shrink-0"
              >
                <span>Add pet</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          <Button
            type="button"
            onClick={() =>
              onCommit(
                petMode,
                draftPetIds,
                draftNumberOfPets,
                draftPetSizeId
              )
            }
            disabled={isConfirmDisabled}
            className="bg-deep-teal hover:bg-deep-teal/90 text-white w-full rounded-xl h-10 text-sm font-semibold cursor-pointer"
          >
            {confirmedCount === 0
              ? petMode === 'profiles'
                ? 'Select at least one pet'
                : 'Enter number of pets'
              : petMode === 'count' &&
                  petSizeCategories.length > 0 &&
                  draftPetSizeId === undefined
                ? 'Select pet size'
                : `Apply ${confirmedCount} ${confirmedCount === 1 ? 'pet' : 'pets'}`}
          </Button>
        </>
      )}
    </div>
  )
}

export function BookingSearchBar({
  onSearch,
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
  onPetSizeUpdated,
  inlineOpen: controlledInlineOpen,
  onInlineOpenChange,
  onInlinePanelChange,
}: BookingSearchBarProps) {
  const [uncontrolledInlineOpen, setUncontrolledInlineOpen] =
    React.useState<InlinePanel>(null)
  const inlineOpen =
    controlledInlineOpen !== undefined
      ? controlledInlineOpen
      : uncontrolledInlineOpen

  const setInlinePanel = React.useCallback(
    (next: InlinePanel) => {
      if (controlledInlineOpen === undefined) {
        setUncontrolledInlineOpen(next)
      }
      onInlineOpenChange?.(next)
      onInlinePanelChange?.(next !== null)
    },
    [controlledInlineOpen, onInlineOpenChange, onInlinePanelChange]
  )

  const { minCheckInDate, maxAdvanceDate, isPastSameDayCutoff } =
    React.useMemo(() => {
      const now = new Date()
      const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const pastCutoff = bangkokNow.getUTCHours() >= 18

      const todayLocal = new Date(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate()
      )
      const minDate = new Date(todayLocal)
      if (pastCutoff) minDate.setDate(minDate.getDate() + 1)

      const maxDate = new Date(todayLocal)
      maxDate.setDate(maxDate.getDate() + 180)

      return {
        minCheckInDate: minDate,
        maxAdvanceDate: maxDate,
        isPastSameDayCutoff: pastCutoff,
      }
    }, [])

  const fromTime = date?.from?.getTime()
  const toTime = date?.to?.getTime()

  // Auto-search when dates + pets are complete
  React.useEffect(() => {
    const petCount =
      selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets
    if (
      date?.from &&
      date?.to &&
      differenceInDays(date.to, date.from) >= 1 &&
      petCount > 0
    ) {
      const resolvedPetSizeId =
        selectedPetIds.length > 0
          ? petProfiles.find((p) => selectedPetIds.includes(p.id))
              ?.petSizeCategoryId
          : petSizeId
      onSearch({
        checkInDate: format(date.from, 'yyyy-MM-dd'),
        checkOutDate: format(date.to, 'yyyy-MM-dd'),
        petCount,
        petSizeId: resolvedPetSizeId,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, selectedPetIds.length, numberOfPets, petSizeId])

  const petButtonLabel = React.useMemo(() => {
    if (selectedPetIds.length > 0) {
      const names = petProfiles
        .filter((p) => selectedPetIds.includes(p.id))
        .map((p) => p.name)
      if (names.length === 0)
        return `${selectedPetIds.length} ${selectedPetIds.length > 1 ? 'pets' : 'pet'}`
      if (names.length <= 2) return names.join(', ')
      return `${names[0]}, +${names.length - 1} more`
    }
    if (numberOfPets > 0)
      return `${numberOfPets} ${numberOfPets > 1 ? 'pets' : 'pet'}`
    return 'Add pets'
  }, [selectedPetIds, numberOfPets, petProfiles])

  const handleCommitPets = (
    mode: PetMode,
    draftIds: number[],
    draftCount: number,
    draftSize: number | undefined
  ) => {
    if (mode === 'profiles') {
      setSelectedPetIds(draftIds)
      setNumberOfPets(0)
      setPetSizeId(undefined)
    } else {
      setSelectedPetIds([])
      setNumberOfPets(draftCount)
      setPetSizeId(draftSize)
    }
    setInlinePanel(null)
  }

  const handleResearchAfterSizeEdit = (editedSizeId: number) => {
    if (date?.from && date?.to) {
      const petCount =
        selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets
      if (petCount > 0) {
        onSearch({
          checkInDate: format(date.from, 'yyyy-MM-dd'),
          checkOutDate: format(date.to, 'yyyy-MM-dd'),
          petCount,
          petSizeId: editedSizeId,
        })
      }
    }
  }

  const togglePanel = (panel: InlinePanel) => {
    setInlinePanel(inlineOpen === panel ? null : panel)
  }

  return (
    <div className="space-y-3">
      {/* Airbnb-style 2-row bordered picker box */}
      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <div className="grid grid-cols-2 divide-x divide-border">
          <button
            type="button"
            onClick={() => togglePanel('checkin')}
            className={cn(
              'flex flex-col items-start px-3.5 py-2.5 text-left transition-colors cursor-pointer min-w-0',
              inlineOpen === 'checkin' ? 'bg-deep-teal/5' : 'hover:bg-off-white/60'
            )}
          >
            <span className="text-[11px] font-semibold text-deep-teal">
              Check-in
            </span>
            <span
              className={cn(
                'text-sm truncate w-full tabular-nums mt-0.5',
                date?.from ? 'text-foreground font-medium' : 'text-neutral-gray'
              )}
            >
              {date?.from ? format(date.from, 'MMM dd, yyyy') : 'Add date'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => togglePanel('checkout')}
            className={cn(
              'flex flex-col items-start px-3.5 py-2.5 text-left transition-colors cursor-pointer min-w-0',
              inlineOpen === 'checkout'
                ? 'bg-deep-teal/5'
                : 'hover:bg-off-white/60'
            )}
          >
            <span className="text-[11px] font-semibold text-deep-teal">
              Check-out
            </span>
            <span
              className={cn(
                'text-sm truncate w-full tabular-nums mt-0.5',
                date?.to ? 'text-foreground font-medium' : 'text-neutral-gray'
              )}
            >
              {date?.to ? format(date.to, 'MMM dd, yyyy') : 'Add date'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => togglePanel('pets')}
          className={cn(
            'w-full border-t border-border flex items-center justify-between px-3.5 py-2.5 text-left transition-colors cursor-pointer',
            inlineOpen === 'pets'
              ? 'bg-deep-teal/5'
              : 'hover:bg-off-white/60'
          )}
        >
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-deep-teal block">
              Pets
            </span>
            <span
              className={cn(
                'text-sm truncate block mt-0.5',
                selectedPetIds.length === 0 && numberOfPets === 0
                  ? 'text-neutral-gray'
                  : 'text-foreground font-medium'
              )}
            >
              {petButtonLabel}
            </span>
          </div>
          {inlineOpen !== null ? (
            <ChevronUp className="w-4 h-4 text-neutral-gray shrink-0" />
          ) : (
            <PawPrint className="w-4 h-4 text-deep-teal shrink-0" />
          )}
        </button>
      </div>

      {/* Expandable panel inside the card/drawer */}
      {inlineOpen === 'checkin' && (
        <div className="rounded-2xl border border-border bg-white p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-deep-teal">
              Select check-in date
            </p>
            <button
              type="button"
              onClick={() => setInlinePanel(null)}
              className="text-xs font-medium text-neutral-gray hover:text-foreground cursor-pointer"
            >
              Close
            </button>
          </div>
          {isPastSameDayCutoff && (
            <p className="text-xs text-neutral-gray">
              Same-day check-in closes at 18:00 ICT (open up to 180 days ahead).
            </p>
          )}
          <Calendar
            mode="single"
            defaultMonth={date?.from ?? minCheckInDate}
            selected={date?.from}
            onSelect={(day) => {
              if (!day) return
              const newTo = date?.to && date.to > day ? date.to : undefined
              setDate({ from: day, to: newTo })
              setInlinePanel(newTo ? null : 'checkout')
            }}
            startMonth={minCheckInDate}
            endMonth={maxAdvanceDate}
            disabled={[{ before: minCheckInDate }, { after: maxAdvanceDate }]}
            fixedWeeks
            className="w-full"
          />
        </div>
      )}

      {inlineOpen === 'checkout' && (
        <div className="rounded-2xl border border-border bg-white p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-deep-teal">
              Select check-out date
            </p>
            <button
              type="button"
              onClick={() => setInlinePanel(null)}
              className="text-xs font-medium text-neutral-gray hover:text-foreground cursor-pointer"
            >
              Close
            </button>
          </div>
          <Calendar
            mode="single"
            defaultMonth={date?.to ?? date?.from ?? minCheckInDate}
            selected={date?.to}
            onSelect={(day) => {
              if (!day) return
              setDate((prev) => ({ from: prev?.from, to: day }))
              setInlinePanel(null)
            }}
            startMonth={minCheckInDate}
            endMonth={maxAdvanceDate}
            disabled={[
              {
                before: date?.from
                  ? new Date(date.from.getTime() + 86400000)
                  : new Date(minCheckInDate.getTime() + 86400000),
              },
              { after: maxAdvanceDate },
            ]}
            fixedWeeks
            className="w-full"
          />
        </div>
      )}

      {inlineOpen === 'pets' && (
        <div className="rounded-2xl border border-border bg-white p-3.5">
          <PetSelectionBody
            selectedPetIds={selectedPetIds}
            numberOfPets={numberOfPets}
            petSizeId={petSizeId}
            petProfiles={petProfiles}
            petProfilesLoading={petProfilesLoading}
            petSizeCategories={petSizeCategories}
            onPetSizeUpdated={onPetSizeUpdated}
            onCommit={handleCommitPets}
            onResearchAfterSizeEdit={handleResearchAfterSizeEdit}
          />
        </div>
      )}
    </div>
  )
}
