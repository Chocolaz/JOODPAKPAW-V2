'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useNotifications } from '@/app/_components/NotificationContext'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { User as UserIcon, ShieldCheck, Menu } from 'lucide-react'
import { assetPath, cn, getApiImageUrl } from '@/lib/utils'

const CENTER_NAV_ITEMS = [
  { href: '/', label: 'Explore' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/chat', label: 'Messages' },
  { href: '/notifications', label: 'Notifications' },
]

const VISIBLE_PATHS = [
  '/',
  '/profile',
  '/favorites',
  '/notifications',
  '/chat',
  '/top-rated',
  '/new-listings',
  '/recommended',
  '/best-value',
  '/near-you',
  '/dog-friendly',
  '/cat-friendly',
  '/recently-viewed',
]

export function DesktopNav() {
  const normalizedPath = useNormalizedPathname()
  const { unreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()
  const { isAuthenticated, user } = useAuth()
  const { openAuthModal } = useAuthModal()

  const isAdmin = Boolean(user?.role?.some((r) => r.name === 'admin'))
  const isHost = Boolean(
    user?.isVerifiedHost || user?.role?.some((r) => r.name === 'host')
  )

  if (
    !VISIBLE_PATHS.includes(normalizedPath) &&
    !normalizedPath.startsWith('/chat') &&
    !normalizedPath.startsWith('/profile/')
  ) {
    return null
  }

  const avatarUrl = user?.avatar ? getApiImageUrl(user.avatar) : null
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      'U'
    : ''
  const shortName =
    user?.visibleName?.trim() || user?.firstName?.trim() || 'Account'

  const isProfileActive =
    normalizedPath === '/profile' ||
    (normalizedPath.startsWith('/profile/') &&
      !normalizedPath.startsWith('/profile/host'))

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden lg:block fixed top-0 z-50 w-full bg-white border-b border-border"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 xl:h-[72px] flex items-center justify-between gap-6">
        {/* Left: Crisp Wordmark */}
        <Link
          href="/"
          aria-label="JoodPakPaw Home"
          className="flex items-center shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
        >
          <span className="relative block w-[176px] h-10 overflow-hidden">
            <Image
              src={assetPath('/icons/JOODPAK.svg')}
              alt="JoodPakPaw"
              fill
              sizes="160px"
              className="object-cover object-center"
              priority
            />
          </span>
        </Link>

        {/* Center: Quiet Editorial Navigation Links */}
        <div className="flex items-center gap-7 xl:gap-9 h-full">
          {CENTER_NAV_ITEMS.map(({ href, label }) => {
            const isActive =
              href === '/chat'
                ? normalizedPath === '/chat' ||
                  normalizedPath.startsWith('/chat/')
                : normalizedPath === href
            const badgeCount =
              href === '/notifications'
                ? unreadCount
                : href === '/chat'
                ? chatUnreadCount
                : 0

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative h-full inline-flex items-center gap-1.5 text-sm xl:text-[15px] border-b-2 transition-colors active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal',
                  isActive
                    ? 'border-deep-teal text-deep-teal font-semibold'
                    : 'border-transparent text-neutral-gray font-medium hover:text-foreground'
                )}
              >
                <span>{label}</span>
                {badgeCount > 0 && (
                  <span
                    aria-label={`${badgeCount} unread`}
                    className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent-orange text-white text-[10px] font-bold leading-none inline-flex items-center justify-center tabular-nums"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Right: Host Mode / Admin / Airbnb-style Account Pill */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0">
          {isAuthenticated ? (
            <Link
              href="/profile/host"
              className={cn(
                'px-3 py-2 rounded-full text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal',
                normalizedPath.startsWith('/profile/host')
                  ? 'text-deep-teal font-semibold bg-off-white'
                  : 'text-foreground hover:bg-off-white/70 hover:text-deep-teal'
              )}
            >
              {isHost ? 'Host mode' : 'Become a host'}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                openAuthModal('login', { returnUrl: '/profile/host' })
              }
              className="px-3 py-2 rounded-full text-sm font-medium text-foreground hover:bg-off-white/70 hover:text-deep-teal transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
            >
              Become a host
            </button>
          )}

          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal',
                normalizedPath.startsWith('/admin')
                  ? 'bg-deep-teal text-white'
                  : 'text-deep-teal hover:bg-off-white/70'
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Admin</span>
            </Link>
          )}

          {isAuthenticated ? (
            <Link
              href="/profile"
              aria-label="Account profile"
              className={cn(
                'rounded-full border px-2.5 py-1.5 flex items-center gap-2.5 transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal',
                isProfileActive
                  ? 'border-deep-teal bg-off-white/60 text-deep-teal'
                  : 'border-border bg-white text-foreground hover:border-foreground/30'
              )}
            >
              <Menu className="w-4 h-4 text-neutral-gray ml-0.5 shrink-0" />
              {avatarUrl ? (
                <span className="relative w-7 h-7 rounded-full overflow-hidden bg-off-white shrink-0">
                  <Image
                    src={avatarUrl}
                    alt={shortName}
                    fill
                    sizes="32px"
                    unoptimized
                    className="object-cover"
                  />
                </span>
              ) : (
                <span className="w-7 h-7 rounded-full bg-deep-teal text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </span>
              )}
              <span className="text-sm font-medium max-w-[100px] truncate pr-1">
                {shortName}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login', { returnUrl: '/profile' })}
              className="rounded-full border border-border bg-white px-3 py-1.5 flex items-center gap-2.5 text-foreground hover:border-foreground/30 active:scale-[0.98] disabled:opacity-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
            >
              <Menu className="w-4 h-4 text-neutral-gray shrink-0" />
              <span className="w-7 h-7 rounded-full bg-off-white text-deep-teal flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold pr-0.5">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
