'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import { AppNotification } from '@/types'
import { getActionConfig, getNotificationRoute } from '../_utils'

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
  const timeAgo = formatDistanceToNow(new Date(notification.receivedAt), {
    addSuffix: true,
  })

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
    setTimeout(() => {
      isDragging.current = false
    }, 50)
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
      transition: { duration: 0.2, ease: 'easeIn' },
    })
    onDelete(notification.id)
  }

  return (
    <div className="overflow-hidden">
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_BTN_WIDTH, right: 0 }}
        dragElastic={0.08}
        animate={controls}
        onDragStart={() => {
          isDragging.current = true
        }}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex',
          width: `calc(100% + ${DELETE_BTN_WIDTH}px)`,
        }}
      >
        {/* Notification Row */}
        <div
          onClick={handleClick}
          className={cn(
            'group flex items-start gap-3 md:gap-4 px-4 md:px-6 py-4 cursor-pointer select-none flex-1 min-w-0 border-l-2 transition-colors',
            notification.isRead
              ? 'border-l-transparent bg-white hover:bg-off-white/40'
              : 'border-l-accent-orange bg-off-white/60 hover:bg-off-white/80'
          )}
        >
          {/* Action icon */}
          <div
            className={cn(
              'rounded-full flex items-center justify-center shrink-0 mt-0.5',
              'w-10 h-10 md:w-11 md:h-11',
              cfg.bg
            )}
          >
            <Icon className={cn('w-5 h-5', cfg.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={cn(
                  'leading-snug text-sm md:text-base transition-colors',
                  notification.isRead
                    ? 'font-normal text-foreground/85'
                    : 'font-semibold text-foreground'
                )}
              >
                {notification.title}
              </p>
              {!notification.isRead && (
                <span className="px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[11px] font-semibold leading-none shrink-0">
                  New
                </span>
              )}
            </div>

            {notification.message && (
              <div className="mt-1.5 pl-2.5 border-l-2 border-border">
                <p className="text-xs md:text-sm text-neutral-gray leading-relaxed line-clamp-2">
                  {notification.message}
                </p>
              </div>
            )}

            <p className="text-xs text-neutral-gray mt-1.5 tabular-nums">
              {timeAgo}
            </p>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(notification.id)
              }}
              aria-label="Delete notification"
              className="hidden md:flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-full hover:bg-red-50 text-neutral-gray hover:text-red-600 transition-opacity cursor-pointer"
              title="Delete notification"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {route && (
              <div className="w-6 h-6 rounded-full bg-deep-teal/10 flex items-center justify-center">
                <ChevronRight className="w-3.5 h-3.5 text-deep-teal" />
              </div>
            )}
          </div>
        </div>

        {/* Mobile swipe-to-delete action */}
        <button
          type="button"
          className="w-20 shrink-0 bg-red-600 flex flex-col items-center justify-center gap-1 cursor-pointer"
          onClick={handleDelete}
        >
          <Trash2 className="w-5 h-5 text-white" />
          <span className="text-xs font-medium text-white">Delete</span>
        </button>
      </motion.div>
    </div>
  )
}
