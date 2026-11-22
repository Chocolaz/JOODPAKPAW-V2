'use client'

import Image from 'next/image'
import Link from 'next/link'
import { assetPath } from '@/lib/utils'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useProfileContext } from '../ProfileContext'
import { PetCard } from './_components/PetCard'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PetsPage() {
  const {
    petProfiles: { pets, loading, error },
  } = useProfileContext()
  const router = useRouter()

  return (
    <div className="w-full space-y-6">
      {/* Unified Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="font-bold text-deep-teal">Your pets</h1>
          <p className="text-sm text-neutral-gray mt-1 tabular-nums">
            {!loading && !error && pets.length > 0
              ? `${pets.length} ${pets.length === 1 ? 'pet' : 'pets'} registered for personalized stay matching`
              : 'Manage your pet profiles, medical notes, and care preferences'}
          </p>
        </div>
        <Link href="/profile/pets/add/1" className="shrink-0">
          <Button className="bg-accent-orange hover:opacity-95 text-white gap-2 px-5 rounded-xl cursor-pointer">
            <Plus className="w-4 h-4" />
            Add pet
          </Button>
        </Link>
      </header>

      <div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : error ? (
          <div className="animate-in fade-in duration-300">
            <ErrorState message={error} />
          </div>
        ) : pets.length > 0 ? (
          <div className="animate-in fade-in duration-300 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                onClick={() => router.push(`/profile/pets/${pet.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 rounded-2xl border border-dashed border-border bg-off-white py-14 px-6 text-center text-neutral-gray">
            <Image
              src={assetPath('/graphics/no-pet.png')}
              alt="No pets found"
              width={160}
              height={160}
              className="w-auto h-auto max-w-[160px] mx-auto"
            />
            <h2 className="mt-4 font-semibold text-deep-teal">
              No pet profiles yet
            </h2>
            <p className="mt-1 text-sm max-w-md mx-auto">
              Add your pet once so stays automatically match weight limits, energy needs, and care facilities.
            </p>
            <button
              type="button"
              onClick={() => router.push('/profile/pets/add/1')}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-orange text-white hover:opacity-95 text-sm font-semibold transition-opacity cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add your first pet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
