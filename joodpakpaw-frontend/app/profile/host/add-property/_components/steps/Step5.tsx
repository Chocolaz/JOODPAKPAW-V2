'use client'

import { useAddProperty } from '../../_context/AddPropertyContext'
import { useGroupedFacilities } from '../../../_hooks/useGroupedFacilities'
import { FacilityCard } from '../../../_components/FacilityCard'
import { StepNavigation } from '../StepNavigation'

export function Step5({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { formData, updateField } = useAddProperty()
  const { groupedFacilities, loading, error } = useGroupedFacilities()

  const handleToggle = (facilityId: number) => {
    const updated = formData.facilities.includes(facilityId)
      ? formData.facilities.filter((id) => id !== facilityId)
      : [...formData.facilities, facilityId]

    updateField('facilities', updated)
  }

  if (loading) {
    return (
      <>
        <div className="w-full text-center mt-5 pb-24 animate-pulse motion-reduce:animate-none">
          <div className="h-7 w-72 bg-gray-200 rounded-lg mx-auto mb-3" />
          <div className="h-4 w-48 bg-gray-100 rounded mx-auto mb-6" />
          <div className="space-y-8">
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((c) => (
                    <div key={c} className="h-16 rounded-2xl bg-gray-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <StepNavigation onBack={onBack} onNext={onNext} isNextDisabled />
      </>
    )
  }

  if (error) {
    return <div className="text-red-600 text-sm mt-20 text-center">{error}</div>
  }

  return (
    <>
      <div className="w-full text-center mt-5 pb-24">
        <h3 className="text-deep-teal">
          What facilities does your property offer?
        </h3>
        <p className="mb-6 text-neutral-gray text-sm mt-1">
          Select all pet care facilities available at your space
        </p>

        <div className="max-h-[58vh] overflow-y-auto modern-scrollbar pr-2 space-y-8">
          {Object.entries(groupedFacilities).map(([category, facilities]) => (
            <div key={category}>
              <h5 className="text-left text-deep-teal capitalize font-semibold mb-3">
                {category}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {facilities.map((facility) => (
                  <FacilityCard
                    key={facility.id}
                    facility={facility}
                    selected={formData.facilities.includes(facility.id)}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <StepNavigation onBack={onBack} onNext={onNext} />
    </>
  )
}
