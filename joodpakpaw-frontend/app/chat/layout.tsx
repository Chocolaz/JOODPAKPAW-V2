'use client'

import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { ChatSidebar } from './_components/ChatSidebar'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const path = useNormalizedPathname()
  const activeRoomId = path.startsWith('/chat/') ? Number(path.split('/')[2]) || undefined : undefined

  return (
    <>
      {/* Mobile: normal full-screen flow */}
      <div className="lg:hidden">{children}</div>

      {/* Desktop: two-panel layout */}
      <div className="hidden lg:flex fixed left-4 xl:left-6 right-4 xl:right-6 top-[calc(5rem+0.75rem)] xl:top-[calc(6rem+0.75rem)] bottom-3 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Left sidebar */}
        <div className="w-80 xl:w-96 flex flex-col border-r border-gray-100 bg-white shrink-0">
          <ChatSidebar activeRoomId={activeRoomId} />
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 bg-gray-50/30">
          {children}
        </div>
      </div>
    </>
  )
}
