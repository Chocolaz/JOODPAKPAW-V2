'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAddProperty } from '../../_context/AddPropertyContext'
import { useAuth } from '@/app/_components/AuthContext'
import { updateHostPropertyIsActive } from '@/lib/api'
import { cn, assetPath } from '@/lib/utils'
import { StepNavigation } from '../StepNavigation'

type PublishOption = 'publish' | 'later'

const options: {
  id: PublishOption
  label: string
  sub: string
  image: string
  alt: string
}[] = [
  {
    id: 'publish',
    label: 'Yes, publish it',
    sub: 'Go live now',
    image: '/graphics/public-it.svg',
    alt: 'Publish now',
  },
  {
    id: 'later',
    label: 'Save as draft',
    sub: 'Publish later',
    image: '/graphics/public-later.svg',
    alt: 'Save for later',
  },
]

export function Step9() {
  const router = useRouter()
  const { refreshAuth } = useAuth()
  const { formData, clearAddPropertySession } = useAddProperty()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOption, setSelectedOption] = useState<PublishOption | null>(
    null
  )

  const publishProperty = async () => {
    if (!formData.propertyId) {
      toast.error('Property ID not found.')
      return
    }
    setIsSubmitting(true)
    try {
      await updateHostPropertyIsActive(String(formData.propertyId), true)
      toast.success('Your property has been published!')
      await refreshAuth()
      clearAddPropertySession()
      router.push('/profile/host?tab=properties')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish property.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const savePropertyLater = async () => {
    toast.info('Your property has been saved as a draft.')
    await refreshAuth()
    clearAddPropertySession()
    router.push('/profile/host?tab=properties')
  }

  const handleConfirm = async () => {
    if (selectedOption === 'publish') await publishProperty()
    else if (selectedOption === 'later') await savePropertyLater()
  }

  return (
    <>
      <div className="w-full text-center mt-5 pb-24">
        <h3 className="text-deep-teal">Ready to publish your place?</h3>
        <p className="mt-2 mb-10 text-neutral-gray text-sm leading-relaxed">
          Once published, pet owners can view and book your space. You can edit details or unpublish at any time.
        </p>

        <div className="flex flex-wrap justify-center gap-5 pb-4">
          {options.map(({ id, label, sub, image, alt }) => {
            const isSelected = selectedOption === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedOption(id)}
                disabled={isSubmitting}
                className={cn(
                  'relative flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-colors w-[156px] h-[156px] disabled:opacity-50 disabled:cursor-not-allowed',
                  isSelected
                    ? 'border-deep-teal bg-off-white'
                    : 'border-border bg-white hover:border-deep-teal/40 hover:bg-off-white/40'
                )}
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 bg-deep-teal rounded-full p-1">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <div className="h-16 flex items-center justify-center">
                  <Image
                    src={assetPath(image)}
                    alt={alt}
                    width={64}
                    height={64}
                  />
                </div>
                <span className="mt-3 text-sm font-semibold text-foreground">
                  {label}
                </span>
                <span className="text-xs text-neutral-gray">{sub}</span>
              </button>
            )
          })}
        </div>
      </div>

      <StepNavigation
        onBack={() => router.push('/profile/host/add-property/8')}
        backText="Back"
        onNext={handleConfirm}
        nextText="Confirm"
        isNextDisabled={!selectedOption || isSubmitting}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
