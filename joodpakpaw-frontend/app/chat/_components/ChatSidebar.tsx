'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { assetPath } from '@/lib/utils'
import type { ChatRoom } from '@/types/chat'

function formatTime(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function RoomItem({
  room,
  isActive,
  onClick,
  currentUserId,
}: {
  room: ChatRoom
  isActive: boolean
  onClick: () => void
  currentUserId?: number
}) {
  const name = `${room.otherUser.firstName} ${room.otherUser.lastName}`
  const isUnread = room.lastMessage.senderId !== currentUserId && !room.lastMessage.readAt

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors duration-150 ${
        isActive ? 'bg-accent-orange/8' : isUnread ? 'bg-accent-orange/5 hover:bg-accent-orange/10' : 'hover:bg-gray-50'
      }`}
    >
      <div className="relative shrink-0">
        {room.otherUser.avatar ? (
          <div className="relative w-11 h-11 lg:w-13 lg:h-13">
            <Image src={room.otherUser.avatar} alt={name} fill className="rounded-full object-cover" />
            {isUnread && (
              <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-accent-orange border-2 border-white" />
            )}
          </div>
        ) : (
          <div className="relative w-11 h-11 lg:w-13 lg:h-13 rounded-full bg-deep-teal/10 flex items-center justify-center">
            <span className="text-deep-teal font-semibold text-sm lg:text-base">{name.charAt(0).toUpperCase()}</span>
            {isUnread && (
              <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-accent-orange border-2 border-white" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm lg:text-base truncate min-w-0 ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {name}
          </span>
          <span className={`text-[10px] lg:text-xs shrink-0 ${isUnread ? 'text-accent-orange font-medium' : 'text-neutral-gray'}`}>
            {formatTime(room.lastMessageAt)}
          </span>
        </div>
        <p className={`text-xs lg:text-sm truncate mt-0.5 flex items-center gap-1 ${isUnread ? 'text-gray-700 font-medium' : 'text-neutral-gray'}`}>
          {room.lastMessage.content || (
            <>
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Photo</span>
            </>
          )}
        </p>
      </div>

      {isActive && <div className="w-1 h-8 rounded-full bg-accent-orange shrink-0" />}
    </motion.button>
  )
}

function SkeletonItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  )
}

interface ChatSidebarProps {
  activeRoomId?: number
}

export function ChatSidebar({ activeRoomId }: ChatSidebarProps) {
  const { rooms, isLoading } = useChat()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [query, setQuery] = useState('')

  const sorted = [...rooms].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )

  const filtered = query.trim()
    ? sorted.filter((r) => {
        const name = `${r.otherUser.firstName} ${r.otherUser.lastName}`.toLowerCase()
        return name.includes(query.toLowerCase())
      })
    : sorted

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="px-4 pt-[calc(3.5rem+1rem)] lg:pt-4 pb-3 border-b border-gray-100 shrink-0">
        <h2 className="text-lg lg:text-xl font-semibold text-deep-teal mb-3">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-gray" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 lg:py-2.5 text-sm lg:text-base rounded-full bg-gray-100 border-none outline-none focus:ring-2 focus:ring-accent-orange/30 transition-all"
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-gray-50">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)}
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-2 text-neutral-gray"
            >
              <Image src={assetPath('/graphics/no-chat.png')} alt="No messages" width={100} height={100} className="opacity-80" />
              <p className="text-sm">{query ? 'No results found' : 'No messages yet'}</p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {filtered.map((room) => (
                <RoomItem
                  key={room.id}
                  room={room}
                  isActive={room.id === activeRoomId}
                  onClick={() => router.push(from ? `/chat/${room.id}?from=${encodeURIComponent(from)}` : `/chat/${room.id}`)}
                  currentUserId={user?.id}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
