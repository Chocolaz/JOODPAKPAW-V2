'use client'

import { Heart } from 'lucide-react'
import { authErrorEmitter, AuthRequiredError } from '@/lib/authErrors'

export function RecommendedCTA() {
  const handleLogin = () => {
    authErrorEmitter.emit(new AuthRequiredError('no_token'))
  }

  return (
    <div className="mb-10 lg:mb-0 lg:py-10 lg:border-b lg:border-gray-100">
      <div className="flex items-center gap-2 mb-4 lg:mb-6">
        <Heart className="w-5 h-5 fill-accent-orange text-accent-orange" />
        <h5 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-deep-teal">
          Recommended for You
        </h5>
      </div>

      {/* CTA card — w-44 matches property card width in mobile scroll row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 lg:mx-0 lg:px-0 lg:overflow-x-visible">
        <div className="w-44 shrink-0 lg:w-64">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full h-full min-h-[200px] rounded-[20px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 p-4 text-center hover:border-deep-teal transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center group-hover:bg-accent-orange/20 transition-colors">
              <Heart className="w-6 h-6 text-accent-orange" />
            </div>
            <p className="text-sm text-neutral-gray leading-snug">
              Log in to see picks for you
            </p>
            <span className="text-sm font-semibold text-white bg-deep-teal rounded-full px-4 py-1.5">
              Log in
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
