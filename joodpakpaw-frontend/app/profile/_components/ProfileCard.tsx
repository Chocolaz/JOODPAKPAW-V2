'use client'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { UserProfile } from '@/types'
import { getDisplayName } from '@/lib/utils'
import { Mail, Phone, ShieldCheck, BadgeCheck, User } from 'lucide-react'

export const ProfileCard = ({
  profile,
  onPasswordChangeClick,
}: {
  profile: UserProfile
  onPasswordChangeClick: () => void
}) => {
  const isHost =
    profile.role?.some((r) => r.name === 'host') || profile.isBecomeToHost

  return (
    <div className="space-y-4 py-2">
      <Card className="w-full border border-border shadow-none bg-off-white/60">
        <CardContent className="p-5 flex items-center gap-4">
          <Avatar className="w-16 h-16 ring-2 ring-white border border-border shrink-0">
            <AvatarImage
              src={profile.avatar || undefined}
              alt={`${profile.firstName} ${profile.lastName}`}
            />
            <AvatarFallback className="text-xl bg-white text-deep-teal font-semibold">
              {profile.firstName?.charAt(0)}
              {profile.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-deep-teal leading-tight truncate">
                {getDisplayName(profile)}
              </h3>
              {profile.isVerifiedHost && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                  <BadgeCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-gray/70 shrink-0" />
                <p className="text-sm text-neutral-gray">
                  {isHost ? 'Host' : 'Guest'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-gray/70 shrink-0" />
                <p className="text-sm text-neutral-gray truncate">
                  {profile.email}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-2xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-neutral-gray" />
            <span className="text-sm text-neutral-gray">Phone</span>
          </div>
          <span className="text-sm text-foreground tabular-nums">
            {profile.phone || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-neutral-gray" />
            <span className="text-sm text-neutral-gray">Password</span>
          </div>
          <button
            type="button"
            onClick={onPasswordChangeClick}
            className="text-sm text-deep-teal font-medium hover:underline cursor-pointer"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  )
}
