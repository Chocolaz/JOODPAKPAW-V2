'use client'

import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Star, UserCircle, BadgeCheck } from 'lucide-react'
import { PropertyHost as PropertyHostType } from '@/types/property'
import { cn, getDisplayName } from '@/lib/utils'
import { ContactHostButton } from './ContactHostButton'

interface PropertyHostProps {
  host: PropertyHostType
  hostAvgRating?: number
  chatRoomId?: number | null
  onChatSuccess?: () => void
  propertyId?: number
  propertyTitle?: string
  propertyThumbnail?: string | null
  startingPrice?: number
}

export function PropertyHost({
  host,
  hostAvgRating,
  chatRoomId,
  onChatSuccess,
  propertyId,
  propertyTitle,
  propertyThumbnail,
  startingPrice,
}: PropertyHostProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rating = hostAvgRating ?? host.hostAvgRating ?? 0
  const hostDisplayName = getDisplayName(host) || 'Host'
  const fullPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname
  const hostHref = `/hosts/${host.id}?from=${encodeURIComponent(fullPath)}`

  return (
    <section className="border-t border-border pt-8">
      <h2 className="font-semibold text-deep-teal mb-4">Meet your host</h2>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => router.push(hostHref)}
            className="relative w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-full overflow-hidden bg-off-white shrink-0 border-2 border-deep-teal/20 hover:border-accent-orange transition-colors cursor-pointer"
          >
            {host.avatar ? (
              <Image
                src={host.avatar}
                alt={hostDisplayName}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <UserCircle className="w-full h-full text-neutral-300" />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1.5">
            <button
              type="button"
              onClick={() => router.push(hostHref)}
              className="group text-left min-w-0 w-full cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="font-semibold text-deep-teal text-base lg:text-lg truncate group-hover:underline underline-offset-2">
                  {hostDisplayName}
                </span>
                {host.isVerifiedHost && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-deep-teal/10 text-deep-teal px-2.5 py-0.5 text-xs font-medium shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified host
                  </span>
                )}
              </div>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {rating > 0 ? (
                <div className="inline-flex items-center gap-1.5 bg-off-white/70 border border-border rounded-full px-2.5 py-0.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'w-3.5 h-3.5',
                          s <= Math.round(rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-neutral-300 text-neutral-300'
                        )}
                        strokeWidth={0}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {rating.toFixed(1)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-neutral-gray">
                  Host on JoodPakPaw
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="sm:shrink-0">
          <ContactHostButton
            hostId={host.id}
            compact
            chatRoomId={chatRoomId}
            onSuccess={onChatSuccess}
            propertyId={propertyId}
            propertyTitle={propertyTitle}
            propertyThumbnail={propertyThumbnail}
            startingPrice={startingPrice}
          />
        </div>
      </div>
    </section>
  )
}
