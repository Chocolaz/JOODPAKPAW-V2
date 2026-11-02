'use client'

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react'
import { PetProfileFormData } from '@/types'

interface AddPetContextType {
  formData: PetProfileFormData
  setFormData: React.Dispatch<React.SetStateAction<PetProfileFormData>>
  updateField: <K extends keyof PetProfileFormData>(
    field: K,
    value: PetProfileFormData[K]
  ) => void
  highestStepReached: number
  setHighestStepReached: (step: number) => void
  isLoading: boolean
  clearAddPetSession: () => void
}

const AddPetContext = createContext<AddPetContextType | undefined>(
  undefined
)

const initialFormData: PetProfileFormData = {
  petTypeId: null,
  petTypeName: null,
  petBreedId: null,
  petBreedName: null,
  petName: null,
  petImage: null,
  petGender: null,
  petSizeCategoryId: null,
  petSizeName: null,
  petBirthDate: null,
  petActivityLevel: null,
  contactName: null,
  contactPhone: null,
  petNote: null,
}

export const AddPetProvider = ({ children }: { children: ReactNode }) => {
  const [formData, setFormData] = useState<PetProfileFormData>(initialFormData)
  const [highestStepReached, setHighestStepReachedState] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem('addPetFormData')
      if (storedData) {
        setFormData((prev) => ({ ...prev, ...JSON.parse(storedData) }))
      }
      const storedStep = sessionStorage.getItem('addPetHighestStepReached')
      if (storedStep) {
        setHighestStepReachedState(parseInt(storedStep, 10))
      }
    } catch (error) {
      console.error('Failed to parse from sessionStorage', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem('addPetFormData', JSON.stringify(formData))
    }
  }, [formData, isLoading])

  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem('addPetHighestStepReached', String(highestStepReached))
    }
  }, [highestStepReached, isLoading])

  const updateField = useCallback(
    <K extends keyof PetProfileFormData>(
      field: K,
      value: PetProfileFormData[K]
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const setHighestStepReached = (step: number) => {
    setHighestStepReachedState((prev) => {
      const newHighest = Math.max(prev, step)
      return newHighest
    })
  }

  const clearAddPetSession = () => {
    sessionStorage.removeItem('addPetFormData')
    sessionStorage.removeItem('addPetHighestStepReached')
  }

  const value = {
    formData,
    setFormData,
    updateField,
    highestStepReached,
    setHighestStepReached,
    isLoading,
    clearAddPetSession,
  }

  return (
    <AddPetContext.Provider value={value}>
      {children}
    </AddPetContext.Provider>
  )
}

export const useAddPet = () => {
  const context = useContext(AddPetContext)
  if (context === undefined) {
    throw new Error('useAddPet must be used within an AddPetProvider')
  }
  return context
}
