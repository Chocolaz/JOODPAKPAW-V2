'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createProperty } from '@/lib/api'
import { useAddProperty } from '../../_context/AddPropertyContext'
import { propertyTypes } from '../../_constants'
import { StepNavigation } from '../StepNavigation'
import { useFacilities } from '../../_hooks/useFacilities'
import { CreatePropertyResponse } from '@/types'
import { cn } from '@/lib/utils'

export function Step7({ onBack }: { onBack: () => void }) {
  const { formData, updateField } = useAddProperty()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { facilities } = useFacilities()

  const handleSubmit = async () => {
    if (formData.propertyId) {
      router.push('/profile/host/add-property/8')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const res = (await createProperty(formData)) as CreatePropertyResponse
      const propertyId = res?.data?.id
      if (!propertyId) throw new Error('Property ID not returned from server')
      updateField('propertyId', propertyId)
      toast.success('Listing created successfully!')
      router.push('/profile/host/add-property/8')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create property.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const address = [
    formData.address,
    formData.district,
    formData.province,
    formData.country,
    formData.zipcode,
  ]
    .filter(Boolean)
    .join(', ')

  const selectedFacilityNames = useMemo(
    () => facilities.filter((f) => formData.facilities.includes(f.id)).map((f) => f.name),
    [facilities, formData.facilities]
  )

  const thumbnails = useMemo(
    () => formData.images.slice(0, 4).map((file) => URL.createObjectURL(file)),
    [formData.images]
  )

  const basicComplete = !!(formData.title && formData.description && formData.propertyTypeId)
  const locationComplete = !!(formData.province && formData.district && formData.address && formData.zipcode)
  const photosComplete = formData.images.length > 0
  const allComplete = basicComplete && locationComplete && photosComplete

  const sections = [
    {
      title: 'Basic Information',
      editStep: 4,
      isComplete: basicComplete,
      content: (
        <div className="space-y-2.5">
          <ReviewItem label="Title" value={formData.title} />
          <ReviewItem label="Description" value={formData.description} />
          <ReviewItem
            label="Property Type"
            value={propertyTypes.find((p) => p.id === formData.propertyTypeId)?.name}
          />
        </div>
      ),
    },
    {
      title: 'Location',
      editStep: 2,
      isComplete: locationComplete,
      content: <ReviewItem label="Address" value={address} />,
    },
    {
      title: 'Facilities',
      editStep: 5,
      isComplete: true,
      content: selectedFacilityNames.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedFacilityNames.map((name) => (
            <span
              key={name}
              className="text-xs bg-teal-50 text-deep-teal border border-teal-100 px-2 py-0.5 rounded-full"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-gray italic">None selected</p>
      ),
    },
    {
      title: 'Photos',
      editStep: 6,
      isComplete: photosComplete,
      content: formData.images.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {thumbnails.map((src, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200">
              <Image src={src} alt={`Photo ${i + 1}`} fill className="object-cover" />
            </div>
          ))}
          {formData.images.length > 4 && (
            <div className="w-16 h-16 rounded-lg border border-neutral-200 bg-gray-50 flex items-center justify-center text-xs text-neutral-gray font-medium">
              +{formData.images.length - 4}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-amber-500 italic">No photos uploaded</p>
      ),
    },
  ]

  return (
    <>
      <div className="w-full text-left mt-6">
        <h3 className="font-bold mb-1 text-deep-teal">Review your listing</h3>
        <p className="text-neutral-gray text-sm mb-6">
          Click any section to make changes before submitting.
        </p>
      </div>

      <div className="w-full overflow-y-auto scrollbar-modern max-h-[60vh] pb-14">
        <div className="space-y-4">
          {sections.map(({ title, editStep, isComplete, content }) => (
            <section
              key={title}
              className="bg-white rounded-xl border border-neutral-200 px-5 py-4 cursor-pointer hover:bg-neutral-50 transition-colors group"
              onClick={() => router.push(`/profile/host/add-property/${editStep}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-positive-green shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <h4 className="font-semibold text-deep-teal">{title}</h4>
                </div>
                <Pencil className="w-3.5 h-3.5 text-neutral-gray group-hover:text-deep-teal transition-colors shrink-0" />
              </div>
              {content}
            </section>
          ))}
        </div>
      </div>

      {error && (
        <div className="w-full mb-2 p-3 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {!allComplete && (
        <p className="text-xs text-amber-500 text-center mb-2">
          Complete all required sections before submitting.
        </p>
      )}

      <StepNavigation
        onBack={onBack}
        onNext={handleSubmit}
        isNextDisabled={!allComplete}
        isSubmitting={isSubmitting}
        nextText="Submit"
      />
    </>
  )
}

function ReviewItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-xs text-neutral-gray uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium', value ? 'text-neutral-dark' : 'text-red-400 italic')}>
        {value || 'Not set'}
      </p>
    </div>
  )
}
