'use client'

import { useAddProperty } from '../../_context/AddPropertyContext'
import { StepNavigation } from '../StepNavigation'
import { TitleDescriptionForm } from '@/app/profile/host/_components/TitleDescriptionForm'

export function Step4({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { formData, updateField } = useAddProperty()

  const isFormValid = () => {
    return (
      formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.title.length <= 60 &&
      formData.description.length <= 300
    )
  }

  return (
    <>
      <div className="w-full text-center mt-10">
        <h3 className="text-deep-teal">What’s your property called?</h3>
        <p className="mb-6 text-neutral-gray text-sm">
          Make it easy for pet parents to recognize your space
        </p>

        <TitleDescriptionForm
          title={formData.title}
          description={formData.description}
          onTitleChange={(value) => updateField('title', value)}
          onDescriptionChange={(value) => updateField('description', value)}
        />
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        isNextDisabled={!isFormValid()}
      />
    </>
  )
}
