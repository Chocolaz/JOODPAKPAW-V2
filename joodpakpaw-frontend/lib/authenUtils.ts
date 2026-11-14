'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { refreshToken as callRefreshTokenApi } from './authApi' // Alias to avoid name collision
import {
  saveTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
} from './tokenManager'

export {
  saveTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
}

// --- Refresh access token function ---
export const refreshAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null

  const currentRefreshToken = getRefreshToken()
  if (!currentRefreshToken) {
    console.warn('No refresh token found in cookies.')
    clearTokens()
    return null
  }

  try {
    const res = await callRefreshTokenApi(currentRefreshToken)
    const newAccessToken = typeof res === 'string' ? res : res.accessToken
    const newRefreshToken =
      (typeof res === 'object' && res?.refreshToken) || currentRefreshToken

    if (newAccessToken) {
      saveTokens(newAccessToken, newRefreshToken)
      return newAccessToken
    }

    clearTokens()
    return null
  } catch (error) {
    console.error('Failed to refresh access token:', error)
    clearTokens()
    return null
  }
}

// --- Custom Hooks ---
export const useAuthRedirect = (redirectPath: string = '/') => {
  const router = useRouter()
  const isAuthent = isAuthenticated()

  useEffect(() => {
    if (isAuthent) {
      router.push(redirectPath)
    }
  }, [router, redirectPath, isAuthent])

  return isAuthent
}

export const useCooldown = (initialCooldown: number = 0) => {
  const [cooldown, setCooldown] = useState(initialCooldown)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  return { cooldown, startCooldown: (time: number) => setCooldown(time) }
}

export const useEmailFromQuery = (fallbackPath: string) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  useEffect(() => {
    if (!email) {
      console.error('Email not found in query parameters')
      router.push(fallbackPath)
    }
  }, [searchParams, router, fallbackPath, email])

  return email
}
