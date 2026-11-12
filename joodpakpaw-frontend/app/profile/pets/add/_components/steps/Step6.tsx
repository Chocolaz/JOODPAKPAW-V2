'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Phone,
  User,
  Zap,
  Scale,
  Calendar,
  FileText,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { useAddPet } from '../../_context/AddPetContext'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { WizardStepHeader } from '../WizardStepHeader'
import {
  ENERGY_LEVELS,
  MIXED_PET_ICON_SRC,
  SIZE_LABELS,
  formatCleanBreedName,
} from '../../_constants/petWizard'
import { createPetProfile } from '@/lib/api'

export function Step6({ onBack }: { onBack: () => void }) {
  const { formData, clearAddPetSession } = useAddPet()
  const { petProfiles } = useProfileContext()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const petName = formData.petName || 'Pet'
  const years = formData.ageYears ?? 0
  const months = formData.ageMonths ?? 0

  const ageText =
    years > 0 || months > 0
      ? [
          years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
          months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '',
        ]
          .filter(Boolean)
          .join(', ')
      : formData.petBirthDate
      ? `Born ${formData.petBirthDate}`
      : 'Not specified'

  const sizeText = formData.petSizeCategoryId
    ? SIZE_LABELS[formData.petSizeCategoryId] || 'Standard'
    : formData.approxWeight
    ? `Approx. ${formData.approxWeight} kg`
    : 'Auto-assigned'

  const activityInfo =
    ENERGY_LEVELS.find((l) => l.rating === formData.petActivityLevel) || ENERGY_LEVELS[2]

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const apiFormData = new FormData()
    if (formData.petName) apiFormData.append('name', formData.petName.trim())
    if (formData.petImage) apiFormData.append('image', formData.petImage)
    if (formData.petGender) apiFormData.append('sex', formData.petGender)
    if (formData.petTypeId) apiFormData.append('petTypeId', String(formData.petTypeId))
    if (formData.petBreedId) apiFormData.append('petBreedId', String(formData.petBreedId))
    if (formData.petSizeCategoryId) {
      apiFormData.append('petSizeCategoryId', String(formData.petSizeCategoryId))
    }
    if (formData.petActivityLevel) {
      apiFormData.append('petEnergyId', String(formData.petActivityLevel))
    }
    if (formData.contactName) apiFormData.append('contactName', formData.contactName.trim())
    if (formData.contactPhone) apiFormData.append('contactPhone', formData.contactPhone.trim())
    if (formData.petNote) apiFormData.append('note', formData.petNote.trim())

    if (formData.petBirthDate) {
      apiFormData.append('birthDate', formData.petBirthDate)
    } else {
      if (formData.ageYears !== null && formData.ageYears !== undefined) {
        apiFormData.append('ageYears', String(formData.ageYears))
      }
      if (formData.ageMonths !== null && formData.ageMonths !== undefined) {
        apiFormData.append('ageMonths', String(formData.ageMonths))
      }
    }

    if (formData.approxWeight) {
      apiFormData.append('weight', String(formData.approxWeight))
    }

    try {
      await createPetProfile(apiFormData)
      if (petProfiles && typeof petProfiles.refetch === 'function') {
        await petProfiles.refetch()
      }
      toast.success(`${petName}'s profile created`)
      clearAddPetSession()
      router.push('/profile/pets')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create pet profile'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="w-full mt-6">
        <WizardStepHeader
          title={`${petName}'s pet passport`}
          description="Review your companion's boarding details before saving"
        />

        <div className="max-w-lg mx-auto space-y-4 pb-8">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          {/* Passport Card */}
          <div className="overflow-hidden rounded-2xl bg-white border border-[#323232]/10">
            {/* Solid Brand Top Accent */}
            <div className="h-1.5 bg-deep-teal" />

            <div className="p-6 space-y-5">
              {/* Pet Identity Header */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-off-white border border-[#323232]/10">
                  {formData.petImagePreview ? (
                    <Image
                      src={formData.petImagePreview}
                      alt={petName}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : formData.petBreedImageUrl ? (
                    <Image
                      src={formData.petBreedImageUrl}
                      alt={petName}
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <Image
                        src={MIXED_PET_ICON_SRC}
                        alt={petName}
                        width={56}
                        height={56}
                        unoptimized
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-medium text-deep-teal truncate">
                      {petName}
                    </h3>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-off-white text-deep-teal border border-[#323232]/10">
                      {formData.petGender === 'male' ? 'Male' : 'Female'}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-gray mt-1 truncate">
                    {formData.petTypeName} · {formatCleanBreedName(formData.petBreedName || 'Mixed or other')}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-positive-green font-medium mt-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>Ready for boarding</span>
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#323232]/10">
                <div className="p-3.5 rounded-xl bg-off-white/60 border border-[#323232]/10">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-gray">
                    <Calendar className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>Age</span>
                  </div>
                  <div className="text-sm font-medium text-deep-teal mt-1 tabular-nums">
                    {ageText}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-off-white/60 border border-[#323232]/10">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-gray">
                    <Scale className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>Size class</span>
                  </div>
                  <div className="text-sm font-medium text-deep-teal mt-1 truncate tabular-nums">
                    {sizeText}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-off-white/60 border border-[#323232]/10 col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-gray">
                      <Zap className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      <span>Activity level</span>
                    </div>
                    <span className="text-xs text-neutral-gray tabular-nums">
                      Level {activityInfo.rating}/5
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <Image
                      src={activityInfo.iconSrc}
                      alt={activityInfo.title}
                      width={24}
                      height={24}
                      unoptimized
                      className="w-6 h-6 object-contain shrink-0"
                    />
                    <span className="text-sm font-medium text-deep-teal">
                      {activityInfo.title}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Info */}
              <div className="p-4 rounded-xl bg-off-white border border-[#323232]/10 space-y-2.5">
                <div className="text-xs font-medium text-deep-teal">
                  Emergency contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{formData.contactName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <Phone className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{formData.contactPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Boarding Notes */}
              {formData.petNote && (
                <div className="p-4 rounded-xl bg-off-white/60 border border-[#323232]/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-deep-teal">
                    <FileText className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
                    <span>Host instructions</span>
                  </div>
                  <p className="text-xs text-neutral-gray leading-relaxed">
                    {formData.petNote}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={handleSubmit}
        isNextDisabled={isSubmitting}
        isSubmitting={isSubmitting}
        nextText="Create Pet Profile"
      />
    </>
  )
}
