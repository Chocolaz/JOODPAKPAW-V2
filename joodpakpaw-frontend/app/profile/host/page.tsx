'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'
import { useUserProfile } from '@/app/profile/_hooks/useUserProfile'
import { useProfileContext } from '../ProfileContext'
import { getHostBookingsPaginated, getHostReviews } from '@/lib/api'
import { Booking, HostReview } from '@/types'
import {
  HostWorkspaceShell,
  type HostWorkspaceTab,
} from './_components/HostWorkspaceShell'
import { HostOverviewTab } from './_components/HostOverviewTab'
import { HostListingsTab } from './_components/HostListingsTab'
import { HostBookingList } from './_components/HostBookingList'
import { HostBookingHistoryList } from './_components/HostBookingHistoryList'
import { HostReviewsTab } from './_components/HostReviewsTab'
import { UnbanPropertyDrawer } from './_components/UnbanPropertyDrawer'

const UNBAN_ALL_CATEGORY_ID = 11

export default function HostPage() {
  const { user } = useAuth()
  const { profile, refreshProfile } = useUserProfile()
  const {
    hostProperties: { properties, loading, error, refetch },
  } = useProfileContext()

  const router = useRouter()
  const searchParams = useSearchParams()
  const isHost = Boolean(user?.role?.some((role) => role.name === 'host'))

  const [isAppealOpen, setIsAppealOpen] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [reviews, setReviews] = useState<HostReview[]>([])
  const [reviewsTotalRows, setReviewsTotalRows] = useState(0)
  const [bookingFilterOverride, setBookingFilterOverride] = useState<string | null>(null)
  const [reviewFilterOverride, setReviewFilterOverride] = useState<'all' | 'needs_reply' | null>(null)

  const tabParam = searchParams.get('tab') as HostWorkspaceTab | null
  const filterParam = searchParams.get('filter') || 'all'

  const activeTab: HostWorkspaceTab = useMemo(() => {
    if (!isHost) {
      return tabParam === 'overview' ? 'overview' : 'properties'
    }
    if (
      tabParam === 'overview' ||
      tabParam === 'properties' ||
      tabParam === 'bookings' ||
      tabParam === 'history' ||
      tabParam === 'reviews'
    ) {
      return tabParam
    }
    return 'overview'
  }, [isHost, tabParam])

  const loadWorkspaceData = useCallback(async () => {
    if (!isHost || !user?.id) return
    setBookingsLoading(true)
    try {
      const [bookingsRes, reviewsRes] = await Promise.all([
        getHostBookingsPaginated(1, 50).catch(() => null),
        getHostReviews(String(user.id), 1, 20).catch(() => null),
      ])
      if (bookingsRes) {
        setBookings(bookingsRes.data)
      }
      if (reviewsRes) {
        setReviews(reviewsRes.data)
        setReviewsTotalRows(reviewsRes.totalRows)
      }
    } finally {
      setBookingsLoading(false)
    }
  }, [isHost, user?.id])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    void loadWorkspaceData()
  }, [loadWorkspaceData])

  const pendingBookingsCount = useMemo(
    () => bookings.filter((b) => b.bookingStatus.toUpperCase() === 'PENDING').length,
    [bookings]
  )

  const unrepliedReviewsCount = useMemo(
    () => reviews.filter((r) => !r.hostReply).length,
    [reviews]
  )

  const handleSelectTab = useCallback(
    (
      tab: HostWorkspaceTab,
      options?: { filterStatus?: string; reviewFilter?: 'all' | 'needs_reply' }
    ) => {
      if (options?.filterStatus !== undefined) {
        setBookingFilterOverride(options.filterStatus)
      }
      if (options?.reviewFilter !== undefined) {
        setReviewFilterOverride(options.reviewFilter)
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.push(`/profile/host?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleChangeListingFilter = useCallback(
    (f: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'properties')
      params.set('filter', f)
      router.push(`/profile/host?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleOpenCalendarForProperty = useCallback(
    (propertyId: number) => {
      router.push(`/profile/host/${propertyId}`)
    },
    [router]
  )

  return (
    <>
      <UnbanPropertyDrawer
        isOpen={isAppealOpen}
        onOpenChange={setIsAppealOpen}
        reportCategoryId={UNBAN_ALL_CATEGORY_ID}
        onSuccess={refreshProfile}
        quota={profile?.unbanAllPropertiesRequestCount ?? 0}
        suspensionReason={profile?.suspensionReason}
        lastAppealNote={profile?.lastAppealNote}
      />

      <HostWorkspaceShell
        activeTab={activeTab}
        onSelectTab={(tab) => handleSelectTab(tab)}
        user={user}
        profile={profile}
        isHost={isHost}
        listingsCount={properties.length}
        pendingBookingsCount={pendingBookingsCount}
        unrepliedReviewsCount={unrepliedReviewsCount}
        onOpenAppeal={() => setIsAppealOpen(true)}
      >
        {activeTab === 'overview' && (
          <HostOverviewTab
            user={user}
            isHost={isHost}
            properties={properties}
            bookings={bookings}
            bookingsLoading={bookingsLoading}
            reviews={reviews}
            reviewsTotalRows={reviewsTotalRows}
            isAccountBanned={Boolean(profile?.isBannedAllProperties)}
            onNavigateTab={handleSelectTab}
            onDataMutated={loadWorkspaceData}
          />
        )}

        {activeTab === 'properties' && (
          <HostListingsTab
            properties={properties}
            loading={loading}
            error={error}
            filterParam={filterParam}
            onChangeFilter={handleChangeListingFilter}
            isAccountBanned={Boolean(profile?.isBannedAllProperties)}
            onOpenCalendarForProperty={handleOpenCalendarForProperty}
          />
        )}

        {isHost && activeTab === 'bookings' && (
          <div key={bookingFilterOverride ?? 'default'}>
            <HostBookingList
              initialStatusFilter={bookingFilterOverride ?? 'ALL'}
              onDataMutated={loadWorkspaceData}
            />
          </div>
        )}

        {isHost && activeTab === 'history' && <HostBookingHistoryList />}

        {isHost && activeTab === 'reviews' && (
          <div key={reviewFilterOverride ?? 'default'}>
            <HostReviewsTab />
          </div>
        )}
      </HostWorkspaceShell>
    </>
  )
}
