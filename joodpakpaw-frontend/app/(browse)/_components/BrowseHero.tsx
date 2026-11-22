'use client'

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
  return (
    <section className="rounded-3xl bg-off-white border border-deep-teal/10 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 md:gap-6 px-5 py-4 sm:px-7 sm:py-5 lg:px-10 lg:py-5">
        {/* Left Copy + Personalized Pet Chips */}
        <div className="md:col-span-6 space-y-2 min-w-0">
          <h1 className="text-deep-teal font-bold leading-snug break-words min-w-0">
            Find trusted stays for your pets
          </h1>
          <p className="text-neutral-gray max-w-md leading-relaxed">
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
                        className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal ${
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
                    className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold text-accent-orange hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add pet
                  </Link>
                </>
              ) : (
                <Link
                  href="/profile/pets"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full bg-deep-teal text-white text-xs sm:text-sm font-semibold hover:bg-deep-teal/90 active:scale-[0.98] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
                >
                  <Plus className="w-4 h-4" />
                  Add your pet
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right Illustration (Compact height, wider on desktop) */}
        <div className="md:col-span-6 flex justify-center md:justify-end min-w-0">
          <div className="relative w-full max-w-[360px] md:max-w-[460px] lg:max-w-[580px] h-[120px] sm:h-[136px] md:h-[144px] lg:h-[156px]">
            <Image
              src={assetPath('/graphics/home.svg')}
              alt="Pet-friendly homestay illustration with welcoming companions"
              fill
              priority
              sizes="(max-width: 768px) 360px, (max-width: 1024px) 460px, 580px"
              className="object-contain object-center md:object-right"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
