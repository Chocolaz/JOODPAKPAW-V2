'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { SettingsList } from './_components/SettingsList'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/_components/AuthContext'
import clsx from 'clsx'
import { assetPath } from '@/lib/utils'
import { ChevronRight, PawPrint, CalendarClock, House, Mail, ShieldCheck, User, Flag, BadgeCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function ProfileCardSkeleton() {
  return (
    <Card className="w-full overflow-hidden">
      <div className="h-20 md:h-36 lg:h-44 bg-gray-200 animate-pulse" />
      <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0 relative">
        <div className="flex justify-between items-start">
          <div className="w-18 h-18 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full bg-gray-200 animate-pulse ring-4 ring-white -mt-10 md:-mt-14 lg:-mt-16" />
        </div>
        <div className="mt-3 md:mt-4 space-y-2 md:space-y-3">
          <div className="h-5 md:h-7 w-36 md:w-48 bg-gray-200 animate-pulse rounded-md" />
          <div className="h-4 md:h-5 w-48 md:w-64 bg-gray-200 animate-pulse rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

function ProfilePageSkeleton() {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden flex-1 flex-col gap-4 px-5 mt-4">
        <div className="flex flex-col gap-4 mb-4">
          <ProfileCardSkeleton />

          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="flex flex-col items-center justify-center p-5 gap-2">
                  <div className="w-11 h-11 rounded-xl bg-gray-200 animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 animate-pulse rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-11 h-11 rounded-xl bg-gray-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-3 w-20 bg-gray-200 animate-pulse rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="w-6 h-6 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 animate-pulse rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop skeleton */}
      <div className="hidden md:block px-6 lg:px-10 xl:px-16 py-6 lg:py-8">
        <div className="grid grid-cols-12 gap-6 lg:gap-10">
          <div className="col-span-4">
            <div className="sticky top-32 space-y-4">
              <ProfileCardSkeleton />
              <Card className="w-full shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-5">
                    <div className="w-7 h-7 rounded bg-gray-200 animate-pulse" />
                    <div className="h-5 w-20 bg-gray-200 animate-pulse rounded-md" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="col-span-8">
            <div className="h-7 w-40 bg-gray-200 animate-pulse rounded-md mb-5" />
            <div className="grid grid-cols-2 gap-5">
              {[0, 1, 2].map((i) => (
                <Card key={i} className={clsx('shadow-sm', i === 2 && 'col-span-2')}>
                  <CardContent className="flex items-center gap-5 p-6 lg:p-7">
                    <div className="w-16 h-16 rounded-2xl bg-gray-200 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 w-24 bg-gray-200 animate-pulse rounded-md" />
                      <div className="h-4 w-36 bg-gray-200 animate-pulse rounded-md" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, requireAuth } = useAuth()
  const router = useRouter()
  const guestAvatarSrc = assetPath('/graphics/guest.jpg')

  const checkAuthAndRedirect = (authenticatedPath: string) => {
    if (authLoading) return
    if (!requireAuth()) return
    router.push(authenticatedPath)
  }

  const handleProfileClick = () => {
    if (authLoading) return
    if (!requireAuth()) return
    if (user) {
      router.push(`/profile/${user.firstName.toLowerCase()}`)
    }
  }

  const isHost = user?.role?.some((roleItem) => roleItem.name === 'host')

  const featureItems = [
    {
      label: 'Pets',
      description: 'Manage your pet profiles',
      icon: PawPrint,
      path: '/profile/pets',
      color: 'bg-orange-50',
      iconColor: 'text-accent-orange',
      grid: true,
    },
    {
      label: 'Bookings',
      description: 'View booking history',
      icon: CalendarClock,
      path: '/profile/bookings',
      color: 'bg-teal-50',
      iconColor: 'text-deep-teal',
      grid: true,
    },
    {
      label: 'My Reports',
      description: 'View submitted reports',
      icon: Flag,
      path: '/profile/reports',
      color: 'bg-red-50',
      iconColor: 'text-red-400',
      grid: true,
    },
    {
      label: 'Become a Host',
      description: 'List your property',
      icon: House,
      path: '/profile/host',
      color: 'bg-green-50',
      iconColor: 'text-green-600',
      grid: false,
    },
    ...(isHost ? [{
      label: 'Verification',
      description: 'Get a verified badge',
      icon: ShieldCheck,
      path: '/profile/verification',
      color: 'bg-blue-50',
      iconColor: 'text-blue-500',
      grid: false,
    }] : []),
  ]

  const ProfileCard = (
    <Card
      className="w-full overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 group"
      onClick={handleProfileClick}
    >
      {/* Gradient banner */}
      <div
        className={clsx(
          'h-20 md:h-36 lg:h-44 relative',
          isAuthenticated
            ? 'bg-gradient-to-br from-deep-teal via-deep-teal/80 to-positive-green/60'
            : 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-100'
        )}
      >
        <div className="absolute top-2 right-6 w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-2 left-8 w-10 h-10 md:w-16 md:h-16 rounded-full bg-white/5" />
        <div className="absolute top-4 left-1/2 w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/5 hidden md:block" />
      </div>

      <CardContent className="px-5 pb-5 md:px-6 md:pb-7 pt-0 relative">
        {/* Avatar overlapping the banner */}
        <div className="flex justify-between items-start">
          <Avatar className="w-18 h-18 md:w-28 md:h-28 lg:w-32 lg:h-32 ring-4 ring-white shadow-lg -mt-10 md:-mt-14 lg:-mt-16">
            <AvatarImage
              src={isAuthenticated && user?.avatar ? user.avatar : guestAvatarSrc}
              alt={
                isAuthenticated && user
                  ? `${user.firstName} ${user.lastName}`
                  : 'Guest'
              }
            />
            <AvatarFallback className="text-2xl md:text-4xl lg:text-5xl bg-gray-100 text-deep-teal font-semibold">
              {user
                ? `${user.firstName?.charAt(0)}${user.lastName?.charAt(0)}`
                : '?'}
            </AvatarFallback>
          </Avatar>

          {/* View profile hint */}
          {isAuthenticated && (
            <span className="mt-2 text-xs md:text-sm text-neutral-gray flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View profile
              <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </span>
          )}
        </div>

        {/* Name + info */}
        <div className="mt-3 md:mt-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-deep-teal leading-tight">
              {isAuthenticated && user
                ? `${user.firstName} ${user.lastName}`
                : 'Guest'}
            </h3>
            {isAuthenticated && user?.isVerifiedHost && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 text-xs font-medium">
                <BadgeCheck className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>

          {isAuthenticated && user ? (
            <div className="mt-1.5 md:mt-2 flex flex-col gap-1 md:gap-1.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-gray/70 shrink-0" />
                <p className="text-sm md:text-base text-neutral-gray">{isHost ? 'Host' : 'Guest'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-gray/70 shrink-0" />
                <p className="text-sm md:text-base text-neutral-gray truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm md:text-base text-neutral-gray mt-1 md:mt-2">
              Welcome to JoodPakPaw!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  /* Desktop feature card — bigger, more visual weight */
  const DesktopFeatureCard = ({
    item,
    fullWidth = false,
  }: {
    item: (typeof featureItems)[0]
    fullWidth?: boolean
  }) => (
    <Card
      className={clsx(
        'shadow-sm cursor-pointer hover:shadow-lg active:scale-[0.98] transition-all duration-200 group',
        fullWidth && 'col-span-2'
      )}
      onClick={() => checkAuthAndRedirect(item.path)}
    >
      <CardContent className="flex items-center gap-5 p-6 lg:p-7">
        <div
          className={clsx(
            'shrink-0 rounded-2xl flex items-center justify-center w-16 h-16 lg:w-18 lg:h-18',
            item.color
          )}
        >
          <item.icon className={clsx('w-8 h-8 lg:w-9 lg:h-9', item.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-deep-teal text-lg lg:text-xl">{item.label}</p>
          <p className="text-sm text-neutral-gray mt-1">{item.description}</p>
        </div>
        <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
      </CardContent>
    </Card>
  )

  return (
    <AnimatePresence mode="wait">
      {authLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ProfilePageSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* ========== MOBILE LAYOUT ========== */}
          <div className="md:hidden flex-1 flex-col gap-4 px-5 overflow-y-auto mt-4">
            <div className="flex flex-col gap-4 mb-4">
              {ProfileCard}

              {/* Feature grid — 2 cols for compact items */}
              <div className="grid grid-cols-2 gap-3">
                {featureItems.filter(item => item.grid).map((item) => (
                  <Card
                    key={item.label}
                    className="shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] transition-all duration-200"
                    onClick={() => checkAuthAndRedirect(item.path)}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-5 gap-2">
                      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', item.color)}>
                        <item.icon className={clsx('w-5 h-5', item.iconColor)} />
                      </div>
                      <span className="font-medium text-deep-teal text-lg">
                        {item.label}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Full-width row items */}
              {featureItems.filter(item => !item.grid).map((item) => (
                <Card
                  key={item.label}
                  className="shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] transition-all duration-200 group"
                  onClick={() => checkAuthAndRedirect(item.path)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', item.color)}>
                      <item.icon className={clsx('w-5 h-5', item.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-deep-teal">{item.label}</p>
                      <p className="text-xs text-neutral-gray mt-0.5">{item.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <SettingsList />
          </div>

          {/* ========== DESKTOP / TABLET LAYOUT ========== */}
          <div className="hidden md:block px-6 lg:px-10 xl:px-16 py-6 lg:py-8">
            <div className="grid grid-cols-12 gap-6 lg:gap-10">
              {/* Left column — Profile card + Settings */}
              <div className="col-span-4">
                <div className="sticky top-32 space-y-4">
                  {ProfileCard}
                  <SettingsList />
                </div>
              </div>

              {/* Right column — Features */}
              <div className="col-span-8">
                <h3 className="text-xl lg:text-2xl font-semibold text-deep-teal mb-5">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-5">
                  {featureItems.map((item, i) => (
                    <DesktopFeatureCard
                      key={item.label}
                      item={item}
                      fullWidth={featureItems.length % 2 !== 0 && i === featureItems.length - 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
