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
    <div className="min-h-[calc(100dvh-5rem)] w-full flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 py-12 text-foreground">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200/80 shadow-xs p-6 sm:p-8 flex flex-col items-center text-center">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 border border-gray-200/80">
          <AlertTriangle
            className="h-5 w-5 text-deep-teal"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">JoodPakPaw</p>

        <h1 className="font-baloo2 baloo2 text-2xl sm:text-3xl font-semibold text-deep-teal">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm sm:text-base text-neutral-gray leading-relaxed">
          We ran into an unexpected issue while loading this page. Try again or
          return to the home page.
        </p>

        {error.digest && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600 border border-gray-200/80 tabular-nums">
            <span>Reference</span>
            <code className="font-mono font-medium text-gray-900">
              {error.digest}
            </code>
          </div>
        )}

        <div className="mt-8 flex w-full flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] flex-1 rounded-lg bg-deep-teal text-white hover:bg-deep-teal/90 font-baloo2 baloo2 text-base font-medium transition-colors duration-150 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Try again
          </Button>

          <Button
            asChild
            variant="outline"
            className="min-h-[44px] flex-1 rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-baloo2 baloo2 text-base font-medium transition-colors duration-150"
          >
            <Link href="/">
              <Home className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
