import { format, isToday, isYesterday } from 'date-fns'
import { Bell } from 'lucide-react'
import { AppNotification } from '@/types'
import { ACTION_CONFIG, BOOKING_DETAIL_ACTIONS, Tab } from '../_constants'

export function normalizeActionName(actionName?: string): string {
  if (!actionName) return ''
  const name = actionName.toLowerCase()
  if (name.includes('cancel')) return 'cancel'
  if (name.includes('reminder')) return 'reminder'
  if (name.includes('payment') || name.includes('slip')) return 'payment'
  if (name.includes('review')) return 'review'
  if (name.includes('booking')) return 'booking'
  if (name.includes('kyc') || name.includes('verification') || name.includes('identity')) return 'verification'
  if (name.includes('report') || name.includes('ban') || name.includes('appeal') || name.includes('ticket')) return 'report'
  return name
}

export function getActionConfig(actionName?: string, roleName?: string) {
  const normalized = normalizeActionName(actionName)
  const entry = ACTION_CONFIG[normalized] ?? ACTION_CONFIG[actionName ?? '']
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
  const { roleName, referenceId, referenceTable } = notification
  const actionName = normalizeActionName(notification.actionName)

  if (
    (BOOKING_DETAIL_ACTIONS.has(actionName) || referenceTable === 'bookings' || referenceTable === 'booking') &&
    referenceId
  ) {
    return roleName === 'host'
      ? `/profile/host/booking/${referenceId}`
      : `/profile/bookings/${referenceId}`
  }

  if (actionName === 'report') {
    if (roleName === 'host') return '/profile/host'
    if (referenceId) return `/profile/reports/${referenceId}`
    return '/profile/reports'
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
