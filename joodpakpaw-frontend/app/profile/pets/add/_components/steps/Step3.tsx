'use client'

import React, { useState, useRef } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { AppCropModal } from '@/components/ui/AppCropModal'
import { cn } from '@/lib/utils'
import { PetGender } from '@/types'
import { Camera, Image as ImageIcon, Trash2, Sparkles } from 'lucide-react'
import Image from 'next/image'

export function Step3({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const petTypeName = formData.petTypeName || 'Pet'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setRawImageSrc(reader.result as string)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    // reset input so user can pick same file again if desired
    e.target.value = ''
  }

  const handleCropComplete = (croppedFile: File, previewUrl: string) => {
    updateField('petImage', croppedFile)
    updateField('petImagePreview', previewUrl)
    setCropModalOpen(false)
    setRawImageSrc(null)
  }

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateField('petImage', null)
    updateField('petImagePreview', null)
    setRawImageSrc(null)
  }

  const isNextDisabled =
    !formData.petName || !formData.petName.trim() || !formData.petGender

  return (
    <>
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-6 sm:mb-8">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 3 of 6
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Tell us about your {petTypeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Give your companion a name, a photo for boarding check-ins, and their gender.
          </p>
        </header>

        <div className="max-w-md mx-auto space-y-6 pb-6">
          {/* Avatar Photo Upload Frame */}
          <div className="flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-32 h-32 sm:w-36 sm:h-36 rounded-full cursor-pointer transition-all duration-200 border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-500 bg-stone-50 dark:bg-stone-850 flex items-center justify-center overflow-hidden shadow-sm hover:shadow-md"
            >
              {formData.petImagePreview ? (
                <>
                  <Image
                    src={formData.petImagePreview}
                    alt={formData.petName || 'Pet photo'}
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                  {/* Hover overlay to change */}
                  <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">Change Photo</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-stone-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-stone-200/60 dark:bg-stone-800 flex items-center justify-center mb-2 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/50">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">Add Photo</span>
                  <span className="text-[10px] text-stone-400 mt-0.5">Tap to crop</span>
                </div>
              )}
            </div>

            {/* Action buttons below photo */}
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                {formData.petImagePreview ? 'Adjust Photo' : 'Upload Pet Photo'}
              </button>

              {formData.petImagePreview && (
                <>
                  <span className="text-stone-300 dark:text-stone-700">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </>
              )}
            </div>

            {!formData.petImagePreview && (
              <div className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Photos help hosts recognize your pet during drop-off</span>
              </div>
            )}
          </div>

          {/* Pet Name Input */}
          <div className="space-y-1.5">
            <label htmlFor="pet-name-input" className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Pet Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="pet-name-input"
              type="text"
              value={formData.petName || ''}
              onChange={(e) => updateField('petName', e.target.value)}
              placeholder="e.g. Milo, Luna, Buddy"
              maxLength={50}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm font-medium"
            />
          </div>

          {/* Gender Selector Pills */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Gender <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateField('petGender', PetGender.Male)}
                className={cn(
                  'flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 font-medium text-sm transition-all outline-none',
                  formData.petGender === PetGender.Male
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-200 shadow-sm'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                )}
              >
                <span className="text-base font-bold text-sky-500">♂</span>
                <span>Male (ตัวผู้)</span>
              </button>

              <button
                type="button"
                onClick={() => updateField('petGender', PetGender.Female)}
                className={cn(
                  'flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 font-medium text-sm transition-all outline-none',
                  formData.petGender === PetGender.Female
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 shadow-sm'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                )}
              >
                <span className="text-base font-bold text-rose-500">♀</span>
                <span>Female (ตัวเมีย)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern High-Z Crop Modal Portaled to document.body */}
      {rawImageSrc && (
        <AppCropModal
          isOpen={cropModalOpen}
          imageSrc={rawImageSrc}
          circularCrop={true}
          aspectRatio={1}
          title={`Crop ${formData.petName ? formData.petName + "'s" : petTypeName} Photo`}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropModalOpen(false)
            setRawImageSrc(null)
          }}
        />
      )}

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        isNextDisabled={isNextDisabled}
      />
    </>
  )
}
