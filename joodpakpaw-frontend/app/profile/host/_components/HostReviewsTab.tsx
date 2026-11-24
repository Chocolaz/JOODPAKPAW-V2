'use client'

import { useEffect, useMemo, useState } from 'react'
import { getHostReviews } from '@/lib/api'
import { HostReview } from '@/types/hostProfile'
import { useAuth } from '@/app/_components/AuthContext'
import { HostReviewCard } from '@/app/hosts/[hostId]/_components/HostReviewCard'
import { ReportReviewDrawer } from '@/app/_components/property-detail/ReportReviewDrawer'
import { Star, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_LIMIT = 9
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

type ReviewFilter = 'all' | 'needs_reply' | 'replied'

interface HostReviewsTabProps {
  initialFilter?: ReviewFilter
  onReviewsUpdated?: () => Promise<void> | void
}

export function HostReviewsTab({
  initialFilter = 'all',
  onReviewsUpdated,
}: HostReviewsTabProps) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<HostReview[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [avgRating, setAvgRating] = useState(0)
  const [reportReviewId, setReportReviewId] = useState<number | null>(null)
  const [filter, setFilter] = useState<ReviewFilter>(initialFilter)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) return
    getHostReviews(String(user.id), 1, PAGE_LIMIT)
      .then((res) => {
        if (cancelled) return
        setReviews(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
        if (res.data.length > 0) {
          const sum = res.data.reduce((a, r) => a + r.rating, 0)
          setAvgRating(parseFloat((sum / res.data.length).toFixed(1)))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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

  const handleReplyPosted = (
    bookingId: number,
    hostReply: string,
    hostRepliedAt: string
  ) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === bookingId ? { ...r, hostReply, hostRepliedAt } : r
      )
    )
    void onReviewsUpdated?.()
  }

  const unrepliedCount = useMemo(
    () => reviews.filter((r) => !r.hostReply).length,
    [reviews]
  )
  const repliedCount = reviews.length - unrepliedCount

  const filteredReviews = useMemo(() => {
    if (filter === 'needs_reply') return reviews.filter((r) => !r.hostReply)
    if (filter === 'replied') return reviews.filter((r) => !!r.hostReply)
    return reviews
  }, [reviews, filter])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-deep-teal">Guest Reviews</h1>
          <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
            {totalRows} {totalRows === 1 ? 'review' : 'reviews'}
            {avgRating > 0 && ` averaging ${avgRating} out of 5`}
          </p>
        </div>

        {avgRating > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-off-white border border-border rounded-xl">
            <Star
              className="w-4 h-4 fill-amber-400 text-amber-400"
              strokeWidth={0}
            />
            <span className="text-base font-bold text-deep-teal tabular-nums">
              {avgRating}
            </span>
            <span className="text-xs text-neutral-gray">
              {RATING_LABELS[Math.round(avgRating)]}
            </span>
          </div>
        )}
      </div>

      {/* Filter Pills */}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
              filter === 'all'
                ? 'bg-deep-teal text-white border-deep-teal'
                : 'bg-white text-neutral-gray border-border hover:border-deep-teal'
            )}
          >
            {filter === 'all' && <Check className="w-3.5 h-3.5" />}
            All ({reviews.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('needs_reply')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
              filter === 'needs_reply'
                ? 'bg-accent-orange text-white border-accent-orange'
                : 'bg-white text-accent-orange border-accent-orange/40 hover:border-accent-orange'
            )}
          >
            {filter === 'needs_reply' && <Check className="w-3.5 h-3.5" />}
            Needs reply ({unrepliedCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('replied')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
              filter === 'replied'
                ? 'bg-deep-teal text-white border-deep-teal'
                : 'bg-white text-neutral-gray border-border hover:border-deep-teal'
            )}
          >
            {filter === 'replied' && <Check className="w-3.5 h-3.5" />}
            Replied ({repliedCount})
          </button>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 w-full rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6 rounded-2xl border border-border bg-off-white/40">
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className="w-6 h-6 fill-gray-200 text-gray-200"
                strokeWidth={0}
              />
            ))}
          </div>
          <h4 className="text-foreground">No reviews yet</h4>
          <p className="text-xs text-neutral-gray mt-1 max-w-[260px]">
            Guest feedback will appear here once completed stays leave reviews.
          </p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-2xl border border-border bg-off-white/40 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {filter === 'needs_reply'
              ? 'All reviews on this page have been replied to!'
              : 'No replied reviews on this page yet.'}
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="text-xs font-semibold text-deep-teal underline underline-offset-2 cursor-pointer"
          >
            Show all reviews
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {filteredReviews.map((review) => (
              <HostReviewCard
                key={review.id}
                review={review}
                onReport={setReportReviewId}
                allowReply={true}
                onReplyPosted={handleReplyPosted}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={cn(
                    'w-8 h-8 rounded-full text-xs font-semibold transition-colors cursor-pointer tabular-nums',
                    p === page
                      ? 'bg-deep-teal text-white'
                      : 'border border-border text-neutral-gray hover:border-deep-teal hover:text-deep-teal'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-neutral-gray hover:border-deep-teal hover:text-deep-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {reportReviewId !== null && (
        <ReportReviewDrawer
          bookingId={reportReviewId}
          isOpen={reportReviewId !== null}
          onOpenChange={(open) => {
            if (!open) setReportReviewId(null)
          }}
        />
      )}
    </div>
  )
}
