'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/app/_components/AuthContext'
import { useProfileContext } from './ProfileContext'
import { SettingsList } from './_components/SettingsList'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getBookings } from '@/lib/api'
import { Booking } from '@/types/booking'
import { assetPath, cn } from '@/lib/utils'
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  House,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

function getSpeciesClayIcon(petTypeName?: string): string {
  const normalized = (petTypeName || '').toLowerCase()
  if (normalized.includes('cat') || normalized.includes('แมว')) {
    return '/icons/species/clay-cat-transparent.webp'
  }
  if (
    normalized.includes('exotic') ||
    normalized.includes('bird') ||
    normalized.includes('rabbit') ||
    normalized.includes('สัตว์เลี้ยงพิเศษ')
  ) {
    return '/icons/species/clay-exotic-transparent.webp'
  }
  return '/icons/species/clay-dog-transparent.webp'
}

function formatDateRange(checkIn: string, checkOut: string): string {
  try {
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const fmt = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const yearFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric' })
    return `${fmt.format(start)} – ${fmt.format(end)}, ${yearFmt.format(end)}`
  } catch {
    return `${checkIn} – ${checkOut}`
  }
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse motion-reduce:animate-none shrink-0" />
          <div className="space-y-2">
            <div className="h-6 w-44 rounded-md bg-gray-200 animate-pulse motion-reduce:animate-none" />
            <div className="h-4 w-52 rounded-md bg-gray-100 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
        <div className="h-10 w-36 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
      </div>

      <div className="space-y-3">
        <div className="h-5 w-32 rounded-md bg-gray-200 animate-pulse motion-reduce:animate-none" />
        <div className="h-24 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none" />
      </div>

      <div className="space-y-3">
        <div className="h-5 w-28 rounded-md bg-gray-200 animate-pulse motion-reduce:animate-none" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-36 rounded-2xl bg-off-white border border-border animate-pulse motion-reduce:animate-none" />
        <div className="h-36 rounded-2xl bg-white border border-border animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, requireAuth } = useAuth()
  const { petProfiles, hostProperties } = useProfileContext()

  const [upcomingStay, setUpcomingStay] = useState<Booking | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    const loadUpcoming = async () => {
      setBookingsLoading(true)
      try {
        const res = await getBookings(1, 10)
        if (cancelled) return
        const upcoming = res.data
          .filter((b) => {
            const status = b.bookingStatus.toUpperCase()
            return status === 'CONFIRMED' || status === 'PENDING'
          })
          .sort(
            (a, b) =>
              new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
          )
        setUpcomingStay(upcoming[0] ?? null)
      } catch {
        if (!cancelled) setUpcomingStay(null)
      } finally {
        if (!cancelled) setBookingsLoading(false)
      }
    }

    void loadUpcoming()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (authLoading) {
    return <OverviewSkeleton />
  }

  // Calm Guest Welcome State
  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto py-8 lg:py-14">
        <div className="rounded-2xl bg-off-white border border-border p-8 text-center space-y-5">
          <div className="w-20 h-20 rounded-2xl bg-white border border-border mx-auto flex items-center justify-center p-2">
            <Image
              src={assetPath('/icons/species/clay-dog-transparent.webp')}
              alt="JoodPakPaw pet hospitality"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-bold text-deep-teal">Your JoodPakPaw profile</h1>
            <p className="text-neutral-gray max-w-md mx-auto">
              Sign in to manage your pet profiles, track upcoming stays, save favorite hosts, and become a verified pet host.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => requireAuth()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-accent-orange text-white font-semibold hover:opacity-95 transition-opacity cursor-pointer"
            >
              Sign in or create account
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isHost = user.role?.some((r) => r.name === 'host')
  const isAdmin = user.role?.some((r) => r.name === 'admin')
  const personalInfoHref = `/profile/${user.firstName.toLowerCase()}`
  const visiblePets = petProfiles.pets.slice(0, 3)

  return (
    <div className="space-y-8">
      {/* 1. Identity Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="w-16 h-16 ring-2 ring-border shrink-0">
            <AvatarImage
              src={user.avatar || undefined}
              alt={`${user.firstName} ${user.lastName}`}
            />
            <AvatarFallback className="bg-off-white text-deep-teal font-semibold text-xl">
              {user.firstName?.charAt(0)}
              {user.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-deep-teal truncate">
                {user.firstName} {user.lastName}
              </h1>
              {user.isVerifiedHost && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium shrink-0">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verified identity
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-gray truncate mt-0.5">
              {user.email}
            </p>
          </div>
        </div>

        <Link
          href={personalInfoHref}
          className="self-start sm:self-auto px-4 py-2 rounded-xl border border-border text-sm font-medium text-deep-teal hover:bg-off-white transition-colors shrink-0"
        >
          Edit personal info
        </Link>
      </section>

      {/* 2. Live Upcoming Stay */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-deep-teal">Upcoming stay</h2>
          <Link
            href="/profile/bookings"
            className="text-sm font-medium text-deep-teal hover:underline"
          >
            View all bookings
          </Link>
        </div>

        {bookingsLoading ? (
          <div className="h-24 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none" />
        ) : upcomingStay ? (
          <div className="rounded-2xl border border-border bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-off-white border border-border flex items-center justify-center shrink-0 text-deep-teal">
                <CalendarClock className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium',
                      upcomingStay.bookingStatus.toUpperCase() === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    )}
                  >
                    {upcomingStay.bookingStatus.toUpperCase() === 'CONFIRMED'
                      ? 'Confirmed'
                      : 'Pending payment'}
                  </span>
                  <span className="text-xs text-neutral-gray tabular-nums">
                    {formatDateRange(
                      upcomingStay.checkInDate,
                      upcomingStay.checkOutDate
                    )}
                  </span>
                </div>
                <h3 className="font-semibold text-deep-teal truncate">
                  {upcomingStay.property.title}
                </h3>
                <p className="text-sm text-neutral-gray tabular-nums">
                  {upcomingStay.numberOfPets}{' '}
                  {upcomingStay.numberOfPets === 1 ? 'pet' : 'pets'},{' '}
                  ฿{Number(upcomingStay.totalPrice).toLocaleString()} total
                </p>
              </div>
            </div>

            <Link
              href={`/profile/bookings/${upcomingStay.id}`}
              className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-deep-teal text-white text-sm font-medium hover:opacity-95 transition-opacity shrink-0"
            >
              View trip
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-off-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-deep-teal">No upcoming stays yet</h3>
              <p className="text-sm text-neutral-gray">
                Discover verified pet-friendly homes, resorts, and homestays matched to your pets.
              </p>
            </div>
            <Link
              href="/"
              className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-accent-orange text-white text-sm font-semibold hover:opacity-95 transition-opacity shrink-0"
            >
              Explore stays
            </Link>
          </div>
        )}
      </section>

      {/* 3. Live My Pets Strip */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-deep-teal tabular-nums">
            My pets {!petProfiles.loading && `(${petProfiles.pets.length})`}
          </h2>
          <Link
            href="/profile/pets"
            className="text-sm font-medium text-deep-teal hover:underline"
          >
            Manage pets
          </Link>
        </div>

        {petProfiles.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visiblePets.map((pet) => (
              <Link
                key={pet.id}
                href={`/profile/pets/${pet.id}`}
                className="rounded-2xl border border-border bg-white p-4 flex items-center gap-3.5 hover:border-deep-teal transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-off-white border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {pet.image ? (
                    <Image
                      src={pet.image}
                      alt={pet.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={assetPath(getSpeciesClayIcon(pet.petTypeName))}
                      alt={pet.petTypeName || pet.name}
                      width={40}
                      height={40}
                      className="object-contain p-1"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-deep-teal truncate">
                    {pet.name}
                  </p>
                  <p className="text-xs text-neutral-gray truncate">
                    {pet.petBreedName || pet.petTypeName || 'Pet profile'}
                    {pet.petSizeName ? ` (${pet.petSizeName})` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-gray/60 shrink-0" />
              </Link>
            ))}

            <Link
              href="/profile/pets/add/1"
              className="rounded-2xl border border-dashed border-border bg-off-white/60 p-4 flex items-center justify-center gap-2 text-sm font-medium text-deep-teal hover:border-deep-teal transition-colors min-h-[80px]"
            >
              <Plus className="w-4 h-4" />
              <span>{petProfiles.pets.length === 0 ? 'Add your first pet' : 'Add another pet'}</span>
            </Link>
          </div>
        )}
      </section>

      {/* 4. Host & Trust Editorial Band */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-off-white border border-border p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-deep-teal">
                {isHost ? 'Host dashboard' : 'Become a host'}
              </h3>
              <p className="text-sm text-neutral-gray">
                {isHost
                  ? `Manage ${hostProperties.properties.length} listed pet ${
                      hostProperties.properties.length === 1 ? 'stay' : 'stays'
                    }, room availability calendars, and guest bookings.`
                  : 'Open your home to traveling pets and earn income with verified bookings.'}
              </p>
            </div>
            {!isHost ? (
              <Image
                src={assetPath('/graphics/steps/tell-us.svg')}
                alt="Become a host"
                width={56}
                height={56}
                className="shrink-0 object-contain drop-shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 text-deep-teal">
                <House className="w-5 h-5" />
              </div>
            )}
          </div>
          <div>
            <Link
              href="/profile/host"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-orange text-white text-sm font-semibold hover:opacity-95 transition-opacity"
            >
              <span>{isHost ? 'Open host mode' : 'Get started'}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-border p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-deep-teal">Identity verification</h3>
              <p className="text-sm text-neutral-gray">
                {user.isVerifiedHost
                  ? 'Your identity is verified. Pet parents see your verified badge across JoodPakPaw.'
                  : 'Verify your government ID to build trust with guests and unlock hosting.'}
              </p>
            </div>
            <div
              className={cn(
                'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0',
                user.isVerifiedHost
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-off-white border-border text-deep-teal'
              )}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/profile/verification"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-deep-teal hover:underline"
            >
              <span>
                {user.isVerifiedHost ? 'View verification status' : 'Start verification'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </Link>

            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-gray hover:text-deep-teal"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin center</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Mobile sign-out card (Desktop sidebar already carries Sign out on lg+) */}
      <div className="lg:hidden pt-2">
        <SettingsList />
      </div>
    </div>
  )
}
