'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { FilterPanel } from '@/app/_components/FilterPanel'
import { useBrowseFilters } from '@/app/_hooks/useBrowseFilters'
import { useAuth } from '@/app/_components/AuthContext'
import { getAllPetProfiles } from '@/lib/api'
import { PetProfile } from '@/types'
import { AirbnbSearchBar } from './AirbnbSearchBar'

interface BrowsePetsContextValue {
  userPets: PetProfile[]
  isPetsLoading: boolean
}

const BrowsePetsContext = createContext<BrowsePetsContextValue>({
  userPets: [],
  isPetsLoading: false,
})

export function useBrowsePets() {
  return useContext(BrowsePetsContext)
}

interface BrowseLayoutClientProps {
  children: React.ReactNode
}

export function BrowseLayoutClient({ children }: BrowseLayoutClientProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [userPets, setUserPets] = useState<PetProfile[]>([])
  const [isPetsLoading, setIsPetsLoading] = useState(false)

  const { isAuthenticated } = useAuth()
  const {
    searchQuery,
    province,
    checkIn,
    checkOut,
    petTypes,
    petSizeCategoryId,
    petProfileIds,
    filters,
    activeFilterCount,
    applyFilters,
    setParams,
  } = useBrowseFilters()
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    if (!isAuthenticated) {
      setUserPets([])
      setIsPetsLoading(false)
      return
    }
    let cancelled = false
    setIsPetsLoading(true)
    getAllPetProfiles()
      .then((res) => {
        if (!cancelled) setUserPets(res.petProfiles ?? [])
      })
      .catch(() => {
        if (!cancelled) setUserPets([])
      })
      .finally(() => {
        if (!cancelled) setIsPetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  return (
    <BrowsePetsContext.Provider value={{ userPets, isPetsLoading }}>
      {/* Unified 3-Part Airbnb Search Pill Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-3 lg:py-3.5">
          <AirbnbSearchBar
            searchQuery={searchQuery}
            province={province}
            checkIn={checkIn}
            checkOut={checkOut}
            petTypes={petTypes}
            petSizeCategoryId={petSizeCategoryId}
            petProfileIds={petProfileIds}
            activeFilterCount={activeFilterCount}
            isAuthenticated={isAuthenticated}
            userPets={userPets}
            onUpdateParams={setParams}
            onFilterClick={() => setIsFilterOpen(true)}
          />
        </div>
      </div>

      <FilterPanel
        isOpen={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onApply={applyFilters}
      />

      <div>{children}</div>
    </BrowsePetsContext.Provider>
  )
}
