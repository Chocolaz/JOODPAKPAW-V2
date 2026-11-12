'use client'

import React from 'react'
import { Phone, User, FileText, AlertCircle } from 'lucide-react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { useAuth } from '@/app/_components/AuthContext'
import { WizardStepHeader } from '../WizardStepHeader'

export function Step5({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const { user } = useAuth()

  const petName = formData.petName || 'your pet'

  const handleAutofill = () => {
    if (!user) return
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
    if (fullName) updateField('contactName', fullName)
    if (user.phone) updateField('contactPhone', user.phone)
  }

  const isContactNameValid = Boolean(
    formData.contactName && formData.contactName.trim().length >= 2
  )
  const isPhoneValid = Boolean(
    formData.contactPhone && formData.contactPhone.trim().length >= 8
  )
  const isNextDisabled = !isContactNameValid || !isPhoneValid

  return (
    <>
      <div className="w-full mt-6">
        <WizardStepHeader
          title="Emergency and care instructions"
          description="Provide an emergency contact and any medical or dietary notes for the host"
        />

        <div className="max-w-lg mx-auto space-y-6 pb-6">
          {/* Quick Autofill Banner */}
          {user && (!formData.contactName || !formData.contactPhone) && (
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-off-white border border-[#323232]/10">
              <div className="flex items-center gap-2.5 text-deep-teal">
                <User className="w-4 h-4 shrink-0 text-neutral-gray" strokeWidth={1.5} />
                <span className="text-xs font-medium">
                  Use my account contact details
                </span>
              </div>
              <button
                type="button"
                onClick={handleAutofill}
                className="text-xs font-medium text-white bg-deep-teal hover:bg-deep-teal/90 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer shrink-0"
              >
                Autofill
              </button>
            </div>
          )}

          {/* Contact Name Input */}
          <div className="space-y-2">
            <label
              htmlFor="contact-name-input"
              className="flex items-center gap-2 text-sm font-medium text-deep-teal"
            >
              <User className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
              <span>
                Emergency contact name <span className="text-accent-orange">*</span>
              </span>
            </label>
            <input
              id="contact-name-input"
              type="text"
              value={formData.contactName || ''}
              onChange={(e) => updateField('contactName', e.target.value)}
              placeholder="e.g. Alice Smith"
              maxLength={70}
              className="w-full px-4 py-3 text-sm bg-white border border-[#323232]/15 rounded-xl text-foreground placeholder:text-neutral-gray/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange transition-colors duration-150"
            />
          </div>

          {/* Contact Phone Input */}
          <div className="space-y-2">
            <label
              htmlFor="contact-phone-input"
              className="flex items-center gap-2 text-sm font-medium text-deep-teal"
            >
              <Phone className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
              <span>
                Emergency phone number <span className="text-accent-orange">*</span>
              </span>
            </label>
            <input
              id="contact-phone-input"
              type="tel"
              value={formData.contactPhone || ''}
              onChange={(e) => updateField('contactPhone', e.target.value)}
              placeholder="e.g. 0812345678"
              maxLength={20}
              className="w-full px-4 py-3 text-sm bg-white border border-[#323232]/15 rounded-xl text-foreground placeholder:text-neutral-gray/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange transition-colors duration-150 tabular-nums"
            />
          </div>

          {/* Special Boarding Notes Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pet-note-input"
                className="flex items-center gap-2 text-sm font-medium text-deep-teal"
              >
                <FileText className="w-4 h-4 text-neutral-gray shrink-0" strokeWidth={1.5} />
                <span>Special care and boarding notes</span>
              </label>
              <span className="text-xs text-neutral-gray">Optional</span>
            </div>
            <textarea
              id="pet-note-input"
              rows={4}
              value={formData.petNote || ''}
              onChange={(e) => updateField('petNote', e.target.value)}
              placeholder={`Diet, medications, anxiety triggers, or sleeping habits for ${petName}`}
              maxLength={500}
              className="w-full px-4 py-3 text-sm bg-white border border-[#323232]/15 rounded-xl text-foreground placeholder:text-neutral-gray/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange transition-colors duration-150 resize-none"
            />
            <div className="flex justify-between items-center text-xs text-neutral-gray pt-0.5">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>Shared with the host upon booking</span>
              </span>
              <span className="tabular-nums">{(formData.petNote || '').length}/500</span>
            </div>
          </div>
        </div>
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        isNextDisabled={isNextDisabled}
      />
    </>
  )
}
