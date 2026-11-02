'use client'

import React, { ReactNode, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { MenuHeader } from '@/app/booking/_components/MenuHeader'
import { useNormalizedPathname } from '../_hooks/useNormalizedPathname'

export default function BookingLayout({ children }: { children: ReactNode }) {
  const normalizedPath = useNormalizedPathname()
  const searchParams = useSearchParams()

  // Log searchParams to debug its state
  useEffect(() => {
    console.log('BookingLayout searchParams:', searchParams)
  }, [searchParams])

  const getHeaderProps = () => {
    // Ensure searchParams is not null/undefined before calling .get
    if (normalizedPath === '/booking/confirm' && searchParams) {
      const propertyId = searchParams.get('propertyId')
      if (propertyId) {
        return {
          title: 'Booking',
          backPath: `/${propertyId}?drawer=open`,
        }
      }
    }
    // Default or other booking paths
    return { title: 'Booking', backPath: '/' }
  }

  const headerProps = getHeaderProps()

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[500px]">
        <MenuHeader {...headerProps} />
        {children}
      </div>
    </div>
  )
}
