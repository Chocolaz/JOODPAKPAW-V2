'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { getPetBreedsByTypeId } from '@/lib/api'
import { PetBreed } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { Search, X, Check, HelpCircle, Scale } from 'lucide-react'
import Image from 'next/image'

const WEIGHT_PRESETS = [
  { label: '< 5 kg', desc: 'Small (e.g. Chihuahua)', min: 1, max: 5, defaultVal: 3.5, sizeId: 1 },
  { label: '5 – 15 kg', desc: 'Medium (e.g. Beagle)', min: 5, max: 15, defaultVal: 10, sizeId: 2 },
  { label: '15 – 30 kg', desc: 'Large (e.g. Husky)', min: 15, max: 30, defaultVal: 22, sizeId: 3 },
  { label: '> 30 kg', desc: 'Giant (e.g. Great Dane)', min: 30, max: 60, defaultVal: 35, sizeId: 4 },
]

export function Step2({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [breeds, setBreeds] = useState<PetBreed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const petTypeId = formData.petTypeId || 1
  const petTypeName = formData.petTypeName || 'Pet'

  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getPetBreedsByTypeId(petTypeId)
        const list = Array.isArray(response.petBreeds)
          ? response.petBreeds
          : Array.isArray((response as any)?.data?.petBreeds)
          ? (response as any).data.petBreeds
          : []
        setBreeds(list)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load breeds.')
      } finally {
        setLoading(false)
      }
    }
    fetchBreeds()
  }, [petTypeId])

  // Filter breeds by search query
  const filteredBreeds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return breeds
    return breeds.filter((b) => b.breed.toLowerCase().includes(query))
  }, [breeds, searchQuery])

  // Separate mixed/other from standard breeds for first-class top pin
  const { specialBreeds, standardBreeds } = useMemo(() => {
    const special: PetBreed[] = []
    const standard: PetBreed[] = []

    for (const b of filteredBreeds) {
      const lower = b.breed.toLowerCase()
      if (lower.includes('mixed') || lower.includes('other') || lower.includes('unknown') || lower.includes('พันธุ์ผสม') || lower.includes('อื่นๆ')) {
        special.push(b)
      } else {
        standard.push(b)
      }
    }
    return { specialBreeds: special, standardBreeds: standard }
  }, [filteredBreeds])

  const handleSelectBreed = (b: PetBreed) => {
    const isSpecial =
      b.breed.toLowerCase().includes('mixed') ||
      b.breed.toLowerCase().includes('other') ||
      b.breed.toLowerCase().includes('unknown') ||
      b.breed.includes('พันธุ์ผสม') ||
      b.breed.includes('อื่นๆ')

    updateField('petBreedId', b.id)
    updateField('petBreedName', b.breed)
    updateField('petBreedImageUrl', b.imageUrl || null)
    updateField('isMixedBreed', isSpecial)

    if (!isSpecial) {
      // Clear or auto-derive size from breed name
      const bLower = b.breed.toLowerCase()
      let autoSizeId = 1
      if (bLower.includes('giant') || bLower.includes('maine coon')) autoSizeId = 4
      else if (bLower.includes('golden') || bLower.includes('labrador') || bLower.includes('husky') || bLower.includes('ridgeback') || bLower.includes('ragdoll')) autoSizeId = 3
      else if (bLower.includes('corgi') || bLower.includes('beagle') || bLower.includes('bulldog') || bLower.includes('shorthair') || bLower.includes('persian')) autoSizeId = 2
      updateField('petSizeCategoryId', autoSizeId)
    }
  }

  const handleSelectWeightPreset = (preset: typeof WEIGHT_PRESETS[0]) => {
    updateField('approxWeight', preset.defaultVal)
    updateField('petSizeCategoryId', preset.sizeId)
  }

  // Format clean display breed name (English first, Thai secondary)
  const formatBreedNames = (rawBreed: string) => {
    const match = /(.*?)\s*\((.*?)\)/.exec(rawBreed)
    if (match) {
      return { primary: match[1].trim(), secondary: match[2].trim() }
    }
    return { primary: rawBreed, secondary: '' }
  }

  const isMixedOrOther = formData.isMixedBreed || (formData.petBreedName && (
    formData.petBreedName.toLowerCase().includes('mixed') ||
    formData.petBreedName.toLowerCase().includes('other') ||
    formData.petBreedName.toLowerCase().includes('unknown')
  ))

  const isNextDisabled =
    !formData.petBreedId ||
    (isMixedOrOther && (!formData.approxWeight || formData.approxWeight <= 0))

  return (
    <>
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-6 sm:mb-8">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 2 of 6
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            What breed is your {petTypeName}?
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Select a verified breed, or choose Mixed / Other if not listed.
          </p>
        </header>

        {/* Search Bar */}
        <div className="relative mb-6 max-w-md mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${petTypeName} breeds...`}
            className="w-full pl-10 pr-9 py-2.5 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pb-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-36 bg-stone-100 dark:bg-stone-800/40 rounded-xl border border-stone-200/60 dark:border-stone-800"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="space-y-6 pb-6">
            {/* Special Breeds Section (Mixed Breed & Other / Unknown) */}
            {specialBreeds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {specialBreeds.map((b) => {
                  const isSelected = formData.petBreedId === b.id
                  const { primary, secondary } = formatBreedNames(b.breed)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBreed(b)}
                      className={cn(
                        'relative flex items-center gap-3.5 p-3.5 rounded-xl border-2 text-left transition-all duration-200 outline-none bg-white dark:bg-stone-900 shadow-sm',
                        isSelected
                          ? 'border-amber-500 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                      )}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80">
                        {b.imageUrl ? (
                          <Image
                            src={b.imageUrl}
                            alt={primary}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <HelpCircle className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {primary}
                        </div>
                        {secondary && (
                          <div className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                            {secondary}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline Weight Prompt for Mixed / Unknown */}
            {isMixedOrOther && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h4 className="text-sm font-semibold">
                    Approximate Adult Weight (kg)
                  </h4>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Since mixed and crossbreed sizes vary, choose an estimated weight range so hosts can allocate suitable room sizes.
                </p>

                {/* Preset Chips */}
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
                          'p-2.5 rounded-xl border text-left transition-all text-xs outline-none',
                          isSelected
                            ? 'bg-amber-500 text-stone-950 font-semibold border-amber-600 shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-amber-200/60 dark:border-stone-800 hover:border-amber-400'
                        )}
                      >
                        <div className="font-bold">{p.label}</div>
                        <div className={cn('text-[10px] truncate', isSelected ? 'text-stone-900/80' : 'text-stone-500 dark:text-stone-400')}>
                          {p.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Exact weight input */}
                <div className="flex items-center gap-3 pt-1">
                  <label htmlFor="approx-weight-input" className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                    Or exact weight:
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
                          if (val <= 5) updateField('petSizeCategoryId', 1)
                          else if (val <= 15) updateField('petSizeCategoryId', 2)
                          else if (val <= 30) updateField('petSizeCategoryId', 3)
                          else updateField('petSizeCategoryId', 4)
                        }
                      }}
                      placeholder="e.g. 12"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-mono">
                      kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Purebred Grid */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
                Recognized Breeds ({standardBreeds.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {standardBreeds.map((b) => {
                  const isSelected = formData.petBreedId === b.id
                  const { primary, secondary } = formatBreedNames(b.breed)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBreed(b)}
                      className={cn(
                        'group relative flex flex-col p-2.5 rounded-xl border-2 text-left transition-all duration-200 outline-none bg-white dark:bg-stone-900 shadow-sm',
                        isSelected
                          ? 'border-amber-500 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/20'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                      )}
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2 bg-stone-100 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60">
                        {b.imageUrl ? (
                          <Image
                            src={b.imageUrl}
                            alt={primary}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <HelpCircle className="w-6 h-6" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {primary}
                      </div>
                      {secondary && (
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                          {secondary}
                        </div>
                      )}
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
