'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, Flag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HostReview } from '@/types/hostProfile'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

const CLAMP_THRESHOLD = 80 * 3

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('w-3.5 h-3.5', s <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200')} strokeWidth={0} />
      ))}
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

function ReviewImages({ images, onOpen }: { images: { filePath: string }[]; onOpen: (i: number) => void }) {
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

export function HostReviewCard({ review, onReport }: { review: HostReview; onReport?: (id: number) => void }) {
  const { guestProfile } = review
  const guestName = `${guestProfile.firstName} ${guestProfile.lastName}`
  const initial = guestProfile.firstName.charAt(0).toUpperCase()
  const [modalOpen, setModalOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const reviewImages = review.reviewImages ?? []
  const isLong = !!review.comment && review.comment.length > CLAMP_THRESHOLD
  const openLightbox = (i: number) => { setLightboxIndex(i); setLightboxOpen(true) }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
            {guestProfile.avatar ? (
              <Image src={guestProfile.avatar} alt={guestName} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-deep-teal text-sm font-semibold">
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
            <span className="text-xs text-neutral-gray">{formatDate(review.reviewedAt)}</span>
            {onReport && (
              <button
                onClick={() => onReport(review.id)}
                className="p-1 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition cursor-pointer"
                title="Report this review"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Comment — flex-1 pushes property tag to bottom */}
        <div className="flex-1">
          {review.comment ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed break-words line-clamp-3">
                {review.comment}
              </p>
              {isLong && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-1 text-xs font-medium text-accent-orange hover:underline underline-offset-2 transition-colors cursor-pointer"
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
          <ReviewImages images={reviewImages} onOpen={openLightbox} />
        )}

        {/* Property tag */}
        <div className="flex items-center gap-1.5 text-xs text-deep-teal/70 pt-1 border-t border-gray-50">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-orange shrink-0" />
          <span className="truncate">{review.propertyName}</span>
        </div>
      </div>

      {/* Full review modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
                  {guestProfile.avatar ? (
                    <Image src={guestProfile.avatar} alt={guestName} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-deep-teal text-sm font-semibold">
                      {initial}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-semibold text-gray-900 truncate">{guestName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={review.rating} />
                    <RatingBadge rating={review.rating} />
                    <span className="text-xs text-neutral-gray">{formatDate(review.reviewedAt)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{review.comment}</p>
            {reviewImages.length > 0 && (
              <ReviewImages images={reviewImages} onOpen={openLightbox} />
            )}
            <div className="flex items-center gap-1.5 text-xs text-deep-teal/70 pt-2 border-t border-gray-100">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange shrink-0" />
              <span className="truncate">{review.propertyName}</span>
            </div>
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
