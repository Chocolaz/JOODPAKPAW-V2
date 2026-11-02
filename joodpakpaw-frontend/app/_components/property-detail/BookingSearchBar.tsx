'use client'

import * as React from 'react'
import { format, differenceInDays } from 'date-fns'
import { DateRange } from 'react-day-picker'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

import { getPetProfileById, updatePetProfile } from '@/lib/api'
import { toast } from 'sonner'
import { cn, formatPetSizeRange, getApiImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PawPrint, CheckCircle2, Hash, AlertTriangle, Pencil, ChevronDown } from 'lucide-react'
import { PetProfile, PetSizeCategory } from '@/types'

export interface SearchParams {
  checkInDate: string | undefined
  checkOutDate: string | undefined
  petCount: number
  petSizeId?: number
}

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
  /** Inline expand mode — no nested dialogs, expands in place (use inside Drawer) */
  inlineMode?: boolean
  /** Callback when inline panel opens/closes — used to hide sibling content */
  onInlinePanelChange?: (isOpen: boolean) => void
}

type PetMode = 'profiles' | 'count'
type InlinePanel = 'checkin' | 'checkout' | 'pets' | null

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
  inlineMode = false,
  onInlinePanelChange,
}: BookingSearchBarProps) {
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(undefined)
  const [isDateDialogOpen, setIsDateDialogOpen] = React.useState(false)
  const [isPetsDialogOpen, setIsPetsDialogOpen] = React.useState(false)
  const [inlineOpen, setInlineOpen] = React.useState<InlinePanel>(null)

  // Draft state inside the dialog — committed on "Confirm"
  const [draftPetIds, setDraftPetIds] = React.useState<number[]>([])
  const [draftNumberOfPets, setDraftNumberOfPets] = React.useState(0)
  const [draftPetSizeId, setDraftPetSizeId] = React.useState<number | undefined>(undefined)
  const [petMode, setPetMode] = React.useState<PetMode>(
    petProfiles.length > 0 ? 'profiles' : 'count'
  )

  // Inline pet size editing state
  const [editingPetId, setEditingPetId] = React.useState<number | null>(null)
  const [editingPetDetail, setEditingPetDetail] = React.useState<PetProfile | null>(null)
  const [editingPetDetailLoading, setEditingPetDetailLoading] = React.useState(false)
  const [selectedEditSizeId, setSelectedEditSizeId] = React.useState<number | undefined>(undefined)
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
      formPayload.append('petActivityLevel', String(editingPetDetail.rating || 1))
      await updatePetProfile(editingPetDetail.id.toString(), formPayload)
      toast.success(`${editingPetDetail.name}'s size updated!`)
      onPetSizeUpdated(editingPetDetail.id, selectedEditSizeId)
      setEditingPetId(null)
      setEditingPetDetail(null)
      if (date?.from && date?.to) {
        const petCount = selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets
        if (petCount > 0) {
          onSearch({
            checkInDate: format(date.from, 'yyyy-MM-dd'),
            checkOutDate: format(date.to, 'yyyy-MM-dd'),
            petCount,
            petSizeId: selectedEditSizeId,
          })
        }
      }
    } catch {
      toast.error('Failed to update pet size.')
    } finally {
      setSavingSize(false)
    }
  }

  // Notify parent when inline panel opens/closes
  React.useEffect(() => {
    if (inlineMode && onInlinePanelChange) {
      onInlinePanelChange(inlineOpen !== null)
    }
  }, [inlineOpen, inlineMode, onInlinePanelChange])

  // Sync draft state when dialogs/panels open
  React.useEffect(() => {
    if (isDateDialogOpen) setSelectedDateRange(date)
  }, [isDateDialogOpen, inlineOpen, date])

  React.useEffect(() => {
    if (isPetsDialogOpen || inlineOpen === 'pets') {
      setDraftPetIds(selectedPetIds)
      setDraftNumberOfPets(numberOfPets)
      setDraftPetSizeId(petSizeId)
      if (selectedPetIds.length > 0) {
        setPetMode('profiles')
      } else if (numberOfPets > 0) {
        setPetMode('count')
      } else {
        setPetMode(petProfiles.length > 0 ? 'profiles' : 'count')
      }
    }
  }, [isPetsDialogOpen, inlineOpen, selectedPetIds, numberOfPets, petSizeId, petProfiles.length])

  const handleConfirmDate = () => {
    if (selectedDateRange?.from && selectedDateRange?.to) {
      setDate(selectedDateRange)
      setIsDateDialogOpen(false)
      setInlineOpen(null)
    }
  }

  const handleConfirmPets = () => {
    if (petMode === 'profiles') {
      setSelectedPetIds(draftPetIds)
      setNumberOfPets(0)
      setPetSizeId(undefined)
    } else {
      setSelectedPetIds([])
      setNumberOfPets(draftNumberOfPets)
      setPetSizeId(draftPetSizeId)
    }
    setIsPetsDialogOpen(false)
    setInlineOpen(null)
  }

  const toggleDraft = (id: number) => {
    setDraftPetIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleDraftNumberChange = (delta: number) => {
    setDraftNumberOfPets((prev) => Math.min(10, Math.max(0, prev + delta)))
  }

  const isConfirmDateDisabled = React.useMemo(() => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) return true
    return differenceInDays(selectedDateRange.to, selectedDateRange.from) < 1
  }, [selectedDateRange])

  // Auto-search when dates + pets are all set
  React.useEffect(() => {
    const petCount = selectedPetIds.length > 0 ? selectedPetIds.length : numberOfPets
    if (date?.from && date?.to && petCount > 0) {
      const resolvedPetSizeId = selectedPetIds.length > 0
        ? petProfiles.find((p) => selectedPetIds.includes(p.id))?.petSizeCategoryId
        : petSizeId
      onSearch({
        checkInDate: format(date.from, 'yyyy-MM-dd'),
        checkOutDate: format(date.to, 'yyyy-MM-dd'),
        petCount,
        petSizeId: resolvedPetSizeId,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date?.from?.getTime(), date?.to?.getTime(), selectedPetIds.length, numberOfPets, petSizeId])

  const petButtonLabel = React.useMemo(() => {
    if (selectedPetIds.length > 0) {
      const names = petProfiles
        .filter((p) => selectedPetIds.includes(p.id))
        .map((p) => p.name)
      if (names.length <= 2) return names.join(', ')
      return `${names[0]}, +${names.length - 1} more`
    }
    if (numberOfPets > 0) return `${numberOfPets} pet${numberOfPets > 1 ? 's' : ''}`
    return 'Select pets'
  }, [selectedPetIds, numberOfPets, petProfiles])

  const confirmedCount =
    petMode === 'profiles' ? draftPetIds.length : draftNumberOfPets
  const isConfirmPetsDisabled =
    confirmedCount === 0 ||
    (petMode === 'count' && petSizeCategories.length > 0 && draftPetSizeId === undefined)

  // ── Shared pet panel content ──────────────────────────────────────────────
  const petPanelContent = (
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
                'rounded-2xl border-2 overflow-hidden transition-all duration-200',
                petMode === 'profiles' ? 'border-deep-teal shadow-sm' : 'border-gray-200'
              )}
            >
              <button
                type="button"
                onClick={() => setPetMode('profiles')}
                className="w-full flex items-center justify-between px-5 py-4 bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-xl transition-colors', petMode === 'profiles' ? 'bg-deep-teal/10' : 'bg-gray-100')}>
                    <PawPrint className={cn('w-5 h-5 transition-colors', petMode === 'profiles' ? 'text-deep-teal' : 'text-gray-400')} />
                  </div>
                  <div className="text-left">
                    <p className={cn('font-semibold text-sm', petMode === 'profiles' ? 'text-deep-teal' : 'text-gray-700')}>
                      My Pets
                    </p>
                    <p className="text-xs text-neutral-gray mt-0.5">Select from your pet profiles</p>
                  </div>
                </div>
                <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', petMode === 'profiles' ? 'border-deep-teal bg-deep-teal' : 'border-gray-300')}>
                  {petMode === 'profiles' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {petMode === 'profiles' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                  >
                    <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 space-y-2">
                      {petProfiles.map((pet) => {
                        const isSelected = draftPetIds.includes(pet.id)
                        return (
                          <motion.button
                            key={pet.id}
                            type="button"
                            onClick={() => toggleDraft(pet.id)}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-150 text-left bg-white',
                              isSelected ? 'border-accent-orange bg-accent-orange/5' : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                              {getApiImageUrl(pet.image) ? (
                                <Image src={getApiImageUrl(pet.image)!} alt={pet.name} width={40} height={40} className="object-cover w-full h-full" />
                              ) : (
                                <PawPrint className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('font-semibold text-sm', isSelected ? 'text-accent-orange' : 'text-gray-800')}>
                                {pet.name}
                              </p>
                              {pet.petTypeName && (
                                <p className="text-xs text-neutral-gray truncate">
                                  {pet.petTypeName}{pet.age ? ` · ${pet.age}y` : ''}
                                </p>
                              )}
                            </div>
                            <CheckCircle2 className={cn('w-5 h-5 shrink-0 transition-colors', isSelected ? 'text-accent-orange' : 'text-gray-200')} />
                          </motion.button>
                        )
                      })}

                      <AnimatePresence>
                        {draftPetIds.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2 }}
                            className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              <p className="text-xs font-semibold text-amber-700">Pets grow — are their sizes still correct?</p>
                            </div>
                            <div className="space-y-2">
                              {petProfiles.filter((p) => draftPetIds.includes(p.id)).map((pet) => {
                                const sizeCategory = petSizeCategories.find((s) => s.id === pet.petSizeCategoryId)
                                const isEditing = editingPetId === pet.id
                                return (
                                  <div key={pet.id}>
                                    {isEditing ? (
                                      <div className="rounded-lg bg-white border border-amber-200 p-2.5 space-y-2.5">
                                        <p className="text-xs font-semibold text-amber-800">Update {pet.name}&apos;s size</p>
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
                                                  onClick={() => setSelectedEditSizeId(size.id)}
                                                  className={cn(
                                                    'flex-1 rounded-lg border-2 py-1.5 px-1 text-center transition-all duration-150',
                                                    selectedEditSizeId === size.id ? 'border-accent-orange bg-accent-orange/10' : 'border-gray-200 bg-white hover:border-gray-300'
                                                  )}
                                                >
                                                  <PawPrint className={cn('mx-auto mb-0.5',
                                                    size.name.toLowerCase() === 'small' ? 'w-3.5 h-3.5' :
                                                    size.name.toLowerCase() === 'medium' ? 'w-5 h-5' : 'w-6 h-6',
                                                    selectedEditSizeId === size.id ? 'text-accent-orange' : 'text-gray-400'
                                                  )} />
                                                  <p className={cn('text-xs font-semibold capitalize', selectedEditSizeId === size.id ? 'text-accent-orange' : 'text-gray-600')}>{size.name}</p>
                                                  <p className="text-[10px] text-neutral-gray">{formatPetSizeRange(size.min, size.max)}</p>
                                                </button>
                                              ))}
                                            </div>
                                            <div className="flex gap-2">
                                              <Button type="button" variant="outline" size="sm" className="flex-1 h-7 text-xs"
                                                onClick={() => { setEditingPetId(null); setEditingPetDetail(null) }}
                                                disabled={savingSize}
                                              >
                                                Cancel
                                              </Button>
                                              <Button type="button" size="sm" className="flex-1 h-7 text-xs bg-accent-orange hover:bg-accent-orange/90"
                                                onClick={handleSavePetSize}
                                                disabled={savingSize || selectedEditSizeId === undefined}
                                              >
                                                {savingSize ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save'}
                                              </Button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-medium text-amber-800">{pet.name}</span>
                                          {sizeCategory ? (
                                            <span className="text-xs text-amber-600 capitalize">· {sizeCategory.name} ({formatPetSizeRange(sizeCategory.min, sizeCategory.max)})</span>
                                          ) : (
                                            <span className="text-xs text-amber-400">· no size set</span>
                                          )}
                                        </div>
                                        <button type="button" onClick={() => handleEditPetSize(pet)}
                                          className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Enter Number */}
          <div className={cn('rounded-xl border-2 overflow-hidden transition-all duration-200', petMode === 'count' ? 'border-accent-orange/50' : 'border-gray-200')}>
            <button
              type="button"
              onClick={() => setPetMode('count')}
              className={cn('w-full flex items-center justify-between px-4 py-3', petMode === 'count' ? 'bg-accent-orange/5' : 'bg-white hover:bg-gray-50')}
            >
              <div className="flex items-center gap-3">
                <Hash className={cn('w-4 h-4 shrink-0 transition-colors', petMode === 'count' ? 'text-accent-orange' : 'text-gray-400')} />
                <div className="text-left">
                  <p className={cn('text-sm font-medium transition-colors', petMode === 'count' ? 'text-accent-orange' : 'text-gray-500')}>
                    Enter number of pets
                  </p>
                  <p className="text-xs text-neutral-gray">
                    {petProfiles.length > 0 ? 'Without using pet profiles' : 'How many pets are joining?'}
                  </p>
                </div>
              </div>
              <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', petMode === 'count' ? 'border-accent-orange bg-accent-orange' : 'border-gray-300')}>
                {petMode === 'count' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {petMode === 'count' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                >
                  <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-deep-teal">Number of pets</span>
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full"
                          onClick={() => handleDraftNumberChange(-1)} disabled={draftNumberOfPets === 0}>-</Button>
                        <span className="w-8 text-center font-semibold">{draftNumberOfPets}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full"
                          onClick={() => handleDraftNumberChange(1)} disabled={draftNumberOfPets === 10}>+</Button>
                      </div>
                    </div>
                    {petSizeCategories.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-deep-teal">Pet size</p>
                        <div className="flex flex-wrap gap-2">
                          {petSizeCategories.map((size) => (
                            <button key={size.id} type="button"
                              onClick={() => setDraftPetSizeId((prev) => prev === size.id ? undefined : size.id)}
                              className={cn(
                                'flex-1 min-w-[80px] rounded-xl border-2 px-3 py-2 text-center transition-all duration-150',
                                draftPetSizeId === size.id ? 'border-accent-orange bg-accent-orange/10 text-accent-orange' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                              )}
                            >
                              <p className="text-sm font-semibold capitalize">{size.name}</p>
                              <p className="text-xs text-neutral-gray">{formatPetSizeRange(size.min, size.max)}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {petProfiles.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-orange/5 border border-accent-orange/20">
              <PawPrint className="w-4 h-4 text-accent-orange shrink-0" />
              <p className="text-xs text-gray-600">
                Add pet profiles for a better experience.{' '}
                <Link href="/profile/pets" className="font-medium text-accent-orange hover:underline">
                  Add a profile →
                </Link>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )

  const confirmPetsButton = (
    <Button onClick={handleConfirmPets} disabled={isConfirmPetsDisabled} className="bg-accent-orange w-full">
      {confirmedCount === 0
        ? petMode === 'profiles' ? 'Select at least one pet' : 'Enter number of pets'
        : petMode === 'count' && petSizeCategories.length > 0 && draftPetSizeId === undefined
        ? 'Select pet size'
        : `Confirm ${confirmedCount} pet${confirmedCount > 1 ? 's' : ''}`}
    </Button>
  )

  // ── Trigger pill (shared between both modes) ──────────────────────────────
  const dateLabel = date?.from
    ? date.to
      ? `${format(date.from, 'LLL dd')} – ${format(date.to, 'LLL dd')}`
      : format(date.from, 'LLL dd, y')
    : null

  const dateTriggerContent = (
    <div className="flex flex-col items-start">
      <span className="font-semibold text-sm text-deep-teal">Dates</span>
      {dateLabel
        ? <span className="text-sm">{dateLabel}</span>
        : <span className="text-neutral-gray text-sm">Add dates</span>}
    </div>
  )

  const petTriggerContent = (
    <div className="flex flex-col items-start">
      <span className="font-semibold text-sm text-deep-teal">Pets</span>
      <span className={cn('text-sm', selectedPetIds.length === 0 && numberOfPets === 0 && 'text-neutral-gray')}>
        {petButtonLabel}
      </span>
    </div>
  )

  // ── Inline MODE ───────────────────────────────────────────────────────────
  const handleInlineSelectCheckin = (day: Date | undefined) => {
    if (!day) return
    const newTo = date?.to && date.to > day ? date.to : undefined
    setDate({ from: day, to: newTo })
    // Auto-open checkout if not yet set
    setInlineOpen(newTo ? null : 'checkout')
  }

  const handleInlineSelectCheckout = (day: Date | undefined) => {
    if (!day) return
    setDate((prev) => ({ from: prev?.from, to: day }))
    setInlineOpen(null)
  }

  if (inlineMode) {
    const pillTriggers = (
      <div className="flex items-center p-1.5 rounded-full border bg-off-white shadow-sm">
        <button
          type="button"
          onClick={() => setInlineOpen('checkin')}
          className={cn(
            'flex-1 flex flex-col items-start px-4 py-2 rounded-full transition-colors min-w-0',
            inlineOpen === 'checkin' ? 'bg-deep-teal/10' : 'hover:bg-neutral-200'
          )}
        >
          <span className="font-semibold text-xs text-deep-teal">Check-in</span>
          <span className={cn('text-sm truncate', date?.from ? 'text-gray-800' : 'text-neutral-gray')}>
            {date?.from ? format(date.from, 'MMM dd') : 'Add date'}
          </span>
        </button>
        <div className="w-px h-8 bg-gray-200 shrink-0" />
        <button
          type="button"
          onClick={() => setInlineOpen('checkout')}
          className={cn(
            'flex-1 flex flex-col items-start px-4 py-2 rounded-full transition-colors min-w-0',
            inlineOpen === 'checkout' ? 'bg-deep-teal/10' : 'hover:bg-neutral-200'
          )}
        >
          <span className="font-semibold text-xs text-deep-teal">Check-out</span>
          <span className={cn('text-sm truncate', date?.to ? 'text-gray-800' : 'text-neutral-gray')}>
            {date?.to ? format(date.to, 'MMM dd') : 'Add date'}
          </span>
        </button>
        <div className="w-px h-8 bg-gray-200 shrink-0" />
        <button
          type="button"
          onClick={() => setInlineOpen('pets')}
          className={cn(
            'flex-1 flex flex-col items-start px-4 py-2 rounded-full transition-colors min-w-0',
            inlineOpen === 'pets' ? 'bg-accent-orange/10' : 'hover:bg-neutral-200'
          )}
        >
          <span className="font-semibold text-xs text-deep-teal">Pets</span>
          <span className={cn('text-sm truncate', selectedPetIds.length === 0 && numberOfPets === 0 ? 'text-neutral-gray' : 'text-gray-800')}>
            {petButtonLabel}
          </span>
        </button>
      </div>
    )

    if (inlineOpen === null) {
      return <div className="flex flex-col gap-3 mb-4">{pillTriggers}</div>
    }

    return (
      <div className="flex flex-col gap-2 -mx-5 px-5 pb-6 bg-white min-h-[60vh]">
        <div className="pt-4 pb-3">{pillTriggers}</div>

        <AnimatePresence mode="wait">
          {inlineOpen === 'checkin' && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-sm font-medium text-deep-teal mb-3">Select check-in date</p>
              <Calendar
                mode="single"
                defaultMonth={date?.from ?? new Date()}
                selected={date?.from}
                onSelect={(day) => {
                  if (!day) return
                  const newTo = date?.to && date.to > day ? date.to : undefined
                  setDate({ from: day, to: newTo })
                  if (!newTo) setInlineOpen('checkout')
                }}
                startMonth={new Date()}
                hidden={[{ before: new Date() }]}
                fixedWeeks
                className="w-full"
              />
            </motion.div>
          )}

          {inlineOpen === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-sm font-medium text-deep-teal mb-3">Select check-out date</p>
              <Calendar
                mode="single"
                defaultMonth={date?.to ?? date?.from ?? new Date()}
                selected={date?.to}
                onSelect={(day) => {
                  if (!day) return
                  setDate((prev) => ({ from: prev?.from, to: day }))
                  setInlineOpen(null)
                }}
                startMonth={new Date()}
                hidden={[{
                  before: date?.from ? new Date(date.from.getTime() + 86400000) : new Date()
                }]}
                fixedWeeks
                className="w-full"
              />
            </motion.div>
          )}

          {inlineOpen === 'pets' && (
            <motion.div
              key="pets"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {petPanelContent}
              {confirmPetsButton}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── DIALOG MODE (sidebar / desktop) ──────────────────────────────────────
  return (
    <div className="flex items-center gap-2 p-2 rounded-full border bg-off-white shadow-sm mb-4">
      {/* Date Range Picker */}
      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogTrigger asChild>
          <Button
            id="date"
            variant="ghost"
            className={cn(
              'flex-1 justify-start text-left font-normal rounded-full h-14 px-6 text-base hover:bg-neutral-200',
              !date && 'text-muted-foreground'
            )}
          >
            {dateTriggerContent}
          </Button>
        </DialogTrigger>

        <DialogContent className="w-auto max-h-[90vh] p-6 flex flex-col gap-2 overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-accent-orange">Select Dates</DialogTitle>
            <DialogDescription>Choose your check-in and check-out dates.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="range"
              defaultMonth={selectedDateRange?.from}
              selected={selectedDateRange}
              onSelect={setSelectedDateRange}
              numberOfMonths={2}
              startMonth={new Date()}
              hidden={[{ before: new Date() }]}
              fixedWeeks
              className="min-w-[280px] md:min-w-[400px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmDate} disabled={isConfirmDateDisabled} className="bg-positive-green w-full">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pet Selector */}
      <Dialog open={isPetsDialogOpen} onOpenChange={setIsPetsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'flex-1 justify-start text-left font-normal rounded-full h-14 px-6 text-base hover:bg-neutral-200',
              selectedPetIds.length === 0 && numberOfPets === 0 && 'text-neutral-gray'
            )}
          >
            {petTriggerContent}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-accent-orange">Which pets are coming?</DialogTitle>
            <DialogDescription>Select the pet profiles joining this stay.</DialogDescription>
          </DialogHeader>
          <div className="py-2">{petPanelContent}</div>
          <DialogFooter>{confirmPetsButton}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
