'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from './AuthContext'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { refreshAccessToken } from '@/lib/authenUtils'
import {
  getNotifications,
  deleteAllNotifications,
  deleteNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/api'
import { AppNotification } from '@/types'
import { getNotificationRoute } from '@/app/notifications/_utils'

const READ_IDS_KEY = 'joodpakpaw_read_ids'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  isConnected: boolean | null
  isLoading: boolean
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteOne: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isConnected: null,
  isLoading: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  deleteOne: async () => {},
  clearAll: async () => {},
})

export const useNotifications = () => useContext(NotificationContext)

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

function parseNotification(
  raw: unknown,
  readIds: Set<string>
): AppNotification {
  const data =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : (raw as Record<string, unknown>)

  const id = String(data?.id ?? Date.now())

  const referenceId =
    typeof data?.referenceId === 'number'
      ? data.referenceId
      : typeof data?.referenceId === 'string'
        ? parseInt(data.referenceId, 10) || undefined
        : undefined

  return {
    id,
    type: String(data?.type ?? 'info'),
    category: String(data?.category ?? 'general'),
    title: String(data?.title ?? 'Notification'),
    message: String(data?.message ?? ''),
    isRead: readIds.has(id) || Boolean(data?.isRead ?? false),
    receivedAt: String(data?.createdAt ?? new Date().toISOString()),
    referenceId,
    referenceTable:
      typeof data?.referenceTable === 'string'
        ? data.referenceTable
        : undefined,
    roleName:
      typeof data?.roleName === 'string' ? data.roleName : undefined,
    actionName:
      typeof data?.actionName === 'string' ? data.actionName : undefined,
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, refreshAuth } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const readIds = loadReadIds()
      const response = await getNotifications()
      const parsed = response.notifications.map((n) =>
        parseNotification(n, readIds)
      )
      setNotifications(parsed)
    } catch {
      // Keep existing state on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      queueMicrotask(() => setNotifications([]))
      return
    }
    fetchNotifications()
  }, [isAuthenticated, fetchNotifications])

  const addNotification = useCallback((raw: unknown) => {
    try {
      const readIds = loadReadIds()
      const notification = parseNotification(raw, readIds)
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev
        return [notification, ...prev]
      })
    } catch {
      // ignore malformed data
    }
  }, [])

  const markAsRead = useCallback((id: string) => {
    const readIds = loadReadIds()
    readIds.add(id)
    saveReadIds(readIds)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
    markNotificationAsRead(id).catch(() => {})
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const readIds = loadReadIds()
      prev.forEach((n) => readIds.add(n.id))
      saveReadIds(readIds)
      return prev.map((n) => ({ ...n, isRead: true }))
    })
    markAllNotificationsAsRead().catch(() => {})
  }, [])

  const deleteOne = useCallback(async (id: string) => {
    await deleteNotificationById(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    await deleteAllNotifications()
    setNotifications([])
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket()
      queueMicrotask(() => setIsConnected(null))
      return
    }

    queueMicrotask(() => setIsConnected(null))
    const socket = connectSocket()
    if (!socket) return

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null

    const onConnect = () => {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer)
        disconnectTimer = null
      }
      setIsConnected(true)
      fetchNotifications()
    }
    const onDisconnect = () => {
      disconnectTimer = setTimeout(async () => {
        const newToken = await refreshAccessToken()
        disconnectSocket()
        if (newToken) {
          setReconnectKey((k) => k + 1)
        } else {
          setIsConnected(false)
        }
      }, 4000)
    }
    const onNotification = (data: unknown) => {
      try {
        const readIds = loadReadIds()
        const notif = parseNotification(data, readIds)
        addNotification(data)

        const route = getNotificationRoute(notif)
        toast(notif.title, {
          description: notif.message,
          action: route
            ? {
                label: 'View',
                onClick: () => router.push(`${route}?from=toast`),
              }
            : undefined,
        })

        const govEvents = [
          'kyc_approved',
          'kyc_rejected',
          'property_banned',
          'property_unbanned',
          'account_banned',
          'account_unbanned',
        ]
        const rawObj =
          typeof data === 'object' && data !== null
            ? (data as Record<string, unknown>)
            : {}
        const eventName = String(
          rawObj.actionName ??
            rawObj.type ??
            notif.actionName ??
            notif.type ??
            ''
        )
        if (govEvents.includes(eventName)) {
          refreshAuth().catch(() => {})
        }
      } catch {
        // ignore malformed notification payload
      }
    }

    socket.on('connect', onConnect)
    socket.on('connected', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('notification', onNotification)

    if (socket.connected) {
      queueMicrotask(() => setIsConnected(true))
    }

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      socket.off('connect', onConnect)
      socket.off('connected', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('notification', onNotification)
    }
  }, [
    isAuthenticated,
    reconnectKey,
    addNotification,
    fetchNotifications,
    refreshAuth,
    router,
  ])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteOne,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
