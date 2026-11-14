'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { WizardStepHeader } from '../WizardStepHeader'
import { SPECIES_CONFIG, SpeciesCardConfig } from '../../_constants/petWizard'
import { getPetTypes } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Pet } from '@/types'

export function Step1({ onNext }: { onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [dbPets, setDbPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPetTypes = async () => {
      try {
        setLoading(true)
        const response = await getPetTypes()
        const petsList = Array.isArray(response.pets)
          ? response.pets
          : Array.isArray((response as { data?: { pets?: Pet[] } })?.data?.pets)
          ? (response as { data: { pets: Pet[] } }).data.pets
          : []
        setDbPets(petsList)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pet types')
      } finally {
        setLoading(false)
      }
    }
    fetchPetTypes()
  }, [])

  const resolvePetTypeId = (key: SpeciesCardConfig['key']): { id: number; name: string } => {
    if (key === 'dog') {
      const match = dbPets.find(
        (p) => p.name.toLowerCase().includes('dog') || p.name.includes('สุนัข') || p.id === 1
      )
      return { id: match?.id ?? 1, name: 'Dog' }
    }
    if (key === 'cat') {
      const match = dbPets.find(
        (p) => p.name.toLowerCase().includes('cat') || p.name.includes('แมว') || p.id === 2
      )
      return { id: match?.id ?? 2, name: 'Cat' }
    }
    const match = dbPets.find(
      (p) => p.name.toLowerCase().includes('exotic') || p.name.includes('พิเศษ') || p.id === 7
    )
    return { id: match?.id ?? 7, name: 'Exotic' }
  }

  const handleSelectSpecies = (cfg: SpeciesCardConfig) => {
    const { id, name } = resolvePetTypeId(cfg.key)
    updateField('petTypeId', id)
    updateField('petTypeName', name)

    if (formData.petTypeId !== id) {
      updateField('petBreedId', null)
      updateField('petBreedName', null)
      updateField('petBreedImageUrl', null)
      updateField('isMixedBreed', false)
      updateField('approxWeight', null)
    }
  }

  if (loading) {
    return (
      <div className="w-full mt-6">
        <div className="flex flex-col items-center mb-8">
          <div className="h-7 bg-off-white rounded-lg w-64 mb-2" />
          <div className="h-4 bg-off-white/70 rounded w-80" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 bg-off-white/60 rounded-2xl border border-[#323232]/10"
            />
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
      <div className="w-full mt-6">
        <WizardStepHeader
          title="What type of pet are you boarding?"
          description="Choose your pet species to match room availability and care options"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
          {SPECIES_CONFIG.map((cfg) => {
            const { id } = resolvePetTypeId(cfg.key)
            const isSelected = formData.petTypeId === id

            return (
              <button
                key={cfg.key}
                type="button"
                onClick={() => handleSelectSpecies(cfg)}
                className={cn(
                  'relative flex flex-col items-center text-center p-6 rounded-2xl border transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent-orange/40',
                  isSelected
                    ? 'border-accent-orange bg-off-white'
                    : 'border-[#323232]/10 bg-white hover:border-deep-teal/30'
                )}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-orange text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  </div>
                )}

                <div
                  className={cn(
                    'w-24 h-24 rounded-xl flex items-center justify-center mb-4 p-2 transition-colors duration-150',
                    isSelected ? 'bg-white' : 'bg-off-white/70'
                  )}
                >
                  <Image
                    src={cfg.imageSrc}
                    alt={cfg.label}
                    width={88}
                    height={88}
                    className="w-20 h-20 object-contain"
                    unoptimized
                    priority
                  />
                </div>

                <h3 className="text-lg font-medium text-deep-teal">
                  {cfg.label}
                </h3>
                <p className="mt-1 text-xs text-neutral-gray leading-relaxed">
                  {cfg.subtitle}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <StepNavigation onNext={onNext} isNextDisabled={!formData.petTypeId} />
    </>
  )
}
