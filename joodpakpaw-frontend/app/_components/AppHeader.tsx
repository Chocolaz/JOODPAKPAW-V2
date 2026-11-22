'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

interface AppHeaderProps {
  title: string
  backPath?: string
  useBack?: boolean
  menu?: React.ReactNode
}

export const AppHeader = ({ title, backPath, useBack, menu }: AppHeaderProps) => {
  const router = useRouter()
  const showBack = Boolean(backPath || useBack)

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between gap-2 h-14 px-4 md:px-6">
        {showBack ? (
          <>
            <button
              type="button"
              aria-label="Go back"
              onClick={() => (useBack ? router.back() : router.push(backPath!))}
              className="min-w-11 min-h-11 -ml-2 inline-flex items-center justify-center rounded-full text-deep-teal hover:bg-neutral-50 active:bg-neutral-100 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="font-semibold text-deep-teal truncate flex-1">
              {title}
            </h2>
            <div className="min-w-10 flex items-center justify-end shrink-0">
              {menu}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-bold text-deep-teal truncate flex-1">
              {title}
            </h2>
            <div className="flex items-center justify-end gap-1 shrink-0">
              {menu}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
