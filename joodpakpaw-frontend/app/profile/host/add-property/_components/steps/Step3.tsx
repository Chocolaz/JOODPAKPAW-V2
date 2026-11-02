'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import provinces from '../../_data/thailand-provinces.json'
import { Input } from '@/components/ui/input'
import { useAddProperty } from '../../_context/AddPropertyContext'
import { StepNavigation } from '../StepNavigation'
import { ChevronDown, Pencil } from 'lucide-react'

export function Step3({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { formData, updateField } = useAddProperty()

  const [editDistrict, setEditDistrict] = useState(!formData.district)

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.name_en.toLowerCase() === formData.province.toLowerCase()),
    [formData.province]
  )
  const districts = useMemo(() => selectedProvince?.districts ?? [], [selectedProvince])

  const displayDistrict = (name: string) =>
    formData.province
      ? name.replace(new RegExp(`\\s+${formData.province}$`, 'i'), '').trim()
      : name

  const handleDistrictChange = (e: ChangeEvent<HTMLSelectElement>) => {
    updateField('district', e.target.value)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'zipcode') {
      updateField('zipcode', value.replace(/\D/g, '').slice(0, 5))
      return
    }
    updateField(name as keyof typeof formData, value)
  }

  const handleBack = () => {
    updateField('district', formData.geocodedDistrict)
    onBack()
  }

  const districtDiffers =
    editDistrict && !!formData.geocodedDistrict && formData.district !== formData.geocodedDistrict

  const isFormValid =
    formData.province.trim() !== '' &&
    formData.district.trim() !== '' &&
    formData.address.trim() !== '' &&
    formData.zipcode.trim().length === 5

  const selectClass =
    'w-full p-4 pr-12 text-lg rounded-lg border border-input bg-transparent shadow-sm font-[inherit] appearance-none focus:outline-none focus:ring-1 focus:ring-accent-orange disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <>
      <div className="w-full text-center mt-10 pb-24">
        <h3 className="text-deep-teal">Confirm your address</h3>
        <p className="mb-6 text-neutral-gray text-sm">
          We&apos;ve auto-filled your address based on the location you picked.
          Edit anything that looks wrong.
        </p>

        <div className="space-y-4 text-left pb-4">
          <div>
            <label className="text-sm font-medium text-deep-teal mb-1 block">Country</label>
            <Input value="Thailand" disabled className="cursor-not-allowed" />
          </div>

          <div>
            <label className="text-sm font-medium text-deep-teal mb-1 block">Province</label>
            <Input value={formData.province} disabled className="cursor-not-allowed" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-deep-teal">District</label>
              {!editDistrict && (
                <button
                  type="button"
                  onClick={() => setEditDistrict(true)}
                  className="flex items-center gap-1 text-xs text-accent-orange hover:underline"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>
            {editDistrict ? (
              <div className="space-y-1">
                <div className="relative">
                  <select
                    value={formData.district}
                    onChange={handleDistrictChange}
                    disabled={!selectedProvince}
                    className={selectClass}
                  >
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.name_en}>{displayDistrict(d.name_en)}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
                {districtDiffers && (
                  <p className="text-xs text-amber-500">
                    Your pin is in {formData.geocodedDistrict}. This mismatch may affect how your property appears in search results.
                  </p>
                )}
              </div>
            ) : (
              <Input value={displayDistrict(formData.district)} disabled className="cursor-not-allowed" />
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-deep-teal mb-1 block">Address</label>
            <Input
              name="address"
              placeholder="Street address"
              value={formData.address}
              maxLength={120}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-deep-teal mb-1 block">Zipcode</label>
            <Input
              name="zipcode"
              placeholder="Zipcode"
              value={formData.zipcode}
              maxLength={5}
              inputMode="numeric"
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <StepNavigation onBack={handleBack} onNext={onNext} isNextDisabled={!isFormValid} />
    </>
  )
}
