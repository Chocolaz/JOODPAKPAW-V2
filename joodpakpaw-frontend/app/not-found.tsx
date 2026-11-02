import Link from 'next/link'
import { PawPrint, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white text-gray-800 px-6 py-10">
      <div className="relative mb-8">
        <div className="absolute -inset-4 bg-accent-orange/10 rounded-full blur-xl" />
        <div className="relative bg-white p-8 rounded-full shadow-md border border-gray-100">
          <PawPrint className="w-16 h-16 text-accent-orange" />
        </div>
      </div>

      <h1 className="text-8xl font-extrabold text-deep-teal tracking-tight">
        404
      </h1>

      <h2 className="text-xl font-semibold text-gray-700 mt-3 mb-2">
        Oops! Page Not Found
      </h2>

      <p className="text-base text-center text-gray-500 mb-10 max-w-sm leading-relaxed">
        We couldn&apos;t find the page you&apos;re looking for. It may have been
        moved or no longer exists.
      </p>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 px-8 py-3.5 bg-deep-teal text-white rounded-xl shadow-md hover:shadow-lg hover:bg-deep-teal/90 transition-all font-medium w-full max-w-xs"
      >
        <Home size={18} />
        Back to Home
      </Link>
    </div>
  )
}
