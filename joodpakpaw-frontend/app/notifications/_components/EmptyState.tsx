'use client'

import { Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { Tab } from '../_constants'

const EMPTY_MESSAGES: Record<Tab, string> = {
  guest: 'No guest notifications yet.',
  host: 'No host notifications yet.',
  all: "You'll see booking updates and messages here.",
}

interface Props {
  activeTab: Tab
}

export function EmptyState({ activeTab }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 md:gap-6 px-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gray-100 flex items-center justify-center"
      >
        <Bell className="w-9 h-9 md:w-12 md:h-12 text-gray-300" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-center space-y-1 md:space-y-2"
      >
        <p className="font-semibold text-gray-700 md:text-lg">No notifications yet</p>
        <p className="text-sm md:text-base text-neutral-gray">{EMPTY_MESSAGES[activeTab]}</p>
      </motion.div>
    </div>
  )
}
