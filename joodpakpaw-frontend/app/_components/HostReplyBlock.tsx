'use client'

import { cn } from '@/lib/utils'

interface HostReplyBlockProps {
  hostReply?: string | null
  hostRepliedAt?: string | null
  compact?: boolean
  onSeeMore?: () => void
  className?: string
  textClassName?: string
}

function formatReplyDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const parsed = new Date(dateStr.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Shared public host-reply card used in guest booking details, host booking details,
 * property reviews, and host profile reviews.
 */
export function HostReplyBlock({
  hostReply,
  hostRepliedAt,
  compact = false,
  onSeeMore,
  className,
  textClassName,
}: HostReplyBlockProps) {
  if (!hostReply) return null

  const formattedDate = formatReplyDate(hostRepliedAt)
  const isReplyLong = compact && hostReply.length > 160

  return (
    <div
      className={cn(
        'rounded-xl bg-[#f7f2e8] border border-[#1c4f4a]/15 p-3 space-y-1 text-left',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#1c4f4a]">
          Response from Host
        </span>
        {formattedDate && (
          <span className="text-[11px] text-neutral-gray">
            {formattedDate}
          </span>
        )}
      </div>
      <p
        className={cn(
          'text-xs text-gray-700 leading-relaxed',
          compact && 'line-clamp-3',
          textClassName
        )}
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {hostReply}
      </p>
      {isReplyLong && onSeeMore && (
        <button
          type="button"
          onClick={onSeeMore}
          className="text-xs font-medium text-accent-orange hover:underline underline-offset-2 cursor-pointer"
        >
          See more
        </button>
      )}
    </div>
  )
}
