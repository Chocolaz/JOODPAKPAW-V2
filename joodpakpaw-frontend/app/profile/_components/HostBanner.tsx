'use client'

import { useAuth } from '@/app/_components/AuthContext'
import { Progress } from '@/components/ui/progress'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Check, ExternalLink } from 'lucide-react'

interface HostBannerProps {
  currentStep?: number
  totalSteps?: number
  summary?: {
    total: number
    published: number
    draft: number
  }
}

export function HostBanner({ currentStep, totalSteps, summary }: HostBannerProps) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeFilter = searchParams.get('filter') || 'all'

  const setFilter = (f: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', f)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const getStepTitle = (step: number) => {
    if (step >= 1 && step <= 4) return 'Tell us about your space'
    if (step >= 5 && step <= 7) return 'Make it stand Out'
    if (step >= 8 && step <= 9) return 'Publish your listing'
    return ''
  }

  const getStepSubtitle = (step: number) => {
    switch (step) {
      case 1: return 'Property Type'
      case 2:
      case 3: return 'Address'
      case 4: return 'Title and description'
      case 5: return 'Facilities'
      case 6: return 'Picture'
      case 7: return 'Review'
      case 8: return 'Room'
      case 9: return 'Publish'
      default: return ''
    }
  }

  return (
    <div className="bg-off-white p-6 sm:p-10 rounded-bl-4xl rounded-br-4xl shadow-sm border-b w-full">
      {currentStep && totalSteps ? (
        <div className="min-h-20">
          <div className="relative flex items-center justify-center">
            <div className="text-center mb-2">
              <h5 className="text-deep-teal">{getStepTitle(currentStep)}</h5>
              <p className="text-base text-neutral-gray">{getStepSubtitle(currentStep)}</p>
            </div>
            <div className="absolute right-0 flex flex-col items-center text-center mb-3">
              <span className="text-sm">Step</span>
              <div className="text-sm font-medium">
                {currentStep}
                <span className="text-neutral-gray">/{totalSteps}</span>
              </div>
            </div>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="mt-3" />
        </div>
      ) : (
        <div className="min-h-[60px]">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-lg text-accent-orange">
                Hello {user?.firstName} {user?.lastName}
              </p>
              <h4 className="text-deep-teal mb-3">Manage your host activities below!</h4>
            </div>
            {user?.id && (
              <button
                onClick={() => router.push(`/hosts/${user.id}`)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-deep-teal/30 text-deep-teal bg-white hover:bg-deep-teal hover:text-white hover:border-deep-teal transition-all duration-150 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                Public profile
              </button>
            )}
          </div>

          {summary && summary.total > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                  activeFilter === 'all'
                    ? 'bg-deep-teal text-white border-deep-teal shadow-sm'
                    : 'bg-white text-deep-teal border-deep-teal/40 hover:border-deep-teal hover:bg-deep-teal/10 hover:scale-105'
                )}
              >
                {activeFilter === 'all' && <Check className="w-3 h-3" />}
                {summary.total} total
              </button>

              {summary.published > 0 && (
                <button
                  onClick={() => setFilter('published')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                    activeFilter === 'published'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-green-700 border-green-300 hover:border-green-500 hover:bg-green-50 hover:scale-105'
                  )}
                >
                  {activeFilter === 'published' && <Check className="w-3 h-3" />}
                  {summary.published} published
                </button>
              )}

              {summary.draft > 0 && (
                <button
                  onClick={() => setFilter('draft')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer active:scale-95',
                    activeFilter === 'draft'
                      ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                      : 'bg-white text-yellow-700 border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50 hover:scale-105'
                  )}
                >
                  {activeFilter === 'draft' && <Check className="w-3 h-3" />}
                  {summary.draft} draft
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
