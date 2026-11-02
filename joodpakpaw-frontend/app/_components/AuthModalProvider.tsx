'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { authErrorEmitter } from '@/lib/authErrors'
import { useAuth } from '@/app/_components/AuthContext'
import { AuthModalContext } from '@/app/_context/AuthModalContext'
import type { AuthModalStep, AuthModalOptions } from '@/app/_context/AuthModalContext'
import { AuthModal } from '@/app/_components/AuthModal'

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()

  // ── Auth form modal ───────────────────────────────────────────────────────
  const [authStep, setAuthStep] = useState<AuthModalStep | null>(null)
  const [authOptions, setAuthOptions] = useState<AuthModalOptions>({})

  const openAuthModal = useCallback((step: AuthModalStep = 'login', opts: AuthModalOptions = {}) => {
    setAuthStep(step)
    setAuthOptions(opts)
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthStep(null)
    setAuthOptions({})
  }, [])

  const handleStepChange = useCallback((step: AuthModalStep, opts?: Partial<AuthModalOptions>) => {
    setAuthStep(step)
    if (opts) setAuthOptions((prev) => ({ ...prev, ...opts }))
  }, [])

  // Open auth modal when requireAuth() fires — passes current path as returnUrl
  useEffect(() => {
    return authErrorEmitter.subscribe(() => {
      const qs = searchParams.toString()
      const returnUrl = qs ? `${pathname}?${qs}` : pathname
      openAuthModal('login', { returnUrl })
    })
  }, [pathname, searchParams, openAuthModal])

  // Close if user becomes authenticated (fired before auth finished loading)
  useEffect(() => {
    if (isAuthenticated) closeAuthModal()
  }, [isAuthenticated])

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <AuthModal
        isOpen={authStep !== null}
        step={authStep ?? 'login'}
        options={authOptions}
        onClose={closeAuthModal}
        onStepChange={handleStepChange}
      />
    </AuthModalContext.Provider>
  )
}
