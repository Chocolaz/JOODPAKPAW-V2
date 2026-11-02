import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './tokenManager'

const SOCKET_URL = 'https://bscit.sit.kmutt.ac.th'
const SOCKET_PATH = '/capstone25/cp25nk2/api/socket.io'

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

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    query: { token },
    transports: ['polling'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
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
