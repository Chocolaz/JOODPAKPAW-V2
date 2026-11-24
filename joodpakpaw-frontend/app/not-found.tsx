import Link from 'next/link'
import { PawPrint, Home } from 'lucide-react'
import { GoBackButton } from '@/app/_components/GoBackButton'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-off-white/40 px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-off-white text-accent-orange">
          <PawPrint className="h-8 w-8" strokeWidth={1.75} />
        </div>

        <p className="text-sm font-semibold text-accent-orange mb-1">404 Not Found</p>
        <h1 className="font-bold text-deep-teal mb-2">Page Not Found</h1>

        <p className="text-sm text-neutral-gray leading-relaxed mb-7">
          We couldn&apos;t find the page or record you requested. The link may be
          invalid, or the item may have been removed.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <GoBackButton className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-deep-teal hover:bg-off-white transition-colors cursor-pointer" />
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-deep-teal text-white text-sm font-semibold hover:bg-deep-teal/90 transition-colors"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
