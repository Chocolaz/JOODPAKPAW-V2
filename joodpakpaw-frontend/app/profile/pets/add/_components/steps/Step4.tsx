'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Plus, Minus, Calendar, Zap } from 'lucide-react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { WizardStepHeader } from '../WizardStepHeader'
import { ENERGY_LEVELS } from '../../_constants/petWizard'
import { cn } from '@/lib/utils'

export function Step4({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [showExactDate, setShowExactDate] = useState(
    Boolean(formData.isExactBirthDate || formData.petBirthDate)
  )

  const years = formData.ageYears ?? 1
  const months = formData.ageMonths ?? 0
  const petName = formData.petName || 'your pet'

  useEffect(() => {
    if (formData.ageYears === null || formData.ageYears === undefined) {
      updateField('ageYears', 1)
      updateField('ageMonths', 0)
    }
  }, [formData.ageYears, updateField])

  const handleYearChange = (delta: number) => {
    const nextVal = Math.max(0, Math.min(30, years + delta))
    updateField('ageYears', nextVal)
    if (!showExactDate) {
      updateField('petBirthDate', null)
    }
  }

  const handleMonthChange = (delta: number) => {
    let nextMonths = months + delta
    let nextYears = years

    if (nextMonths > 11) {
      nextYears = Math.min(30, nextYears + 1)
      nextMonths = 0
    } else if (nextMonths < 0) {
      if (nextYears > 0) {
        nextYears -= 1
        nextMonths = 11
      } else {
        nextMonths = 0
      }
    }

    updateField('ageYears', nextYears)
    updateField('ageMonths', nextMonths)
    if (!showExactDate) {
      updateField('petBirthDate', null)
    }
  }

  const handleExactDateChange = (dateStr: string) => {
    updateField('petBirthDate', dateStr)
    if (dateStr) {
      const birth = new Date(dateStr)
      const now = new Date()
      let totalMonths =
        (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
      if (now.getDate() < birth.getDate()) totalMonths--
      if (totalMonths >= 0) {
        updateField('ageYears', Math.floor(totalMonths / 12))
        updateField('ageMonths', totalMonths % 12)
      }
    }
  }

  const formattedAge =
    years === 0 && months === 0
      ? 'Newborn'
      : [
          years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
          months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '',
        ]
          .filter(Boolean)
          .join(' ')

  const hasValidAge = years > 0 || months > 0 || Boolean(formData.petBirthDate)
  const isNextDisabled = !hasValidAge || !formData.petActivityLevel

  return (
    <>
      <div className="w-full mt-6">
        <WizardStepHeader
          title="Age and energy level"
          description={`Help hosts understand ${petName}'s life stage and daily exercise needs`}
        />

        <div className="max-w-lg mx-auto space-y-6 pb-6">
          {/* Estimated Age Card */}
          <div className="p-5 rounded-2xl bg-white border border-[#323232]/10 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-deep-teal">
                  Estimated age
                </h3>
                <p className="text-xs text-neutral-gray mt-0.5">
                  Approximate years and months
                </p>
              </div>

              <span className="text-xs font-medium text-deep-teal bg-off-white px-3 py-1 rounded-lg border border-[#323232]/10 tabular-nums">
                {formattedAge}
              </span>
            </div>

            {/* Years & Months Steppers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Years Stepper */}
              <div className="flex flex-col p-3.5 rounded-xl bg-off-white/60 border border-[#323232]/10">
                <span className="text-xs font-medium text-neutral-gray mb-2">
                  Years
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleYearChange(-1)}
                    disabled={years <= 0}
                    aria-label="Decrease years"
                    className="w-8 h-8 rounded-lg bg-white border border-[#323232]/15 flex items-center justify-center text-deep-teal disabled:opacity-30 hover:border-accent-orange transition-colors duration-150 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" strokeWidth={1.5} />
                  </button>

                  <span className="text-lg font-medium tabular-nums text-deep-teal">
                    {years}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleYearChange(1)}
                    disabled={years >= 30}
                    aria-label="Increase years"
                    className="w-8 h-8 rounded-lg bg-white border border-[#323232]/15 flex items-center justify-center text-deep-teal disabled:opacity-30 hover:border-accent-orange transition-colors duration-150 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Months Stepper */}
              <div className="flex flex-col p-3.5 rounded-xl bg-off-white/60 border border-[#323232]/10">
                <span className="text-xs font-medium text-neutral-gray mb-2">
                  Months
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    disabled={years <= 0 && months <= 0}
                    aria-label="Decrease months"
                    className="w-8 h-8 rounded-lg bg-white border border-[#323232]/15 flex items-center justify-center text-deep-teal disabled:opacity-30 hover:border-accent-orange transition-colors duration-150 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" strokeWidth={1.5} />
                  </button>

                  <span className="text-lg font-medium tabular-nums text-deep-teal">
                    {months}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    aria-label="Increase months"
                    className="w-8 h-8 rounded-lg bg-white border border-[#323232]/15 flex items-center justify-center text-deep-teal hover:border-accent-orange transition-colors duration-150 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Exact Birthdate Toggle */}
            <div className="pt-3 border-t border-[#323232]/10">
              <button
                type="button"
                onClick={() => {
                  const nextState = !showExactDate
                  setShowExactDate(nextState)
                  updateField('isExactBirthDate', nextState)
                  if (!nextState) updateField('petBirthDate', null)
                }}
                className="flex items-center gap-2 text-xs text-neutral-gray hover:text-deep-teal transition-colors duration-150 cursor-pointer"
              >
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                <span>
                  {showExactDate ? 'Hide exact birthdate' : 'I know the exact birthdate'}
                </span>
              </button>

              {showExactDate && (
                <div className="mt-3">
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={formData.petBirthDate || ''}
                    onChange={(e) => handleExactDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#323232]/15 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent-orange/25 focus:border-accent-orange tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Energy & Activity Level Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-deep-teal">
              <Zap className="w-4 h-4 text-neutral-gray" strokeWidth={1.5} />
              <h3 className="text-sm font-medium">
                Energy and activity level <span className="text-accent-orange">*</span>
              </h3>
            </div>

            <div className="space-y-2.5">
              {ENERGY_LEVELS.map((level) => {
                const isSelected = formData.petActivityLevel === level.rating
                return (
                  <button
                    key={level.rating}
                    type="button"
                    onClick={() => updateField('petActivityLevel', level.rating)}
                    className={cn(
                      'w-full flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-colors duration-150 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-orange/40',
                      isSelected
                        ? 'border-accent-orange bg-off-white'
                        : 'border-[#323232]/10 bg-white hover:border-deep-teal/30'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg shrink-0 flex items-center justify-center p-1.5 transition-colors duration-150',
                        isSelected ? 'bg-white' : 'bg-off-white/70'
                      )}
                    >
                      <Image
                        src={level.iconSrc}
                        alt={level.title}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-9 h-9 object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-deep-teal">
                          {level.title}
                        </span>
                        <span className="text-xs text-neutral-gray tabular-nums">
                          Level {level.rating}/5
                        </span>
                      </div>
                      <p className="text-xs text-neutral-gray mt-0.5 leading-snug">
                        {level.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
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
