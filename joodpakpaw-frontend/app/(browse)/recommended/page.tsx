'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { getRecommendedProperties } from '@/lib/api'
import { getLowestPrice } from '@/lib/utils'
import { Property } from '@/types'
import { PropertyList } from '@/app/_components/PropertyList'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'

const SKELETON_COUNT = 12

export default function RecommendedPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated } = useAuth()
  const { filters, buildSeeAllUrl } = useBrowseFilters()

  useEffect(() => {
    if (!isAuthenticated) {
      setProperties([])
      setIsLoading(false)
      return
    }
    getRecommendedProperties(1, 1000)
      .then((res) => setProperties(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (filters.petTypes.length > 0) {
        const names = (p.pets || []).map((pet) => pet.name.toLowerCase())
        if (!filters.petTypes.some((t) => names.includes(t))) return false
      }
      if (filters.minRating > 0 && p.avgRating < filters.minRating) return false
      if (filters.maxPrice !== '') {
        const price = getLowestPrice(p.roomCategories)
        if (price !== null && price > Number(filters.maxPrice)) return false
      }
      return true
    })
  }, [properties, filters])

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={buildSeeAllUrl('/')}
          className="text-neutral-gray hover:text-deep-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />
          <h1 className="text-xl lg:text-xl font-semibold text-deep-teal">
            Recommended for You
          </h1>
          {!isLoading && (
            <span className="text-sm lg:text-sm text-neutral-gray">
              ({filtered.length})
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton count={SKELETON_COUNT} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <PropertyList
            properties={filtered}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4"
            showPetPolicyChip={true}
            showHeartIcon={isAuthenticated}
          />
        </motion.div>
      )}
    </div>
  )
}

function BrowseSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
          <div className="mt-2 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
