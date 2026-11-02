'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useNotifications } from '@/app/_components/NotificationContext'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { Home, Heart, Bell, User, MessageCircle } from 'lucide-react'
import { assetPath } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
]

const VISIBLE_PATHS = ['/', '/profile', '/favorites', '/notifications', '/chat', '/top-rated', '/new-listings', '/recommended', '/best-value', '/near-you', '/dog-friendly', '/cat-friendly', '/recently-viewed']

export function DesktopNav() {
  const normalizedPath = useNormalizedPathname()
  const { unreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()
  const { isAuthenticated } = useAuth()
  const { openAuthModal } = useAuthModal()

  if (
    !VISIBLE_PATHS.includes(normalizedPath) &&
    !normalizedPath.startsWith('/chat') &&
    !normalizedPath.startsWith('/profile/')
  ) return null

  return (
    <nav className="hidden lg:block fixed top-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between h-14 lg:h-16 xl:h-[72px]">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <div className="relative lg:w-[180px] xl:w-[220px] h-14 lg:h-16 xl:h-[72px] overflow-hidden">
            <Image
              src={assetPath('/icons/JOODPAK.svg')}
              alt="JoodPakPaw logo"
              fill
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              priority
            />
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/chat'
              ? normalizedPath === '/chat' || normalizedPath.startsWith('/chat/')
              : normalizedPath === href
            const badgeCount =
              href === '/notifications' ? unreadCount :
              href === '/chat' ? chatUnreadCount : 0
            const showBadge = badgeCount > 0

            const isProfile = href === '/profile'
            const linkClass = `relative flex items-center gap-2 px-4 py-2 rounded-full text-sm lg:text-base xl:text-lg font-medium transition-colors duration-200 ${
              isActive
                ? 'bg-accent-orange/10 text-accent-orange'
                : 'text-neutral-gray hover:bg-gray-50 hover:text-deep-teal'
            }`
            const badge = showBadge && (
              <span className="absolute -top-0.5 right-1.5 min-w-4 h-4 px-0.5 bg-accent-orange rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-bold leading-none">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              </span>
            )

            if (isProfile && !isAuthenticated) {
              return (
                <button
                  key={href}
                  onClick={() => openAuthModal('login', { returnUrl: '/profile' })}
                  className={linkClass}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge}
                </button>
              )
            }

            return (
              <Link
                key={href}
                href={href}
                className={linkClass}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
