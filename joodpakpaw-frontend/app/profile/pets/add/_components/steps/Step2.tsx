'use client'

import { useEffect, useState } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { getPetBreeds } from '@/lib/api'
import { PetBreed } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { Input } from '@/components/ui/input'
import { Search, Check, PawPrint } from 'lucide-react'
import Image from 'next/image'
import { getApiImageUrl } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

interface Step2Props {
  onNext: () => void
  onBack: () => void
}

function BreedImage({ src, alt }: { src: string; alt: string }) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50">
          <Spinner className="w-4 h-4 text-deep-teal/40" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(
          'object-contain transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  )
}

export function Step2({ onNext, onBack }: Step2Props) {
  const { formData, updateField } = useAddPet()
  const [breeds, setBreeds] = useState<PetBreed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!formData.petTypeId) {
      setError('Pet type not selected.')
      setLoading(false)
      return
    }

    const fetchBreeds = async () => {
      try {
        setLoading(true)
        const response = await getPetBreeds(formData.petTypeId!)
        setBreeds(response.petBreeds)
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch pet breeds.',
        )
      } finally {
        setLoading(false)
      }
    }
    fetchBreeds()
  }, [formData.petTypeId])

  const filteredBreeds = breeds.filter((breed) =>
    breed.breed.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex flex-col w-full animate-pulse">
        <div className="flex flex-col items-center mt-5 mb-4">
          <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-36" />
        </div>
        <div className="pb-3 pt-1">
          <div className="h-10 bg-gray-100 rounded-full w-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[140px] bg-gray-50 rounded-xl flex flex-col items-center p-3">
               <div className="w-full aspect-square max-w-[80px] rounded-lg bg-gray-100 mb-3" />
               <div className="h-4 bg-gray-100 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <div className="flex flex-col w-full">
      {/* Title — scrolls away */}
      <div className="w-full text-center mt-5 mb-4">
        <h3 className="text-deep-teal text-2xl font-semibold">
          What breed is your pet?
        </h3>
        <p className="text-neutral-gray text-sm">
          Select the breed of your pet.
        </p>
      </div>

      {/* Search bar — sticks to top of scroll container */}
      <div className="sticky top-0 z-10 bg-white pb-3 pt-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for a breed..."
            className="pl-10 rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Breed grid — flows naturally, outer container scrolls */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        {filteredBreeds.length === 0 ? (
          <div className="col-span-2 lg:col-span-3 flex flex-col items-center py-14 text-neutral-gray">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium text-sm">No breeds found</p>
            <p className="text-xs opacity-60 mt-1">Try a different search term</p>
          </div>
        ) : (
          filteredBreeds.map((breed) => {
            const isSelected = formData.petBreedId === breed.id
            const breedImageUrl = getApiImageUrl(breed.imageUrl)
            
            return (
              <button
                key={breed.id}
                onClick={() => {
                  updateField('petBreedId', breed.id)
                  updateField('petBreedName', breed.breed)
                }}
                className={cn(
                  'relative flex flex-col items-center p-3 border rounded-xl shadow-sm cursor-pointer transition-all duration-200 bg-white min-h-[140px]',
                  isSelected
                    ? 'border-positive-green bg-teal-50/20 ring-1 ring-positive-green/20'
                    : 'border-gray-100 hover:border-deep-teal/30 hover:shadow-md',
                )}
              >
                {/* Breed Image Container */}
                <div className="w-full aspect-square max-w-[80px] rounded-lg overflow-hidden mb-3 bg-gray-50 flex items-center justify-center relative">
                  {breedImageUrl ? (
                    <BreedImage src={breedImageUrl} alt={breed.breed} />
                  ) : (
                    <PawPrint className="w-8 h-8 text-neutral-gray/20" />
                  )}
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-positive-green flex items-center justify-center z-10">
                    <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                )}
                
                <span
                  className={cn(
                    'text-center font-semibold text-xs lg:text-sm line-clamp-2 px-1',
                    isSelected ? 'text-positive-green' : 'text-neutral-dark',
                  )}
                >
                  {breed.breed}
                </span>
              </button>
            )
          })
        )}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!formData.petBreedId}
      />
    </div>
  )
}
