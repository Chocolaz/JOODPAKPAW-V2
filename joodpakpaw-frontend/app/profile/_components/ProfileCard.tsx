'use client'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { UserProfile } from '@/types'
import { Mail, Phone, ShieldCheck, BadgeCheck, User } from 'lucide-react'

export const ProfileCard = ({
  profile,
  onPasswordChangeClick,
}: {
  profile: UserProfile
  onPasswordChangeClick: () => void
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  const guestAvatarSrc = `${basePath}/graphics/guest.jpg`
  const roleLabel = profile.role?.map(r => r.name).join(', ') || (profile.isBecomeToHost ? 'Host' : 'Guest')
  const isHost = profile.role?.some(r => r.name === 'host') || profile.isBecomeToHost

  return (
    <div className="space-y-4 py-2">
      {/* Profile card with banner */}
      <Card className="w-full overflow-hidden">
        {/* Gradient banner */}
        <div className="h-20 relative bg-gradient-to-br from-deep-teal via-deep-teal/80 to-positive-green/60">
          <div className="absolute top-2 right-6 w-16 h-16 rounded-full bg-white/10" />
          <div className="absolute -bottom-2 left-8 w-10 h-10 rounded-full bg-white/5" />
        </div>

        <CardContent className="px-5 pb-5 pt-0 relative">
          {/* Avatar overlapping banner */}
          <Avatar className="w-18 h-18 ring-4 ring-white shadow-lg -mt-10">
            <AvatarImage src={profile.avatar || guestAvatarSrc} alt={`${profile.firstName} ${profile.lastName}`} />
            <AvatarFallback className="text-2xl bg-gray-100 text-deep-teal font-semibold">
              {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* Name + role */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-deep-teal leading-tight">
                {profile.firstName} {profile.lastName}
              </h3>
              {profile.isVerifiedHost && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 text-xs font-medium">
                  <BadgeCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-gray/70 shrink-0" />
                <p className="text-sm text-neutral-gray">{isHost ? 'Host' : 'Guest'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-gray/70 shrink-0" />
                <p className="text-sm text-neutral-gray truncate">{profile.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info rows */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-neutral-gray" />
            <span className="text-sm text-neutral-gray">Phone</span>
          </div>
          <span className="text-sm text-gray-800">{profile.phone || '—'}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-neutral-gray" />
            <span className="text-sm text-neutral-gray">Password</span>
          </div>
          <button
            onClick={onPasswordChangeClick}
            className="text-sm text-deep-teal font-medium hover:underline"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  )
}
