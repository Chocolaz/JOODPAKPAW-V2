'use client'

import React, { useEffect, useState } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { getPetTypes } from '@/lib/api'
import { Pet } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { Check } from 'lucide-react'

// Distinct custom icons for the 3 species
function DogIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.5 1 1.695-.69 3.83-2.5 4-5.828z" />
      <path d="M14 5.172C14 3.782 15.577 2.679 17.5 3c2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.5 1-1.695-.69-3.83-2.5-4-5.828z" />
      <path d="M7 14c0 3.866 2.239 7 5 7s5-3.134 5-7c0-2-1.5-4-5-4s-5 2-5 4z" />
      <circle cx="9.5" cy="13.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" />
      <path d="M11 16.5c.5.5 1.5.5 2 0" />
    </svg>
  )
}

function CatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5c-4.5 0-7 3.5-7 8 0 4 3 8 7 8s7-4 7-8c0-4.5-2.5-8-7-8z" />
      <path d="M5 10L3 3l7 3" />
      <path d="M19 10l2-7-7 3" />
      <circle cx="9.5" cy="12" r="1" fill="currentColor" />
      <circle cx="14.5" cy="12" r="1" fill="currentColor" />
      <path d="M11.5 14.5h1" />
      <path d="M10 16c.8.7 3.2.7 4 0" />
      <path d="M7 13.5H3" />
      <path d="M7 15H4" />
      <path d="M17 13.5h4" />
      <path d="M17 15h3" />
    </svg>
  )
}

function ExoticIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Friendly exotic outline (bunny / small pet silhouette) */}
      <path d="M9 11C6.5 11 4.5 13 4.5 16c0 3 2.5 5 7.5 5s7.5-2 7.5-5c0-3-2-5-4.5-5" />
      <path d="M8.5 11c0-3.5-1.5-8 0-9 1.5-1 3.5 4 3.5 7" />
      <path d="M15.5 11c0-3.5 1.5-8 0-9-1.5-1-3.5 4-3.5 7" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <path d="M11.5 17.5c.3.3.7.3 1 0" />
      <path d="M19 18c1.5 0 2.5-1 2.5-2.5" />
    </svg>
  )
}

interface SpeciesCardDef {
  key: 'dog' | 'cat' | 'exotic'
  label: string
  subtitle: string
  tag: string
  icon: React.ComponentType<{ className?: string }>
}

const SPECIES_CONFIG: SpeciesCardDef[] = [
  {
    key: 'dog',
    label: 'Dog',
    subtitle: 'Canines of all breeds, shapes & sizes',
    tag: 'Popular',
    icon: DogIcon,
  },
  {
    key: 'cat',
    label: 'Cat',
    subtitle: 'Felines, indoor cats & gentle kittens',
    tag: 'Popular',
    icon: CatIcon,
  },
  {
    key: 'exotic',
    label: 'Exotic Pet',
    subtitle: 'Rabbits, hamsters, ferrets & reptiles',
    tag: 'Special Care',
    icon: ExoticIcon,
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
            Choose the species so we can tailor breeds, room sizing, and care guidelines.
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
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}

                {/* Tag badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      isSelected
                        ? 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    )}
                  >
                    {cfg.tag}
                  </span>
                </div>

                {/* Icon Circle */}
                <div
                  className={cn(
                    'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mt-3 mb-4 transition-transform group-hover:scale-105 duration-200',
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
