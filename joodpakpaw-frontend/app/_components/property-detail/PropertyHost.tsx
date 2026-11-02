'use client'

import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Star, UserCircle, BadgeCheck } from 'lucide-react'
import { PropertyHost as PropertyHostType } from '@/types/property'
import { cn } from '@/lib/utils'
import { ContactHostButton } from './ContactHostButton'

interface PropertyHostProps {
  host: PropertyHostType
  hostAvgRating?: number
  chatRoomId?: number | null
  onChatSuccess?: () => void
}

export function PropertyHost({ host, hostAvgRating, chatRoomId, onChatSuccess }: PropertyHostProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rating = hostAvgRating ?? host.hostAvgRating ?? 0
  const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  const hostHref = `/hosts/${host.id}?from=${encodeURIComponent(fullPath)}`
  return (
    <div className="border-t pt-8 mb-10">
      <h3 className="text-lg lg:text-xl font-semibold text-deep-teal mb-5">
        Meet your host
      </h3>

      <div className="flex items-center gap-4 bg-off-white/60 rounded-2xl p-5 border border-gray-100 shadow-sm">
        {/* Avatar — tappable, navigates to host profile */}
        <button onClick={() => router.push(hostHref)} className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden bg-gray-100 shrink-0 ring-2 ring-deep-teal/20 shadow-sm hover:ring-accent-orange transition-all">
          {host.avatar ? (
            <Image
              src={host.avatar}
              alt={`${host.firstName} ${host.lastName}`}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <UserCircle className="w-full h-full text-gray-300" />
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push(hostHref)} className="group text-left min-w-0 w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-deep-teal text-base lg:text-lg truncate group-hover:underline underline-offset-2">
                {host.firstName} {host.lastName}
              </p>
              {host.isVerifiedHost && (
                <BadgeCheck className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500 shrink-0" />
              )}
            </div>
          </button>
          <div className="flex items-center gap-1.5 mt-1">
            {rating > 0 ? (
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn('w-3.5 h-3.5', s <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-300 text-gray-300')}
                      strokeWidth={0}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-gray-300 text-gray-300" strokeWidth={0} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message button */}
        <ContactHostButton hostId={host.id} compact chatRoomId={chatRoomId} onSuccess={onChatSuccess} />
      </div>
    </div>
  )
}
