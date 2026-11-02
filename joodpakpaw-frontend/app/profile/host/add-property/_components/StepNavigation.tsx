'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

type StepNavigationProps = {
  onBack?: () => void
  onNext?: () => void
  isNextDisabled?: boolean
  isSubmitting?: boolean
  backText?: string
  nextText?: string
}

export function StepNavigation({
  onBack,
  onNext,
  isNextDisabled = false,
  isSubmitting = false,
  backText = 'Back',
  nextText = 'Continue',
}: StepNavigationProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const nav = (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-4 px-10 z-50 flex justify-between items-center max-w-[500px] lg:max-w-2xl mx-auto">
      {onBack ? (
        <Button
          variant="outline"
          onClick={onBack}
          className="text-base px-6 py-3 min-w-[90px]"
          disabled={isSubmitting}
        >
          {backText}
        </Button>
      ) : (
        <div />
      )}

      {onNext && (
        <Button
          onClick={onNext}
          className="text-base px-6 py-3 min-w-[110px] bg-positive-green"
          disabled={isNextDisabled || isSubmitting}
        >
          {isSubmitting ? <Spinner className="h-5 w-5" /> : nextText}
        </Button>
      )}
    </div>
  )

  return mounted ? createPortal(nav, document.body) : null
}
