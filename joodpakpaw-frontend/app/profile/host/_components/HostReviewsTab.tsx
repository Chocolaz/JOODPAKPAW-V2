'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getHostReviews } from '@/lib/api'
import { HostReview } from '@/types/hostProfile'
import { useAuth } from '@/app/_components/AuthContext'
import { HostReviewCard } from '@/app/hosts/[hostId]/_components/HostReviewCard'
import { ReportReviewDrawer } from '@/app/_components/property-detail/ReportReviewDrawer'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_LIMIT = 9
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

export function HostReviewsTab() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<HostReview[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [avgRating, setAvgRating] = useState(0)
  const [reportReviewId, setReportReviewId] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    getHostReviews(String(user.id), 1, PAGE_LIMIT)
      .then((res) => {
        setReviews(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
        if (res.data.length > 0) {
          const sum = res.data.reduce((a, r) => a + r.rating, 0)
          setAvgRating(parseFloat((sum / res.data.length).toFixed(1)))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  const handlePageChange = (newPage: number) => {
    if (!user?.id || newPage === page) return
    setPage(newPage)
    setLoading(true)
    getHostReviews(String(user.id), newPage, PAGE_LIMIT)
      .then((res) => {
        setReviews(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 lg:px-12 pt-4 lg:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-deep-teal">Reviews</h2>
            <p className="text-sm text-neutral-gray mt-0.5">
              {totalRows} {totalRows === 1 ? 'review' : 'reviews'}
              {avgRating > 0 && ` · ${avgRating} avg rating`}
            </p>
          </div>

          {/* Rating summary pill */}
          {avgRating > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-100 rounded-xl">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" strokeWidth={0} />
              <span className="text-lg font-bold text-gray-900">{avgRating}</span>
              <span className="text-xs text-neutral-gray">
                {RATING_LABELS[Math.round(avgRating)]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-modern px-4 md:px-6 lg:px-12 pb-28 lg:pb-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4"
            >
              {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </motion.div>
          ) : reviews.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center py-20 text-center px-6"
            >
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-6 h-6 fill-gray-200 text-gray-200" strokeWidth={0} />
                ))}
              </div>
              <h4 className="text-base font-semibold text-gray-600">No reviews yet</h4>
              <p className="text-sm text-gray-400 mt-1 max-w-[240px]">
                Reviews from guests will appear here once you receive bookings.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {reviews.map((review) => (
                  <HostReviewCard key={review.id} review={review} onReport={setReportReviewId} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
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
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {reportReviewId !== null && (
        <ReportReviewDrawer
          bookingId={reportReviewId}
          isOpen={reportReviewId !== null}
          onOpenChange={(open) => { if (!open) setReportReviewId(null) }}
        />
      )}
    </div>
  )
}
