'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { TABS, Tab } from '../_constants'

interface Props {
  activeTab: Tab
  tabUnread: Record<Tab, number>
  onTabChange: (tab: Tab) => void
}

export function TabBar({ activeTab, tabUnread, onTabChange }: Props) {
  return (
    <div className="flex bg-white border-b border-gray-100 px-4 md:px-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const count = tabUnread[tab.id]
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-3 md:py-4 text-sm md:text-base font-medium transition-colors duration-200"
          >
            <tab.Icon className={cn('w-3.5 h-3.5 md:w-4.5 md:h-4.5', isActive ? 'text-accent-orange' : 'text-gray-400')} />
            <span className={isActive ? 'text-accent-orange' : 'text-gray-400'}>
              {tab.label}
            </span>
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="min-w-4 md:min-w-5 h-4 md:h-5 px-1 bg-accent-orange rounded-full flex items-center justify-center"
              >
                <span className="text-white text-[9px] md:text-[10px] font-bold leading-none">
                  {count > 9 ? '9+' : count}
                </span>
              </motion.span>
            )}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-orange rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
