'use client'

import { useRouter } from 'next/navigation'
import { Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const PET_STEPS = [
  { id: 1, label: 'Species' },
  { id: 2, label: 'Breed' },
  { id: 3, label: 'Photo' },
  { id: 4, label: 'Gender' },
  { id: 5, label: 'Size' },
  { id: 6, label: 'Age' },
  { id: 7, label: 'Activity' },
  { id: 8, label: 'Contact' },
  { id: 9, label: 'Review' },
]

export function DesktopPetStepper({ stepId }: { stepId: number }) {
  const router = useRouter()

  return (
    <nav className="max-w-2xl mx-auto w-full px-12 pt-6 pb-4">
      <Link
        href="/profile/pets"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-gray hover:text-deep-teal transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pets
      </Link>

      <div className="flex items-center">
        {PET_STEPS.map((step, index) => {
          const isDone = stepId > step.id
          const isActive = stepId === step.id
          const isLast = index === PET_STEPS.length - 1
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                disabled={!isDone}
                onClick={() => isDone && router.push(`/profile/pets/add/${step.id}`)}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 shrink-0',
                  isDone &&
                    'bg-positive-green text-white cursor-pointer hover:brightness-90',
                  isActive &&
                    'bg-accent-orange text-white ring-4 ring-accent-orange/25',
                  !isDone &&
                    !isActive &&
                    'bg-gray-100 text-neutral-gray cursor-default',
                )}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                ) : (
                  step.id
                )}
              </button>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-px mx-1.5 transition-colors duration-300',
                    isDone ? 'bg-positive-green/50' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-start mt-2">
        {PET_STEPS.map((step, index) => {
          const isDone = stepId > step.id
          const isActive = stepId === step.id
          const isLast = index === PET_STEPS.length - 1
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="w-7 flex justify-center">
                <span
                  className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    isActive && 'text-accent-orange',
                    isDone && 'text-positive-green',
                    !isDone && !isActive && 'text-neutral-gray/40',
                  )}
                >
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
