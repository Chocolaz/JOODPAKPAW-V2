'use client'

import { useMemo, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/app/_components/NotificationContext'
import { AppHeader } from '@/app/_components/AppHeader'

import { Tab } from './_constants'
import { filterByTab, groupByDate } from './_utils'
import { listVariants, groupVariants, emptyVariants } from './_variants'
import { NotificationItem } from './_components/NotificationItem'
import { NotificationSkeleton } from './_components/NotificationSkeleton'
import { TabBar } from './_components/TabBar'
import { ActionsBar } from './_components/ActionsBar'
import { EmptyState } from './_components/EmptyState'

export default function NotificationsPage() {
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

  const filtered = useMemo(
    () => filterByTab(notifications, activeTab),
    [notifications, activeTab]
  )
  const filteredUnread = useMemo(
    () => filtered.filter((n) => !n.isRead).length,
    [filtered]
  )
  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const tabUnread = useMemo(() => ({
    all: notifications.filter((n) => !n.isRead).length,
    guest: notifications.filter((n) => !n.isRead && n.roleName === 'guest').length,
    host: notifications.filter((n) => !n.isRead && n.roleName === 'host').length,
  }), [notifications])

  const connectionMenu = (
    <AnimatePresence mode="wait">
      {isConnected !== null && (
        <motion.span
          key={isConnected ? 'on' : 'off'}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'flex items-center gap-1.5 text-[11px] md:text-xs font-medium',
            isConnected ? 'text-emerald-500' : 'text-gray-400'
          )}
          title={isConnected ? 'Connected' : 'Disconnected'}
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
          <span className="hidden md:inline">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  )

  return (
    <div>
      <div className="lg:hidden"><AppHeader title="Notifications" menu={connectionMenu} /></div>

      {/* Centered content container for tablet/desktop */}
      <div className="md:max-w-2xl lg:max-w-3xl md:mx-auto md:mt-4 md:px-4 lg:px-0">

        <div className="md:rounded-2xl md:border md:border-gray-100 md:shadow-sm md:overflow-hidden">
          <div className="sticky top-14 z-30 lg:top-0">
            <TabBar activeTab={activeTab} tabUnread={tabUnread} onTabChange={setActiveTab} />

            {/* Actions sub-bar */}
            <AnimatePresence>
              {filtered.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <ActionsBar
                    filteredUnread={filteredUnread}
                    onMarkAllRead={markAllAsRead}
                    onClearAll={clearAll}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Body */}
          <div className="pb-24 md:pb-8 md:bg-gray-50/50">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NotificationSkeleton />
                </motion.div>
              ) : filtered.length === 0 ? (
                <motion.div
                  key={`empty-${activeTab}`}
                  variants={emptyVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <EmptyState activeTab={activeTab} />
                </motion.div>
              ) : (
                <motion.div
                  key={`list-${activeTab}`}
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4 pt-8"
                >
                  <AnimatePresence>
                    {grouped.map(({ label, items }) => (
                      <motion.div
                        key={label}
                        variants={groupVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                      >
                        <p className="px-4 md:px-5 py-1.5 text-[11px] md:text-xs font-semibold text-neutral-gray uppercase tracking-wider">
                          {label}
                        </p>
                        <div className="bg-white md:rounded-2xl mx-4 md:mx-5 overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-100">
                          <AnimatePresence>
                            {items.map((n) => (
                              <NotificationItem
                                key={n.id}
                                notification={n}
                                onRead={markAsRead}
                                onDelete={deleteOne}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  )
}
