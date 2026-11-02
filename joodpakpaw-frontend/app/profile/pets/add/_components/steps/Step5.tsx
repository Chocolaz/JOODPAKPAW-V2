'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { PawPrint, HelpCircle } from 'lucide-react'
import { PetSizeCategory } from '@/types'
import { getPetSizeCategories } from '@/lib/api'
import { ErrorState } from '@/app/profile/_components/ErrorState'

interface Step5Props {
  onNext: () => void
  onBack: () => void
}

export function Step5({ onNext, onBack }: Step5Props) {
  const { formData, updateField } = useAddPet()
  const petImageSrc = formData.petImage instanceof File ? URL.createObjectURL(formData.petImage) : null
  const [sizeCategories, setSizeCategories] = useState<PetSizeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSizes = async () => {
      try {
        setLoading(true)
        const response = await getPetSizeCategories()
        setSizeCategories(response.petSizeCategories)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pet sizes.')
      } finally {
        setLoading(false)
      }
    }
    fetchSizes()
  }, [])

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
  
  if (loading) {
    return (
      <div className="flex flex-col flex-grow w-full animate-pulse">
        <div className="flex flex-col items-center mt-5">
          <div className="w-24 h-24 bg-gray-100 rounded-full mb-8" />
          <div className="h-6 bg-gray-200 rounded w-44 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-64 mb-4" />
          <div className="flex flex-row gap-2 pb-4 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-28 bg-gray-100 rounded-[20px]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <div className="flex flex-col flex-grow w-full">
      <div className="w-full text-center mt-5">
        {/* Pet Image Display */}
        <div className="flex justify-center mb-8">
          <div
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border relative', // Adjusted size
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
              <HelpCircle className="w-16 h-16 text-gray-500" />
            )}
          </div>
        </div>

        <h3 className="text-deep-teal text-2xl font-semibold">
          How big is your pet?
        </h3>
        <p className="mb-4 text-neutral-gray text-sm">
          Don&apos;t worry, this can be updated later as they grow!
        </p>

        {/* Size Selection Cards */}
        <div className="flex flex-row justify-center items-center gap-2 pb-4 w-full">
          {sizeCategories.map((size) => {
            const isSelected = formData.petSizeCategoryId === size.id
            return (
              <button
                key={size.id}
                onClick={() => {
                  updateField('petSizeCategoryId', size.id)
                  updateField('petSizeName', size.name)
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-3 border rounded-[20px] cursor-pointer bg-white transition-all duration-300 ease-in-out flex-1',
                  isSelected
                    ? 'border-positive-green shadow-lg'
                    : 'border-gray-200 hover:border-deep-teal/50 shadow-sm'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isSelected ? 'bg-teal-50' : 'bg-gray-100'
                  )}
                >
                  <PawPrint
                    className={cn(
                      'w-5 h-5',
                      isSelected ? 'text-positive-green' : 'text-neutral-gray'
                    )}
                    strokeWidth={1.5}
                  />
                </div>
                <span
                  className={cn(
                    'mt-2 text-center font-medium capitalize text-sm',
                    isSelected ? 'text-positive-green' : 'text-neutral-dark'
                  )}
                >
                  {size.name}
                </span>
                <p
                  className={cn(
                    'text-center text-xs',
                    isSelected ? 'text-positive-green' : 'text-neutral-gray'
                  )}
                >
                  {getDescription(size.name)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!formData.petSizeCategoryId}
      />
    </div>
  )
}
