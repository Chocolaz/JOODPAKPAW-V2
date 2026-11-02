'use client'

import { Progress } from '@/components/ui/progress'

interface AddPetBannerProps {
  currentStep?: number
  totalSteps?: number
}

export function AddPetBanner({ currentStep, totalSteps }: AddPetBannerProps) {
  const getStepSubtitle = (step: number) => {
    switch (step) {
      case 1:
        return 'Species'
      case 2:
        return 'Breed'
      case 3:
        return 'Photo & Name'
      case 4:
        return 'Gender'
      case 5:
        return 'Size'
      case 6:
        return 'Age'
      case 7:
        return 'Activity Level'
      case 8:
        return 'Contact'
      case 9:
        return 'Review & Submit'
      // Add more cases for future steps
      default:
        return ''
    }
  }

  return (
    <div className="bg-off-white p-10 rounded-bl-4xl rounded-br-4xl shadow-sm border-b w-full">
      {currentStep && totalSteps ? (
        <div className="min-h-20">
          <div className="relative flex items-center justify-center">
            <div className="text-center mb-2">
              <h5 className="text-deep-teal">Add Pet Profile</h5>
              <p className="text-base text-neutral-gray">
                {getStepSubtitle(currentStep)}
              </p>
            </div>

            <div className="absolute right-0 flex flex-col items-center text-center mb-3">
              <span className="text-sm">Step</span>
              <div className="text-sm font-medium">
                {currentStep}
                <span className="text-neutral-gray">/{totalSteps}</span>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <Progress value={(currentStep / totalSteps) * 100} className="mt-3" />
        </div>
      ) : (
        // This part won't be used for now as we always have currentStep/totalSteps
        <div className="min-h-[60px]">
          <h4 className="text-deep-teal mb-3">Add Pet Profile</h4>
        </div>
      )}
    </div>
  )
}
