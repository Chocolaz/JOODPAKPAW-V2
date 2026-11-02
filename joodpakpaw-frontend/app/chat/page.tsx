'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useAuth } from '@/app/_components/AuthContext'
import { assetPath } from '@/lib/utils'
import { AppHeader } from '@/app/_components/AppHeader'
import { ChatSidebar } from './_components/ChatSidebar'

export default function ChatPage() {
  const { requireAuth, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  useEffect(() => {
    if (authLoading) return
    requireAuth()
  }, [authLoading])

  return (
    <>
      {/* Mobile: full room list */}
      <motion.div
        className="lg:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ willChange: 'opacity' }}
      >
        <AppHeader title="Messages" backPath={from ?? '/'} />
        <div className="pb-24">
          <ChatSidebar />
        </div>
      </motion.div>

      {/* Desktop: right-panel empty state */}
      <motion.div
        className="hidden lg:flex h-full flex-col items-center justify-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ willChange: 'opacity' }}
      >
        <Image src={assetPath('/graphics/no-chat.png')} alt="No chat selected" width={160} height={160} className="opacity-90" />
        <div className="text-center">
          <p className="text-base font-medium text-gray-500">Select a conversation</p>
          <p className="text-sm text-gray-400 mt-1">Choose from the list on the left to start chatting</p>
        </div>
      </motion.div>
    </>
  )
}
