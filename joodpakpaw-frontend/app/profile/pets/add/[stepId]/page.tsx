'use client'

import React from 'react' // Import React explicitly
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAddPet } from '../_context/AddPetContext'
import { addPetStepsComponents } from '../steps' // Import the centralized steps
import { useAuth } from '@/app/_components/AuthContext'
import { parsePositiveIntParam } from '@/lib/navigationGuard'

export default function AddPetDynamicStepsPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, loading: authLoading, logout } = useAuth()
  const parsedStepId = parsePositiveIntParam(params.stepId)
  const isOutOfRangeStep =
    parsedStepId === null || parsedStepId > addPetStepsComponents.length
  const stepId = parsedStepId ?? 1
  const { highestStepReached, setHighestStepReached, isLoading } = useAddPet()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      logout()
      router.push('/authen')
    }
  }, [authLoading, isAuthenticated, router, logout])

  useEffect(() => {
    if (!isLoading && !isOutOfRangeStep) {
      if (stepId > highestStepReached + 1) {
        router.push('/profile/pets/add/1')
      }
    }
  }, [stepId, highestStepReached, isLoading, isOutOfRangeStep, router])

  if (isOutOfRangeStep) {
    notFound()
  }

  if (!authLoading && !isAuthenticated) {
    return null
  }

  const handleNext = () => {
    setHighestStepReached(stepId)
    router.push(`/profile/pets/add/${stepId + 1}`)
  }

  const handleBack = () => {
    router.push(`/profile/pets/add/${stepId - 1}`)
  }

  // Dynamically create steps with props
  const steps = addPetStepsComponents.map((StepComponent, index) => {
    const stepNumber = index + 1
    const props: {
      key: string
      onBack?: () => void
      onNext?: () => void
    } = { key: `step-${stepNumber}` }

    if (stepNumber > 1) {
      props.onBack = handleBack
    }
    if (stepNumber < addPetStepsComponents.length) {
      props.onNext = handleNext
    }

    return React.createElement(
      StepComponent as React.ComponentType<typeof props>,
      props
    )
  })

  const renderStep = () => {
    if (stepId > 0 && stepId <= steps.length) {
      return steps[stepId - 1]
    }
    return <div>Invalid Step</div>
  }

  if (isLoading || authLoading || stepId > highestStepReached + 1) {
    return (
      <div className="flex flex-col w-full mt-6">
        <div className="h-7 bg-off-white rounded-lg w-56 mx-auto mb-2" />
        <div className="h-4 bg-off-white/70 rounded w-72 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 bg-off-white/60 rounded-2xl border border-[#323232]/10"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-[500px] lg:max-w-2xl mx-auto w-full px-8 lg:px-12 overflow-x-hidden pb-24">
      {renderStep()}
    </div>
  )
}
