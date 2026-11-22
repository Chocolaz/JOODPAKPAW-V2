'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, PawPrint } from 'lucide-react'
import { assetPath } from '@/lib/utils'
import { PetProfile } from '@/types'

interface BrowseHeroProps {
  /** Optional legacy slot (preserved for backward compatibility on see-all pages) */
  searchBar?: React.ReactNode
  layout?: 'row' | 'column'
  isAuthenticated?: boolean
  userPets?: PetProfile[]
  onSelectPetChip?: (pet: PetProfile) => void
  selectedPetProfileIds?: number[]
}

export function BrowseHero({
  isAuthenticated = false,
  userPets = [],
  onSelectPetChip,
  selectedPetProfileIds = [],
}: BrowseHeroProps) {
  const [imgSrc, setImgSrc] = useState(
    assetPath('/graphics/hero-clay-home.webp')
  )

  return (
    <section className="rounded-3xl bg-off-white border border-deep-teal/10 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 md:gap-6 px-5 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
        {/* Left Copy + Personalized Pet Chips */}
        <div className="md:col-span-7 space-y-2.5 min-w-0">
          <h1 className="text-deep-teal text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight break-words min-w-0">
            Find trusted stays for your pets
          </h1>
          <p className="text-neutral-gray text-sm sm:text-base max-w-lg leading-relaxed">
            Verified pet-safe boarding homes across Thailand tailored to your
            companions.
          </p>

          {isAuthenticated && (
            <div className="pt-1.5 flex items-center gap-2 flex-wrap">
              {userPets.length > 0 ? (
                <>
                  {userPets.slice(0, 4).map((pet) => {
                    const active = selectedPetProfileIds.includes(pet.id)
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => onSelectPetChip?.(pet)}
                        className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-deep-teal text-white border-deep-teal'
                            : 'bg-white text-deep-teal border-deep-teal/20 hover:border-deep-teal'
                        }`}
                      >
                        <PawPrint className="w-3.5 h-3.5 shrink-0" />
                        <span>{pet.name}</span>
                        {pet.petTypeName && (
                          <span
                            className={
                              active ? 'text-white/80' : 'text-neutral-gray'
                            }
                          >
                            ({pet.petTypeName})
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <Link
                    href="/profile/pets"
                    className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold text-accent-orange hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add pet
                  </Link>
                </>
              ) : (
                <Link
                  href="/profile/pets"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full bg-deep-teal text-white text-xs sm:text-sm font-semibold hover:bg-deep-teal/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add your pet
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right Bespoke 3D Pastel Clay Illustration */}
        <div className="md:col-span-5 flex justify-center md:justify-end min-w-0">
          <div className="relative w-full max-w-[340px] md:max-w-[380px] aspect-[16/10] rounded-2xl overflow-hidden">
            <Image
              src={imgSrc}
              alt="Pastel clay miniature pet homestay with a dog, cat, and rabbit"
              fill
              priority
              sizes="(max-width: 768px) 340px, 380px"
              className="object-contain"
              onError={() => setImgSrc(assetPath('/graphics/home.svg'))}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
