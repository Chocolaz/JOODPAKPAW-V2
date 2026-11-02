'use client'

import React, { Suspense } from 'react'
import { Spinner } from '@/components/ui/spinner'
import ConfirmBookingDataLoader from './_components/ConfirmBookingDataLoader' // Import the new data loader component

export default function ConfirmBookingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ConfirmBookingDataLoader />
    </Suspense>
  )
}
