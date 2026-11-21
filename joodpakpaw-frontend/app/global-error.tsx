'use client'

import { useEffect } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import './globals.css'
import { afacad, baloo2, sarabun, prompt } from './fonts'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[JoodPakPaw GlobalErrorBoundary]', error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Something went wrong — JoodPakPaw</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${afacad.variable} ${baloo2.variable} ${sarabun.variable} ${prompt.variable} bg-gray-50 text-foreground antialiased`}
      >
        <main className="min-h-dvh w-full flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 py-12">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200/80 shadow-xs p-6 sm:p-8 flex flex-col items-center text-center">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 border border-gray-200/80">
              <AlertTriangle
                className="h-5 w-5 text-deep-teal"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>

            <p className="text-xs font-medium text-gray-500 mb-2">
              JoodPakPaw
            </p>

            <h1 className="font-baloo2 baloo2 text-2xl sm:text-3xl font-semibold text-deep-teal">
              Application error
            </h1>

            <p className="mt-3 text-sm sm:text-base text-neutral-gray leading-relaxed">
              The application encountered an unexpected error. Reload the page
              to try again or return to the home page.
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
              <button
                type="button"
                onClick={() => reset()}
                className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-deep-teal px-4 py-2 text-white hover:bg-deep-teal/90 transition-colors duration-150 font-baloo2 baloo2 text-base font-medium cursor-pointer"
              >
                <RotateCcw
                  className="h-4 w-4"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                Reload page
              </button>

              {/* Native anchor forces a clean reload out of a crashed root layout */}
              <a
                href="/"
                className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 font-baloo2 baloo2 text-base font-medium"
              >
                <Home
                  className="h-4 w-4"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                Back to home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
