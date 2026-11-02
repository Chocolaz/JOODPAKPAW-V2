'use client'

import { useState } from 'react'
import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { CameraIcon, Dog, Cat } from 'lucide-react'
import { ImageCropModal } from '../ImageCropModal'

interface Step3Props {
  onNext: () => void
  onBack: () => void
}

export function Step3({ onNext, onBack }: Step3Props) {
  const { formData, updateField } = useAddPet()
  const [imagePreview, setImagePreview] = useState<string | null>(
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null,
  )
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const objectUrl = URL.createObjectURL(e.target.files[0])
      setRawImageSrc(objectUrl)
      e.target.value = ''
    }
  }

  const handleCropComplete = (croppedFile: File) => {
    setImagePreview(URL.createObjectURL(croppedFile))
    updateField('petImage', croppedFile)
    setRawImageSrc(null)
  }

  const renderDefaultIcon = () => {
    if (formData.petTypeId === 1) return <Dog className="w-16 h-16 text-neutral-gray" />
    if (formData.petTypeId === 2) return <Cat className="w-16 h-16 text-neutral-gray" />
    return <CameraIcon className="w-16 h-16 text-gray-400" />
  }

  return (
    <>
      {rawImageSrc && (
        <ImageCropModal
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setRawImageSrc(null)}
        />
      )}

      <div className="flex flex-col grow w-full">
        <div className="w-full text-center mt-5">
          <h3 className="text-deep-teal text-2xl font-semibold">
            Add a photo &amp; name
          </h3>
          <p className="mb-6 text-neutral-gray text-sm">
            A great photo helps hosts recognise your pet.
          </p>

          {/* Image upload */}
          <div className="flex justify-center mb-2">
            <label htmlFor="pet-image-upload" className="relative cursor-pointer group">
              <div
                className={cn(
                  'w-40 h-40 rounded-full flex items-center justify-center overflow-hidden border-2 relative transition-colors',
                  imagePreview
                    ? 'border-positive-green'
                    : 'border-dashed border-gray-300 group-hover:border-deep-teal bg-gray-50',
                )}
              >
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Pet preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  renderDefaultIcon()
                )}
              </div>
              <input
                id="pet-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-deep-teal text-white flex items-center justify-center shadow-md group-hover:bg-deep-teal/90 transition-colors">
                <CameraIcon className="w-5 h-5" />
              </div>
            </label>
          </div>

          <p className="text-xs text-neutral-gray mb-8">
            {imagePreview ? 'Tap the photo to change' : 'Tap to upload a photo'}
          </p>

          {/* Name input */}
          <div className="text-left max-w-xs mx-auto">
            <label className="text-sm font-medium text-deep-teal mb-1.5 block">
              Pet Name <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="e.g. Buddy, Mochi, Luna..."
              value={formData.petName || ''}
              onChange={(e) => updateField('petName', e.target.value)}
            />
          </div>
        </div>

        <StepNavigation
          onNext={onNext}
          onBack={onBack}
          isNextDisabled={!formData.petName}
        />
      </div>
    </>
  )
}
