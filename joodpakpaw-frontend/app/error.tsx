'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[JoodPakPaw ErrorBoundary]', error)
  }, [error])

  return (
    <div className="min-h-[calc(100dvh-5rem)] w-full flex flex-col items-center justify-center bg-gradient-to-b from-off-white/60 via-white to-white px-4 sm:px-6 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl bg-white border border-deep-teal/10 shadow-sm px-6 py-8 sm:px-8 sm:py-10 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-accent-orange/15 blur-lg" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-off-white border border-accent-orange/20 shadow-xs">
            <AlertTriangle
              className="h-8 w-8 text-accent-orange"
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="font-baloo2 baloo2 text-xs font-semibold uppercase tracking-widest text-accent-orange mb-2">
          JoodPakPaw
        </p>

        <h1 className="font-baloo2 baloo2 text-2xl sm:text-3xl font-bold text-deep-teal tracking-tight">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm sm:text-base text-neutral-gray leading-relaxed">
          We ran into an unexpected hiccup while loading this page. Please try
          again or head back to the home page.
        </p>

        {error.digest && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-off-white px-3 py-1 text-xs text-neutral-gray border border-deep-teal/10">
            <span>Reference:</span>
            <code className="font-mono font-medium text-deep-teal">
              {error.digest}
            </code>
          </div>
        )}

        <div className="mt-8 flex w-full flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] flex-1 rounded-xl bg-deep-teal text-white hover:bg-deep-teal/90 font-baloo2 baloo2 text-base font-medium shadow-sm"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </Button>

          <Button
            asChild
            variant="outline"
            className="min-h-[44px] flex-1 rounded-xl border-deep-teal/20 bg-white text-deep-teal hover:bg-off-white hover:text-deep-teal font-baloo2 baloo2 text-base font-medium"
          >
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
