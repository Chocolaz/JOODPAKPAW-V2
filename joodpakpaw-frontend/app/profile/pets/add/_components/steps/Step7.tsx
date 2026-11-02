'use client'

import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { Baby, Zap } from 'lucide-react'

interface Step7Props {
  onNext: () => void
  onBack: () => void
}

const ACTIVITY_LEVELS = [
  { level: 1, label: 'Lazy' },
  { level: 2, label: 'Calm' },
  { level: 3, label: 'Moderate' },
  { level: 4, label: 'Active' },
  { level: 5, label: 'Hyper' },
]

export function Step7({ onNext, onBack }: Step7Props) {
  const { formData, updateField } = useAddPet()
  const petImageSrc =
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null

  return (
    <div className="flex flex-col flex-grow w-full">
      <div className="w-full text-center mt-5">
        <div className="flex justify-center mb-8">
          <div
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border relative',
              petImageSrc ? 'border-positive-green' : 'border-deep-teal',
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
              <Baby className="w-16 h-16 text-gray-500" />
            )}
          </div>
        </div>

        <h3 className="text-deep-teal text-2xl font-semibold">
          How active is {formData.petName || 'your pet'}?
        </h3>
        <p className="mb-6 text-neutral-gray text-sm">
          How energetic on a daily basis?
        </p>

        <div className="flex justify-center gap-1 sm:gap-2 mb-2">
          {ACTIVITY_LEVELS.map(({ level, label }) => {
            const isActive = formData.petActivityLevel === level
            const isFilled =
              formData.petActivityLevel !== null &&
              formData.petActivityLevel >= level
            return (
              <button
                key={level}
                onClick={() => updateField('petActivityLevel', level)}
                className="flex flex-col items-center gap-2 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors min-w-[52px]"
              >
                <Zap
                  className={cn(
                    'w-9 h-9 transition-colors',
                    isFilled ? 'text-accent-orange' : 'text-gray-200',
                  )}
                  fill={isFilled ? 'currentColor' : 'none'}
                />
                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isActive ? 'text-accent-orange' : 'text-neutral-gray/50',
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!formData.petActivityLevel}
      />
    </div>
  )
}
