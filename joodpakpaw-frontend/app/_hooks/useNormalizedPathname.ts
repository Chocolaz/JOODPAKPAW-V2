'use client'

import { usePathname } from 'next/navigation'

export function useNormalizedPathname(): string {
  const pathname = usePathname()
  // If the path is longer than a single slash and ends with a slash, remove it.
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  // Otherwise, return the original pathname.
  return pathname
}
