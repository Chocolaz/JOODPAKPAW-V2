import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './tokenManager'

function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin
    } catch {
      // fallback
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:8000'
}

const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/api/socket.io'

let socket: Socket | null = null

// Listeners registered here are automatically re-attached to every new socket instance
type Listener = (...args: unknown[]) => void
const persistentListeners = new Map<string, Set<Listener>>()

function applyPersistentListeners(s: Socket) {
  persistentListeners.forEach((listeners, event) => {
    listeners.forEach((fn) => s.on(event, fn))
  })
}

export function connectSocket(): Socket | null {
  if (typeof window === 'undefined') return null

  const token = getAccessToken()
  if (!token) return null

  if (socket?.connected) return socket

  if (socket) {
    socket.disconnect()
    socket = null
  }

  const socketUrl = getSocketUrl()

  socket = io(socketUrl, {
    path: SOCKET_PATH,
    query: { token },
    auth: { token },
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message)
  })

  socket.on('error', (err) => {
    console.error('[Socket.IO] Socket error:', err)
  })

  applyPersistentListeners(socket)

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket(): Socket | null {
  return socket
}

/** Register a listener that survives socket reconnects. Returns an unsubscribe fn. */
export function addSocketListener(event: string, fn: Listener): () => void {
  if (!persistentListeners.has(event)) {
    persistentListeners.set(event, new Set())
  }
  persistentListeners.get(event)!.add(fn)
  socket?.on(event, fn)

  return () => removeSocketListener(event, fn)
}

export function removeSocketListener(event: string, fn: Listener): void {
  persistentListeners.get(event)?.delete(fn)
  socket?.off(event, fn)
}

export function emitSocketEvent(event: string, data?: unknown): void {
  socket?.emit(event, data)
}
