'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { LogIn, Search } from 'lucide-react'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { assetPath } from '@/lib/utils'
import { AppHeader } from '@/app/_components/AppHeader'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from './_components/ChatSidebar'

export default function ChatPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  const guestSignInCard = (
    <div className="rounded-2xl border border-border bg-white px-6 py-10 text-center max-w-md mx-auto space-y-4">
      <Image
        src={assetPath('/graphics/no-chat.png')}
        alt="Sign in to view messages"
        width={150}
        height={150}
        className="mx-auto"
      />
      <div className="space-y-1.5">
        <h2 className="font-semibold text-deep-teal">
          Sign in to message hosts
        </h2>
        <p className="text-sm text-neutral-gray leading-relaxed">
          Chat directly with verified pet-boarding hosts about care routines,
          rooms, and check-in details.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
        <Button
          type="button"
          onClick={() => openAuthModal('login', { returnUrl: '/chat' })}
          className="h-11 px-6 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold cursor-pointer"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Sign in
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/')}
          className="h-11 px-5 rounded-xl border-border text-foreground hover:bg-off-white/70 font-medium cursor-pointer"
        >
          <Search className="mr-2 h-4 w-4" />
          Explore stays
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile: clean single header + room list or guest prompt */}
      <div className="lg:hidden min-h-screen bg-white">
        <AppHeader title="Messages" backPath={from || undefined} />
        <div className="pt-14 pb-24">
          {!authLoading && !isAuthenticated ? (
            <div className="px-4 pt-6">{guestSignInCard}</div>
          ) : (
            <ChatSidebar />
          )}
        </div>
      </div>

      {/* Desktop: right-panel editorial empty state or guest prompt */}
      <div className="hidden lg:flex h-full flex-col items-center justify-center p-8 text-center">
        {!authLoading && !isAuthenticated ? (
          guestSignInCard
        ) : (
          <div className="space-y-3 max-w-sm">
            <Image
              src={assetPath('/graphics/no-chat.png')}
              alt="Select a conversation"
              width={150}
              height={150}
              className="mx-auto opacity-90"
            />
            <div className="space-y-1">
              <h2 className="font-semibold text-deep-teal">
                Select a conversation
              </h2>
              <p className="text-sm text-neutral-gray leading-relaxed">
                Choose a host or guest from the left sidebar to read and send
                messages.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
