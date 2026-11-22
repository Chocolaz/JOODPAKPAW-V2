'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  User,
  PawPrint,
  CalendarClock,
  ShieldCheck,
  Flag,
  House,
  ShieldAlert,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/app/_components/AuthContext'
import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useProfileContext } from '../ProfileContext'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  tag?: string
  match: (path: string) => boolean
}

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth()
  const { petProfiles } = useProfileContext()
  const normalizedPath = useNormalizedPathname()
  const router = useRouter()
  const [isSignOutOpen, setIsSignOutOpen] = useState(false)

  // Unauthenticated /profile shows the clean centered Guest welcome without sidebar
  if (!isAuthenticated) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        {children}
      </div>
    )
  }

  const personalInfoHref = user?.firstName
    ? `/profile/${user.firstName.toLowerCase()}`
    : '/profile'

  const isHost = user?.role?.some((r) => r.name === 'host')
  const isAdmin = user?.role?.some((r) => r.name === 'admin')

  const accountItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      href: '/profile',
      icon: LayoutGrid,
      match: (path) => path === '/profile',
    },
    {
      id: 'personal',
      label: 'Personal info',
      href: personalInfoHref,
      icon: User,
      match: (path) =>
        path.startsWith('/profile/') &&
        !path.startsWith('/profile/pets') &&
        !path.startsWith('/profile/bookings') &&
        !path.startsWith('/profile/verification') &&
        !path.startsWith('/profile/reports') &&
        !path.startsWith('/profile/host'),
    },
    {
      id: 'pets',
      label: 'My pets',
      href: '/profile/pets',
      icon: PawPrint,
      badge: !petProfiles.loading && petProfiles.pets.length > 0 ? petProfiles.pets.length : undefined,
      match: (path) => path.startsWith('/profile/pets'),
    },
    {
      id: 'bookings',
      label: 'Bookings',
      href: '/profile/bookings',
      icon: CalendarClock,
      match: (path) => path.startsWith('/profile/bookings'),
    },
    {
      id: 'verification',
      label: 'Verification',
      href: '/profile/verification',
      icon: ShieldCheck,
      tag: user?.isVerifiedHost ? 'Verified' : undefined,
      match: (path) => path.startsWith('/profile/verification'),
    },
    {
      id: 'reports',
      label: 'My reports',
      href: '/profile/reports',
      icon: Flag,
      match: (path) => path.startsWith('/profile/reports'),
    },
  ]

  const handleConfirmLogout = () => {
    setIsSignOutOpen(false)
    logout()
    router.push('/authen')
  }

  return (
    <>
      {/* Mobile / Tablet sticky horizontal pill rail (< lg) */}
      <div className="lg:hidden sticky top-14 z-20 bg-white border-b border-border px-4 py-2.5 overflow-x-auto no-scrollbar">
        <nav aria-label="Profile navigation" className="flex items-center gap-2 w-max">
          {accountItems.map((item) => {
            const active = item.match(normalizedPath)
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-deep-teal text-white'
                    : 'bg-off-white text-deep-teal hover:bg-deep-teal/10'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'tabular-nums text-[11px] font-medium',
                      active ? 'text-white/85' : 'text-neutral-gray'
                    )}
                  >
                    ({item.badge})
                  </span>
                )}
              </Link>
            )
          })}
          <Link
            href="/profile/host"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-off-white text-deep-teal hover:bg-deep-teal/10 transition-colors"
          >
            <House className="w-3.5 h-3.5 shrink-0" />
            <span>{isHost ? 'Host mode' : 'Become a host'}</span>
          </Link>
        </nav>
      </div>

      {/* Main container */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-0 lg:h-[calc(100dvh-64px)] xl:h-[calc(100dvh-72px)] lg:overflow-hidden">
        <div className="flex items-start lg:items-stretch lg:h-full gap-8 xl:gap-10">
          {/* Desktop independent-scroll left sidebar (lg+) */}
          <aside className="hidden lg:block w-[260px] shrink-0 h-full overflow-y-auto overscroll-contain py-8 pr-6 border-r border-border space-y-6">
            <div>
              <p className="text-sm font-semibold text-deep-teal px-3 mb-2">
                Account
              </p>
              <nav aria-label="Account sections" className="space-y-1">
                {accountItems.map((item) => {
                  const active = item.match(normalizedPath)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                        active
                          ? 'bg-off-white text-deep-teal font-semibold border border-border'
                          : 'text-neutral-gray hover:text-deep-teal hover:bg-off-white/60 border border-transparent'
                      )}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span className="text-xs font-mono tabular-nums text-neutral-gray">
                          {item.badge}
                        </span>
                      )}
                      {item.tag && (
                        <span className="text-xs font-medium text-emerald-700">
                          {item.tag}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-border space-y-1">
              <p className="text-sm font-semibold text-deep-teal px-3 mb-2">
                Hosting
              </p>
              <Link
                href="/profile/host"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-gray hover:text-deep-teal hover:bg-off-white/60 transition-colors"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <House className="w-4 h-4 shrink-0" />
                  <span className="truncate">{isHost ? 'Host mode' : 'Become a host'}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-neutral-gray/70" />
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-gray hover:text-deep-teal hover:bg-off-white/60 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="truncate">Admin center</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-neutral-gray/70" />
                </Link>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setIsSignOutOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-gray hover:text-red-600 hover:bg-red-50/70 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          {/* Right independent-scroll workspace pane */}
          <div className="min-w-0 flex-1 pb-20 lg:pb-10 lg:h-full lg:overflow-y-auto overscroll-contain lg:py-8 lg:pr-2">
            {children}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out?"
        titleClassName="text-deep-teal"
        confirmButtonClassName="bg-accent-orange"
      />
    </>
  )
}
