'use client'

import { useAuth } from '@/app/_components/AuthContext'
import { Progress } from '@/components/ui/progress'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn, getDisplayName } from '@/lib/utils'
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
  const displayName = getDisplayName(user) || 'Host'

  const setFilter = (f: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', f)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const getStepTitle = (step: number) => {
    if (step >= 1 && step <= 4) return 'Tell us about your space'
    if (step >= 5 && step <= 7) return 'Make it stand out'
    if (step >= 8 && step <= 9) return 'Publish your listing'
    return ''
  }

  const getStepSubtitle = (step: number) => {
    switch (step) {
      case 1:
        return 'Property Type'
      case 2:
        return 'Map Location'
      case 3:
        return 'Address Details'
      case 4:
        return 'Title and Description'
      case 5:
        return 'Facilities'
      case 6:
        return 'Photos'
      case 7:
        return 'Review'
      case 8:
        return 'Room Categories'
      case 9:
        return 'Publish'
      default:
        return ''
    }
  }

  return (
    <div className="bg-off-white p-6 sm:p-8 rounded-bl-3xl rounded-br-3xl border-b border-border w-full">
      {currentStep && totalSteps ? (
        <div className="min-h-20">
          <div className="relative flex items-center justify-center">
            <div className="text-center mb-2">
              <h5 className="text-deep-teal font-semibold">
                {getStepTitle(currentStep)}
              </h5>
              <p className="text-sm text-neutral-gray">
                {getStepSubtitle(currentStep)}
              </p>
            </div>
            <div className="absolute right-0 flex flex-col items-center text-center mb-2">
              <span className="text-xs text-neutral-gray">Step</span>
              <div className="text-sm font-semibold tabular-nums text-deep-teal">
                {currentStep}
                <span className="text-neutral-gray">/{totalSteps}</span>
              </div>
            </div>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="mt-3" />
        </div>
      ) : (
        <div className="min-h-[60px]">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-base font-medium text-accent-orange">
                Hello, {displayName}
              </p>
              <h4 className="text-deep-teal">Manage your host workspace</h4>
            </div>
            {user?.id && (
              <button
                type="button"
                onClick={() => router.push(`/hosts/${user.id}`)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-deep-teal bg-white hover:bg-deep-teal hover:text-white hover:border-deep-teal transition-colors mt-1 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                Public profile
              </button>
            )}
          </div>

          {summary && summary.total > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
                  activeFilter === 'all'
                    ? 'bg-deep-teal text-white border-deep-teal'
                    : 'bg-white text-deep-teal border-border hover:border-deep-teal'
                )}
              >
                {activeFilter === 'all' && <Check className="w-3 h-3" />}
                {summary.total} total
              </button>

              {summary.published > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('published')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
                    activeFilter === 'published'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-500'
                  )}
                >
                  {activeFilter === 'published' && <Check className="w-3 h-3" />}
                  {summary.published} published
                </button>
              )}

              {summary.draft > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('draft')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer tabular-nums',
                    activeFilter === 'draft'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-amber-800 border-amber-200 hover:border-amber-400'
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
