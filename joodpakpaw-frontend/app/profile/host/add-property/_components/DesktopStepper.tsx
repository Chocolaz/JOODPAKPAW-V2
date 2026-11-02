'use client'

import { useRouter } from 'next/navigation'
import { Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const FORM_STEPS = [
  { id: 1, label: 'Type' },
  { id: 2, label: 'Location' },
  { id: 3, label: 'Address' },
  { id: 4, label: 'Details' },
  { id: 5, label: 'Facilities' },
  { id: 6, label: 'Photos' },
  { id: 7, label: 'Review' },
]

export function DesktopStepper({ stepId }: { stepId: number }) {
  const router = useRouter()

  return (
    <nav className="max-w-2xl mx-auto w-full px-12 pt-6 pb-4">
      <Link
        href="/profile/host?tab=properties"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-gray hover:text-deep-teal transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Host
      </Link>

      <div className="flex items-center">
        {FORM_STEPS.map((step, index) => {
          const isDone = stepId > step.id
          const isActive = stepId === step.id
          const isLast = index === FORM_STEPS.length - 1
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                disabled={!isDone}
                onClick={() => isDone && router.push(`/profile/host/add-property/${step.id}`)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 shrink-0',
                  isDone && 'bg-positive-green text-white cursor-pointer hover:brightness-90',
                  isActive && 'bg-accent-orange text-white ring-4 ring-accent-orange/25',
                  !isDone && !isActive && 'bg-gray-100 text-neutral-gray cursor-default',
                )}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={2.5} /> : step.id}
              </button>
              {!isLast && (
                <div className={cn(
                  'flex-1 h-px mx-2 transition-colors duration-300',
                  isDone ? 'bg-positive-green/50' : 'bg-gray-200'
                )} />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-start mt-2">
        {FORM_STEPS.map((step, index) => {
          const isDone = stepId > step.id
          const isActive = stepId === step.id
          const isLast = index === FORM_STEPS.length - 1
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="w-8 flex justify-center">
                <span className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isActive && 'text-accent-orange',
                  isDone && 'text-positive-green',
                  !isDone && !isActive && 'text-neutral-gray/40',
                )}>
                  {step.label}
                </span>
              </div>
              {!isLast && <div className="flex-1" />}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
