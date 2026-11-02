'use client'
import { createContext, useContext } from 'react'

export type AuthModalStep = 'login' | 'register' | 'verify-otp' | 'forgot' | 'forgot-sent'

export interface AuthModalOptions {
  returnUrl?: string
  email?: string
}

interface AuthModalContextValue {
  openAuthModal: (step?: AuthModalStep, opts?: AuthModalOptions) => void
  closeAuthModal: () => void
}

export const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}
