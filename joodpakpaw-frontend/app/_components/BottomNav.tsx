'use client'

import Link from 'next/link'
import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useNotifications } from '@/app/_components/NotificationContext'
import { useChat } from '@/app/_components/ChatContext'
import { cn } from '@/lib/utils'
import {
  Bell,
  Compass,
  Heart,
  MessageCircle,
  User,
} from 'lucide-react'

const DISCOVERY_PATHS = [
  '/top-rated',
  '/new-listings',
  '/recommended',
  '/best-value',
  '/near-you',
  '/dog-friendly',
  '/cat-friendly',
  '/recently-viewed',
  '/trending',
]

function shouldHideBottomNav(path: string): boolean {
  if (
    path.startsWith('/authen') ||
    path.startsWith('/admin') ||
    path.startsWith('/chat/') ||
    path.startsWith('/detail/') ||
    path.startsWith('/booking') ||
    path.startsWith('/profile/host') ||
    path.startsWith('/profile/pets/add')
  ) {
    return true
  }

  // Deep numeric detail routes: /[propertyId], /profile/bookings/[id], /profile/pets/[id], /profile/reports/[id]
  if (/^\/\d+$/.test(path)) return true
  if (/^\/profile\/bookings\/\d+$/.test(path)) return true
  if (/^\/profile\/pets\/\d+$/.test(path)) return true
  if (/^\/profile\/reports\/\d+$/.test(path)) return true

  return false
}

export function BottomNav() {
  const normalizedPath = useNormalizedPathname()
  const { unreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()

  if (shouldHideBottomNav(normalizedPath)) {
    return null
  }

  const navItems = [
    {
      href: '/',
      label: 'Explore',
      icon: Compass,
      isActive:
        normalizedPath === '/' ||
        DISCOVERY_PATHS.some((p) => normalizedPath === p),
      badge: 0,
    },
    {
      href: '/favorites',
      label: 'Favorites',
      icon: Heart,
      isActive:
        normalizedPath === '/favorites' ||
        normalizedPath.startsWith('/favorites/'),
      badge: 0,
    },
    {
      href: '/chat',
      label: 'Chat',
      icon: MessageCircle,
      isActive: normalizedPath === '/chat',
      badge: chatUnreadCount,
    },
    {
      href: '/notifications',
      label: 'Inbox',
      icon: Bell,
      isActive: normalizedPath === '/notifications',
      badge: unreadCount,
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: User,
      isActive:
        normalizedPath === '/profile' ||
        normalizedPath.startsWith('/profile/'),
      badge: 0,
    },
  ]

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const showBadge = item.badge > 0

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={cn(
                'flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors',
                item.isActive
                  ? 'text-accent-orange'
                  : 'text-neutral-gray hover:text-deep-teal'
              )}
            >
              <div className="relative">
                <Icon
                  className="w-5 h-5"
                  strokeWidth={item.isActive ? 2.25 : 1.75}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent-orange text-white text-[10px] font-bold leading-none flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] leading-tight',
                  item.isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
