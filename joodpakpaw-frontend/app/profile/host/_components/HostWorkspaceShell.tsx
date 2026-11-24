'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Clock,
  ExternalLink,
  History,
  LayoutDashboard,
  Plus,
  Star,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { assetPath, cn, getDisplayName } from '@/lib/utils'
import { User, UserProfile } from '@/types'

export type HostWorkspaceTab =
  | 'overview'
  | 'properties'
  | 'bookings'
  | 'calendar'
  | 'history'
  | 'reviews'

interface HostNavItem {
  id: HostWorkspaceTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  urgent?: boolean
  hostOnly?: boolean
}

interface HostWorkspaceShellProps {
  activeTab: HostWorkspaceTab
  onSelectTab: (tab: HostWorkspaceTab) => void
  user: User | null
  profile: UserProfile | null
  isHost: boolean
  listingsCount: number
  pendingBookingsCount: number
  unrepliedReviewsCount: number
  onOpenAppeal: () => void
  children: React.ReactNode
}

export function HostWorkspaceShell({
  activeTab,
  onSelectTab,
  user,
  profile,
  isHost,
  listingsCount,
  pendingBookingsCount,
  unrepliedReviewsCount,
  onOpenAppeal,
  children,
}: HostWorkspaceShellProps) {
  const router = useRouter()

  const navItems: HostNavItem[] = [
    {
      id: 'overview',
      label: 'Today',
      icon: LayoutDashboard,
    },
    {
      id: 'properties',
      label: 'Listings',
      icon: Building2,
      badge: listingsCount > 0 ? listingsCount : undefined,
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: CalendarCheck2,
      badge: pendingBookingsCount > 0 ? pendingBookingsCount : undefined,
      urgent: pendingBookingsCount > 0,
      hostOnly: true,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: CalendarDays,
      hostOnly: true,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      hostOnly: true,
    },
    {
      id: 'reviews',
      label: 'Reviews',
      icon: Star,
      badge: unrepliedReviewsCount > 0 ? unrepliedReviewsCount : undefined,
      hostOnly: true,
    },
  ]

  const visibleItems = navItems.filter((item) => !item.hostOnly || isHost)
  const displayName = getDisplayName(user) || 'Host'
  const isVerified = Boolean(user?.isVerifiedHost || profile?.isVerifiedHost)
  const isAccountBanned = Boolean(profile?.isBannedAllProperties)

  return (
    <>
      {/* Mobile / Tablet sticky horizontal pill rail (< lg) */}
      <div className="lg:hidden sticky top-14 z-20 bg-white border-b border-border px-4 py-2.5 overflow-x-auto hide-scrollbar">
        <nav aria-label="Host workspace navigation" className="flex items-center gap-2 w-max">
          {visibleItems.map((item) => {
            const active = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
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
                      'tabular-nums text-[11px] font-semibold px-1.5 py-0.2 rounded-full',
                      item.urgent
                        ? 'bg-accent-orange text-white'
                        : active
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-deep-teal border border-border'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Split-Sidebar Host Workspace */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-0 lg:h-[calc(100dvh-64px)] xl:h-[calc(100dvh-72px)] lg:overflow-hidden">
        <div className="flex items-start lg:items-stretch lg:h-full gap-8 xl:gap-10">
          {/* Desktop independent-scroll left sidebar */}
          <aside className="hidden lg:flex lg:flex-col lg:justify-between w-[260px] shrink-0 h-full overflow-y-auto overscroll-contain modern-scrollbar py-7 pr-6 border-r border-border">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-deep-teal px-3 mb-2">
                  Host Workspace
                </p>
                <nav aria-label="Host sections" className="space-y-1">
                  {visibleItems.map((item) => {
                    const active = activeTab === item.id
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectTab(item.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left',
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
                          <span
                            className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums',
                              item.urgent
                                ? 'bg-accent-orange text-white'
                                : 'bg-white border border-border text-deep-teal'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    !isAccountBanned && router.push('/profile/host/add-property')
                  }
                  disabled={isAccountBanned}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Add New Property</span>
                </button>

                {user?.id && isHost && (
                  <Link
                    href={`/hosts/${user.id}`}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-deep-teal border border-border hover:bg-off-white transition-colors"
                  >
                    <span>View Public Host Profile</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                )}
              </div>
            </div>

            <div className="pt-5 border-t border-border space-y-3">
              <div className="px-3">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-neutral-gray mt-0.5">
                  {isVerified ? 'Verified Host' : 'Standard Host Account'}
                </p>
              </div>
              <Link
                href="/profile"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-gray hover:text-deep-teal hover:bg-off-white/60 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Back to Guest Account</span>
              </Link>
            </div>
          </aside>

          {/* Right independent-scroll workspace pane */}
          <div className="min-w-0 flex-1 pb-24 lg:pb-10 lg:h-full lg:overflow-y-auto overscroll-contain modern-scrollbar lg:py-7 lg:pr-2 space-y-5">
            {/* Host Identity Verification Banner (Hallmark warm --off-white + clay shield) */}
            {!isVerified && (
              <div className="bg-off-white border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden p-1">
                    <Image
                      src={assetPath('/icons/clay-shield-verify.webp')}
                      alt="Verified Host Shield"
                      width={36}
                      height={36}
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-deep-teal">
                      Verify your host identity
                    </h4>
                    <p className="text-xs text-neutral-gray mt-0.5 leading-relaxed">
                      Build trust with pet parents and display the Verified Host seal across your stays.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/profile/verification')}
                  className="shrink-0 px-4 py-2 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Verify Identity
                </button>
              </div>
            )}

            {/* Account-wide Ban & Appeal Status Banner */}
            {profile?.isBannedAllProperties &&
              (profile.hasPendingUnbanAllPropertiesRequest ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">
                        Account Appeal Under Review
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        We will notify you once an administrator finishes reviewing your appeal.
                      </p>
                    </div>
                  </div>
                  {profile.suspensionReason && (
                    <div className="text-xs bg-white text-amber-950 rounded-xl p-3 border border-amber-200 mt-1">
                      <span className="font-semibold">Reason: </span>
                      {profile.suspensionReason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-red-800 leading-tight">
                          Your host account has been suspended
                        </p>
                        <span
                          className={cn(
                            'shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums',
                            (profile.unbanAllPropertiesRequestCount ?? 0) >= 2
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white text-red-700 border border-red-200'
                          )}
                        >
                          <Clock className="w-3 h-3" />
                          {Math.max(0, 2 - (profile.unbanAllPropertiesRequestCount ?? 0))}/2 appeals left
                        </span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">
                        {(profile.unbanAllPropertiesRequestCount ?? 0) >= 2
                          ? 'Maximum appeals reached for this suspension cycle.'
                          : 'All properties are temporarily paused and hidden from guests. Submit an appeal below for review.'}
                      </p>
                      {profile.suspensionReason && (
                        <div className="mt-2 text-xs bg-white text-red-900 rounded-xl p-3 border border-red-200">
                          <span className="font-semibold">Reason: </span>
                          {profile.suspensionReason}
                        </div>
                      )}
                      {profile.lastAppealNote && (
                        <div className="mt-2 text-xs bg-white text-foreground rounded-xl p-3 border border-border">
                          <span className="font-semibold">Previous Appeal Decision: </span>
                          {profile.lastAppealNote}
                        </div>
                      )}
                    </div>
                  </div>
                  {(profile.unbanAllPropertiesRequestCount ?? 0) < 2 && (
                    <button
                      type="button"
                      onClick={onOpenAppeal}
                      className="w-full sm:w-auto sm:self-end px-5 py-2.5 rounded-xl bg-white text-sm font-semibold text-red-700 border border-red-300 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      Submit Appeal
                    </button>
                  )}
                </div>
              ))}

            {children}
          </div>
        </div>
      </div>
    </>
  )
}
