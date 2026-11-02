'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { useAuth } from '@/app/_components/AuthContext'
import { getProfile } from '@/lib/api'
import { Baby, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Step8Props {
  onNext: () => void
  onBack: () => void
}

export function Step8({ onNext, onBack }: Step8Props) {
  const { formData, updateField } = useAddPet()
  const { user } = useAuth()
  const petImageSrc =
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null

  const [autoFilled, setAutoFilled] = useState(false)

  // Autofill from profile if fields are empty on first visit
  useEffect(() => {
    const alreadyFilled = formData.contactName || formData.contactPhone
    if (alreadyFilled) return

    const fullName = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : ''

    const fill = (phone: string) => {
      if (fullName) updateField('contactName', fullName)
      if (phone) updateField('contactPhone', phone)
      if (fullName || phone) setAutoFilled(true)
    }

    // Try to get phone from profile endpoint
    getProfile()
      .then((res) => fill(res.data.phone ?? ''))
      .catch(() => {
        // Fallback: fill name only
        if (fullName) {
          updateField('contactName', fullName)
          setAutoFilled(true)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fillFromProfile = () => {
    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : ''
    getProfile()
      .then((res) => {
        if (fullName) updateField('contactName', fullName)
        if (res.data.phone) updateField('contactPhone', res.data.phone)
        setAutoFilled(true)
      })
      .catch(() => {
        if (fullName) updateField('contactName', fullName)
        setAutoFilled(true)
      })
  }

  const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 3 && value.length <= 6) {
      value = value.slice(0, 3) + '-' + value.slice(3)
    } else if (value.length > 6) {
      value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10)
    }
    updateField('contactPhone', value)
    setAutoFilled(false)
  }

  return (
    <div className="flex flex-col flex-grow w-full">
      <div className="w-full text-center mt-5">
        {/* Pet avatar */}
        <div className="flex justify-center mb-8">
          <div
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border relative',
              petImageSrc ? 'border-positive-green' : 'border-deep-teal',
            )}
          >
            {petImageSrc ? (
              <Image
                src={petImageSrc}
                alt={formData.petName || 'Pet image'}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              <Baby className="w-16 h-16 text-gray-500" />
            )}
          </div>
        </div>

        <h3 className="text-deep-teal text-2xl font-semibold">
          Emergency Contact
        </h3>
        <p className="mb-6 text-neutral-gray text-sm">
          Who should hosts call if they need to reach you?
        </p>

        <div className="w-full max-w-xs lg:max-w-lg mx-auto space-y-4 text-left">
          {/* Auto-fill banner */}
          {autoFilled ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50 border border-teal-100">
              <UserCheck className="w-4 h-4 text-deep-teal shrink-0" />
              <p className="text-xs text-deep-teal">
                Pre-filled from your profile — feel free to edit
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={fillFromProfile}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-deep-teal/30 hover:border-deep-teal/60 hover:bg-teal-50/50 transition-colors text-left"
            >
              <UserCheck className="w-4 h-4 text-deep-teal/60 shrink-0" />
              <p className="text-xs text-deep-teal/70">
                Use my profile info
              </p>
            </button>
          )}

          <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
            <div>
              <label className="text-sm font-medium text-deep-teal mb-1 block">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                placeholder="Contact person name"
                value={formData.contactName || ''}
                onChange={(e) => {
                  updateField('contactName', e.target.value)
                  setAutoFilled(false)
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-deep-teal mb-1 block">
                Phone <span className="text-red-400">*</span>
              </label>
              <Input
                type="tel"
                placeholder="Telephone number"
                value={formData.contactPhone || ''}
                onChange={handleContactPhoneChange}
                maxLength={12}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-deep-teal mb-1 block">
              Notes{' '}
              <span className="text-neutral-gray font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Anything about the pet that others should know"
              value={formData.petNote || ''}
              onChange={(e) => updateField('petNote', e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!formData.contactName || !formData.contactPhone}
      />
    </div>
  )
}
