'use client'

import { useSyncExternalStore } from 'react'
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

const emptySubscribe = () => () => {}

export function StepNavigation({
  onBack,
  onNext,
  isNextDisabled = false,
  isSubmitting = false,
  backText = 'Back',
  nextText = 'Continue',
}: StepNavigationProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const nav = (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] px-6 z-50">
      <div className="flex justify-between items-center max-w-[500px] lg:max-w-2xl mx-auto">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="text-sm font-semibold px-6 h-11 rounded-xl border-border text-foreground hover:bg-off-white"
            disabled={isSubmitting}
          >
            {backText}
          </Button>
        ) : (
          <div />
        )}

        {onNext && (
          <Button
            type="button"
            onClick={onNext}
            className="text-sm font-semibold px-6 h-11 min-w-[120px] rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white"
            disabled={isNextDisabled || isSubmitting}
          >
            {isSubmitting ? <Spinner className="h-4 w-4" /> : nextText}
          </Button>
        )}
      </div>
    </div>
  )

  return mounted ? createPortal(nav, document.body) : null
}
