'use client'

import { useAuth } from '@/app/_components/AuthContext'

interface PetsBannerProps {
  summary?: {
    total: number
  }
}

export function PetsBanner({ summary }: PetsBannerProps) {
  const { user } = useAuth()

  return (
    <div className="bg-off-white p-10 rounded-bl-4xl rounded-br-4xl shadow-sm border-b w-full">
      <div className="min-h-[60px]">
        <p className="text-lg text-accent-orange">
          Hello {user?.firstName} {user?.lastName}
        </p>
        <h4 className="text-deep-teal mb-3">Here are your lovely pets! </h4>

        {summary && summary.total > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1 rounded-full bg-deep-teal/10 text-deep-teal text-sm font-medium">
              {summary.total} {summary.total > 1 ? 'pets' : 'pet'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
