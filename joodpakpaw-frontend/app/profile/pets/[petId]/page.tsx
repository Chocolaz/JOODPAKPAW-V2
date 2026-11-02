'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getPetProfileById } from '@/lib/api'
import { PetProfile } from '@/types'
import { toast } from 'sonner'
import PetDetailDisplay from './_components/PetDetailDisplay'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

function PetDetailSkeleton() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero image skeleton */}
      <div className="relative w-full aspect-[4/3] bg-gray-200 animate-pulse">
        <button
          onClick={() => router.push('/profile/pets')}
          className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-gray" />
        </button>
        {/* Name overlay placeholder */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 space-y-2">
          <div className="h-7 bg-gray-300/50 rounded w-1/3" />
          <div className="h-4 bg-gray-300/40 rounded w-1/4" />
        </div>
      </div>

      {/* Stat pills skeleton */}
      <div className="px-5 -mt-4 relative z-10">
        <div className="flex gap-2 pb-1">
          {[72, 56, 64, 60].map((w, i) => (
            <div
              key={i}
              className="animate-pulse h-7 rounded-full bg-gray-200"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </div>

      {/* Detail cards skeleton */}
      <div className="px-5 mt-4 space-y-3">
        {/* Birthday card */}
        <div className="animate-pulse bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-gray-200 rounded w-14" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          </div>
        </div>

        {/* Energy card */}
        <div className="animate-pulse bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-2 h-5 rounded-full bg-gray-200" />
              ))}
            </div>
          </div>
        </div>

        {/* Contact card */}
        <div className="animate-pulse bg-gray-50 rounded-2xl p-4">
          <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 bg-gray-200 rounded w-28" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
            <div className="h-9 w-16 rounded-xl bg-gray-200" />
          </div>
        </div>

        {/* Notes card */}
        <div className="animate-pulse bg-gray-50 rounded-2xl p-4">
          <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PetDetailPage() {
  const { petId } = useParams()
  const [petProfile, setPetProfile] = useState<PetProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPetProfile = useCallback(async () => {
    if (!petId) return;
    try {
      setIsLoading(true)
      const data = await getPetProfileById(petId as string)
      setPetProfile(data)
    } catch (err) {
      console.error('Failed to fetch pet profile:', err)
      setError('Failed to load pet profile.')
      toast.error('Failed to load pet profile.')
    } finally {
      setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    fetchPetProfile()
  }, [fetchPetProfile])

  const handlePetUpdate = () => {
    fetchPetProfile()
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <PetDetailSkeleton />
        </motion.div>
      ) : error ? (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center text-red-500 mt-10"
        >
          <p>{error}</p>
        </motion.div>
      ) : !petProfile ? (
        <motion.div
          key="not-found"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center text-gray-500 mt-10"
        >
          <p>No pet profile found.</p>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <PetDetailDisplay pet={petProfile} onPetUpdate={handlePetUpdate} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
