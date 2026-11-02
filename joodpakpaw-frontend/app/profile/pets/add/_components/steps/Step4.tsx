'use client'

import { useState } from 'react'
import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { Mars, Venus, HelpCircle } from 'lucide-react'
import { PetGender } from '@/types'

interface Step4Props {
  onNext: () => void
  onBack: () => void
}

export function Step4({ onNext, onBack }: Step4Props) {
  const { formData, updateField } = useAddPet()
  const petImageSrc =
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null

  const renderDefaultIcon = () => {
    if (formData.petTypeId === 1) {
      return <Mars className="w-16 h-16 text-deep-teal" />
    } else if (formData.petTypeId === 2) {
      return <Venus className="w-16 h-16 text-deep-teal" />
    } else {
      return <HelpCircle className="w-16 h-16 text-gray-500" />
    }
  }

  const genderOptions = [
    { label: 'Male', value: PetGender.Male, icon: Mars },
    { label: 'Female', value: PetGender.Female, icon: Venus },
  ]

  return (
    <div className="flex flex-col grow w-full">
      <div className="w-full text-center mt-5">
        {/* Pet Image Display */}
        <div className="flex justify-center mb-8">
          <div
            className={cn(
              'w-26 h-26 rounded-full flex items-center justify-center overflow-hidden border relative',
              petImageSrc ? 'border-positive-green' : 'border-deep-teal'
            )}
          >
            {petImageSrc ? (
              <Image
                src={petImageSrc}
                alt={formData.petName || 'Pet image'}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              renderDefaultIcon()
            )}
          </div>
        </div>

        <h3 className="text-deep-teal text-2xl font-semibold">
          What&apos;s your pet&apos;s gender?
        </h3>
        <div className="h-4" />

        {/* Gender Selection Cards */}
        <div className="flex flex-col items-center gap-6 pb-4">
          <div className="flex gap-8">
            {genderOptions.map((option) => {
              const isSelected = formData.petGender === option.value

              let cardBorderColor = 'border-gray-200 hover:border-deep-teal/50'
              let iconBgColor = 'bg-gray-100'
              let iconTextColor = 'text-neutral-gray'
              let labelTextColor = 'text-neutral-dark'

              if (isSelected) {
                if (option.value === PetGender.Male) {
                  cardBorderColor = 'border-positive-green'
                  iconBgColor = 'bg-blue-50'
                  iconTextColor = 'text-blue-400'
                  labelTextColor = 'text-blue-500'
                } else if (option.value === PetGender.Female) {
                  cardBorderColor = 'border-positive-green'
                  iconBgColor = 'bg-pink-50'
                  iconTextColor = 'text-pink-400'
                  labelTextColor = 'text-pink-500'
                }
              }

              const IconComponent = option.icon

              return (
                <button
                  key={option.value}
                  onClick={() => updateField('petGender', option.value)}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 border rounded-[20px] shadow-sm cursor-pointer transition-colors w-[150px] h-[150px] bg-white',
                    cardBorderColor
                  )}
                >
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center transition-colors',
                      iconBgColor
                    )}
                  >
                    <IconComponent
                      className={cn('w-12 h-12', iconTextColor)}
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className={cn('mt-4 text-center font-medium', labelTextColor)}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!formData.petGender}
      />
    </div>
  )
}
