'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/_components/AuthContext'

const KEY = (userId: number | string) => `joodpakpaw_recently_viewed_${userId}`
const GUEST_KEY = 'joodpakpaw_recently_viewed'
const MAX = 10

export function useRecentlyViewed() {
  const { user } = useAuth()
  const storageKey = user ? KEY(user.id) : GUEST_KEY
  const [ids, setIds] = useState<number[]>([])

  useEffect(() => {
    // When user logs in, we might want to clear guest key
    // But we should only do it once when transitioning from guest to user
    if (user) {
      // Optional: migrate guest history to user history here if desired
      // For now, let's keep it simple and just clear it as before
      localStorage.removeItem(GUEST_KEY)
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setIds(JSON.parse(stored))
      else setIds([])
    } catch {
      setIds([])
    }
  }, [storageKey, user])

  const track = (propertyId: number) => {
    try {
      const stored = localStorage.getItem(storageKey)
      const current: number[] = stored ? JSON.parse(stored) : []
      const updated = [propertyId, ...current.filter((id) => id !== propertyId)].slice(0, MAX)
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setIds(updated)
    } catch {}
  }

  return { ids, track }
}
