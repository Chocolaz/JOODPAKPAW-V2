'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { createPetProfile } from '@/lib/api'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { toast } from 'sonner'
import {
  Sparkles,
  Phone,
  User,
  Zap,
  Scale,
  Calendar,
  FileText,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'

const SIZE_LABELS: Record<number, string> = {
  1: 'Small (< 5 kg)',
  2: 'Medium (5 – 15 kg)',
  3: 'Large (15 – 30 kg)',
  4: 'Giant (> 30 kg)',
}

const ACTIVITY_LABELS: Record<number, { title: string; emoji: string }> = {
  1: { title: 'Couch Potato', emoji: '🛋️' },
  2: { title: 'Mellow', emoji: '🚶' },
  3: { title: 'Balanced', emoji: '🐕' },
  4: { title: 'High Energy', emoji: '🎾' },
  5: { title: 'Hyperactive', emoji: '⚡' },
}

function formatCleanBreedName(rawBreed: string): string {
  const match = /(.*?)\s*\(.*?\)/.exec(rawBreed)
  return (match ? match[1] : rawBreed).trim()
}

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
      ? `${years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : ''}${years > 0 && months > 0 ? ', ' : ''}${months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : ''}`
      : formData.petBirthDate
      ? `Born ${formData.petBirthDate}`
      : 'Not specified'

  const sizeText = formData.petSizeCategoryId
    ? SIZE_LABELS[formData.petSizeCategoryId] || 'Standard'
    : formData.approxWeight
    ? `Approx. ${formData.approxWeight} kg`
    : 'Auto-assigned'

  const activityInfo = formData.petActivityLevel
    ? ACTIVITY_LABELS[formData.petActivityLevel] || { title: 'Moderate', emoji: '🐕' }
    : { title: 'Moderate', emoji: '🐕' }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const apiFormData = new FormData()
    if (formData.petName) apiFormData.append('name', formData.petName.trim())
    if (formData.petImage) apiFormData.append('image', formData.petImage)
    if (formData.petGender) apiFormData.append('sex', formData.petGender)
    if (formData.petTypeId) apiFormData.append('petTypeId', String(formData.petTypeId))
    if (formData.petBreedId) apiFormData.append('petBreedId', String(formData.petBreedId))
    if (formData.petSizeCategoryId) apiFormData.append('petSizeCategoryId', String(formData.petSizeCategoryId))
    if (formData.petActivityLevel) apiFormData.append('petEnergyId', String(formData.petActivityLevel))
    if (formData.contactName) apiFormData.append('contactName', formData.contactName.trim())
    if (formData.contactPhone) apiFormData.append('contactPhone', formData.contactPhone.trim())
    if (formData.petNote) apiFormData.append('note', formData.petNote.trim())

    // Send age
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
      toast.success(`${petName}'s profile has been created!`)
      clearAddPetSession()
      router.push('/profile/pets')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create pet profile.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-6 sm:mb-8">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 6 of 6 • Final Review
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {petName}&apos;s Pet Passport
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Review your companion&apos;s boarding details before saving their profile.
          </p>
        </header>

        <div className="max-w-md mx-auto space-y-4 pb-8">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Passport Card */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-md">
            {/* Header Ribbon */}
            <div className="h-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

            <div className="p-5 sm:p-6 space-y-5">
              {/* Pet Identity Header */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-800 border-2 border-white dark:border-stone-800 shadow-sm">
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
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400">
                      <Sparkles className="w-8 h-8 text-amber-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
                      {petName}
                    </h3>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                        formData.petGender === 'male'
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-900/60'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60'
                      )}
                    >
                      {formData.petGender === 'male' ? '♂ Male' : '♀ Female'}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 truncate">
                    {formData.petTypeName} • {formatCleanBreedName(formData.petBreedName || 'Mixed / Other')}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Boarding Passport</span>
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
                  <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>Age</span>
                  </div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {ageText}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
                  <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    <Scale className="w-3 h-3 text-stone-400" />
                    <span>Size Class</span>
                  </div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-0.5 truncate">
                    {sizeText}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800 col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Activity Level</span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400">
                      Level {formData.petActivityLevel}/5
                    </span>
                  </div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-0.5 flex items-center gap-1.5">
                    <span>{activityInfo.emoji}</span>
                    <span>{activityInfo.title}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Info */}
              <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Emergency Contact
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                    <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">{formData.contactName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 font-mono">
                    <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">{formData.contactPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Boarding Notes */}
              {formData.petNote && (
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300">
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    <span>Host Instructions</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed italic">
                    &ldquo;{formData.petNote}&rdquo;
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
