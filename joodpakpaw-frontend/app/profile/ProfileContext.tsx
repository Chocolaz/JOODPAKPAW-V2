'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useAuth } from '@/app/_components/AuthContext'
import { useHostProperties } from './host/_hooks/useHostProperties'
import { useUserPets } from './pets/_hooks/useUserPets'
import { Property, PetProfile } from '@/types'

interface HostPropertiesState {
  properties: Property[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface PetProfilesState {
  pets: PetProfile[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface ProfileContextType {
  setMenu: (menu: ReactNode) => void
  menu: ReactNode | null
  hostProperties: HostPropertiesState
  petProfiles: PetProfilesState
}

const ProfileContext = createContext<ProfileContextType>({
  setMenu: () => {},
  menu: null,
  hostProperties: {
    properties: [],
    loading: true,
    error: null,
    refetch: async () => {},
  },
  petProfiles: {
    pets: [],
    loading: true,
    error: null,
    refetch: async () => {},
  },
})

export const useProfileContext = () => useContext(ProfileContext)

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const isHost = user?.role?.some((role) => role.name === 'host')

  const [menu, setMenu] = useState<ReactNode | null>(null)
  const hostProperties = useHostProperties({ enabled: !!isHost })
  const petProfiles = useUserPets({ enabled: !!user })

  return (
    <ProfileContext.Provider
      value={{ menu, setMenu, hostProperties, petProfiles }}
    >
      {children}
    </ProfileContext.Provider>
  )
}
