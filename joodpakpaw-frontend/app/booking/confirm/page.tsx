'use client'

import React, { Suspense } from 'react'
import { Spinner } from '@/components/ui/spinner'
import ConfirmBookingDataLoader from './_components/ConfirmBookingDataLoader'

export default function ConfirmBookingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ConfirmBookingDataLoader />
    </Suspense>
  )
}

