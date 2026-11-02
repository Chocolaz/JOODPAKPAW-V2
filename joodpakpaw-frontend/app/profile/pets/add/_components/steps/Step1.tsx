'use client'

import { useEffect, useState } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { Dog, Cat } from 'lucide-react'
import { getPetTypes } from '@/lib/api'
import { Pet } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'


export function Step1({ onNext }: { onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [availablePetTypes, setAvailablePetTypes] = useState<(Pet & { icon: React.ElementType })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPetTypes = async () => {
      try {
        setLoading(true)
        const response = await getPetTypes()
        const typesWithIcons = response.pets.map((petType) => ({
          ...petType,
          icon: petType.name.toLowerCase() === 'dog' ? Dog : Cat,
        }))
        setAvailablePetTypes(typesWithIcons)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pet types.')
      } finally {
        setLoading(false)
      }
    }
    fetchPetTypes()
  }, [])

  if (loading) {
    return (
      <div className="w-full mt-5 animate-pulse">
        <div className="flex flex-col items-center mb-16">
          <div className="h-6 bg-gray-200 rounded w-52 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-64" />
        </div>
        <div className="flex flex-wrap justify-center gap-8 pb-4">
          {[1, 2].map((i) => (
            <div key={i} className="w-[150px] h-[150px] bg-gray-100 rounded-[20px]" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <>
      <div className="w-full text-center mt-5">
        <h3 className="text-deep-teal text-2xl font-semibold">
          What kind of pet is this?
        </h3>
        <p className="mb-16 text-neutral-gray text-sm">
          Choose the species that best describes the pet.
        </p>

        <div className="flex flex-wrap justify-center gap-8 pb-4">
          {availablePetTypes.map((type) => {
            const isSelected = formData.petTypeId === type.id
            return (
              <button
                key={type.id}
                onClick={() => {
                  updateField('petTypeId', type.id)
                  updateField('petTypeName', type.name)
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-4 border rounded-[20px] shadow-sm cursor-pointer transition-colors w-[150px] h-[150px] bg-white',
                  isSelected
                    ? 'border-positive-green'
                    : 'border-gray-200 hover:border-deep-teal/50'
                )}
              >
                <div
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center transition-colors',
                    isSelected ? 'bg-teal-50' : 'bg-gray-100'
                  )}
                >
                  <type.icon
                    className={cn(
                      'w-12 h-12',
                      isSelected ? 'text-positive-green' : 'text-neutral-gray'
                    )}
                    strokeWidth={1.5}
                  />
                </div>
                <span
                  className={cn(
                    'mt-4 text-center font-medium',
                    isSelected ? 'text-positive-green' : 'text-neutral-dark'
                  )}
                >
                  {type.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <StepNavigation onNext={onNext} isNextDisabled={!formData.petTypeId} />
    </>
  )
}
