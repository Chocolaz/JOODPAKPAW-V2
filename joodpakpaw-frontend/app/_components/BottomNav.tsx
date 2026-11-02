'use client'

import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useNotifications } from '@/app/_components/NotificationContext'
import { useChat } from '@/app/_components/ChatContext'
import Link from 'next/link'
import { motion } from 'framer-motion'
import BellIcon from '@/public/icons/nav/Bell.svg'
import ChatIcon from '@/public/icons/nav/Chat.svg'
import HeartIcon from '@/public/icons/nav/Heart.svg'
import HomeIcon from '@/public/icons/nav/Home.svg'
import ProfileIcon from '@/public/icons/nav/Profile.svg'

export function BottomNav() {
  const normalizedPath = useNormalizedPathname()
  const { unreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()

  const hiddenPaths = ['/authen', '/admin', '/profile/']

  if (hiddenPaths.some((p) => normalizedPath.startsWith(p))) {
    return null
  }

  const navItems = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/favorites', label: 'Favorites', icon: HeartIcon },
    { href: '/chat', label: 'Chat', icon: ChatIcon },
    { href: '/notifications', label: 'Notifications', icon: BellIcon },
    { href: '/profile', label: 'Profile', icon: ProfileIcon },
  ]

  return (
    <nav className="lg:hidden fixed bottom-4 left-0 right-0 mx-auto bg-white border border-black/20 shadow-lg rounded-[10px] max-w-[500px] w-[90%]">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = item.href === '/chat'
            ? normalizedPath === '/chat' || normalizedPath.startsWith('/chat/')
            : normalizedPath === item.href
          const badgeCount =
            item.href === '/notifications' ? unreadCount :
            item.href === '/chat' ? chatUnreadCount : 0
          const showBadge = badgeCount > 0

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex flex-col items-center justify-center w-full ${isActive ? 'pt-3 pb-2' : 'pt-4 pb-3'}`}
            >
              <motion.div
                className="absolute top-0 w-10 h-[3px] rounded-full bg-accent-orange"
                initial={false}
                animate={{ scaleX: isActive ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />

              {/* Icon wrapper — relative so badge can be positioned inside */}
              <div className="relative">
                <item.icon
                  className={`w-6 h-6 transition-colors duration-300 ${
                    isActive ? 'text-accent-orange' : 'text-gray-500'
                  }`}
                />

                {/* Unread badge */}
                {showBadge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-accent-orange rounded-full flex items-center justify-center"
                  >
                    <span className="text-white text-[9px] font-bold leading-none">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  </motion.span>
                )}
              </div>

              <motion.div
                className="overflow-hidden"
                initial={false}
                animate={{ height: isActive ? 'auto' : 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-xs font-medium text-accent-orange baloo2 pt-1">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
