'use client'

import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { HostReview } from '@/types/hostProfile'
import { HostReviewCard } from './HostReviewCard'
import { Skeleton } from '@/components/ui/skeleton'

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

interface HostReviewsSectionProps {
  reviews: HostReview[]
  page: number
  totalPages: number
  totalRows: number
  avgRating: number
  reviewCount: number
  loading: boolean
  onPageChange: (page: number) => void
  onSeeAll?: () => void
  onReport?: (id: number) => void
}

export function HostReviewsSection({
  reviews,
  page,
  totalPages,
  totalRows,
  avgRating,
  reviewCount,
  loading,
  onPageChange,
  onSeeAll,
  onReport,
}: HostReviewsSectionProps) {
  const isEmpty = !loading && reviews.length === 0

  return (
    <section className="px-5 lg:px-12 mt-2 border-t border-gray-100 pt-7 lg:pt-9 pb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-accent-orange shrink-0" />
          <h2 className="text-lg font-bold text-deep-teal font-baloo2">
            Reviews
            {reviewCount > 0 && (
              <span className="ml-2 text-sm font-medium text-neutral-gray">({totalRows})</span>
            )}
          </h2>
        </div>
        {totalRows > 6 && onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-sm font-medium text-accent-orange hover:underline underline-offset-2 transition-colors"
          >
            See all
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-5 h-5 fill-gray-200 text-gray-200" strokeWidth={0} />
            ))}
          </div>
          <p className="font-medium text-gray-700 mt-1">No reviews yet</p>
          <p className="text-sm text-neutral-gray">Be the first to stay and leave a review.</p>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10 lg:items-start">
          {/* Left: summary sticky */}
          <div className="lg:sticky lg:top-6 mb-6 lg:mb-0 min-w-0">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-2 text-center">
              <span className="text-5xl font-bold text-deep-teal font-baloo2 leading-none">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn('w-4 h-4', s <= Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200')}
                    strokeWidth={0}
                  />
                ))}
              </div>
              {avgRating > 0 && (
                <span className="text-xs font-semibold text-deep-teal">
                  {RATING_LABELS[Math.round(avgRating)] || ''}
                </span>
              )}
              <span className="text-[11px] text-neutral-gray">
                {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          {/* Right: review cards + pagination */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key={`page-${page}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  {reviews.map((review) => (
                    <HostReviewCard key={review.id} review={review} onReport={onReport} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={cn(
                      'w-8 h-8 rounded-full text-sm font-medium transition-colors',
                      p === page
                        ? 'bg-deep-teal text-white'
                        : 'border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
