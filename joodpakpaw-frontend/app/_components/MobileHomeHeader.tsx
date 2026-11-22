'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { User as UserIcon } from 'lucide-react'
import { assetPath, getApiImageUrl, getDisplayName } from '@/lib/utils'

export function MobileHomeHeader() {
  const { isAuthenticated, user } = useAuth()
  const { openAuthModal } = useAuthModal()

  const isHost = Boolean(
    user?.isVerifiedHost || user?.role?.some((r) => r.name === 'host')
  )
  const avatarUrl = user?.avatar ? getApiImageUrl(user.avatar) : null
  const displayName = getDisplayName(user) || 'Account'
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      'U'
    : ''

  return (
    <header className="lg:hidden bg-white border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        {/* Left: Crisp Brand Wordmark */}
        <Link
          href="/"
          aria-label="JoodPakPaw Home"
          className="flex items-center shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
        >
          <span className="relative block w-[150px] h-9 overflow-hidden">
            <Image
              src={assetPath('/icons/JOODPAK.svg')}
              alt="JoodPakPaw"
              fill
              sizes="150px"
              className="object-cover object-center"
              priority
            />
          </span>
        </Link>

        {/* Right: Host CTA + Account / Sign in */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && user ? (
            <>
              <Link
                href="/profile/host"
                className="px-3 py-1.5 rounded-full text-xs font-medium text-deep-teal hover:bg-neutral-50 active:bg-neutral-100 transition-colors whitespace-nowrap"
              >
                {isHost ? 'Host mode' : 'Become a host'}
              </Link>
              <Link
                href="/profile"
                aria-label={displayName}
                className="w-9 h-9 rounded-full border border-border bg-white inline-flex items-center justify-center overflow-hidden hover:bg-neutral-50 transition-colors shrink-0"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                ) : initials ? (
                  <span className="w-full h-full bg-deep-teal text-white text-xs font-semibold flex items-center justify-center">
                    {initials}
                  </span>
                ) : (
                  <UserIcon className="w-4 h-4 text-deep-teal" />
                )}
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="min-h-9 px-3.5 py-1.5 rounded-full border border-border bg-white text-xs font-semibold text-deep-teal hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
