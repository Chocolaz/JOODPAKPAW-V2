'use client'

import Image from 'next/image'
import Link from 'next/link'
import { assetPath } from '@/lib/utils'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useProfileContext } from '../ProfileContext'
import { PetCard } from './_components/PetCard'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useAuth } from '@/app/_components/AuthContext'
import { Button } from '@/components/ui/button'

export default function PetsPage() {
  const {
    petProfiles: { pets, loading, error },
  } = useProfileContext()
  const { user } = useAuth()
  const router = useRouter()

  return (
    <div className="flex flex-col px-5 lg:px-12 max-w-[500px] lg:max-w-[1440px] mx-auto">
      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between py-8 border-b border-gray-100 mb-6">
        <div>
          <p className="text-accent-orange font-semibold text-sm uppercase tracking-widest mb-1">
            Hello, {user?.firstName}
          </p>
          <h1 className="text-3xl xl:text-4xl font-bold text-deep-teal">
            Your Pets
          </h1>
          {!loading && !error && pets.length > 0 && (
            <p className="text-neutral-gray mt-1">
              {pets.length} {pets.length === 1 ? 'pet' : 'pets'} registered
            </p>
          )}
        </div>
        <Link href="/profile/pets/add/1">
          <Button className="interact-button bg-accent-orange! gap-2 px-6">
            <Plus className="w-4 h-4" />
            Add Pet
          </Button>
        </Link>
      </div>

      <div className="pb-24 lg:pb-12">
        {loading ? null : error ? (
          <div className="animate-in fade-in duration-300">
            <ErrorState message={error} />
          </div>
        ) : pets.length > 0 ? (
          <div className="animate-in fade-in duration-300 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5 mt-4 lg:mt-0">
            {/* Add Pet card — mobile only; desktop uses header button */}
            <button
              onClick={() => router.push('/profile/pets/add/1')}
              className="lg:hidden block w-full cursor-pointer text-left group"
            >
              <div className="aspect-square w-full rounded-xl border-2 border-dashed border-gray-300 group-hover:border-deep-teal flex flex-col items-center justify-center transition-colors bg-gray-50 group-hover:bg-teal-50/50">
                <div className="w-12 h-12 rounded-full bg-deep-teal/10 group-hover:bg-deep-teal/20 flex items-center justify-center transition-colors mb-2">
                  <Plus className="w-6 h-6 text-deep-teal" />
                </div>
                <span className="text-sm font-medium text-deep-teal">
                  Add Pet
                </span>
              </div>
            </button>

            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                onClick={() => router.push(`/profile/pets/${pet.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 text-center mt-20 text-neutral-gray">
            <Image
              src={assetPath('/graphics/no-pet.png')}
              alt="No pets found"
              width={200}
              height={200}
              className="w-auto h-auto max-w-sm mx-auto"
            />
            <h2 className="mt-4 text-lg font-semibold text-deep-teal">
              Uh Oh!
            </h2>
            <p className="mt-1">
              Looks like you have no profiles set up at this moment, add your
              pet now
            </p>
            <button
              onClick={() => router.push('/profile/pets/add/1')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-orange text-white hover:bg-accent-orange/80 text-base font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Pet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
