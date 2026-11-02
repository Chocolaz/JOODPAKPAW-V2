'use client'

import { CheckCheck, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  filteredUnread: number
  onMarkAllRead: () => void
  onClearAll: () => void
}

export function ActionsBar({ filteredUnread, onMarkAllRead, onClearAll }: Props) {
  return (
    <div className="flex items-center justify-between px-5 md:px-6 py-2.5 md:py-3.5 border-b border-gray-100 bg-white">
      <motion.p
        key={filteredUnread}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-xs md:text-sm text-neutral-gray"
      >
        {filteredUnread > 0 ? `${filteredUnread} unread` : 'All caught up'}
      </motion.p>

      <div className="flex items-center gap-4 md:gap-5">
        <AnimatePresence>
          {filteredUnread > 0 && (
            <motion.button
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              onClick={onMarkAllRead}
              className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm font-medium text-deep-teal hover:opacity-75 transition-opacity"
            >
              <CheckCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Mark all read
            </motion.button>
          )}
        </AnimatePresence>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm font-medium text-red-400 hover:opacity-75 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Clear all
        </button>
      </div>
    </div>
  )
}
