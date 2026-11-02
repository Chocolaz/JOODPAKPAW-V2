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

  if (loading) return (
    <>
      <div className="w-full text-center mt-5 animate-pulse">
        <div className="h-7 w-72 bg-gray-200 rounded-lg mx-auto mb-3" />
        <div className="h-4 w-48 bg-gray-100 rounded mx-auto mb-6" />
        <div className="space-y-10">
          {[1, 2, 3].map((g) => (
            <div key={g}>
              <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
              <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((c) => (
                  <div key={c} className="h-16 rounded-[14px] bg-gray-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <StepNavigation onBack={onBack} onNext={onNext} isNextDisabled />
    </>
  )
  if (error) return <div className="text-red-500 mt-20">{error}</div>

  return (
    <>
      <div className="w-full text-center mt-5">
        <h3 className="text-deep-teal">
          What facilities does your property offer?
        </h3>
        <p className="mb-6 text-neutral-gray text-sm">
          Select all the facilities available for pets
        </p>

        <div className="max-h-[57vh] overflow-y-auto scrollbar-modern pr-2 space-y-10 mb-20">
          {Object.entries(groupedFacilities).map(([category, facilities]) => (
            <div key={category}>
              <h5 className="text-left text-deep-teal capitalize mb-4">
                {category}
              </h5>

              <div className="grid grid-cols-2 gap-6">
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
