'use client'

import { CheckCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  filteredUnread: number
  unreadOnly: boolean
  onToggleUnreadOnly: () => void
  onMarkAllRead: () => void
  onRequestClearAll: () => void
}

export function ActionsBar({
  filteredUnread,
  unreadOnly,
  onToggleUnreadOnly,
  onMarkAllRead,
  onRequestClearAll,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border bg-off-white/30">
      <div className="flex items-center gap-3">
        <p className="text-xs md:text-sm text-neutral-gray tabular-nums">
          {filteredUnread > 0 ? `${filteredUnread} unread` : 'All caught up'}
        </p>

        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={onToggleUnreadOnly}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
            unreadOnly
              ? 'bg-deep-teal text-white border-deep-teal'
              : 'bg-white text-neutral-gray border-border hover:text-foreground'
          )}
        >
          Unread only
        </button>
      </div>

      <div className="flex items-center gap-4">
        {filteredUnread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-deep-teal hover:opacity-75 transition-opacity cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        )}
        <button
          type="button"
          onClick={onRequestClearAll}
          className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-red-600 hover:opacity-75 transition-opacity cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear all</span>
        </button>
      </div>
    </div>
  )
}
