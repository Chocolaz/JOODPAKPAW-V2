'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/app/_components/AuthContext'

const KEY = (userId: number | string) => `joodpakpaw_recently_viewed_${userId}`
const GUEST_KEY = 'joodpakpaw_recently_viewed'
const MAX = 10

export function useRecentlyViewed() {
  const { user } = useAuth()
  const storageKey = user ? KEY(user.id) : GUEST_KEY
  const [ids, setIds] = useState<number[]>([])

  useEffect(() => {
    if (user) {
      localStorage.removeItem(GUEST_KEY)
    }

    let parsed: number[] = []
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) parsed = JSON.parse(stored)
    } catch {
      parsed = []
    }
    queueMicrotask(() => setIds(parsed))
  }, [storageKey, user])

  const track = useCallback(
    (propertyId: number) => {
      try {
        const stored = localStorage.getItem(storageKey)
        const current: number[] = stored ? JSON.parse(stored) : []
        const updated = [
          propertyId,
          ...current.filter((id) => id !== propertyId),
        ].slice(0, MAX)
        localStorage.setItem(storageKey, JSON.stringify(updated))
        setIds(updated)
      } catch {}
    },
    [storageKey]
  )

  return { ids, track }
}
