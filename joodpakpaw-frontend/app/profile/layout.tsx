'use client'
// app/profile/layout.tsx
import React, { ReactNode, useEffect } from 'react'
import { useNormalizedPathname } from '@/app/_hooks/useNormalizedPathname'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProfileHeader } from './_components/ProfileHeader'
import { HostBanner } from './_components/HostBanner'
import { DesktopStepper } from './host/add-property/_components/DesktopStepper'
import { DesktopPetStepper } from './pets/add/_components/DesktopPetStepper'
import { PetsBanner } from './pets/_components/PetsBanner'
import { AddPetBanner } from './pets/add/_components/AddPetBanner'
import { addPetStepsComponents } from './pets/add/steps' // Import the steps array
import { ProfileProvider, useProfileContext } from './ProfileContext'
import { useAuth } from '@/app/_components/AuthContext'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

function LayoutContent({ children }: { children: ReactNode }) {
  const normalizedPath = useNormalizedPathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromNotifications = searchParams.get('from') === 'notifications'
  const { menu, hostProperties, petProfiles } = useProfileContext()
  const { isAuthenticated, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !isAuthenticated && normalizedPath !== '/profile') {
      router.replace('/profile')
    }
  }, [isAuthenticated, authLoading, normalizedPath, router])

  // Only block rendering when the user is not yet authenticated.
  // Do NOT unmount children during a refresh (authLoading while already
  // authenticated) — that would remount AddPropertyProvider with empty
  // sessionStorage and trigger the step-guard to redirect to step 1.
  if (!isAuthenticated && (authLoading || normalizedPath !== '/profile')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Determine header properties based on the current path
  const getHeaderProps = () => {
    if (normalizedPath.startsWith('/profile/host/add-property')) {
      return { title: 'Host', backPath: '/profile/host?tab=properties' }
    }
    if (normalizedPath.match(/^\/profile\/host\/booking\/\d+$/)) {
      const bookingId = normalizedPath.split('/').pop()
      return {
        title: `Booking #${bookingId}`,
        backPath: fromNotifications ? '/notifications' : '/profile/host?tab=bookings',
      }
    }
    if (
      normalizedPath.startsWith('/profile/host/') &&
      normalizedPath.split('/').length === 4
    ) {
      // /profile/host/[propertyId]
      return null // Do not show header for this specific page
    }
    if (normalizedPath === '/profile/host') {
      return { title: 'Host', backPath: fromNotifications ? '/notifications' : '/profile' }
    }
    if (normalizedPath === '/profile/pets') {
      return { title: 'Pets', backPath: '/profile' }
    }
    if (normalizedPath.startsWith('/profile/pets/add')) {
      return { title: 'Add Pet', backPath: '/profile/pets' }
    }
    if (normalizedPath.match(/^\/profile\/pets\/\d+$/)) {
      return null // Pet detail page has its own header
    }
    if (normalizedPath === '/profile/bookings') {
      return { title: 'Bookings', backPath: '/profile' }
    }
    if (normalizedPath === '/profile/reports') {
      return { title: 'My Reports', backPath: fromNotifications ? '/notifications' : '/profile' }
    }
    if (normalizedPath.match(/^\/profile\/reports\/\d+$/)) {
      return {
        title: 'Report Detail',
        backPath: fromNotifications ? '/notifications' : '/profile/reports',
      }
    }
    if (normalizedPath.match(/^\/profile\/bookings\/\d+$/)) {
      return {
        title: 'Booking Detail',
        backPath: fromNotifications ? '/notifications' : '/profile/bookings',
      }
    }
    if (normalizedPath === '/profile/verification') {
      return { title: 'Verification', backPath: fromNotifications ? '/notifications' : '/profile' }
    }
    if (normalizedPath.startsWith('/profile/') && normalizedPath !== '/profile') {
      // This covers /profile/[firstName] and other potential sub-pages
      return { title: 'Profile', backPath: '/profile' }
    }
    // Base /profile page
    return { title: 'Profile' }
  }

  const headerProps = getHeaderProps()

  const renderBanner = () => {
    if (normalizedPath.startsWith('/profile/host/add-property')) {
      const stepId = parseInt(normalizedPath.split('/').pop() || '', 10)
      if (!isNaN(stepId)) {
        return <HostBanner currentStep={stepId} totalSteps={9} />
      }
      return null
    }
    if (normalizedPath.startsWith('/profile/pets/add')) {
      const stepId = parseInt(normalizedPath.split('/').pop() || '', 10)
      if (!isNaN(stepId)) {
        return (
          <AddPetBanner
            currentStep={stepId}
            totalSteps={addPetStepsComponents.length}
          />
        )
      }
      return null
    }
    if (normalizedPath === '/profile/host') {
      return null // Banner is rendered inside the host page
    }
    if (normalizedPath === '/profile/pets') {
      const { pets, error } = petProfiles
      if (error) {
        return null
      }
      return <PetsBanner summary={{ total: pets.length }} />
    }
    return null
  }

  const isAddPetFlow = normalizedPath.startsWith('/profile/pets/add')

  return (
    <main className="flex justify-center">
      <div className="w-full">
        {headerProps && <div className="lg:hidden"><ProfileHeader {...headerProps} menu={menu} /></div>}
        <div className={cn(
          headerProps ? 'pt-14 lg:pt-0' : '',
          isAddPetFlow && 'flex flex-col h-[calc(100dvh-56px)] lg:block lg:h-auto overflow-hidden lg:overflow-visible'
        )}>
          {/* Banner — shrink-0 so it never scrolls away on mobile add-pet */}
          <div className={cn('lg:hidden', isAddPetFlow && 'shrink-0')}>{renderBanner()}</div>

          {/* Desktop steppers */}
          {(() => {
            if (normalizedPath.startsWith('/profile/host/add-property')) {
              const stepId = parseInt(normalizedPath.split('/').pop() || '', 10)
              if (!isNaN(stepId) && stepId >= 1 && stepId <= 7) {
                return <div className="hidden lg:block"><DesktopStepper stepId={stepId} /></div>
              }
            }
            if (isAddPetFlow) {
              const stepId = parseInt(normalizedPath.split('/').pop() || '', 10)
              if (!isNaN(stepId) && stepId >= 1 && stepId <= 9) {
                return <div className="hidden lg:block"><DesktopPetStepper stepId={stepId} /></div>
              }
            }
            return null
          })()}

          {/* Scrollable content on mobile add-pet, normal on everything else */}
          <div className={cn(isAddPetFlow && 'flex-1 overflow-y-auto lg:overflow-visible lg:flex-none')}>
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <LayoutContent>{children}</LayoutContent>
    </ProfileProvider>
  )
}
