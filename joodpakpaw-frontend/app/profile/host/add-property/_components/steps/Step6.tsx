'use client'

import { useAddProperty } from '../../_context/AddPropertyContext'
import { StepNavigation } from '../StepNavigation'
import { ImageManager } from '@/app/_components/ImageManager'

export function Step6({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { formData, updateField } = useAddProperty()

  return (
    <>
      <div className="w-full text-center mt-5 pb-24">
        <h3 className="text-deep-teal">Upload photos of your property</h3>
        <p className="mb-5 text-neutral-gray text-sm mt-1">
          Add clear photos that help pet parents visualize where their pets will stay
        </p>

        <ImageManager
          existingImages={[]}
          newFiles={formData.images}
          onExistingImagesChange={() => {}}
          onNewFilesChange={(files) => updateField('images', files)}
        />
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        isNextDisabled={formData.images.length === 0}
      />
    </>
  )
}
