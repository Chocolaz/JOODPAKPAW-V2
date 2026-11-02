'use client'

import Image from 'next/image'
import { Star, CalendarDays, UserCheck, BadgeCheck } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { HostProfile } from '@/types/hostProfile'
import { ContactHostButton } from '@/app/_components/property-detail/ContactHostButton'

function formatMemberSince(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function HostProfileHero({ host, chatRoomId, onChatCreated }: { host: HostProfile; chatRoomId?: number | null; onChatCreated?: (chatRoomId: number) => void }) {
  const hasRating = host.avgRating > 0
  const isGuest = host.totalProperties === 0
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const fromChat = !!fromParam?.startsWith('/chat')

  return (
    <div className="relative">
      {/* Banner */}
      <div
        className={`h-40 lg:h-52 w-full lg:w-screen lg:ml-[calc(50%-50vw)] relative overflow-hidden bg-gradient-to-br ${
          isGuest
            ? 'from-[#1a6b3d] via-positive-green/80 to-green-300/60'
            : 'from-[#e8521a] via-accent-orange/80 to-orange-300/60'
        }`}
      >
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute top-4 right-24 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-black/10" />
        <div className="absolute bottom-4 left-1/2 w-16 h-16 rounded-full bg-white/8" />
      </div>

      {/* Below banner */}
      <div className="px-5 lg:px-12 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:gap-6 -mt-14 lg:-mt-16">
          {/* Avatar */}
          <div className="relative w-28 h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden bg-gray-100 ring-4 ring-white shadow-xl shrink-0 mx-auto lg:mx-0">
            {host.avatar ? (
              <Image
                src={host.avatar}
                alt={`${host.firstName} ${host.lastName}`}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-deep-teal/10 flex items-center justify-center">
                <span className="text-deep-teal font-bold text-4xl font-baloo2">
                  {host.firstName.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 mt-3 lg:mt-0 lg:pb-1 text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start flex-wrap">
              <h1 className="text-2xl lg:text-2xl font-bold text-deep-teal font-baloo2 leading-tight">
                {host.firstName} {host.lastName}
              </h1>
              {host.isVerifiedHost && (
                <BadgeCheck className="w-6 h-6 text-blue-500 shrink-0" />
              )}
              {isGuest && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-positive-green/15 text-positive-green text-xs font-semibold">
                  <UserCheck className="w-3 h-3" />
                  Guest
                </span>
              )}
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-1.5 mt-1 text-sm text-neutral-gray">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>Member since {formatMemberSince(host.createdAt)}</span>
            </div>
          </div>

          {/* Contact button — desktop */}
          {!fromChat && (
            <div className="hidden lg:block lg:pb-1 shrink-0">
              <ContactHostButton hostId={host.id} chatRoomId={chatRoomId} onSuccess={onChatCreated} />
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div
          className={`mt-5 grid ${host.isVerifiedHost ? 'grid-cols-4' : 'grid-cols-3'} bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-x divide-gray-100`}
        >
          {/* Rating */}
          <div className="flex flex-col items-center gap-0.5 py-4 px-4">
            <span className="text-2xl lg:text-3xl font-bold text-deep-teal font-baloo2 leading-none">
              {hasRating ? host.avgRating.toFixed(1) : '—'}
            </span>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    'w-3 h-3',
                    hasRating && s <= Math.round(host.avgRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  )}
                  strokeWidth={0}
                />
              ))}
            </div>
            <span className="text-[11px] text-neutral-gray mt-0.5 uppercase tracking-wide font-medium">
              Rating
            </span>
          </div>

          {/* Reviews */}
          <div className="flex flex-col items-center justify-center gap-0.5 py-4 px-4">
            <span className="text-2xl lg:text-3xl font-bold text-deep-teal font-baloo2 leading-none">
              {host.reviewCount}
            </span>
            <span className="text-[11px] text-neutral-gray mt-1 uppercase tracking-wide font-medium">
              {host.reviewCount === 1 ? 'Review' : 'Reviews'}
            </span>
          </div>

          {/* Properties */}
          <div className="flex flex-col items-center justify-center gap-0.5 py-4 px-4">
            <span className="text-2xl lg:text-3xl font-bold text-deep-teal font-baloo2 leading-none">
              {host.totalProperties}
            </span>
            <span className="text-[11px] text-neutral-gray mt-1 uppercase tracking-wide font-medium">
              {host.totalProperties === 1 ? 'Property' : 'Properties'}
            </span>
          </div>

          {/* Verified */}
          {host.isVerifiedHost && (
            <div className="flex flex-col items-center justify-center gap-1 py-4 px-4">
              <BadgeCheck className="w-6 h-6 text-blue-500" />
              <span className="text-[11px] text-blue-500 mt-0.5 uppercase tracking-wide font-medium">
                <span className="sm:hidden">Verified</span>
                <span className="hidden sm:inline">Verified Host</span>
              </span>
            </div>
          )}
        </div>

        {/* Contact button — mobile */}
        {!fromChat && (
          <div className="mt-4 lg:hidden">
            <ContactHostButton hostId={host.id} chatRoomId={chatRoomId} />
          </div>
        )}
      </div>
    </div>
  )
}
