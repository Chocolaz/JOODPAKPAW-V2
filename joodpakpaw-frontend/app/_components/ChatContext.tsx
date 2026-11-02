'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { addSocketListener } from '@/lib/socket'
import {
  getChatRooms,
  getChatRoomById,
  sendChatMessage,
  markChatMessagesAsRead,
  deleteChatRoom,
} from '@/lib/api'
import type { ChatRoom, ChatMessage } from '@/types/chat'

interface ChatContextType {
  rooms: ChatRoom[]
  roomMessages: Record<number, ChatMessage[]>
  unreadCount: number
  isLoading: boolean
  loadRoom: (id: number) => Promise<void>
  sendMessage: (roomId: number, content: string, images?: File[]) => Promise<void>
  markRoomAsRead: (roomId: number) => void
  markAsRead: (roomId: number) => void
  deleteRoom: (roomId: number) => Promise<void>
  refreshRooms: () => Promise<void>
}

const ChatContext = createContext<ChatContextType>({
  rooms: [],
  roomMessages: {},
  unreadCount: 0,
  isLoading: false,
  loadRoom: async () => {},
  sendMessage: async () => {},
  markRoomAsRead: () => {},
  markAsRead: () => {},
  deleteRoom: async () => {},
  refreshRooms: async () => {},
})

