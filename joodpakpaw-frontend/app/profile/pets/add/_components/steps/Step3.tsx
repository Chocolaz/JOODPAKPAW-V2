'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { AppCropModal } from '@/components/ui/AppCropModal'
import { WizardStepHeader } from '../WizardStepHeader'
import { cn } from '@/lib/utils'
import { PetGender } from '@/types'

export function Step3({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const petTypeName = (formData.petTypeName || 'pet').toLowerCase()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setRawImageSrc(reader.result as string)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
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
      <div className="w-full mt-6">
        <WizardStepHeader
          title={`Tell us about your ${petTypeName}`}
          description="Add a clear photo for check-in, their name, and gender"
        />

        <div className="max-w-lg mx-auto space-y-6 pb-6">
          {/* Avatar Photo Upload Frame */}
          <div className="flex flex-col items-center p-6 rounded-2xl bg-off-white/60 border border-[#323232]/10">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-32 h-32 rounded-full cursor-pointer transition-colors duration-150 border border-dashed border-[#323232]/25 hover:border-accent-orange bg-white flex items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-accent-orange/40"
            >
              {formData.petImagePreview ? (
                <>
                  <Image
                    src={formData.petImagePreview}
                    alt={formData.petName || 'Pet photo'}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[#323232]/55 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center text-white">
                    <Camera className="w-4 h-4 mb-1" strokeWidth={1.5} />
                    <span className="text-xs font-medium">Change photo</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-gray group-hover:text-deep-teal transition-colors duration-150 p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-off-white flex items-center justify-center mb-2">
                    <ImageIcon className="w-4 h-4 text-deep-teal" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-deep-teal">Add photo</span>
                  <span className="text-xs text-neutral-gray mt-0.5">Tap to crop</span>
                </div>
              )}
            </button>

            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-accent-orange hover:underline cursor-pointer"
              >
                {formData.petImagePreview ? 'Adjust photo' : 'Upload pet photo'}
              </button>

              {formData.petImagePreview && (
                <>
                  <span className="text-[#323232]/20">·</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    <span>Remove</span>
                  </button>
                </>
              )}
            </div>

            {!formData.petImagePreview && (
              <p className="text-xs text-neutral-gray mt-2">
                Photos help hosts recognize your pet during drop-off
              </p>
            )}
          </div>

          {/* Pet Name Input */}
          <div className="space-y-2">
            <label
              htmlFor="pet-name-input"
              className="block text-sm font-medium text-deep-teal"
            >
              Pet name <span className="text-accent-orange">*</span>
            </label>
            <input
              id="pet-name-input"
              type="text"
              value={formData.petName || ''}
              onChange={(e) => updateField('petName', e.target.value)}
              placeholder="e.g. Milo, Luna, Buddy"
              maxLength={50}
              className="w-full px-4 py-3 text-sm bg-white border border-[#323232]/15 rounded-xl text-foreground placeholder:text-neutral-gray/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange transition-colors duration-150"
            />
          </div>

          {/* Gender Selector */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-deep-teal">
              Gender <span className="text-accent-orange">*</span>
            </span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: PetGender.Male, label: 'Male' },
                { value: PetGender.Female, label: 'Female' },
              ].map((option) => {
                const isSelected = formData.petGender === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('petGender', option.value)}
                    className={cn(
                      'flex items-center justify-center p-3.5 rounded-xl border text-sm font-medium transition-colors duration-150 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-orange/40',
                      isSelected
                        ? 'border-accent-orange bg-off-white text-deep-teal'
                        : 'border-[#323232]/10 bg-white text-foreground hover:border-deep-teal/30'
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {rawImageSrc && (
        <AppCropModal
          isOpen={cropModalOpen}
          imageSrc={rawImageSrc}
          circularCrop={true}
          aspectRatio={1}
          title={`Crop ${formData.petName ? `${formData.petName}'s` : petTypeName} photo`}
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
