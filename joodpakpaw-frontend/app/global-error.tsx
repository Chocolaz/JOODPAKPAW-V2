'use client'

import { useEffect, type CSSProperties } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    backgroundColor: '#f9fafb',
    color: '#111827',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },
  main: {
    minHeight: '100dvh',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '48px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 448,
    boxSizing: 'border-box',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    border: '1px solid rgba(229, 231, 235, 0.8)',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  iconBox: {
    marginBottom: 24,
    display: 'flex',
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    border: '1px solid rgba(229, 231, 235, 0.8)',
  },
  brand: {
    margin: '0 0 8px 0',
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
  },
  heading: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.25,
    fontWeight: 600,
    color: '#1c4f4a',
  },
  description: {
    margin: '12px 0 0 0',
    fontSize: 15,
    lineHeight: 1.6,
    color: '#6a6a6a',
  },
  digestBadge: {
    marginTop: 16,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    padding: '6px 12px',
    fontSize: 12,
    color: '#4b5563',
    border: '1px solid rgba(229, 231, 235, 0.8)',
    fontVariantNumeric: 'tabular-nums',
  },
  digestCode: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontWeight: 500,
    color: '#111827',
  },
  actions: {
    marginTop: 32,
    display: 'flex',
    width: '100%',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    minHeight: 44,
    flex: '1 1 160px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#1c4f4a',
    border: 'none',
    padding: '8px 16px',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 500,
    cursor: 'pointer',
  },
  secondaryLink: {
    minHeight: 44,
    flex: '1 1 160px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    padding: '8px 16px',
    color: '#374151',
    fontSize: 16,
    fontWeight: 500,
    textDecoration: 'none',
    boxSizing: 'border-box',
  },
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
      <body style={styles.body}>
        <main style={styles.main}>
          <div style={styles.card}>
            <div style={styles.iconBox}>
              <AlertTriangle
                size={20}
                color="#1c4f4a"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>

            <p style={styles.brand}>JoodPakPaw</p>

            <h1 style={styles.heading}>Application error</h1>

            <p style={styles.description}>
              The application encountered an unexpected error. Reload the page
              to try again or return to the home page.
            </p>

            {error.digest && (
              <div style={styles.digestBadge}>
                <span>Reference</span>
                <code style={styles.digestCode}>{error.digest}</code>
              </div>
            )}

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => reset()}
                style={styles.primaryButton}
              >
                <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                Reload page
              </button>

              {/* Native anchor forces a clean reload out of a crashed root layout */}
              <a href="/" style={styles.secondaryLink}>
                <Home size={16} strokeWidth={1.5} aria-hidden="true" />
                Back to home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
