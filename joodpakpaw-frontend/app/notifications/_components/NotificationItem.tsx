'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import { AppNotification } from '@/types'
import { getActionConfig, getNotificationRoute } from '../_utils'
import { itemVariants } from '../_variants'

const SWIPE_THRESHOLD = 40
const DELETE_BTN_WIDTH = 80

interface Props {
  notification: AppNotification
  onRead: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

export function NotificationItem({ notification, onRead, onDelete }: Props) {
  const router = useRouter()
  const cfg = getActionConfig(notification.actionName, notification.roleName)
  const { Icon } = cfg
  const timeAgo = formatDistanceToNow(new Date(notification.receivedAt), { addSuffix: true })

  const route = getNotificationRoute(notification)
  const controls = useAnimation()
  const isDragging = useRef(false)
  const isOpen = useRef(false)

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      controls.start({ x: -DELETE_BTN_WIDTH })
      isOpen.current = true
    } else {
      controls.start({ x: 0 })
      isOpen.current = false
    }
    setTimeout(() => { isDragging.current = false }, 50)
  }

  const handleClick = () => {
    if (isDragging.current) return
    if (isOpen.current) {
      controls.start({ x: 0 })
      isOpen.current = false
      return
    }
    onRead(notification.id)
    if (route) {
      router.push(`${route}?from=notifications`)
    }
  }

  const handleDelete = async () => {
    await controls.start({
      x: -400,
      opacity: 0,
      transition: { duration: 0.25, ease: 'easeIn' },
    })
    onDelete(notification.id)
  }

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="overflow-hidden"
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_BTN_WIDTH, right: 0 }}
        dragElastic={0.08}
        animate={controls}
        onDragStart={() => { isDragging.current = true }}
        onDragEnd={handleDragEnd}
        style={{ display: 'flex', width: `calc(100% + ${DELETE_BTN_WIDTH}px)` }}
      >
        {/* Card */}
        <div
          onClick={handleClick}
          className={cn(
            'flex items-start gap-3 md:gap-4 px-4 md:px-6 py-3.5 md:py-5 cursor-pointer select-none flex-1 min-w-0',
            notification.isRead ? 'bg-white' : 'bg-orange-50'
          )}
        >
          {/* Action icon */}
          <div className={cn(
            'rounded-full flex items-center justify-center shrink-0 mt-0.5',
            'w-10 h-10 md:w-12 md:h-12',
            cfg.bg
          )}>
            <Icon className={cn('w-5 h-5 md:w-6 md:h-6', cfg.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              'leading-snug transition-all duration-300',
              'text-sm md:text-base',
              notification.isRead ? 'font-normal text-gray-600' : 'font-semibold text-gray-900'
            )}>
              {notification.title}
            </p>
            {notification.message && (
              <div className="mt-2 pl-2.5 border-l-2 border-gray-200">
                <p className="text-xs md:text-sm text-neutral-gray/80 leading-relaxed line-clamp-2">
                  {notification.message}
                </p>
              </div>
            )}
            <p className="text-[11px] md:text-xs text-neutral-gray/70 mt-1 md:mt-1.5">{timeAgo}</p>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 mt-1">
            <AnimatePresence>
              {!notification.isRead && (
                <motion.span
                  key="dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-accent-orange"
                />
              )}
            </AnimatePresence>
            {route && (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-accent-orange/10 flex items-center justify-center">
                <ChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5 text-accent-orange" />
              </div>
            )}
          </div>
        </div>

        {/* Delete button — hidden until swiped */}
        <div
          className="w-20 shrink-0 bg-red-500 flex flex-col items-center justify-center gap-1 cursor-pointer"
          onClick={handleDelete}
        >
          <Trash2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
          <span className="text-[10px] md:text-xs font-medium text-white">Delete</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
