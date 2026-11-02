import Link from 'next/link'
import { Ban, Home } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 px-4 py-10">
      {/* Icon */}
      <div className="mb-6 bg-white p-6 rounded-full shadow-sm">
        <Ban className="w-20 h-20 text-accent-orange" />
      </div>

      {/* Error Code */}
      <h1 className="text-6xl font-bold text-deep-teal mb-3">403</h1>

      {/* Message */}
      <h2 className="text-2xl font-semibold text-gray-700 mb-3">
        Access Denied
      </h2>

      <p className="text-lg text-center text-gray-600 mb-8 max-w-md">
        You do not have permission to access this page.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-deep-teal text-white rounded-lg shadow hover:bg-accent-orange transition-colors"
        >
          <Home size={20} />
          Back to Home
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400">
        🐾 Every pet deserves a perfect stay
      </p>
    </div>
  )
}
