'use client'

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react'
import { PropertyFormData } from '@/types'

interface AddPropertyContextType {
  formData: PropertyFormData
  setFormData: React.Dispatch<React.SetStateAction<PropertyFormData>>
  updateField: <K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K]
  ) => void
  highestStepReached: number
  setHighestStepReached: (step: number) => void
  isLoading: boolean
  clearAddPropertySession: () => void
}

const AddPropertyContext = createContext<AddPropertyContextType | undefined>(
  undefined
)

const initialFormData: PropertyFormData = {
  propertyId: undefined,
  propertyTypeId: null,
  latitude: '',
  longitude: '',
  country: '',
  province: '',
  district: '',
  geocodedProvince: '',
  geocodedDistrict: '',
  address: '',
  zipcode: '',
  title: '',
  description: '',
  facilities: [],
  images: [],
}

export const AddPropertyProvider = ({ children }: { children: ReactNode }) => {
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData)
  const [highestStepReached, setHighestStepReachedState] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem('addPropertyFormData')
      if (storedData) {
        setFormData((prev) => ({ ...prev, ...JSON.parse(storedData) }))
      }
      const storedStep = sessionStorage.getItem('highestStepReached')
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
      const { images: _images, ...dataToStore } = formData
      void _images
      sessionStorage.setItem('addPropertyFormData', JSON.stringify(dataToStore))
    }
  }, [formData, isLoading])

  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem('highestStepReached', String(highestStepReached))
    }
  }, [highestStepReached, isLoading])

  const updateField = useCallback(
    <K extends keyof PropertyFormData>(
      field: K,
      value: PropertyFormData[K]
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

  const clearAddPropertySession = () => {
    sessionStorage.removeItem('addPropertyFormData')
    sessionStorage.removeItem('highestStepReached')
  }

  const value = {
    formData,
    setFormData,
    updateField,
    highestStepReached,
    setHighestStepReached,
    isLoading,
    clearAddPropertySession,
  }

  return (
    <AddPropertyContext.Provider value={value}>
      {children}
    </AddPropertyContext.Provider>
  )
}

export const useAddProperty = () => {
  const context = useContext(AddPropertyContext)
  if (context === undefined) {
    throw new Error('useAddProperty must be used within an AddPropertyProvider')
  }
  return context
}
