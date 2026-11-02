'use client'

import React, { useState, useEffect } from 'react'
import { Dog, Cat, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateRoomCategory, getPetTypes, getPetSizeCategories } from '@/lib/api'
import { useFacilities } from '../add-property/_hooks/useFacilities'
import { RoomCategories, EditRoomCategoryFormData, Pet, PetSizeCategory } from '@/types'
import { PropertyImage } from '@/types/property'
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

function SkeletonFacilities({ cols = 2 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[72px] rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

interface EditRoomCategoryFormProps {
  propertyId: number
  category: RoomCategories
  onEditSuccess: () => void
  variant?: 'mobile' | 'desktop'
}

export function EditRoomCategoryForm({
  propertyId,
  category,
  onEditSuccess,
  variant = 'mobile',
}: EditRoomCategoryFormProps) {
  const { facilities: allFacilities, loading: facilitiesLoading } = useFacilities()

  const [formData, setFormData] = useState<EditRoomCategoryFormData>({
    name: category.name,
    totalRoom: category.totalRoom,
    numberOfPets: category.numberOfPets,
    basePrice: category.basePrice,
    pets: category.pets.map((p) => p.id),
    facilities: (category.facilities ?? []).map((f) => f.id),
    petSizeCategoryId: category.petSizeCategory?.id ?? 1,
    newImages: [],
    deleteImageIds: [],
  })
  const [existingImages, setExistingImages] = useState<PropertyImage[]>(
    (category.images ?? []).map((img) => ({
      id: img.id,
      fileName: img.fileName,
      filePath: img.filePath,
      fileContentType: img.fileContentType,
      fileExtensionName: img.fileExtensionName,
      fileSize: img.fileSize,
    }))
  )
  const [displayPrice, setDisplayPrice] = useState(
    category.basePrice > 0 ? new Intl.NumberFormat('en-US').format(category.basePrice) : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [petTypes, setPetTypes] = useState<Pet[]>([])
  const [petSizeCategories, setPetSizeCategories] = useState<PetSizeCategory[]>([])
  const [loadingPetData, setLoadingPetData] = useState(true)

  const roomFacilities = allFacilities.filter((f) => f.category.name === 'indoor')

  const isFormValid = React.useMemo(() => (
    formData.name.trim() !== '' &&
    formData.basePrice > 0 &&
    formData.totalRoom >= 1 &&
    formData.numberOfPets >= 1 &&
    formData.pets.length > 0 &&
    formData.facilities.length > 0 &&
    formData.petSizeCategoryId !== null
  ), [formData])

  useEffect(() => {
    async function loadPets() {
      try {
        const [petRes, sizeRes] = await Promise.all([getPetTypes(), getPetSizeCategories()])
        setPetTypes(petRes.pets)
        setPetSizeCategories(sizeRes.petSizeCategories)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load pet data')
      } finally {
        setLoadingPetData(false)
      }
    }
    loadPets()
  }, [])

  const update = <K extends keyof EditRoomCategoryFormData>(key: K, value: EditRoomCategoryFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (key: 'pets' | 'facilities', id: number) => {
    update(key, formData[key].includes(id)
      ? (formData[key] as number[]).filter((v) => v !== id)
      : [...(formData[key] as number[]), id]
    )
  }

  const formatPrice = (value: number) => new Intl.NumberFormat('en-US').format(value)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= 50) update('name', e.target.value)
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw.length <= 6) {
      const numeric = raw ? parseInt(raw, 10) : 0
      update('basePrice', numeric as EditRoomCategoryFormData['basePrice'])
      setDisplayPrice(raw ? formatPrice(numeric) : '')
    }
  }

  const handleExistingImagesChange = (images: PropertyImage[]) => {
    const removedIds = existingImages
      .filter((img) => !images.find((i) => i.id === img.id))
      .map((img) => img.id)
    setExistingImages(images)
    update('deleteImageIds', [...formData.deleteImageIds, ...removedIds])
  }

  const renderPetIcon = (pet: Pet, selected: boolean) => {
    const Icon = pet.name.toLowerCase() === 'dog' ? Dog : Cat
    return (
      <div className={cn('flex items-center justify-center rounded-full w-10 h-10', selected ? 'bg-teal-50' : 'bg-[#EFF1F4]')}>
        <Icon className={cn('h-7 w-7', selected && 'text-positive-green')} />
      </div>
    )
  }

  const renderSizeIcon = (name: string, selected: boolean) => {
    const Icon = name.toLowerCase() === 'small' ? SmallIcon : name.toLowerCase() === 'medium' ? MediumIcon : LargeIcon
    return (
      <div className={cn('flex items-center justify-center rounded-full w-10 h-10', selected ? 'bg-teal-50' : 'bg-[#EFF1F4]')}>
        <Icon className={cn('h-5 w-5', selected ? 'text-positive-green' : 'text-gray-500')} />
      </div>
    )
  }

  const validate = () => {
    if (!formData.name.trim()) { setErrorMessage('Room name is required.'); return false }
    if (formData.basePrice <= 0) { setErrorMessage('Base price must be greater than 0.'); return false }
    if (formData.totalRoom < 1 || formData.totalRoom > 5) { setErrorMessage('Total rooms must be between 1 and 5.'); return false }
    if (formData.numberOfPets < 1 || formData.numberOfPets > 5) { setErrorMessage('Max pets must be between 1 and 5.'); return false }
    if (formData.pets.length === 0) { setErrorMessage('Please select at least one species.'); return false }
    if (formData.facilities.length === 0) { setErrorMessage('Please select at least one facility.'); return false }
    setErrorMessage('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await updateRoomCategory(propertyId, category.id, formData)
      toast.success('Room category updated!')
      onEditSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update room category.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  if (variant === 'desktop') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto scrollbar-modern px-6 py-5">
          {errorMessage && <p className="text-sm text-red-500 mb-4">{errorMessage}</p>}

          <div className="grid grid-cols-2 gap-8">
            {/* Left: name, photos, species, size */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Room Name</label>
                <Input placeholder="e.g. Deluxe Suite" value={formData.name} onChange={handleNameChange} required />
                <p className="text-xs text-gray-400 text-right mt-1">{formData.name.length}/50</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Room Photos <span className="text-gray-400 font-normal">(optional)</span></label>
                <ImageManager
                  existingImages={existingImages}
                  newFiles={formData.newImages}
                  onExistingImagesChange={handleExistingImagesChange}
                  onNewFilesChange={(files) => update('newImages', files)}
                  renderAsGridAddButton
                  layout="scroll"
                  maxFiles={5}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Species Allowed</label>
                {loadingPetData ? (
                  <div className="flex gap-3">{[0, 1].map((i) => <div key={i} className="w-24 h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {petTypes.map((pet) => {
                      const selected = formData.pets.includes(pet.id)
                      return (
                        <button key={pet.id} type="button" onClick={() => toggleMulti('pets', pet.id)}
                          className={cn('flex flex-col items-center justify-center rounded-xl border shadow-sm transition gap-2 px-5 py-3',
                            selected ? 'border-positive-green bg-teal-50/60' : 'bg-white hover:border-deep-teal/40')}>
                          {renderPetIcon(pet, selected)}
                          <span className={cn('text-sm font-medium', selected ? 'text-positive-green' : 'text-gray-700')}>{pet.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Pet Size</label>
                {loadingPetData ? (
                  <div className="flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {petSizeCategories.map((size) => {
                      const selected = formData.petSizeCategoryId === size.id
                      const description = size.max === 14 ? 'under 14kg' : size.min === 14 && size.max === 25 ? '14–25kg' : 'over 25kg'
                      return (
                        <button key={size.id} type="button" onClick={() => update('petSizeCategoryId', size.id)}
                          className={cn('flex flex-col items-center justify-center rounded-xl border shadow-sm transition gap-1.5 px-4 py-3 min-w-[80px]',
                            selected ? 'border-positive-green bg-teal-50/60' : 'bg-white hover:border-deep-teal/40')}>
                          {renderSizeIcon(size.name, selected)}
                          <span className={cn('text-sm font-medium', selected ? 'text-positive-green' : 'text-gray-700')}>{size.name}</span>
                          <span className="text-[10px] text-gray-400">{description}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: facilities, capacity, price */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Room Facilities</label>
                {facilitiesLoading ? <SkeletonFacilities cols={2} /> : (
                  <div className="grid grid-cols-2 gap-2">
                    {roomFacilities.map((f) => (
                      <FacilityCard key={f.id} facility={f}
                        selected={formData.facilities.includes(f.id)}
                        onToggle={(id) => toggleMulti('facilities', id)} />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Pets</label>
                  <Select value={String(formData.numberOfPets)} onValueChange={(v) => update('numberOfPets', Number(v) as EditRoomCategoryFormData['numberOfPets'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Rooms</label>
                  <Select value={String(formData.totalRoom)} onValueChange={(v) => update('totalRoom', Number(v) as EditRoomCategoryFormData['totalRoom'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Base Price / Night (฿)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">฿</span>
                  <Input type="text" placeholder="0" value={displayPrice} onChange={handlePriceChange} className="pl-7 text-lg font-semibold" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end">
          <button type="submit" disabled={!isFormValid || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-positive-green text-white text-sm font-semibold rounded-xl hover:bg-positive-green/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    )
  }

  // ── Mobile layout ───────────────────────────────────────────────────────────
  return (
    <form className="py-4 px-10 space-y-4 overflow-y-auto max-h-[80vh] relative" onSubmit={handleSubmit}>
      {errorMessage && <p className="text-red-500 text-sm mb-2">{errorMessage}</p>}

      <div>
        <Label className="text-deep-teal block mb-2">Title</Label>
        <Input placeholder="Room name" value={formData.name} onChange={handleNameChange} required />
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Room Photos <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
        <ImageManager
          existingImages={existingImages}
          newFiles={formData.newImages}
          onExistingImagesChange={handleExistingImagesChange}
          onNewFilesChange={(files) => update('newImages', files)}
          renderAsGridAddButton
          layout="scroll"
          maxFiles={5}
        />
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Species Allowed</Label>
        {loadingPetData ? (
          <div className="flex justify-center gap-6">{[0, 1].map((i) => <div key={i} className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : (
          <div className="flex justify-center items-center gap-6">
            {petTypes.map((pet) => {
              const selected = formData.pets.includes(pet.id)
              return (
                <button key={pet.id} type="button" onClick={() => toggleMulti('pets', pet.id)}
                  className={cn('flex flex-col items-center justify-center rounded-xl border shadow-sm transition aspect-square w-24 h-24 space-y-2',
                    selected ? 'border-positive-green' : 'bg-white hover:border-deep-teal/40')}>
                  {renderPetIcon(pet, selected)}
                  <span className="font-medium text-sm">{pet.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Size</Label>
        {loadingPetData ? (
          <div className="flex justify-center gap-6">{[0, 1, 2].map((i) => <div key={i} className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : (
          <div className="flex justify-center items-center gap-6">
            {petSizeCategories.map((size) => {
              const selected = formData.petSizeCategoryId === size.id
              const description = size.max === 14 ? 'under 14kg' : size.min === 14 && size.max === 25 ? '14-25kg' : 'over 25kg'
              return (
                <button key={size.id} type="button" onClick={() => update('petSizeCategoryId', size.id)}
                  className={cn('flex flex-col items-center justify-center p-4 rounded-xl border shadow-sm transition w-[100px] h-[125px] space-y-1',
                    selected ? 'border-positive-green' : 'bg-white hover:border-deep-teal/40')}>
                  {renderSizeIcon(size.name, selected)}
                  <span className={cn('font-medium', selected && 'text-positive-green')}>{size.name}</span>
                  <p className="text-xs text-gray-500">{description}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Room Facilities</Label>
        {facilitiesLoading ? <SkeletonFacilities cols={2} /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {roomFacilities.map((f) => (
              <FacilityCard key={f.id} facility={f}
                selected={formData.facilities.includes(f.id)}
                onToggle={(id) => toggleMulti('facilities', id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Max pets allowed</Label>
        <div className="flex justify-center">
          <Select value={String(formData.numberOfPets)} onValueChange={(v) => update('numberOfPets', Number(v) as EditRoomCategoryFormData['numberOfPets'])}>
            <SelectTrigger className="py-5 px-4 text-lg w-max"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Total Room</Label>
        <div className="flex justify-center">
          <Select value={String(formData.totalRoom)} onValueChange={(v) => update('totalRoom', Number(v) as EditRoomCategoryFormData['totalRoom'])}>
            <SelectTrigger className="py-5 px-4 text-lg w-max"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-deep-teal block mb-2">Base price per night</Label>
        <div className="flex justify-center">
          <Input type="text" placeholder="000" value={displayPrice} onChange={handlePriceChange}
            className="text-2xl font-medium p-2 w-[150px] text-center placeholder:text-2xl" />
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4">
        <Button type="submit" disabled={!isFormValid || isSubmitting} className="w-full py-6 text-lg bg-positive-green shadow-xl">
          {isSubmitting ? <Spinner /> : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
