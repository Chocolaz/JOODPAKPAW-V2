'use client'

import React, { useEffect, useState } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { getPetTypes } from '@/lib/api'
import { Pet } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { Check } from 'lucide-react'
import { PiDogBold, PiCatBold, PiRabbitBold } from 'react-icons/pi'

interface SpeciesCardDef {
  key: 'dog' | 'cat' | 'exotic'
  label: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

const SPECIES_CONFIG: SpeciesCardDef[] = [
  {
    key: 'dog',
    label: 'Dog',
    subtitle: 'All breeds, shapes, and sizes',
    icon: PiDogBold,
  },
  {
    key: 'cat',
    label: 'Cat',
    subtitle: 'All breeds & indoor companions',
    icon: PiCatBold,
  },
  {
    key: 'exotic',
    label: 'Exotic Pet',
    subtitle: 'Rabbits, hamsters, birds, ferrets & reptiles',
    icon: PiRabbitBold,
  },
]

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
          : Array.isArray((response as any)?.data?.pets)
          ? (response as any).data.pets
          : []
        setDbPets(petsList)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pet types.')
      } finally {
        setLoading(false)
      }
    }
    fetchPetTypes()
  }, [])

  // Map each species card to its corresponding DB petTypeId
  const resolvePetTypeId = (key: 'dog' | 'cat' | 'exotic'): { id: number; name: string } => {
    if (key === 'dog') {
      const match = dbPets.find(
        (p) =>
          p.name.toLowerCase().includes('dog') ||
          p.name.includes('สุนัข') ||
          p.id === 1
      )
      return { id: match?.id ?? 1, name: 'Dog' }
    }
    if (key === 'cat') {
      const match = dbPets.find(
        (p) =>
          p.name.toLowerCase().includes('cat') ||
          p.name.includes('แมว') ||
          p.id === 2
      )
      return { id: match?.id ?? 2, name: 'Cat' }
    }
    // Exotic: search for Exotic or fallback to 7
    const match = dbPets.find(
      (p) =>
        p.name.toLowerCase().includes('exotic') ||
        p.name.includes('พิเศษ') ||
        p.id === 7
    )
    return { id: match?.id ?? 7, name: 'Exotic' }
  }

  const handleSelectSpecies = (cfg: SpeciesCardDef) => {
    const { id, name } = resolvePetTypeId(cfg.key)
    updateField('petTypeId', id)
    updateField('petTypeName', name)
    // Clear breed if pet type changes
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
      <div className="w-full mt-6 animate-pulse">
        <div className="flex flex-col items-center mb-10">
          <div className="h-7 bg-stone-200 dark:bg-stone-800 rounded-lg w-64 mb-3" />
          <div className="h-4 bg-stone-100 dark:bg-stone-800/60 rounded w-80" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-stone-100 dark:bg-stone-800/40 rounded-2xl border border-stone-200/60 dark:border-stone-800"
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
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-8 sm:mb-10">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 1 of 6
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            What type of pet are you boarding?
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Choose your pet species to customize room availability and care options.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
          {SPECIES_CONFIG.map((cfg) => {
            const { id } = resolvePetTypeId(cfg.key)
            const isSelected = formData.petTypeId === id
            const Icon = cfg.icon

            return (
              <button
                key={cfg.key}
                type="button"
                onClick={() => handleSelectSpecies(cfg)}
                className={cn(
                  'relative group flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer outline-none bg-white dark:bg-stone-900',
                  isSelected
                    ? 'border-amber-500 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-md shadow-amber-500/10'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50/50 dark:hover:bg-stone-850/50 shadow-sm'
                )}
              >
                {/* Active check pill */}
                {isSelected && (
                  <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}

                {/* Professional Icon from Phosphor Icons library */}
                <div
                  className={cn(
                    'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mt-2 mb-4 transition-transform group-hover:scale-105 duration-200',
                    isSelected
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'
                  )}
                >
                  <Icon className="w-9 h-9 sm:w-11 sm:h-11" />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                  {cfg.label}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
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
