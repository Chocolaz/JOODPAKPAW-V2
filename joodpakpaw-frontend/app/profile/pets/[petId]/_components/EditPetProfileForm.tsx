'use client'

import React, { useState, useEffect } from 'react'
import { PetProfile, PetSizeCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { updatePetProfile, getPetSizeCategories } from '@/lib/api'
import { useProfileContext } from '@/app/profile/ProfileContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image' // Add this import
import { XCircle, PawPrint, Zap, CameraIcon } from 'lucide-react' // Adjusted import
import { cn } from '@/lib/utils' // Import cn

interface EditPetProfileFormProps {
  pet: PetProfile
  onClose: () => void
  onSuccess: () => void
}

export default function EditPetProfileForm({
  pet,
  onClose,
  onSuccess,
}: EditPetProfileFormProps) {
  const { petProfiles } = useProfileContext()
  const [formData, setFormData] = useState({
    name: pet.name,
    contactName: pet.contactName || '',
    contactPhone: pet.contactPhone || '',
    note: pet.note || '',
    image: null as File | null,
  })
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    pet.image || null
  ) // State for image preview
  const [petSizeCategories, setPetSizeCategories] = useState<PetSizeCategory[]>(
    []
  )
  const [selectedPetSizeId, setSelectedPetSizeId] = useState<string>(
    pet.petSizeName
      ? petSizeCategories
          .find((cat) => cat.name === pet.petSizeName)
          ?.id.toString() || ''
      : ''
  )
  const [selectedPetActivityLevel, setSelectedPetActivityLevel] =
    useState<string>(pet.rating ? pet.rating.toString() : '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [errors, setErrors] = useState<{
    name?: string
    contactName?: string
    contactPhone?: string
    note?: string
    petSizeId?: string
    petActivityLevel?: string
  }>({})

  useEffect(() => {
    const fetchPetCategories = async () => {
      try {
        const { petSizeCategories } = await getPetSizeCategories()
        setPetSizeCategories(petSizeCategories)

        if (pet.petSizeName) {
          const initialSize = petSizeCategories.find(
            (cat) => cat.name === pet.petSizeName
          )
          if (initialSize) {
            setSelectedPetSizeId(initialSize.id.toString())
          }
        }
      } catch (error) {
        console.error('Failed to fetch pet size categories:', error)
        toast.error('Failed to load pet size categories.')
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchPetCategories()
  }, [pet.petSizeName])

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for the field being changed
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numericValue = value.replace(/[^0-9]/g, '') // Only allow numbers
    setFormData((prev) => ({ ...prev, [name]: numericValue }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFormData((prev) => ({ ...prev, image: file }))
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
      setImagePreviewUrl(URL.createObjectURL(file))
    } else {
      setFormData((prev) => ({ ...prev, image: null }))
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
      setImagePreviewUrl(pet.image || null) // Revert to original image if no new file is selected
    }
  }

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: null }))
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImagePreviewUrl(null) // Explicitly set to null to indicate no image
  }

  const handlePetSizeChange = (value: string) => {
    setSelectedPetSizeId(value)
    setErrors((prev) => ({ ...prev, petSizeId: undefined }))
  }

  const handlePetActivityLevelChange = (value: string) => {
    setSelectedPetActivityLevel(value)
    setErrors((prev) => ({ ...prev, petActivityLevel: undefined }))
  }

  const validateForm = () => {
    let newErrors: typeof errors = {}
    let isValid = true

    if (!formData.name.trim()) {
      newErrors.name = 'Pet Name is required.'
      isValid = false
    }

    if (!selectedPetSizeId) {
      newErrors.petSizeId = 'Pet Size is required.'
      isValid = false
    }

    if (!selectedPetActivityLevel) {
      newErrors.petActivityLevel = 'Energy level is required.'
      isValid = false
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Contact Name is required.'
      isValid = false
    }

    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = 'Contact Phone is required.'
      isValid = false
    } else if (!/^\d+$/.test(formData.contactPhone)) {
      newErrors.contactPhone = 'Contact Phone must contain only numbers.'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please correct the errors in the form.')
      return
    }

    setIsSubmitting(true)
    try {
      const formPayload = new FormData()
      formPayload.append('name', formData.name)
      formPayload.append('contactName', formData.contactName)
      formPayload.append('contactPhone', formData.contactPhone)
      formPayload.append('note', formData.note)
      formPayload.append('petSizeId', selectedPetSizeId)
      formPayload.append('petActivityLevel', selectedPetActivityLevel)

      if (formData.image) {
        // If a new image file is selected
        formPayload.append('image', formData.image)
      } else if (pet.image && !imagePreviewUrl) {
        // If there was an original image but it was removed
        formPayload.append('removeImage', 'true') // Signal to backend to remove image
      } else if (
        pet.image &&
        imagePreviewUrl &&
        !imagePreviewUrl.startsWith('blob:')
      ) {
        // If original image is still there and no new image is selected
        // No need to append anything for image, backend should retain it.
      }

      await updatePetProfile(pet.id.toString(), formPayload)
      await petProfiles.refetch()
      toast.success('Pet profile updated successfully!')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update pet profile:', error)
      toast.error('Failed to update pet profile.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const petActivityLevels = [1, 2, 3, 4, 5] // Assuming activity levels are 1-5

  // Helper functions for pet size cards
  const getIconSizeClass = (sizeName: string) => {
    switch (sizeName.toLowerCase()) {
      case 'small':
        return 'w-8 h-8'
      case 'medium':
        return 'w-12 h-12'
      case 'large':
        return 'w-16 h-16'
      default:
        return 'w-12 h-12'
    }
  }

  const getDescription = (sizeName: string) => {
    switch (sizeName.toLowerCase()) {
      case 'small':
        return 'under 14kg'
      case 'medium':
        return '14-25kg'
      case 'large':
        return 'over 25kg'
      default:
        return ''
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-0">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <div className="space-y-4 pt-4">
            {isLoadingCategories ? (
              <>
                {/* Loading skeleton for all fields */}
                <div className="space-y-4">
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-16 mb-2" />
                    <div className="flex justify-center gap-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="w-20 h-24 rounded-2xl" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Skeleton className="h-4 w-16 mb-2" />
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="w-8 h-8 rounded-full" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Pet Name */}
                <div>
                  <Label htmlFor="name" className="text-deep-teal">
                    Pet Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    maxLength={20}
                    required
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Pet Size Cards */}
                <div>
                  <Label className="mb-2 block text-deep-teal">Pet Size</Label>
                  {isLoadingCategories ? (
                    <Spinner />
                  ) : (
                    <div className="flex flex-row justify-center items-center gap-4 pb-4 overflow-x-auto whitespace-nowrap px-4">
                  {petSizeCategories.map((size) => {
                    const isSelected = selectedPetSizeId === size.id.toString()
                    return (
                      <button
                        key={size.id}
                        type="button" // Important: set type="button" to prevent form submission
                        onClick={() => handlePetSizeChange(size.id.toString())}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 border rounded-[20px] cursor-pointer bg-white transition-transform duration-300 ease-in-out',
                          'min-w-20 my-2',
                          isSelected
                            ? 'border-positive-green scale-110 shadow-lg'
                            : 'border-gray-200 hover:border-deep-teal/50 shadow-sm',
                          errors.petSizeId ? 'border-red-500' : ''
                        )}
                      >
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                            isSelected ? 'bg-teal-50' : 'bg-gray-100'
                          )}
                        >
                          <PawPrint
                            className={cn(
                              getIconSizeClass(size.name),
                              isSelected
                                ? 'text-positive-green'
                                : 'text-neutral-gray'
                            )}
                            strokeWidth={1.5}
                          />
                        </div>
                        <span
                          className={cn(
                            'mt-2 text-center font-medium capitalize text-sm',
                            isSelected
                              ? 'text-positive-green'
                              : 'text-neutral-dark'
                          )}
                        >
                          {size.name}
                        </span>
                        <p
                          className={cn(
                            'text-center text-xs',
                            isSelected
                              ? 'text-positive-green'
                              : 'text-neutral-gray'
                          )}
                        >
                          {getDescription(size.name)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
              {errors.petSizeId && (
                <p className="text-red-500 text-xs mt-1 text-center">
                  {errors.petSizeId}
                </p>
              )}
                </div>

                {/* Energy Level */}
                <div>
                  <Label htmlFor="petActivityLevel" className="text-deep-teal">
                    Energy
                  </Label>
                  <div
                    className={cn(
                      'flex justify-center gap-1 mb-8',
                      errors.petActivityLevel
                        ? 'border border-red-500 rounded-md p-2'
                        : ''
                    )}
                  >
                    {petActivityLevels.map((level) => (
                      <Zap
                        key={level}
                        className={cn(
                          'w-8 h-8 cursor-pointer transition-colors',
                          selectedPetActivityLevel &&
                            parseInt(selectedPetActivityLevel) >= level
                            ? 'text-accent-orange'
                            : 'text-gray-300'
                        )}
                        onClick={() =>
                          handlePetActivityLevelChange(level.toString())
                        }
                        fill={
                          selectedPetActivityLevel &&
                          parseInt(selectedPetActivityLevel) >= level
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    ))}
                  </div>
                  {errors.petActivityLevel && (
                    <p className="text-red-500 text-xs mt-1 text-center">
                      {errors.petActivityLevel}
                    </p>
                  )}
                </div>

                {/* Contact Name */}
                <div>
                  <Label htmlFor="contactName" className="text-deep-teal">
                    Contact Name
                  </Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    maxLength={20}
                    required
                    className={errors.contactName ? 'border-red-500' : ''}
                  />
                  {errors.contactName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.contactName}
                    </p>
                  )}
                </div>

                {/* Contact Phone */}
                <div>
                  <Label htmlFor="contactPhone" className="text-deep-teal">
                    Contact Tel
                  </Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.contactPhone}
                    onChange={handlePhoneChange}
                    maxLength={10}
                    required
                    className={errors.contactPhone ? 'border-red-500' : ''}
                  />
                  {errors.contactPhone && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.contactPhone}
                    </p>
                  )}
                </div>

                {/* Note */}
                <div>
                  <Label htmlFor="note" className="text-deep-teal">
                    Note
                  </Label>
                  <Textarea
                    id="note"
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    rows={2}
                    maxLength={100}
                    className={errors.note ? 'border-red-500' : ''}
                  />
                  {errors.note && (
                    <p className="text-red-500 text-xs mt-1">{errors.note}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>
        <TabsContent value="image">
          <div className="space-y-4 pt-4">
            {/* Pet Image */}
            <div className="flex justify-center mb-4">
              {isLoadingCategories ? (
                <Skeleton className="w-40 h-40 rounded-full" />
              ) : (
                <label htmlFor="image-upload" className="relative cursor-pointer">
                  <div
                    className={cn(
                      'w-40 h-40 rounded-full flex items-center justify-center overflow-hidden border relative',
                      imagePreviewUrl
                        ? 'border-positive-green'
                        : 'border-gray-300'
                    )}
                  >
                    {imagePreviewUrl ? (
                      <Image
                        src={imagePreviewUrl}
                        alt="Pet preview"
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <PawPrint className="w-16 h-16 text-neutral-gray" />
                    )}
                    {imagePreviewUrl && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleRemoveImage}
                        className="absolute top-0 right-0 p-1 w-8 h-8 rounded-full bg-white/70 hover:bg-white text-red-500 flex items-center justify-center"
                        aria-label="Remove image"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    id="image-upload"
                    name="image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isLoadingCategories}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white text-deep-teal flex items-center justify-center shadow-md"
                    onClick={() =>
                      document.getElementById('image-upload')?.click()
                    }
                    disabled={isLoadingCategories}
                  >
                    <CameraIcon className="w-5 h-5" />
                  </Button>
                </label>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-positive-green"
          disabled={
            isSubmitting ||
            isLoadingCategories ||
            Object.values(errors).some(Boolean)
          }
        >
          {isSubmitting ? <Spinner className="mr-2" /> : null}
          Save Changes
        </Button>
      </div>
    </form>
  )
}
