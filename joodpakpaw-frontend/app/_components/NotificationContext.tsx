'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { refreshAccessToken } from '@/lib/authenUtils'
import { getNotifications, deleteAllNotifications, deleteNotificationById } from '@/lib/api'
import { AppNotification } from '@/types'

// localStorage only stores which IDs have been read — notifications themselves
// come from the API so they persist across devices.
const READ_IDS_KEY = 'joodpakpaw_read_ids'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  isConnected: boolean | null // null = connecting, true = connected, false = disconnected
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

// ─── Read-state helpers (device-local) ───────────────────────────────────────

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

// ─── Parser ──────────────────────────────────────────────────────────────────

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
    // Read state: prefer local override, fall back to server value
    isRead: readIds.has(id) || Boolean(data?.isRead ?? false),
    receivedAt: String(data?.createdAt ?? new Date().toISOString()),
    referenceId,
    referenceTable:
      typeof data?.referenceTable === 'string' ? data.referenceTable : undefined,
    roleName:
      typeof data?.roleName === 'string' ? data.roleName : undefined,
    actionName:
      typeof data?.actionName === 'string' ? data.actionName : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Fetch all notifications from the server
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const readIds = loadReadIds()
      const response = await getNotifications()
      const parsed = response.notifications.map((n) =>
        parseNotification(n, readIds)
      )
      console.log('[Notification] Fetched:', parsed)
      setNotifications(parsed)
    } catch {
      // Keep existing state on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on login
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      return
    }
    fetchNotifications()
  }, [isAuthenticated, fetchNotifications])

  // Prepend incoming socket notification (dedup by id)
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
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const readIds = loadReadIds()
      prev.forEach((n) => readIds.add(n.id))
      saveReadIds(readIds)
      return prev.map((n) => ({ ...n, isRead: true }))
    })
  }, [])

  const deleteOne = useCallback(async (id: string) => {
    await deleteNotificationById(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    await deleteAllNotifications()
    setNotifications([])
  }, [])

  // Socket lifecycle
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket()
      setIsConnected(null)
      return
    }

    setIsConnected(null)
    const socket = connectSocket()
    if (!socket) return

    // Debounce disconnect so brief proxy-caused reconnects don't flicker the UI
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null

    const onConnect = () => {
      console.log('[Socket] Connected')
      if (disconnectTimer) {
        clearTimeout(disconnectTimer)
        disconnectTimer = null
      }
      setIsConnected(true)
      fetchNotifications()
    }
    const onDisconnect = () => {
      console.log('[Socket] Disconnected — waiting to confirm...')
      disconnectTimer = setTimeout(async () => {
        console.log('[Socket] Confirmed disconnected — refreshing token and reconnecting')
        const newToken = await refreshAccessToken()
        disconnectSocket() // clear stale socket so connectSocket() creates a fresh one
        if (newToken) {
          setReconnectKey((k) => k + 1) // triggers effect re-run with fresh token
        } else {
          // Refresh failed — session truly expired
          console.warn('[Socket] Token refresh failed, staying disconnected')
          setIsConnected(false)
        }
      }, 4000)
    }
    const onNotification = (data: unknown) => {
      console.log('[Notification] Received:', data)
      addNotification(data)
    }

    socket.on('connect', onConnect)
    socket.on('connected', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('notification', onNotification)

    if (socket.connected) setIsConnected(true)

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      socket.off('connect', onConnect)
      socket.off('connected', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('notification', onNotification)
    }
  }, [isAuthenticated, reconnectKey, addNotification, fetchNotifications])

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
