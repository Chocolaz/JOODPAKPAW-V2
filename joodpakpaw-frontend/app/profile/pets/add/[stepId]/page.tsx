'use client'

import React from 'react' // Import React explicitly
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAddPet } from '../_context/AddPetContext'
import { addPetStepsComponents } from '../steps' // Import the centralized steps
import { useAuth } from '@/app/_components/AuthContext'

export default function AddPetDynamicStepsPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, loading: authLoading, logout } = useAuth()
  const stepId = parseInt(params.stepId as string, 10)
  const { highestStepReached, setHighestStepReached, isLoading } = useAddPet()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      logout()
      router.push('/authen')
    }
  }, [authLoading, isAuthenticated, router, logout])

  useEffect(() => {
    if (!isLoading) {
      if (stepId > highestStepReached + 1) {
        router.push('/profile/pets/add/1')
      }
    }
  }, [stepId, highestStepReached, isLoading, router])

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
    const props: any = { key: `step-${stepNumber}` }

    if (stepNumber > 1) {
      props.onBack = handleBack
    }
    if (stepNumber < addPetStepsComponents.length) {
      props.onNext = handleNext
    }

    return React.createElement(StepComponent, props)
  })

  const renderStep = () => {
    if (stepId > 0 && stepId <= steps.length) {
      return steps[stepId - 1]
    }
    return <div>Invalid Step</div>
  }

  if (isLoading || authLoading || stepId > highestStepReached + 1) {
    return (
      <div className="flex flex-col w-full mt-5 animate-pulse">
        <div className="h-7 bg-gray-200 rounded-lg w-48 mx-auto mb-2" />
        <div className="h-4 bg-gray-100 rounded w-32 mx-auto mb-8" />
        <div className="flex justify-center gap-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="w-[150px] h-[150px] bg-gray-100 rounded-[20px]" />
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
