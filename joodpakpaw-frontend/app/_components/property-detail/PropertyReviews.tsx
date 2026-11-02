'use client'

import { useState, useMemo } from 'react'
import { Star, Flag, X } from 'lucide-react'
import { PropertyReview } from '@/types/property'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

interface PropertyReviewsProps {
  avgRating: number
  reviewCount: number
  reviews?: PropertyReview[]
  onReportReview?: (reviewId: number) => void
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
const MAX_VISIBLE_REVIEWS = 6

function StarRow({
  rating,
  size = 'sm',
}: {
  rating: number
  size?: 'sm' | 'md'
}) {
  const starSize = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(starSize, star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200')}
          strokeWidth={0}
        />
      ))}
    </div>
  )
}

function RatingBreakdown({ reviews }: { reviews: PropertyReview[] }) {
  const total = reviews.length
  const counts = [0, 0, 0, 0, 0]
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++
  })

  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1]
        const percentage = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right text-gray-500 font-medium">{star}</span>
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" strokeWidth={0} />
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
            </div>
            <span className="w-4 text-right text-gray-400">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const style =
    rating >= 4
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : rating === 3
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-red-50 text-red-600 ring-red-200'
  return (
    <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1', style)}>
      <Star className="w-3 h-3 fill-current" strokeWidth={0} />
      {rating}.0
    </span>
  )
}

function ReviewImages({
  images,
  onOpen,
}: {
  images: { filePath: string }[]
  onOpen: (i: number) => void
}) {
  if (!images || images.length === 0) return null
  const visible = images.slice(0, 4)
  const overflow = images.length - 4
  return (
    <div className="flex gap-1.5 flex-wrap">
      {visible.map((img, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 cursor-zoom-in shrink-0 hover:brightness-90 transition-all"
        >
          <Image src={img.filePath} alt={`Review photo ${i + 1}`} fill unoptimized className="object-cover" />
          {i === 3 && overflow > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
              +{overflow}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

const CLAMP_THRESHOLD = 80 * 3

function ReviewCard({
  review,
  onReport,
}: {
  review: PropertyReview
  onReport?: (reviewId: number) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const guestName = `${review.firstName} ${review.lastName}`
  const initial = review.firstName.charAt(0).toUpperCase()
  const isLong = !!review.comment && review.comment.length > CLAMP_THRESHOLD
  const reviewImages = review.reviewImages ?? []

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col gap-3">
        {/* Header: avatar + name/stars + rating badge + flag */}
        <div className="flex items-start gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
            {review.avatar ? (
              <Image src={review.avatar} alt={guestName} fill unoptimized className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-deep-teal font-semibold text-sm">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <span className="text-sm font-semibold text-gray-900 truncate block leading-tight">{guestName}</span>
            <StarRow rating={review.rating} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <RatingBadge rating={review.rating} />
            {onReport && (
              <button
                onClick={() => onReport(review.bookingId)}
                className="p-1 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition cursor-pointer"
                title="Report this review"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Comment — flex-1 pushes images to bottom */}
        <div className="flex-1">
          {review.comment ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {review.comment}
              </p>
              {isLong && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-1 text-xs font-medium text-accent-orange hover:underline underline-offset-2 cursor-pointer"
                >
                  See more
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-300 italic">No comment left.</p>
          )}
        </div>

        {/* Images */}
        {reviewImages.length > 0 && (
          <ReviewImages images={reviewImages} onOpen={(i) => { setLightboxIndex(i); setLightboxOpen(true) }} />
        )}
      </div>

      {/* Full review modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
                  {review.avatar ? (
                    <Image src={review.avatar} alt={guestName} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-deep-teal font-semibold text-sm">
                      {initial}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-semibold text-gray-900 truncate">{guestName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={review.rating} />
                    <RatingBadge rating={review.rating} />
                  </div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {review.comment}
            </p>
            {reviewImages.length > 0 && (
              <ReviewImages images={reviewImages} onOpen={(i) => { setLightboxIndex(i); setLightboxOpen(true) }} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={reviewImages.map((img) => ({ src: img.filePath }))}
        index={lightboxIndex}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        carousel={{ finite: reviewImages.length <= 1, imageFit: 'contain' }}
        controller={{ closeOnBackdropClick: true }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.85)' } as never }}
      />
    </>
  )
}

export function PropertyReviews({
  avgRating,
  reviewCount,
  reviews = [],
  onReportReview,
}: PropertyReviewsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const topReviews = useMemo(
    () => [...reviews].sort((a, b) => b.rating - a.rating).slice(0, MAX_VISIBLE_REVIEWS),
    [reviews]
  )

  const hasMore = reviewCount > MAX_VISIBLE_REVIEWS

  return (
    <div className="mt-10 border-t pt-8">
      <h3 className="text-lg lg:text-xl font-semibold text-deep-teal mb-6">Reviews</h3>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-5 h-5 fill-gray-200 text-gray-200" strokeWidth={0} />
            ))}
          </div>
          <p className="font-medium text-gray-700">No reviews yet</p>
          <p className="text-sm text-neutral-gray">Be the first to stay and leave a review.</p>
        </div>
      ) : (
        <div className="xl:grid xl:grid-cols-[260px_1fr] xl:gap-10 xl:items-start">
          {/* Left: summary — sticky on desktop */}
          <div className="xl:sticky xl:top-6 mb-6 xl:mb-0 min-w-0">
            <div className="bg-off-white/80 rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-row xl:flex-col gap-6 xl:gap-4">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="text-4xl font-bold text-gray-900 leading-none">
                  {avgRating > 0 ? avgRating.toFixed(1) : '-'}
                </span>
                <StarRow rating={Math.round(avgRating)} size="md" />
                {avgRating > 0 && (
                  <span className="text-xs font-semibold text-deep-teal mt-0.5">
                    {RATING_LABELS[Math.round(avgRating)] || ''}
                  </span>
                )}
                <span className="text-xs text-neutral-gray">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </div>
              <div className="flex-1 lg:flex-none">
                <RatingBreakdown reviews={reviews} />
              </div>
            </div>
          </div>

          {/* Right: review cards — single column */}
          <div className="space-y-3 min-w-0">
            {topReviews.map((review, index) => (
              <ReviewCard key={index} review={review} onReport={onReportReview} />
            ))}

            {hasMore && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full text-center text-sm font-medium text-deep-teal underline underline-offset-2 hover:text-deep-teal/80 transition-colors py-2"
              >
                Show all {reviewCount} reviews
              </button>
            )}
          </div>
        </div>
      )}

      {/* All reviews modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-deep-teal">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" strokeWidth={0} />
              {avgRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-1 -mr-1">
            {[...reviews]
              .sort((a, b) => b.rating - a.rating)
              .map((review, index) => (
                <ReviewCard key={index} review={review} onReport={onReportReview} />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
