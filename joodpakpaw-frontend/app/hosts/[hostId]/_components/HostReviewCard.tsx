'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, Flag, X, Home, Send, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HostReview } from '@/types/hostProfile'
import { replyToBookingReview } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { HostReplyBlock } from '@/app/_components/HostReplyBlock'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

const CLAMP_THRESHOLD = 80 * 3

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr.replace(' ', 'T')).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-3.5 h-3.5',
            s <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          )}
          strokeWidth={0}
        />
      ))}
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const style =
    rating >= 4
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : rating === 3
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-red-50 text-red-700 ring-red-200'
  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 tabular-nums',
        style
      )}
    >
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
          className="relative w-16 h-16 rounded-xl overflow-hidden border border-border cursor-zoom-in shrink-0 hover:opacity-90 transition-opacity"
        >
          <Image
            src={img.filePath}
            alt={`Review photo ${i + 1}`}
            fill
            unoptimized
            className="object-cover"
          />
          {i === 3 && overflow > 0 && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xs font-semibold tabular-nums">
              +{overflow}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

interface HostReviewCardProps {
  review: HostReview
  onReport?: (id: number) => void
  allowReply?: boolean
  onReplyPosted?: (
    bookingId: number,
    hostReply: string,
    hostRepliedAt: string
  ) => void
}

export function HostReviewCard({
  review,
  onReport,
  allowReply = false,
  onReplyPosted,
}: HostReviewCardProps) {
  const { guestProfile } = review
  const guestName = `${guestProfile.firstName} ${guestProfile.lastName}`
  const initial = guestProfile.firstName.charAt(0).toUpperCase()
  const [modalOpen, setModalOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  const reviewImages = review.reviewImages ?? []
  const isLong = !!review.comment && review.comment.length > CLAMP_THRESHOLD
  const openLightbox = (i: number) => {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  const handlePostReply = async () => {
    const trimmed = replyText.trim()
    if (!trimmed || isSubmittingReply) return
    setIsSubmittingReply(true)
    try {
      const res = await replyToBookingReview(review.id, trimmed)
      const savedReply = res?.hostReply ?? trimmed
      const savedAt = res?.hostRepliedAt ?? new Date().toISOString()
      toast.success('Public reply posted.')
      setIsReplying(false)
      setReplyText('')
      onReplyPosted?.(review.id, savedReply, savedAt)
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to post reply.'
      )
    } finally {
      setIsSubmittingReply(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-border p-4 hover:border-deep-teal/30 transition-colors flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
            {guestProfile.avatar ? (
              <Image
                src={guestProfile.avatar}
                alt={guestName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-deep-teal text-sm font-semibold">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <span className="text-sm font-semibold text-foreground truncate block leading-tight">
              {guestName}
            </span>
            <StarRow rating={review.rating} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <RatingBadge rating={review.rating} />
            <span className="text-xs text-neutral-gray">
              {formatDate(review.reviewedAt)}
            </span>
            {onReport && (
              <button
                type="button"
                onClick={() => onReport(review.id)}
                className="p-1 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                title="Report this review"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="flex-1">
          {review.comment ? (
            <>
              <p className="text-sm text-foreground/85 leading-relaxed break-words line-clamp-3">
                {review.comment}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-1 text-xs font-medium text-accent-orange hover:underline underline-offset-2 transition-colors cursor-pointer"
                >
                  See more
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-gray/60 italic">
              No written comment left.
            </p>
          )}
        </div>

        {reviewImages.length > 0 && (
          <ReviewImages images={reviewImages} onOpen={openLightbox} />
        )}

        {/* Published Host Reply */}
        {review.hostReply && (
          <HostReplyBlock
            hostReply={review.hostReply}
            hostRepliedAt={review.hostRepliedAt}
            compact
            onSeeMore={() => setModalOpen(true)}
          />
        )}

        {/* Inline Reply Box (Host Workspace only) */}
        {allowReply && !review.hostReply && (
          <div className="pt-2 border-t border-border/80">
            {isReplying ? (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) setReplyText(e.target.value)
                  }}
                  placeholder={`Write a warm public reply to ${guestProfile.firstName}...`}
                  disabled={isSubmittingReply}
                  className="resize-none border-border text-xs bg-white focus-visible:ring-deep-teal"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-gray tabular-nums">
                    {replyText.length}/500
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmittingReply}
                      onClick={() => {
                        setIsReplying(false)
                        setReplyText('')
                      }}
                      className="h-8 rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!replyText.trim() || isSubmittingReply}
                      onClick={handlePostReply}
                      className="h-8 rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold"
                    >
                      {isSubmittingReply ? (
                        <Spinner className="w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Post Reply
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsReplying(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep-teal hover:underline cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reply to guest
              </button>
            )}
          </div>
        )}

        {/* Property tag */}
        <div className="flex items-center gap-1.5 text-xs text-deep-teal/80 pt-1.5 border-t border-border/60">
          <Home className="w-3.5 h-3.5 text-accent-orange shrink-0" />
          <span className="truncate font-medium">{review.propertyName}</span>
        </div>
      </div>

      {/* Full review modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-deep-teal/10 shrink-0">
                  {guestProfile.avatar ? (
                    <Image
                      src={guestProfile.avatar}
                      alt={guestName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-deep-teal text-sm font-semibold">
                      {initial}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-semibold text-foreground truncate">
                    {guestName}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={review.rating} />
                    <RatingBadge rating={review.rating} />
                    <span className="text-xs text-neutral-gray">
                      {formatDate(review.reviewedAt)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-off-white text-neutral-gray hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <p
              className="text-sm text-foreground leading-relaxed"
              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            >
              {review.comment}
            </p>
            {reviewImages.length > 0 && (
              <ReviewImages images={reviewImages} onOpen={openLightbox} />
            )}
            <HostReplyBlock
              hostReply={review.hostReply}
              hostRepliedAt={review.hostRepliedAt}
            />
            <div className="flex items-center gap-1.5 text-xs text-deep-teal/80 pt-2 border-t border-border">
              <Home className="w-3.5 h-3.5 text-accent-orange shrink-0" />
              <span className="truncate font-medium">{review.propertyName}</span>
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