export const useChat = () => useContext(ChatContext)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({})
  const [isLoading, setIsLoading] = useState(false)

  const unreadCount = rooms.filter(
    (r) => !r.lastMessage?.readAt && r.lastMessage?.senderId !== user?.id
  ).length

  // Keep a ref to current rooms so socket handlers can access it without stale closure
  const roomsRef = useRef(rooms)
  useEffect(() => { roomsRef.current = rooms }, [rooms])

  // Track self-triggered markAsRead to suppress the self-echo from messages_read
  const selfMarkingRef = useRef<Set<number>>(new Set())

  const fetchRooms = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getChatRooms()
      setRooms(res.chatRooms)
    } catch {
      // keep existing state
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([])
      setRoomMessages({})
      return
    }
    fetchRooms()
  }, [isAuthenticated, fetchRooms])

  // Register persistent socket listeners — these survive socket reconnects
  // because addSocketListener stores them in the module-level registry
  const onNewMessage = useCallback((data: unknown) => {
    try {
      const raw = typeof data === 'string'
        ? (JSON.parse(data) as Record<string, unknown>)
        : (data as Record<string, unknown>)

      let roomId: number | null = null
      let message: ChatMessage | null = null

      // Format A: { roomId, message: {...} }
      if (raw?.roomId && raw?.message) {
        roomId = Number(raw.roomId)
        message = raw.message as ChatMessage
      }
      // Format B: flat message object { id, content, sender, ... }
      else if (raw?.id && raw?.sender) {
        message = raw as unknown as ChatMessage
        // Echo of own sent message — already added optimistically, skip
        if (message.sender.id === user?.id) return
        // Find room by matching sender to otherUser
        const room = roomsRef.current.find((r) => r.otherUser.id === message!.sender.id)
        if (room) roomId = room.id
      }

      if (!roomId || !message) {
        // New room not yet in state — refresh the room list
        fetchRooms()
        return
      }

      const rid = roomId
      const msg = message

      setRoomMessages((prev) => {
        const existing = prev[rid] ?? []
        if (existing.some((m) => m.id === msg.id)) return prev
        return { ...prev, [rid]: [...existing, msg] }
      })

      setRooms((prev) =>
        prev.map((r) =>
          r.id === rid
            ? {
                ...r,
                lastMessageAt: msg.createdAt,
                lastMessage: {
                  id: msg.id,
                  content: msg.content,
                  readAt: msg.sender.id === user?.id ? (msg.readAt ?? new Date().toISOString()) : null,
                  senderId: msg.sender.id,
                },
              }
            : r
        )
      )
    } catch {
      // ignore
    }
  }, [user?.id, fetchRooms])

  const onNewChatRoom = useCallback((data: unknown) => {
    try {
      const room = (typeof data === 'string' ? JSON.parse(data) : data) as ChatRoom
      if (!room?.id) return
      setRooms((prev) => {
        if (prev.some((r) => r.id === room.id)) return prev
        return [room, ...prev]
      })
    } catch {
      // ignore
    }
  }, [])

  const onMessagesRead = useCallback((data: unknown) => {
    try {
      const raw = typeof data === 'string'
        ? (JSON.parse(data) as Record<string, unknown>)
        : (data as Record<string, unknown>)
      const roomId = Number(raw?.roomId)
      const readAt = String(raw?.readAt ?? new Date().toISOString())
      if (!roomId) return

      // If this event was triggered by our own markAsRead call, skip updating
      // message readAt (the other user hasn't actually read our messages yet)
      if (selfMarkingRef.current.has(roomId)) {
        selfMarkingRef.current.delete(roomId)
        // Still update the room's unread state
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? { ...r, lastMessage: { ...r.lastMessage, readAt: r.lastMessage.readAt ?? readAt } }
              : r
          )
        )
        return
      }

      // Triggered by the other user reading — update own sent messages' readAt
      setRoomMessages((prev) => {
        if (!prev[roomId]) return prev
        return {
          ...prev,
          [roomId]: prev[roomId].map((m) => ({ ...m, readAt: m.readAt ?? readAt })),
        }
      })
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, lastMessage: { ...r.lastMessage, readAt: r.lastMessage.readAt ?? readAt } }
            : r
        )
      )
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    const unsubNew = addSocketListener('new_message', onNewMessage)
    const unsubRead = addSocketListener('messages_read', onMessagesRead)
    const unsubRoom = addSocketListener('new_chat_room', onNewChatRoom)
    return () => {
      unsubNew()
      unsubRead()
      unsubRoom()
    }
  }, [isAuthenticated, onNewMessage, onMessagesRead, onNewChatRoom])

  const loadRoom = useCallback(async (id: number) => {
    try {
      const detail = await getChatRoomById(id)
      setRoomMessages((prev) => ({ ...prev, [id]: detail.messages }))
    } catch {
      // keep existing
    }
  }, [])

  const sendMessage = useCallback(async (roomId: number, content: string, images?: File[]) => {
    const newMsg = await sendChatMessage(roomId, content, images)
    setRoomMessages((prev) => {
      const existing = prev[roomId] ?? []
      if (existing.some((m) => m.id === newMsg.id)) return prev
      return { ...prev, [roomId]: [...existing, newMsg] }
    })
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              lastMessageAt: newMsg.createdAt,
              // readAt set to now so the sender's own message doesn't appear as unread in the list
          lastMessage: { id: newMsg.id, content: newMsg.content, readAt: new Date().toISOString(), senderId: newMsg.sender.id },
            }
          : r
      )
    )
  }, [])

  const markRoomAsRead = useCallback((roomId: number) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, lastMessage: { ...r.lastMessage, readAt: new Date().toISOString() } }
          : r
      )
    )
  }, [])

  const deleteRoom = useCallback(async (roomId: number) => {
    await deleteChatRoom(roomId)
    setRooms((prev) => prev.filter((r) => r.id !== roomId))
    setRoomMessages((prev) => {
      const next = { ...prev }
      delete next[roomId]
      return next
    })
  }, [])

  /** Mark messages as read locally + via API, suppressing the self-echo from socket */
  const markAsRead = useCallback((roomId: number) => {
    markRoomAsRead(roomId)
    selfMarkingRef.current.add(roomId)
    markChatMessagesAsRead(roomId).catch(() => {}).finally(() => {
      // Keep the flag a bit longer than the API round-trip to catch the socket echo
      setTimeout(() => selfMarkingRef.current.delete(roomId), 3000)
    })
  }, [markRoomAsRead])

  return (
    <ChatContext.Provider
      value={{ rooms, roomMessages, unreadCount, isLoading, loadRoom, sendMessage, markRoomAsRead, markAsRead, deleteRoom, refreshRooms: fetchRooms }}
    >
      {children}
    </ChatContext.Provider>
  )
}
