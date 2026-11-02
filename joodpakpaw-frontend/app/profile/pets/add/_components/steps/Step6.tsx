'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { StepNavigation } from '@/app/profile/host/add-property/_components/StepNavigation'
import { cn } from '@/lib/utils'
import { useAddPet } from '../../_context/AddPetContext'
import { Baby } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Step6Props {
  onNext: () => void
  onBack: () => void
}

export function Step6({ onNext, onBack }: Step6Props) {
  const { formData, updateField } = useAddPet()
  const petImageSrc =
    formData.petImage instanceof File
      ? URL.createObjectURL(formData.petImage)
      : null

  // Pre-populate from saved petBirthDate on back navigation
  const existingParts = formData.petBirthDate?.split('-')
  const [year, setYear] = useState<number | undefined>(
    existingParts ? parseInt(existingParts[0]) : undefined,
  )
  const [month, setMonth] = useState<number | undefined>(
    existingParts ? parseInt(existingParts[1]) : undefined,
  )
  const [day, setDay] = useState<number | undefined>(
    existingParts ? parseInt(existingParts[2]) : undefined,
  )

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(0, i).toLocaleString('default', { month: 'long' }),
  }))
  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  useEffect(() => {
    if (year && month && day) {
      updateField(
        'petBirthDate',
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      )
    }
  }, [year, month, day, updateField])

  return (
    <div className="flex flex-col flex-grow w-full">
      <div className="w-full text-center mt-5">
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
          How old is {formData.petName || 'your pet'}?
        </h3>
        <p className="mb-6 text-neutral-gray text-sm">
          It doesn&apos;t have to be exact — an estimate is fine!
        </p>

        <div className="grid grid-cols-3 gap-2 w-full max-w-sm mx-auto">
          <Select
            value={year !== undefined ? String(year) : undefined}
            onValueChange={(v) => setYear(parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={month !== undefined ? String(month) : undefined}
            onValueChange={(v) => setMonth(parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={day !== undefined ? String(day) : undefined}
            onValueChange={(v) => setDay(parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        isNextDisabled={!year || !month || !day}
      />
    </div>
  )
}
