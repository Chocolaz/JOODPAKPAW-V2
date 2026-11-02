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
  const showBack = backPath || useBack

  return (
    <header className="fixed top-0 z-40 flex items-center justify-between w-full h-14 px-4 md:px-6 bg-white border-b-2">
      <div className="w-10">
        {showBack && (
          <button
            onClick={() => (useBack ? router.back() : router.push(backPath!))}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 ease-in-out -ml-2"
          >
            <ChevronLeft className="w-6 h-6 text-neutral-gray" />
          </button>
        )}
      </div>
      <h2 className="text-xl font-semibold text-deep-teal absolute left-1/2 -translate-x-1/2">
        {title}
      </h2>
      <div className="min-w-10 flex items-center justify-end">{menu}</div>
    </header>
  )
}
