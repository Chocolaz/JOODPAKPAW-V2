'use client'

import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Property } from '@/types'
import { PropertyList } from '@/app/_components/PropertyList'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'

const PAGE_SIZE = 21

interface BrowsePageLayoutProps {
  title: string
  icon: React.ReactNode
  isLoading: boolean
  filtered: Property[]
  visibleCount: number
  setVisibleCount: (fn: (c: number) => number) => void
  showHeartIcon?: boolean
  showPetPolicyChip?: boolean
  emptyState?: React.ReactNode
}

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
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

export function BrowsePageLayout({
  title,
  icon,
  isLoading,
  filtered,
  visibleCount,
  setVisibleCount,
  showHeartIcon = false,
  showPetPolicyChip = true,
  emptyState,
}: BrowsePageLayoutProps) {
  const { buildSeeAllUrl } = useBrowseFilters()

  return (
    <div className="px-5 lg:px-12 pb-28 lg:pb-16 mt-6 lg:mt-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={buildSeeAllUrl('/')} className="text-neutral-gray hover:text-deep-teal transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-xl lg:text-xl font-semibold text-deep-teal">{title}</h1>
          {!isLoading && <span className="text-sm text-neutral-gray">({filtered.length})</span>}
        </div>
      </div>

      {isLoading ? (
        <BrowseSkeleton />
      ) : filtered.length === 0 && emptyState ? (
        emptyState
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <PropertyList
            properties={filtered.slice(0, visibleCount)}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4"
            showPetPolicyChip={showPetPolicyChip}
            showHeartIcon={showHeartIcon}
          />
          {visibleCount < filtered.length && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-deep-teal/40 hover:text-deep-teal transition"
              >
                <Loader2 className="w-4 h-4" />
                Load more
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export { PAGE_SIZE }
