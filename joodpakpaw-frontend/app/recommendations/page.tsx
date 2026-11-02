'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Heart } from 'lucide-react'
import { getRecommendedProperties } from '@/lib/api'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { useAuth } from '@/app/_components/AuthContext'
import type { Property } from '@/types'

const PAGE_SIZE = 20

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
      <div className="mt-2 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}

export default function RecommendationsPage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  const fetchPage = useCallback(async (p: number) => {
    if (p === 1) setIsLoading(true)
    else setIsFetchingMore(true)
    try {
      const res = await getRecommendedProperties(p, PAGE_SIZE)
      setTotalRows(res.totalRows)
      setProperties((prev) => (p === 1 ? res.data : [...prev, ...res.data]))
    } catch {
      // keep existing
    } finally {
      setIsLoading(false)
      setIsFetchingMore(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/')
      return
    }
    fetchPage(1)
  }, [isAuthenticated, authLoading, fetchPage, router])

  const hasMore = properties.length < totalRows

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPage(next)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 lg:px-12 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />
          <h1 className="text-lg lg:text-2xl font-semibold text-deep-teal">
            Recommended for You
          </h1>
          {!isLoading && (
            <span className="text-sm lg:text-base text-neutral-gray">
              ({totalRows})
            </span>
          )}
        </div>
      </div>

      <div className="px-5 lg:px-12 py-6 lg:py-10 pb-28 lg:pb-16">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Heart className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700">
              No recommendations yet
            </p>
            <p className="text-sm text-neutral-gray">
              Browse more properties to get personalised picks.
            </p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6"
            >
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  showPetPolicyChip
                  showHeartIcon
                />
              ))}
            </motion.div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="px-8 py-3 rounded-full border border-deep-teal text-deep-teal font-medium text-sm hover:bg-deep-teal hover:text-white transition-colors disabled:opacity-50"
                >
                  {isFetchingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
