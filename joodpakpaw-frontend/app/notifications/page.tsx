'use client'

import { useMemo, useState } from 'react'
import { Bell, LogIn, Search, Wifi, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/app/_components/NotificationContext'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { AppHeader } from '@/app/_components/AppHeader'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { Button } from '@/components/ui/button'

import { Tab } from './_constants'
import { filterByTab, groupByDate } from './_utils'
import { NotificationItem } from './_components/NotificationItem'
import { NotificationSkeleton } from './_components/NotificationSkeleton'
import { TabBar } from './_components/TabBar'
import { ActionsBar } from './_components/ActionsBar'
import { EmptyState } from './_components/EmptyState'

export default function NotificationsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const {
    notifications,
    isConnected,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteOne,
    clearAll,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const showHostTab = Boolean(
    user?.isVerifiedHost ||
      user?.role?.some((r) => r.name === 'host') ||
      notifications.some((n) => n.roleName === 'host')
  )
  const effectiveTab: Tab =
    !showHostTab && activeTab === 'host' ? 'all' : activeTab

  const tabFiltered = useMemo(
    () => filterByTab(notifications, effectiveTab),
    [notifications, effectiveTab]
  )
  const filteredUnread = useMemo(
    () => tabFiltered.filter((n) => !n.isRead).length,
    [tabFiltered]
  )
  const filtered = useMemo(
    () => (unreadOnly ? tabFiltered.filter((n) => !n.isRead) : tabFiltered),
    [tabFiltered, unreadOnly]
  )
  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const tabUnread = useMemo(
    () => ({
      all: notifications.filter((n) => !n.isRead).length,
      guest: notifications.filter((n) => !n.isRead && n.roleName === 'guest')
        .length,
      host: notifications.filter((n) => !n.isRead && n.roleName === 'host')
        .length,
    }),
    [notifications]
  )

  const connectionMenu =
    isConnected !== null ? (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
          isConnected
            ? 'text-deep-teal border-deep-teal/20 bg-deep-teal/5'
            : 'text-neutral-gray border-border bg-white'
        )}
        title={isConnected ? 'Live updates connected' : 'Offline'}
      >
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" />
        )}
        <span>{isConnected ? 'Live' : 'Offline'}</span>
      </span>
    ) : null

  return (
    <div className="min-h-screen bg-white">
      <div className="lg:hidden">
        <AppHeader
          title="Notifications"
          menu={isAuthenticated ? connectionMenu : undefined}
        />
      </div>

      <div className="max-w-3xl mx-auto px-0 sm:px-6 lg:px-8 pt-14 pb-24 lg:pt-8 lg:pb-12">
        {/* Desktop Editorial Header */}
        <div className="hidden lg:flex items-end justify-between pb-5 border-b border-border mb-5">
          <div className="space-y-1">
            <h1 className="font-bold text-deep-teal">Notifications</h1>
            <p className="text-sm text-neutral-gray">
              Stay updated on your bookings, pet stays, and account activity
            </p>
          </div>
          {isAuthenticated && <div>{connectionMenu}</div>}
        </div>

        {!authLoading && !isAuthenticated ? (
          <div className="mx-4 sm:mx-auto mt-6 rounded-2xl border border-border bg-white px-6 py-12 text-center max-w-md space-y-4">
            <div className="w-16 h-16 rounded-full bg-off-white border border-border flex items-center justify-center mx-auto">
              <Bell className="w-7 h-7 text-deep-teal" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-semibold text-deep-teal">
                Sign in to view notifications
              </h2>
              <p className="text-sm text-neutral-gray leading-relaxed">
                Track booking confirmations, payment updates, and host replies
                in real time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
              <Button
                type="button"
                onClick={() =>
                  openAuthModal('login', { returnUrl: '/notifications' })
                }
                className="h-11 px-6 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold cursor-pointer"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/')}
                className="h-11 px-5 rounded-xl border-border text-foreground hover:bg-off-white/70 font-medium cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" />
                Explore stays
              </Button>
            </div>
          </div>
        ) : (
          <div className="sm:rounded-2xl sm:border sm:border-border sm:overflow-hidden bg-white">
            <div className="sticky top-14 z-30 lg:top-0 bg-white">
              <TabBar
                activeTab={effectiveTab}
                tabUnread={tabUnread}
                showHostTab={showHostTab}
                onTabChange={setActiveTab}
              />

              {tabFiltered.length > 0 && (
                <ActionsBar
                  filteredUnread={filteredUnread}
                  unreadOnly={unreadOnly}
                  onToggleUnreadOnly={() => setUnreadOnly((prev) => !prev)}
                  onMarkAllRead={markAllAsRead}
                  onRequestClearAll={() => setClearConfirmOpen(true)}
                />
              )}
            </div>

            <div className="sm:bg-off-white/25 min-h-[360px]">
              {isLoading || authLoading ? (
                <NotificationSkeleton />
              ) : filtered.length === 0 ? (
                <EmptyState
                  activeTab={effectiveTab}
                  unreadOnly={unreadOnly}
                  onShowAll={() => setUnreadOnly(false)}
                />
              ) : (
                <div className="space-y-5 py-5 sm:px-5">
                  {grouped.map(({ label, items }) => (
                    <section key={label} className="space-y-2">
                      <h2 className="px-4 sm:px-1 text-xs font-semibold text-neutral-gray">
                        {label}
                      </h2>
                      <div className="bg-white sm:rounded-2xl overflow-hidden border-y sm:border border-border divide-y divide-border">
                        {items.map((n) => (
                          <NotificationItem
                            key={n.id}
                            notification={n}
                            onRead={markAsRead}
                            onDelete={deleteOne}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={async () => {
          setClearConfirmOpen(false)
          await clearAll()
        }}
        title="Clear all notifications?"
        message="This will permanently delete all of your notifications. This action cannot be undone."
        confirmButtonClassName="bg-red-600 hover:bg-red-700 text-white"
      />
    </div>
  )
}
