'use client'

import React, { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { MenuHeader } from '@/app/booking/_components/MenuHeader'
import { useNormalizedPathname } from '../_hooks/useNormalizedPathname'

export default function BookingLayout({ children }: { children: ReactNode }) {
  const normalizedPath = useNormalizedPathname()
  const searchParams = useSearchParams()

  const getHeaderProps = () => {
    if (normalizedPath === '/booking/confirm' && searchParams) {
      const propertyId = searchParams.get('propertyId')
      if (propertyId) {
        return {
          title: 'Confirm and pay',
          backPath: `/detail/${propertyId}?drawer=open`,
        }
      }
    }
    return { title: 'Confirm and pay', backPath: '/' }
  }

  const headerProps = getHeaderProps()

  return (
    <div className="flex justify-center">
      <div className="w-full">
        <div className="lg:hidden">
          <MenuHeader {...headerProps} />
        </div>
        <div className="pt-14 lg:pt-0">{children}</div>
      </div>
    </div>
  )
}
