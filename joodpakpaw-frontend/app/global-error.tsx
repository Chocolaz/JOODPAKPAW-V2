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
        className={`${afacad.variable} ${baloo2.variable} ${sarabun.variable} ${prompt.variable} bg-off-white/40 text-foreground antialiased`}
      >
        <main className="min-h-dvh w-full flex flex-col items-center justify-center bg-gradient-to-b from-off-white/70 via-white to-white px-4 sm:px-6 py-12">
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
              We hit an unexpected snag
            </h1>

            <p className="mt-3 text-sm sm:text-base text-neutral-gray leading-relaxed">
              The application encountered an unexpected error. You can reload
              the page to try again or return to the home page.
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
              <button
                type="button"
                onClick={() => reset()}
                className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-deep-teal px-5 py-2.5 text-white hover:bg-deep-teal/90 transition-colors font-baloo2 baloo2 text-base font-medium shadow-sm cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reload Page
              </button>

              {/* Native anchor forces a clean reload out of a crashed root layout */}
              <a
                href="/"
                className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-deep-teal/20 bg-white px-5 py-2.5 text-deep-teal hover:bg-off-white transition-colors font-baloo2 baloo2 text-base font-medium"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Go to Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
