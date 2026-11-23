'use client'

import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { ChatSidebar } from './_components/ChatSidebar'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const path = useNormalizedPathname()
  const activeRoomId = path.startsWith('/chat/')
    ? Number(path.split('/')[2]) || undefined
    : undefined

  return (
    <>
      {/* Mobile: full-screen list or thread */}
      <div className="lg:hidden">{children}</div>

      {/* Desktop: flush two-panel editorial workspace directly below DesktopNav */}
      <div className="hidden lg:flex lg:h-[calc(100dvh-64px)] xl:h-[calc(100dvh-72px)] w-full border-x border-border bg-white overflow-hidden">
        <aside className="w-80 xl:w-96 flex flex-col border-r border-border bg-white shrink-0 h-full min-h-0">
          <ChatSidebar activeRoomId={activeRoomId} />
        </aside>

        <section className="flex-1 min-w-0 h-full bg-off-white/30">
          {children}
        </section>
      </div>
    </>
  )
}
