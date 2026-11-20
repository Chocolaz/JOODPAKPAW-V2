'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { getLowestPrice } from '@/lib/utils'
import { PropertyList } from '@/app/_components/PropertyList'
import { useAuth } from '@/app/_components/AuthContext'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { useRecommendedProperties } from '@/app/_hooks/useRecommendedProperties'
import { Badge } from '@/components/ui/badge'

const SKELETON_COUNT = 12

export default function RecommendedPage() {
  const { isAuthenticated } = useAuth()
  const { filters, buildSeeAllUrl } = useBrowseFilters()
  const { properties, meta, isLoading } = useRecommendedProperties(1, 50)

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

  const pageTitle = isAuthenticated
    ? 'Recommended for You'
    : 'Popular Picks to Get Started'

  const strategySubtitle = isAuthenticated
    ? 'Pet-aware hybrid matches based on your pets, preferences, and stay quality'
    : 'Top-rated pet-friendly stays across Thailand'

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <Link
            href={buildSeeAllUrl('/')}
            className="mt-1 text-neutral-gray hover:text-deep-teal transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-5 h-5 text-accent-orange" />
              <h1 className="text-xl lg:text-2xl font-semibold text-deep-teal">
                {pageTitle}
              </h1>
              {!isLoading && (
                <span className="text-sm text-neutral-gray">
                  ({filtered.length})
                </span>
              )}
              {meta && (
                <Badge
                  variant="outline"
                  className={
                    meta.source === 'ml_service'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]'
                      : 'border-amber-200 bg-amber-50 text-amber-700 text-[11px]'
                  }
                >
                  {meta.source === 'ml_service' ? 'Live ML' : 'Fallback Engine'}
                </Badge>
              )}
            </div>
            <p className="text-xs lg:text-sm text-neutral-gray mt-1">
              {strategySubtitle}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton count={SKELETON_COUNT} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] gap-3 text-center">
          <Sparkles className="w-10 h-10 text-gray-300" />
          <p className="font-medium text-gray-700">No matching recommendations</p>
          <p className="text-sm text-neutral-gray">
            Try adjusting your filters or browse all pet-friendly stays.
          </p>
        </div>
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
            showMatchReason={true}
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
