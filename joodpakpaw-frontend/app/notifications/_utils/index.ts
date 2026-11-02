import { format, isToday, isYesterday } from 'date-fns'
import { Bell } from 'lucide-react'
import { AppNotification } from '@/types'
import { ACTION_CONFIG, BOOKING_DETAIL_ACTIONS, Tab } from '../_constants'

export function getActionConfig(actionName?: string, roleName?: string) {
  const entry = ACTION_CONFIG[actionName ?? '']
  if (!entry) return { Icon: Bell, color: 'text-deep-teal', bg: 'bg-deep-teal/10' }
  return roleName === 'host' ? entry.host : entry.guest
}

export function getTimeLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

export function groupByDate(
  notifications: AppNotification[]
): { label: string; items: AppNotification[] }[] {
  const groups: Record<string, AppNotification[]> = {}
  for (const n of notifications) {
    const label = getTimeLabel(new Date(n.receivedAt))
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

export function getNotificationRoute(notification: AppNotification): string | null {
  const { actionName, roleName, referenceId, referenceTable } = notification

  if (
    (BOOKING_DETAIL_ACTIONS.has(actionName ?? '') || referenceTable === 'bookings') &&
    referenceId
  ) {
    return roleName === 'host'
      ? `/profile/host/booking/${referenceId}`
      : `/profile/bookings/${referenceId}`
  }

  if (actionName === 'report' && roleName === 'host') {
    return '/profile/host'
  }

  if (actionName === 'report' && roleName === 'guest' && referenceId) {
    return `/profile/reports/${referenceId}`
  }

  if (actionName === 'verification') {
    return '/profile/verification'
  }

  return null
}

export function filterByTab(notifications: AppNotification[], tab: Tab): AppNotification[] {
  if (tab === 'guest') return notifications.filter((n) => n.roleName === 'guest')
  if (tab === 'host') return notifications.filter((n) => n.roleName === 'host')
  return notifications
}
