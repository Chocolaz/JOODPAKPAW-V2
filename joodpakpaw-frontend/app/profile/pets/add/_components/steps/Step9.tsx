'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { createPetProfile } from '@/lib/api'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { toast } from 'sonner'
import {
  Baby,
  PawPrint,
  Mars,
  Venus,
  HelpCircle,
  Scale,
  Zap,
  User,
  Notebook,
} from 'lucide-react'
import { PetGender } from '@/types'
import { format } from 'date-fns'

interface Step9Props {
  onBack: () => void
}

const ACTIVITY_LABELS = ['', 'Lazy', 'Calm', 'Moderate', 'Active', 'Hyper']

const GENDER_CONFIG = {
  [PetGender.Male]: {
    label: 'Male',
    bg: 'bg-blue-50',
    text: 'text-blue-500',
    icon: Mars,
  },
  [PetGender.Female]: {
    label: 'Female',
    bg: 'bg-pink-50',
    text: 'text-pink-500',
    icon: Venus,
  },
  [PetGender.Other]: {
    label: 'Not sure',
    bg: 'bg-gray-100',
    text: 'text-neutral-gray',
    icon: HelpCircle,
  },
}

export function Step9({ onBack }: Step9Props) {
  const { formData, clearAddPetSession } = useAddPet()
  const { petProfiles } = useProfileContext()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const petImageSrc =
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const apiFormData = new FormData()
    if (formData.petName) apiFormData.append('name', formData.petName)
    if (formData.petImage) apiFormData.append('image', formData.petImage)
    if (formData.petBirthDate) apiFormData.append('birthDate', formData.petBirthDate)
    if (formData.petGender) apiFormData.append('sex', formData.petGender)
    if (formData.petTypeId) apiFormData.append('petId', String(formData.petTypeId))
    if (formData.petBreedId) apiFormData.append('petBreedId', String(formData.petBreedId))
    if (formData.petSizeCategoryId) apiFormData.append('petSizeId', String(formData.petSizeCategoryId))
    if (formData.petActivityLevel) apiFormData.append('petEnergyId', String(formData.petActivityLevel))
    if (formData.contactName) apiFormData.append('contactName', formData.contactName)
    if (formData.contactPhone) apiFormData.append('contactPhone', formData.contactPhone)
    if (formData.petNote) apiFormData.append('note', formData.petNote)

    try {
      await createPetProfile(apiFormData)
      await petProfiles.refetch()
      toast.success('Pet profile created successfully!')
      clearAddPetSession()
      router.push('/profile/pets')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const genderCfg = formData.petGender ? GENDER_CONFIG[formData.petGender] : null
  const formattedBirthDate = formData.petBirthDate
    ? format(new Date(formData.petBirthDate), 'MMM d, yyyy')
    : null

  return (
    <div className="flex flex-col flex-grow w-full">
      <div className="w-full mt-5 pb-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-deep-teal text-2xl font-semibold">
            Review &amp; Submit
          </h3>
          <p className="text-neutral-gray text-sm mt-1">
            Everything looks good? Let&apos;s add{' '}
            {formData.petName || 'your pet'}!
          </p>
        </div>

        {/* Pet hero */}
        <div className="flex flex-col items-center mb-6">
          <div
            className={cn(
              'w-28 h-28 rounded-full overflow-hidden border-4 relative shadow-md',
              petImageSrc ? 'border-positive-green' : 'border-gray-200',
            )}
          >
            {petImageSrc ? (
              <Image
                src={petImageSrc}
                alt={formData.petName || 'Pet'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <Baby className="w-14 h-14 text-gray-400" />
              </div>
            )}
          </div>
          <h2 className="mt-3 text-xl font-bold text-deep-teal">
            {formData.petName}
          </h2>
          {(formData.petBreedName || formData.petTypeName) && (
            <p className="text-sm text-neutral-gray mt-0.5">
              {[formData.petBreedName, formData.petTypeName]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        {/* Summary cards */}
        <div className="space-y-3 max-w-sm lg:max-w-lg mx-auto">
          {/* Type + Size */}
          {(formData.petTypeName || formData.petSizeName) && (
            <div className="bg-gray-50 rounded-2xl p-4 flex gap-4">
              {formData.petTypeName && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <PawPrint className="w-4 h-4 text-deep-teal" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-gray uppercase tracking-wide">Type</p>
                    <p className="text-sm font-medium text-deep-teal capitalize">
                      {formData.petTypeName}
                    </p>
                  </div>
                </div>
              )}
              {formData.petSizeName && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4 text-deep-teal" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-gray uppercase tracking-wide">Size</p>
                    <p className="text-sm font-medium text-deep-teal capitalize">
                      {formData.petSizeName}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gender + Birthday */}
          {(genderCfg || formattedBirthDate) && (
            <div className="bg-gray-50 rounded-2xl p-4 flex gap-4">
              {genderCfg && (
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                      genderCfg.bg,
                    )}
                  >
                    <genderCfg.icon
                      className={cn('w-4 h-4', genderCfg.text)}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-gray uppercase tracking-wide">Gender</p>
                    <p className="text-sm font-medium text-deep-teal">
                      {genderCfg.label}
                    </p>
                  </div>
                </div>
              )}
              {formattedBirthDate && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Baby className="w-4 h-4 text-accent-orange" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-gray uppercase tracking-wide">Birthday</p>
                    <p className="text-sm font-medium text-deep-teal">
                      {formattedBirthDate}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity level */}
          {formData.petActivityLevel && (
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-gray uppercase tracking-wide">Activity</p>
                  <p className="text-sm font-medium text-deep-teal">
                    {ACTIVITY_LABELS[formData.petActivityLevel]}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Zap
                    key={level}
                    className={cn(
                      'w-4 h-4',
                      level <= formData.petActivityLevel!
                        ? 'text-accent-orange'
                        : 'text-gray-200',
                    )}
                    fill={
                      level <= formData.petActivityLevel! ? 'currentColor' : 'none'
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {(formData.contactName || formData.contactPhone) && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[10px] text-neutral-gray uppercase tracking-wide font-semibold mb-3">
                Emergency Contact
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-positive-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-deep-teal">
                    {formData.contactName}
                  </p>
                  {formData.contactPhone && (
                    <p className="text-xs text-neutral-gray">
                      {formData.contactPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {formData.petNote && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Notebook className="w-4 h-4 text-deep-teal" />
                <p className="text-[10px] text-neutral-gray uppercase tracking-wide font-semibold">
                  Notes
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {formData.petNote}
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}
      </div>

      <StepNavigation
        onNext={handleSubmit}
        onBack={onBack}
        isNextDisabled={isSubmitting}
        isSubmitting={isSubmitting}
        nextText="Submit"
      />
    </div>
  )
}
