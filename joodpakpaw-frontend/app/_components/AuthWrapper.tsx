'use client'
import { Suspense } from 'react'
import { AuthProvider } from './AuthContext'
import { Spinner } from '@/components/ui/spinner'

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthProvider>{children}</AuthProvider>
    </Suspense>
  )
}
