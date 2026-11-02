'use client'

import React, { useState, useEffect } from 'react'
import { Dog, Cat, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  createRoomCategory,
  getPetTypes,
  getPetSizeCategories,
} from '@/lib/api'
import { useFacilities } from '../add-property/_hooks/useFacilities'
import { RoomCategoryFormData, Pet, PetSizeCategory } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FacilityCard } from './FacilityCard'
import { ImageManager } from '@/app/_components/ImageManager'
import SmallIcon from '/public/icons/small.svg'
import MediumIcon from '/public/icons/medium.svg'
import LargeIcon from '/public/icons/large.svg'

function SkeletonPetTypes() {
  return (
    <div className="flex justify-center items-center gap-6">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  )
}

function SkeletonPetSizes() {
  return (
    <div className="flex justify-center items-center gap-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-[100px] h-[125px] rounded-xl bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  )
}

function SkeletonFacilities({ cols = 2 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[72px] rounded-xl bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  )
}

const initialRoomState: RoomCategoryFormData = {
  name: '',
  basePrice: 0,
  totalRoom: 1,
  numberOfPets: 1,
  pets: [],
  facilities: [],
  petSizeCategoryId: 1,
  images: [],
}

export function AddRoomCategoryForm({
  propertyId,
  onAddSuccess,
  variant = 'mobile',
}: {
  propertyId: number
  onAddSuccess: () => void
  variant?: 'mobile' | 'desktop'
}) {
  const { facilities: allFacilities, loading: facilitiesLoading } =
    useFacilities()

  const [roomData, setRoomData] =
    useState<RoomCategoryFormData>(initialRoomState)
  const [displayPrice, setDisplayPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [petTypes, setPetTypes] = useState<Pet[]>([])
  const [petSizeCategories, setPetSizeCategories] = useState<PetSizeCategory[]>(
    []
  )
  const [loadingPetData, setLoadingPetData] = useState(true)

  const isFormValid = React.useMemo(
    () =>
      roomData.name.trim() !== '' &&
      roomData.basePrice > 0 &&
      roomData.totalRoom >= 1 &&
      roomData.numberOfPets >= 1 &&
      roomData.pets.length > 0 &&
      roomData.facilities.length > 0 &&
      roomData.petSizeCategoryId !== null,
    [roomData]
  )

  const updateRoom = <K extends keyof RoomCategoryFormData>(
    key: K,
    value: RoomCategoryFormData[K]
  ) => {
    setRoomData((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (key: 'pets' | 'facilities', id: number) => {
    updateRoom(
      key as keyof RoomCategoryFormData,
      roomData[key].includes(id)
        ? roomData[key].filter((v) => v !== id)
        : [...roomData[key], id]
    )
  }

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('en-US').format(value)

  const renderPetIcon = (pet: Pet, selected: boolean) => {
    const Icon = pet.name.toLowerCase() === 'dog' ? Dog : Cat
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full w-10 h-10',
          selected ? 'bg-teal-50' : 'bg-[#EFF1F4]'
        )}
      >
        <Icon className={cn('h-7 w-7', selected && 'text-positive-green')} />
      </div>
    )
  }

  const renderSizeIcon = (name: string, selected: boolean) => {
    const Icon =
      name.toLowerCase() === 'small'
        ? SmallIcon
        : name.toLowerCase() === 'medium'
          ? MediumIcon
          : LargeIcon
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full w-10 h-10',
          selected ? 'bg-teal-50' : 'bg-[#EFF1F4]'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            selected ? 'text-positive-green' : 'text-gray-500'
          )}
        />
      </div>
    )
  }

  useEffect(() => {
    async function loadPets() {
      try {
        setLoadingPetData(true)
        const [petRes, sizeRes] = await Promise.all([
          getPetTypes(),
          getPetSizeCategories(),
        ])
        setPetTypes(petRes.pets)
        setPetSizeCategories(sizeRes.petSizeCategories)
        if (sizeRes.petSizeCategories.length > 0) {
          updateRoom(
            'petSizeCategoryId',
            sizeRes.petSizeCategories[0]
              .id as RoomCategoryFormData['petSizeCategoryId']
          )
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load pet data'
        )
      } finally {
        setLoadingPetData(false)
      }
    }
    loadPets()
  }, [])

  const roomFacilities = allFacilities
    .filter((f) => f.category.name === 'indoor')
    .sort((a, b) => a.name.localeCompare(b.name))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'name' && value.length <= 50) updateRoom('name', value)
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw.length <= 6) {
      const numeric = raw ? parseInt(raw, 10) : 0
      updateRoom('basePrice', numeric as RoomCategoryFormData['basePrice'])
      setDisplayPrice(raw ? formatPrice(numeric) : '')
    }
  }

  const validateRoom = () => {
    if (!roomData.name.trim()) {
      setErrorMessage('Room title is required (max 50 chars).')
      return false
    }
    if (roomData.basePrice <= 0) {
      setErrorMessage('Base price must be greater than 0.')
      return false
    }
    if (roomData.totalRoom < 1 || roomData.totalRoom > 5) {
      setErrorMessage('Total room must be between 1 and 5.')
      return false
    }
    if (roomData.numberOfPets < 1 || roomData.numberOfPets > 5) {
      setErrorMessage('Number of pets must be between 1 and 5.')
      return false
    }
    if (roomData.pets.length === 0) {
      setErrorMessage('Please select at least one species allowed.')
      return false
    }
    if (roomData.facilities.length === 0) {
      setErrorMessage('Please select at least one facility.')
      return false
    }
    setErrorMessage('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateRoom()) return
    setIsSubmitting(true)
    try {
      await createRoomCategory(propertyId, roomData)
      toast.success('Room category added!')
      onAddSuccess()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to add room category.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (variant === 'desktop') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto scrollbar-modern px-6 py-5">
          {errorMessage && (
            <p className="text-sm text-red-500 mb-4">{errorMessage}</p>
          )}

          <div className="grid grid-cols-2 gap-8">
            {/* Left: name, species, size, price */}
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Room Name
                </label>
                <Input
                  name="name"
                  placeholder="e.g. Deluxe Suite"
                  value={roomData.name}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-gray-400 text-right mt-1">
                  {roomData.name.length}/50
                </p>
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Room Photos{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <ImageManager
                  existingImages={[]}
                  newFiles={roomData.images}
                  onExistingImagesChange={() => {}}
                  onNewFilesChange={(files) => updateRoom('images', files)}
                  renderAsGridAddButton
                  layout="scroll"
                  maxFiles={5}
                />
              </div>

              {/* Species */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Species Allowed
                </label>
                {loadingPetData ? (
                  <div className="flex gap-3">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="w-24 h-20 rounded-xl bg-gray-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {petTypes.map((pet) => {
                      const selected = roomData.pets.includes(pet.id)
                      return (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => toggleMulti('pets', pet.id)}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-xl border shadow-sm transition gap-2 px-5 py-3',
                            selected
                              ? 'border-positive-green bg-teal-50/60'
                              : 'bg-white hover:border-deep-teal/40'
                          )}
                        >
                          {renderPetIcon(pet, selected)}
                          <span
                            className={cn(
                              'text-sm font-medium',
                              selected ? 'text-positive-green' : 'text-gray-700'
                            )}
                          >
                            {pet.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pet Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Pet Size
                </label>
                {loadingPetData ? (
                  <div className="flex gap-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {petSizeCategories.map((size) => {
                      const selected = roomData.petSizeCategoryId === size.id
                      const kgDescription =
                        size.max === 14
                          ? 'under 14kg'
                          : size.min === 14 && size.max === 25
                            ? '14–25kg'
                            : 'over 25kg'
                      const m2Description =
                        size.max === 14
                          ? 'under 14m²'
                          : size.min === 14 && size.max === 25
                            ? '14–25m²'
                            : 'over 25m²'
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() =>
                            updateRoom('petSizeCategoryId', size.id)
                          }
                          className={cn(
                            'flex flex-col items-center justify-center rounded-xl border shadow-sm transition gap-1 px-4 py-3 min-w-[100px]',
                            selected
                              ? 'border-positive-green bg-teal-50/60'
                              : 'bg-white hover:border-deep-teal/40'
                          )}
                        >
                          {renderSizeIcon(size.name, selected)}
                          <span
                            className={cn(
                              'text-sm font-medium',
                              selected ? 'text-positive-green' : 'text-gray-700'
                            )}
                          >
                            {size.name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {kgDescription}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {m2Description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: facilities, max pets, total rooms, price */}
            <div className="space-y-6">
              {/* Facilities */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Room Facilities
                </label>
                {facilitiesLoading ? (
                  <SkeletonFacilities cols={1} />
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {roomFacilities.map((f) => (
                      <FacilityCard
                        key={f.id}
                        facility={f}
                        selected={roomData.facilities.includes(f.id)}
                        onToggle={(id) => toggleMulti('facilities', id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Max Pets + Total Rooms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Max Pets
                  </label>
                  <Select
                    value={String(roomData.numberOfPets)}
                    onValueChange={(v) =>
                      updateRoom(
                        'numberOfPets',
                        Number(v) as RoomCategoryFormData['numberOfPets']
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Total Rooms
                  </label>
                  <Select
                    value={String(roomData.totalRoom)}
                    onValueChange={(v) =>
                      updateRoom(
                        'totalRoom',
                        Number(v) as RoomCategoryFormData['totalRoom']
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Base Price / Night (฿)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                    ฿
                  </span>
                  <Input
                    name="basePrice"
                    type="text"
                    placeholder="0"
                    value={displayPrice}
                    onChange={handlePriceChange}
                    className="pl-7 text-lg font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end">
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-positive-green text-white text-sm font-semibold rounded-xl hover:bg-positive-green/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Creating…' : 'Create Room Category'}
          </button>
        </div>
      </form>
    )
  }

  // ── Mobile layout (original) ───────────────────────────────────────────────
  return (
    <form
      className="py-4 px-10 space-y-4 overflow-y-auto max-h-[80vh] relative"
      onSubmit={handleSubmit}
    >
      {errorMessage && (
        <p className="text-red-500 text-sm mb-2">{errorMessage}</p>
      )}

      {/* Title */}
      <div>
        <Label htmlFor="name" className="text-deep-teal block mb-2">
          Title
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Room name"
          value={roomData.name}
          onChange={handleChange}
          required
        />
      </div>

      {/* Images */}
      <div>
        <Label className="text-deep-teal block mb-2">
          Room Photos{' '}
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </Label>
        <ImageManager
          existingImages={[]}
          newFiles={roomData.images}
          onExistingImagesChange={() => {}}
          onNewFilesChange={(files) => updateRoom('images', files)}
          renderAsGridAddButton
          layout="scroll"
          maxFiles={5}
        />
      </div>

      {/* Species */}
      <div>
        <Label className="text-deep-teal block mb-2">Species Allowed</Label>
        {loadingPetData ? (
          <SkeletonPetTypes />
        ) : (
          <div className="flex justify-center items-center gap-6">
            {petTypes.map((pet) => {
              const selected = roomData.pets.includes(pet.id)
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => toggleMulti('pets', pet.id)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border shadow-sm transition aspect-square w-24 h-24 space-y-2',
                    selected
                      ? 'border-positive-green'
                      : 'bg-white hover:border-deep-teal/40'
                  )}
                >
                  {renderPetIcon(pet, selected)}
                  <span className="font-medium text-sm">{pet.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Pet Size */}
      <div>
        <Label className="text-deep-teal block mb-2">Pet Size</Label>
        {loadingPetData ? (
          <SkeletonPetSizes />
        ) : (
          <div className="flex justify-center items-center gap-6">
            {petSizeCategories.map((size) => {
              const selected = roomData.petSizeCategoryId === size.id
              const kgDescription =
                size.max === 14
                  ? 'under 14kg'
                  : size.min === 14 && size.max === 25
                    ? '14-25kg'
                    : 'over 25kg'
              const m2Description =
                size.max === 14
                  ? '< 12m²'
                  : size.min === 14 && size.max === 25
                    ? '12-20m²'
                    : '> 20m²'
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => updateRoom('petSizeCategoryId', size.id)}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-xl border shadow-sm transition w-[100px] h-[145px] space-y-0.5',
                    selected
                      ? 'border-positive-green'
                      : 'bg-white hover:border-deep-teal/40'
                  )}
                >
                  {renderSizeIcon(size.name, selected)}
                  <span
                    className={cn(
                      'font-medium text-sm',
                      selected && 'text-positive-green'
                    )}
                  >
                    {size.name}
                  </span>
                  <p className="text-xs text-gray-500">{kgDescription}</p>
                  <p className="text-xs text-gray-500">{m2Description}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Facilities */}
      <div>
        <Label className="text-deep-teal block mb-2">Room Facilities</Label>
        {facilitiesLoading ? (
          <SkeletonFacilities cols={1} />
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {roomFacilities.map((f) => (
              <FacilityCard
                key={f.id}
                facility={f}
                selected={roomData.facilities.includes(f.id)}
                onToggle={(id) => toggleMulti('facilities', id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Max pets */}
      <div>
        <Label className="text-deep-teal block mb-2">Max pets allowed</Label>
        <div className="flex justify-center">
          <Select
            value={String(roomData.numberOfPets)}
            onValueChange={(v) =>
              updateRoom(
                'numberOfPets',
                Number(v) as RoomCategoryFormData['numberOfPets']
              )
            }
          >
            <SelectTrigger className="py-5 px-4 text-lg w-max">
              <SelectValue placeholder="Select number" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Room */}
      <div>
        <Label className="text-deep-teal block mb-2">Total Room</Label>
        <div className="flex justify-center">
          <Select
            value={String(roomData.totalRoom)}
            onValueChange={(v) =>
              updateRoom(
                'totalRoom',
                Number(v) as RoomCategoryFormData['totalRoom']
              )
            }
          >
            <SelectTrigger className="py-5 px-4 text-lg w-max">
              <SelectValue placeholder="Select number" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price */}
      <div>
        <Label htmlFor="basePrice" className="text-deep-teal block mb-2">
          Base price per night
        </Label>
        <div className="flex justify-center">
          <Input
            id="basePrice"
            name="basePrice"
            type="text"
            placeholder="000"
            value={displayPrice}
            onChange={handlePriceChange}
            className="text-2xl font-medium p-2 w-[150px] text-center placeholder:text-2xl"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 left-0 right-0 p-4">
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full py-6 text-lg bg-positive-green shadow-xl"
        >
          {isSubmitting ? <Spinner /> : 'Create Room Category'}
        </Button>
      </div>
    </form>
  )
}
