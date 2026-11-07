'use client'

import React, { useState, useEffect } from 'react'
import { useAddPet } from '../../_context/AddPetContext'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { Plus, Minus, Calendar, Zap, Sparkles } from 'lucide-react'

const ENERGY_LEVELS = [
  {
    rating: 1,
    emoji: '🛋️',
    title: 'Couch Potato',
    desc: 'Sleeps most of the day, gentle strolls, calm temperament',
  },
  {
    rating: 2,
    emoji: '🚶',
    title: 'Mellow',
    desc: 'Low energy, enjoys lounging and brief casual walks',
  },
  {
    rating: 3,
    emoji: '🐕',
    title: 'Balanced',
    desc: 'Moderate energy, loves daily play sessions and walks',
  },
  {
    rating: 4,
    emoji: '🎾',
    title: 'High Energy',
    desc: 'Very active, athletic, loves running and retrieving',
  },
  {
    rating: 5,
    emoji: '⚡',
    title: 'Hyperactive',
    desc: 'Boundless stamina, high endurance, needs intensive exercise',
  },
]

export function Step4({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { formData, updateField } = useAddPet()
  const [showExactDate, setShowExactDate] = useState(Boolean(formData.isExactBirthDate || formData.petBirthDate))

  const years = formData.ageYears ?? 1
  const months = formData.ageMonths ?? 0
  const petName = formData.petName || 'your pet'

  // Sync default age if not yet initialized
  useEffect(() => {
    if (formData.ageYears === null && formData.ageYears === undefined) {
      updateField('ageYears', 1)
      updateField('ageMonths', 0)
    }
  }, [formData.ageYears, updateField])

  const handleYearChange = (delta: number) => {
    const nextVal = Math.max(0, Math.min(30, years + delta))
    updateField('ageYears', nextVal)
    // Clear exact date if manually stepping
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
      let totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
      if (now.getDate() < birth.getDate()) totalMonths--
      if (totalMonths >= 0) {
        updateField('ageYears', Math.floor(totalMonths / 12))
        updateField('ageMonths', totalMonths % 12)
      }
    }
  }

  const hasValidAge = years > 0 || months > 0 || Boolean(formData.petBirthDate)
  const isNextDisabled = !hasValidAge || !formData.petActivityLevel

  return (
    <>
      <div className="w-full mt-4 sm:mt-6">
        <header className="text-center mb-6 sm:mb-8">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full mb-3 border border-amber-200/60 dark:border-amber-900/50">
            Step 4 of 6
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Age & Energy Level
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Help hosts understand {petName}&apos;s life stage and daily exercise requirements.
          </p>
        </header>

        <div className="max-w-md mx-auto space-y-6 pb-6">
          {/* Estimated Age Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Estimated Age
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Approximate years and months
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/60 dark:border-amber-900/40">
                  <Sparkles className="w-3 h-3" />
                  {years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : ''}{' '}
                  {months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : ''}
                  {years === 0 && months === 0 ? 'Newborn' : ''}
                </span>
              </div>
            </div>

            {/* Years & Months Steppers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Years Stepper */}
              <div className="flex flex-col p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                  Years
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleYearChange(-1)}
                    disabled={years <= 0}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 disabled:opacity-30 hover:border-amber-500 transition-colors shadow-sm"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
                    {years}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleYearChange(1)}
                    disabled={years >= 30}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 disabled:opacity-30 hover:border-amber-500 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Months Stepper */}
              <div className="flex flex-col p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                  Months
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    disabled={years <= 0 && months <= 0}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 disabled:opacity-30 hover:border-amber-500 transition-colors shadow-sm"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
                    {months}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:border-amber-500 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Exact Birthdate Toggle */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  const nextState = !showExactDate
                  setShowExactDate(nextState)
                  updateField('isExactBirthDate', nextState)
                  if (!nextState) updateField('petBirthDate', null)
                }}
                className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {showExactDate ? 'Hide exact birthdate' : 'I know the exact birthdate'}
                </span>
              </button>

              {showExactDate && (
                <div className="mt-3 animate-in fade-in duration-150">
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={formData.petBirthDate || ''}
                    onChange={(e) => handleExactDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Energy & Activity Level Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                Energy & Activity Level <span className="text-rose-500">*</span>
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
                      'w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 text-left transition-all duration-200 outline-none shadow-sm',
                      isSelected
                        ? 'border-amber-500 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-amber-500/10'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                    )}
                  >
                    <span className="text-2xl shrink-0 p-1 rounded-lg bg-stone-100 dark:bg-stone-800">
                      {level.emoji}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {level.title}
                        </span>
                        <span className="text-[11px] font-mono text-stone-400">
                          Level {level.rating}/5
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
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
