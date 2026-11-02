'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/app/_components/AuthContext'
import './globals.css'
import { afacad, baloo2, sarabun, prompt } from './fonts'

// Suppress vaul's spurious pointer-capture error (upstream bug, cosmetic only)
// and browser extension connection errors that pollute the console.
if (typeof window !== 'undefined') {
  const _consoleError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      const msg = args[0]
      if (msg.includes('releasePointerCapture')) return
      if (msg.includes('Could not establish connection')) return
    }
    _consoleError(...args)
  }
}
import { BottomNav } from '@/app/_components/BottomNav'
import { DesktopNav } from '@/app/_components/DesktopNav'
import { AuthWrapper } from '@/app/_components/AuthWrapper'
import { Toaster } from '@/components/ui/sonner'
import { BookingProvider } from './_context/BookingContext'
import { AuthModalProvider } from './_components/AuthModalProvider'
import { NotificationProvider } from './_components/NotificationContext'
import { ChatProvider } from './_components/ChatContext'

function AdminGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const isAdminUser = user?.role.some((r) => r.name === 'admin') ?? false
  const isAdminPath = pathname.startsWith('/admin')
  const isAuthenPath = pathname.startsWith('/authen')

  useEffect(() => {
    if (loading) return
    if (isAdminUser && !isAdminPath && !isAuthenPath) {
      router.replace('/admin/dashboard')
    }
  }, [isAdminUser, isAdminPath, isAuthenPath, loading, router])

  return null
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const showBottomNav = !pathname.startsWith('/authen') && !isAdmin && !pathname.startsWith('/chat')

  return (
    <html lang="en">
      <head>
        <title>JOODPAKPAW</title>
        <meta name="description" content="Booking petsitting made easy" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={`${afacad.variable} ${baloo2.variable} ${sarabun.variable} ${prompt.variable} bg-white`}>
        <AuthWrapper>
          <AdminGuard />
          <AuthModalProvider>
            <NotificationProvider>
              <ChatProvider>
              <BookingProvider>
                <DesktopNav />
                <div className={`flex flex-col min-h-screen w-full${isAdmin ? '' : ` max-w-[1440px] mx-auto${pathname.startsWith('/authen') ? '' : ' lg:pt-16 xl:pt-[72px]'}`}`}>
                  <main className="flex-1">{children}</main>
                  {showBottomNav && <BottomNav />}
                </div>
                <Toaster />
              </BookingProvider>
              </ChatProvider>
            </NotificationProvider>
          </AuthModalProvider>
        </AuthWrapper>
      </body>
    </html>
  )
}
