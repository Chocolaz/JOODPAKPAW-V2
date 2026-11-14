'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { Search, X, Check, Scale } from 'lucide-react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { WizardStepHeader } from '../WizardStepHeader'
import {
  MIXED_PET_ICON_SRC,
  WEIGHT_PRESETS,
  WeightPreset,
  deriveSizeFromBreed,
  deriveSizeFromWeight,
  formatCleanBreedName,
  isSpecialBreedName,
} from '../../_constants/petWizard'
import { getPetBreedsByTypeId } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PetBreed } from '@/types'

function BreedThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-off-white/80 p-2">
        <Image
          src={MIXED_PET_ICON_SRC}
          alt={alt}
          width={48}
          height={48}
          unoptimized
          className="w-10 h-10 object-contain"
        />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
      className="object-cover"
      onError={() => setHasError(true)}
    />
  )
}

export function Step2({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [breeds, setBreeds] = useState<PetBreed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const petTypeId = formData.petTypeId || 1
  const petTypeName = (formData.petTypeName || 'pet').toLowerCase()

  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getPetBreedsByTypeId(petTypeId)
        const list = Array.isArray(response.petBreeds)
          ? response.petBreeds
          : Array.isArray((response as { data?: { petBreeds?: PetBreed[] } })?.data?.petBreeds)
          ? (response as { data: { petBreeds: PetBreed[] } }).data.petBreeds
          : []
        setBreeds(list)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load breeds')
      } finally {
        setLoading(false)
      }
    }
    fetchBreeds()
  }, [petTypeId])

  const filteredBreeds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return breeds
    return breeds.filter((b) => {
      const cleanName = formatCleanBreedName(b.breed).toLowerCase()
      return cleanName.includes(query) || b.breed.toLowerCase().includes(query)
    })
  }, [breeds, searchQuery])

  const { specialBreeds, standardBreeds } = useMemo(() => {
    const special: PetBreed[] = []
    const standard: PetBreed[] = []

    for (const b of filteredBreeds) {
      if (isSpecialBreedName(b.breed)) {
        special.push(b)
      } else {
        standard.push(b)
      }
    }
    return { specialBreeds: special, standardBreeds: standard }
  }, [filteredBreeds])

  const handleSelectBreed = (b: PetBreed) => {
    const isSpecial = isSpecialBreedName(b.breed)
    const cleanName = formatCleanBreedName(b.breed)

    updateField('petBreedId', b.id)
    updateField('petBreedName', cleanName)
    updateField('petBreedImageUrl', isSpecial ? null : b.imageUrl || null)
    updateField('isMixedBreed', isSpecial)

    if (!isSpecial) {
      updateField('petSizeCategoryId', deriveSizeFromBreed(cleanName))
    }
  }

  const handleSelectWeightPreset = (preset: WeightPreset) => {
    updateField('approxWeight', preset.defaultVal)
    updateField('petSizeCategoryId', preset.sizeId)
  }

  const isMixedOrOther =
    formData.isMixedBreed ||
    Boolean(formData.petBreedName && isSpecialBreedName(formData.petBreedName))

  const isNextDisabled =
    !formData.petBreedId ||
    (isMixedOrOther && (!formData.approxWeight || formData.approxWeight <= 0))

  return (
    <>
      <div className="w-full mt-6">
        <WizardStepHeader
          title={`What breed is your ${petTypeName}?`}
          description="Select a verified breed, or choose Mixed or Other if not listed"
        />

        {/* Search Bar */}
        <div className="relative mb-6 max-w-lg mx-auto">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-gray"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${petTypeName} breeds`}
            className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-[#323232]/15 rounded-xl text-foreground placeholder:text-neutral-gray/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-gray hover:text-deep-teal transition-colors duration-150 cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-40 bg-off-white/60 rounded-xl border border-[#323232]/10"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="space-y-6 pb-6">
            {/* Special Breeds Section (Mixed Breed & Other / Unknown) */}
            {specialBreeds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {specialBreeds.map((b) => {
                  const isSelected = formData.petBreedId === b.id
                  const cleanName = formatCleanBreedName(b.breed)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBreed(b)}
                      className={cn(
                        'relative flex items-center gap-3.5 p-3 rounded-xl border text-left transition-colors duration-150 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-orange/40',
                        isSelected
                          ? 'border-accent-orange bg-off-white'
                          : 'border-[#323232]/10 bg-white hover:border-deep-teal/30'
                      )}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-off-white/80 border border-[#323232]/10">
                        <BreedThumbnail src={null} alt={cleanName} />
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-sm font-medium text-deep-teal truncate">
                          {cleanName}
                        </div>
                        <div className="text-xs text-neutral-gray truncate mt-0.5">
                          Crossbreed or unlisted
                        </div>
                      </div>

                      {isSelected && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent-orange text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline Weight Prompt for Mixed / Unknown */}
            {isMixedOrOther && (
              <div className="p-5 rounded-2xl bg-off-white border border-accent-orange/30 space-y-4">
                <div className="flex items-center gap-2 text-deep-teal">
                  <Scale className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  <h4 className="text-sm font-medium">
                    Approximate adult weight (kg)
                  </h4>
                </div>
                <p className="text-xs text-neutral-gray">
                  Estimated weight helps boarding hosts allocate the right room size
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WEIGHT_PRESETS.map((p) => {
                    const isSelected =
                      formData.approxWeight !== null &&
                      formData.approxWeight !== undefined &&
                      formData.approxWeight >= p.min &&
                      formData.approxWeight <= p.max
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handleSelectWeightPreset(p)}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-colors duration-150 text-xs outline-none cursor-pointer',
                          isSelected
                            ? 'bg-accent-orange text-white border-accent-orange'
                            : 'bg-white text-foreground border-[#323232]/10 hover:border-deep-teal/30'
                        )}
                      >
                        <div className="font-medium tabular-nums">{p.label}</div>
                        <div
                          className={cn(
                            'text-xs truncate mt-0.5',
                            isSelected ? 'text-white/85' : 'text-neutral-gray'
                          )}
                        >
                          {p.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label
                    htmlFor="approx-weight-input"
                    className="text-xs text-deep-teal font-medium"
                  >
                    Or exact weight
                  </label>
                  <div className="relative w-28">
                    <input
                      id="approx-weight-input"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="120"
                      value={formData.approxWeight || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || null
                        updateField('approxWeight', val)
                        if (val) {
                          updateField('petSizeCategoryId', deriveSizeFromWeight(val))
                        }
                      }}
                      placeholder="12"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#323232]/15 rounded-lg text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-gray">
                      kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Purebred Grid */}
            <div>
              <div className="text-xs font-medium text-neutral-gray mb-3 tabular-nums">
                Recognized breeds ({standardBreeds.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {standardBreeds.map((b) => {
                  const isSelected = formData.petBreedId === b.id
                  const cleanName = formatCleanBreedName(b.breed)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBreed(b)}
                      className={cn(
                        'relative flex flex-col p-2.5 rounded-xl border text-left transition-colors duration-150 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-orange/40',
                        isSelected
                          ? 'border-accent-orange bg-off-white'
                          : 'border-[#323232]/10 bg-white hover:border-deep-teal/30'
                      )}
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2 bg-off-white/60 border border-[#323232]/10">
                        <BreedThumbnail src={b.imageUrl} alt={cleanName} />
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-orange text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          </div>
                        )}
                      </div>

                      <div className="text-xs font-medium text-deep-teal truncate">
                        {cleanName}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        isNextDisabled={Boolean(isNextDisabled)}
      />
    </>
  )
}
