'use client'

import { cn } from '@/lib/utils'
import { TABS, Tab } from '../_constants'

interface Props {
  activeTab: Tab
  tabUnread: Record<Tab, number>
  showHostTab?: boolean
  onTabChange: (tab: Tab) => void
}

export function TabBar({
  activeTab,
  tabUnread,
  showHostTab = true,
  onTabChange,
}: Props) {
  const visibleTabs = showHostTab
    ? TABS
    : TABS.filter((tab) => tab.id !== 'host')

  return (
    <div className="flex bg-white border-b border-border px-4 md:px-6">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id
        const count = tabUnread[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 md:px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer',
              isActive
                ? 'border-deep-teal text-deep-teal'
                : 'border-transparent text-neutral-gray hover:text-foreground'
            )}
          >
            <tab.Icon className="w-4 h-4 shrink-0" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  'min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center text-[10px] font-bold leading-none tabular-nums',
                  isActive
                    ? 'bg-accent-orange text-white'
                    : 'bg-accent-orange/15 text-accent-orange'
                )}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
