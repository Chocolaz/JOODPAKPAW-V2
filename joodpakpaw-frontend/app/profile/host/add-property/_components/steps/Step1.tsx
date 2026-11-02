'use client'

import { useAddProperty } from '../../_context/AddPropertyContext'
import { propertyTypes } from '../../_constants'
import { StepNavigation } from '../StepNavigation'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { cn, assetPath } from '@/lib/utils'

const propertyTypeGraphics = [
  { id: 1, icon: assetPath('/graphics/steps/house.svg') },
  { id: 2, icon: assetPath('/graphics/steps/apartment.svg') },
  { id: 3, icon: assetPath('/graphics/steps/hotel.svg') },
]

export function Step1({ onNext }: { onNext: () => void }) {
  const { formData, updateField } = useAddProperty()

  return (
    <>
      <div className="w-full text-center mt-5">
        <h3 className="text-deep-teal">What type of place is this?</h3>
        <p className="mb-8 text-neutral-gray text-sm">
          Choose the kind of space where pets will stay
        </p>

        <div className="flex flex-wrap justify-center gap-5 pb-4">
          {propertyTypeGraphics.map(({ id, icon }) => {
            const isSelected = formData.propertyTypeId === id
            const label = propertyTypes.find((p) => p.id === id)?.name ?? ''

            return (
              <button
                key={id}
                onClick={() => updateField('propertyTypeId', id)}
                className={cn(
                  'relative flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all w-[145px] h-[145px]',
                  isSelected
                    ? 'border-positive-green bg-teal-50 shadow-sm'
                    : 'border-[#ECEFF2] bg-white hover:border-deep-teal/40 hover:bg-gray-50'
                )}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 bg-positive-green rounded-full p-0.5">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <Image src={icon} alt={label} width={72} height={72} />
                <span className="mt-3 text-sm font-medium text-neutral-dark text-center leading-tight">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <StepNavigation onNext={onNext} isNextDisabled={!formData.propertyTypeId} />
    </>
  )
}
