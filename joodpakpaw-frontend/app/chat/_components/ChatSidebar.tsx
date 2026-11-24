'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Search, ImageIcon, Calendar, Building2 } from 'lucide-react'
import { useState } from 'react'
import { useChat } from '@/app/_components/ChatContext'
import { useAuth } from '@/app/_components/AuthContext'
import { assetPath, cn, getDisplayName } from '@/lib/utils'
import type { ChatRoom } from '@/types/chat'

function formatTime(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
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
  const name = getDisplayName(room.otherUser) || 'User'
  const isUnread = Boolean(
    room.lastMessage &&
      room.lastMessage.senderId !== currentUserId &&
      !room.lastMessage.readAt
  )
  const contextLabel =
    room.activeBooking?.propertyTitle ?? room.contextProperty?.title ?? null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors border-l-2 cursor-pointer',
        isActive
          ? 'border-l-deep-teal bg-deep-teal/[0.06]'
          : isUnread
            ? 'border-l-accent-orange bg-accent-orange/[0.04] hover:bg-accent-orange/[0.08]'
            : 'border-l-transparent hover:bg-off-white/60'
      )}
    >
      <div className="relative shrink-0">
        {room.otherUser.avatar ? (
          <div className="relative w-11 h-11 lg:w-12 lg:h-12 rounded-full overflow-hidden border border-border bg-off-white">
            <Image
              src={room.otherUser.avatar}
              alt={name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-deep-teal/10 border border-deep-teal/15 flex items-center justify-center">
            <span className="text-deep-teal font-semibold text-sm lg:text-base">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm truncate min-w-0',
              isUnread || isActive
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/85'
            )}
          >
            {name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isUnread && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[10px] font-semibold leading-none">
                New
              </span>
            )}
            <span
              className={cn(
                'text-[11px] tabular-nums',
                isUnread
                  ? 'text-accent-orange font-semibold'
                  : 'text-neutral-gray'
              )}
            >
              {room.lastMessageAt ? formatTime(room.lastMessageAt) : ''}
            </span>
          </div>
        </div>

        {contextLabel && (
          <p className="text-[11px] text-deep-teal font-medium truncate flex items-center gap-1">
            {room.activeBooking ? (
              <Calendar className="w-3 h-3 shrink-0 text-accent-orange" />
            ) : (
              <Building2 className="w-3 h-3 shrink-0 text-deep-teal" />
            )}
            <span className="truncate">{contextLabel}</span>
          </p>
        )}

        <p
          className={cn(
            'text-xs truncate flex items-center gap-1',
            isUnread ? 'text-foreground font-medium' : 'text-neutral-gray'
          )}
        >
          {room.lastMessage ? (
            room.lastMessage.content || (
              <>
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Photo</span>
              </>
            )
          ) : (
            <span className="italic text-neutral-gray">
              Start a conversation
            </span>
          )}
        </p>
      </div>
    </button>
  )
}

function SkeletonItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse motion-reduce:animate-none">
      <div className="w-11 h-11 rounded-full bg-neutral-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-neutral-200 rounded w-1/3" />
        <div className="h-3 bg-neutral-200 rounded w-2/3" />
      </div>
    </div>
  )
}

interface ChatSidebarProps {
  activeRoomId?: number
}

export function ChatSidebar({ activeRoomId }: ChatSidebarProps) {
  const { rooms, isLoading } = useChat()
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')

  const totalUnreadCount = rooms.filter(
    (r) =>
      r.lastMessage &&
      r.lastMessage.senderId !== user?.id &&
      !r.lastMessage.readAt
  ).length

  const sorted = [...rooms].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )

  const byTab =
    activeTab === 'unread'
      ? sorted.filter(
          (r) =>
            r.lastMessage &&
            r.lastMessage.senderId !== user?.id &&
            !r.lastMessage.readAt
        )
      : sorted

  const filtered = query.trim()
    ? byTab.filter((r) => {
        const q = query.toLowerCase()
        const name = getDisplayName(r.otherUser).toLowerCase()
        const context = (
          r.activeBooking?.propertyTitle ??
          r.contextProperty?.title ??
          ''
        ).toLowerCase()
        return name.includes(q) || context.includes(q)
      })
    : byTab

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sidebar header — clean single top spacing on Mobile & Desktop */}
      <div className="px-4 py-3.5 border-b border-border bg-white shrink-0 space-y-3">
        <h1 className="hidden lg:block font-bold text-deep-teal">Messages</h1>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-gray" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or stays..."
            className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl bg-off-white/60 border border-border outline-none focus:bg-white focus:border-deep-teal transition-colors"
          />
        </div>

        {/* All / Unread Filter Pills */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
              activeTab === 'all'
                ? 'bg-deep-teal text-white'
                : 'bg-off-white/80 text-neutral-gray hover:text-foreground'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer',
              activeTab === 'unread'
                ? 'bg-accent-orange text-white'
                : 'bg-off-white/80 text-neutral-gray hover:text-foreground'
            )}
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums leading-none',
                  activeTab === 'unread'
                    ? 'bg-white text-accent-orange'
                    : 'bg-accent-orange text-white'
                )}
              >
                {totalUnreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain modern-scrollbar divide-y divide-border/60">
        {isLoading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-2 text-neutral-gray">
            <Image
              src={assetPath('/graphics/no-chat.png')}
              alt="Messages"
              width={96}
              height={96}
              className="opacity-80"
            />
            <p className="text-sm font-medium text-foreground">
              Sign in to view conversations
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-2 text-neutral-gray">
            <Image
              src={assetPath('/graphics/no-chat.png')}
              alt="No messages"
              width={96}
              height={96}
              className="opacity-80"
            />
            <p className="text-sm">
              {query
                ? 'No matching conversations'
                : activeTab === 'unread'
                  ? 'No unread messages'
                  : 'No messages yet'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                onClick={() =>
                  router.push(
                    from
                      ? `/chat/${room.id}?from=${encodeURIComponent(from)}`
                      : `/chat/${room.id}`
                  )
                }
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
