'use client'

import React from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { useAuth } from '@/app/_components/AuthContext'
import { Phone, User, FileText, Sparkles, AlertCircle } from 'lucide-react'

export function Step5({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const { user } = useAuth()

  const petName = formData.petName || 'your pet'

  const handleAutofill = () => {
    if (!user) return
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || ''
    if (fullName) updateField('contactName', fullName)
    if (user.phone) updateField('contactPhone', user.phone)
  }

  const isContactNameValid = Boolean(formData.contactName && formData.contactName.trim().length >= 2)
  const isPhoneValid = Boolean(formData.contactPhone && formData.contactPhone.trim().length >= 8)
  const isNextDisabled = !isContactNameValid || !isPhoneValid

  return (
    <>
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-6 sm:mb-8">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 5 of 6
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Emergency & Care Instructions
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Provide an emergency contact and any medical or dietary needs for the host while boarding.
          </p>
        </header>

        <div className="max-w-md mx-auto space-y-6 pb-6">
          {/* Quick Autofill Banner */}
          {user && (!formData.contactName || !formData.contactPhone) && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                  Use my account contact details
                </span>
              </div>
              <button
                type="button"
                onClick={handleAutofill}
                className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/60 transition-colors"
              >
                Autofill
              </button>
            </div>
          )}

          {/* Contact Name Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="contact-name-input"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300"
            >
              <User className="w-3.5 h-3.5 text-stone-400" />
              <span>
                Emergency Contact Name <span className="text-rose-500">*</span>
              </span>
            </label>
            <input
              id="contact-name-input"
              type="text"
              value={formData.contactName || ''}
              onChange={(e) => updateField('contactName', e.target.value)}
              placeholder="e.g. Alice Smith (Parent / Guardian)"
              maxLength={70}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm font-medium"
            />
          </div>

          {/* Contact Phone Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="contact-phone-input"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300"
            >
              <Phone className="w-3.5 h-3.5 text-stone-400" />
              <span>
                Emergency Phone Number <span className="text-rose-500">*</span>
              </span>
            </label>
            <input
              id="contact-phone-input"
              type="tel"
              value={formData.contactPhone || ''}
              onChange={(e) => updateField('contactPhone', e.target.value)}
              placeholder="e.g. 0812345678"
              maxLength={20}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm font-medium font-mono"
            />
          </div>

          {/* Special Boarding Notes Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pet-note-input"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300"
              >
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                <span>Special Care & Boarding Notes</span>
              </label>
              <span className="text-[11px] text-stone-400">Optional</span>
            </div>
            <textarea
              id="pet-note-input"
              rows={4}
              value={formData.petNote || ''}
              onChange={(e) => updateField('petNote', e.target.value)}
              placeholder={`Tell the host about ${petName}'s diet, medications, thunderstorm anxiety, or favorite sleeping habits...`}
              maxLength={500}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-sm resize-none"
            />
            <div className="flex justify-between items-center text-[11px] text-stone-400 pt-0.5">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-stone-400" />
                Shared securely with host upon booking
              </span>
              <span>{(formData.petNote || '').length}/500</span>
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
