'use client'

import { Bell } from 'lucide-react'
import { Tab } from '../_constants'
import { Button } from '@/components/ui/button'

const EMPTY_MESSAGES: Record<Tab, string> = {
  guest: 'No guest notifications yet.',
  host: 'No host notifications yet.',
  all: "You'll see booking updates, KYC status, and messages here.",
}

interface Props {
  activeTab: Tab
  unreadOnly?: boolean
  onShowAll?: () => void
}

export function EmptyState({ activeTab, unreadOnly = false, onShowAll }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-off-white border border-border flex items-center justify-center">
        <Bell className="w-7 h-7 text-deep-teal/60" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="font-semibold text-foreground">
          {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
        </p>
        <p className="text-sm text-neutral-gray">
          {unreadOnly
            ? 'You are caught up on this view.'
            : EMPTY_MESSAGES[activeTab]}
        </p>
      </div>
      {unreadOnly && onShowAll && (
        <Button
          type="button"
          variant="outline"
          onClick={onShowAll}
          className="rounded-xl border-border text-deep-teal hover:bg-off-white/70 cursor-pointer"
        >
          Show all notifications
        </Button>
      )}
    </div>
  )
}
