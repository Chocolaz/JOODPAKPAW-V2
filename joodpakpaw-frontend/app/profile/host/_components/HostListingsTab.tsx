'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Ban,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  GlobeLock,
  MapPin,
  Plus,
  Settings2,
  Star,
} from 'lucide-react'
import { Property } from '@/types'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import {
  assetPath,
  cn,
  getApiImageUrl,
  getLowestPrice,
  normalizeRoomCategories,
} from '@/lib/utils'

interface HostListingsTabProps {
  properties: Property[]
  loading: boolean
  error: string | null
  filterParam: string
  onChangeFilter: (filter: string) => void
  isAccountBanned?: boolean
  onOpenCalendarForProperty: (propertyId: number) => void
}

export function HostListingsTab({
  properties,
  loading,
  error,
  filterParam,
  onChangeFilter,
  isAccountBanned = false,
  onOpenCalendarForProperty,
}: HostListingsTabProps) {
  const router = useRouter()

  const publishedCount = useMemo(
    () => properties.filter((p) => p.isActive && !p.isBannedByAdmin).length,
    [properties]
  )
  const suspendedCount = useMemo(
    () => properties.filter((p) => p.isBannedByAdmin).length,
    [properties]
  )
  const draftCount = useMemo(
    () => properties.filter((p) => !p.isActive && !p.isBannedByAdmin).length,
    [properties]
  )

  const filteredProperties = useMemo(() => {
    if (filterParam === 'published') {
      return properties.filter((p) => p.isActive && !p.isBannedByAdmin)
    }
    if (filterParam === 'draft') {
      return properties.filter((p) => !p.isActive && !p.isBannedByAdmin)
    }
    if (filterParam === 'suspended') {
      return properties.filter((p) => p.isBannedByAdmin)
    }
    return properties
  }, [properties, filterParam])

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-deep-teal">Your Listings</h1>
          <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
            {properties.length} total properties across published, draft, and paused states
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            !isAccountBanned && router.push('/profile/host/add-property')
          }
          disabled={isAccountBanned}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      {/* Filter Pills */}
      {!loading && !error && properties.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeFilter('all')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              filterParam === 'all'
                ? 'bg-deep-teal text-white border-deep-teal'
                : 'bg-white text-deep-teal border-border hover:border-deep-teal'
            )}
          >
            {filterParam === 'all' && <Check className="w-3.5 h-3.5" />}
            All ({properties.length})
          </button>

          {publishedCount > 0 && (
            <button
              type="button"
              onClick={() => onChangeFilter('published')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                filterParam === 'published'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-500'
              )}
            >
              {filterParam === 'published' && <Check className="w-3.5 h-3.5" />}
              Published ({publishedCount})
            </button>
          )}

          {draftCount > 0 && (
            <button
              type="button"
              onClick={() => onChangeFilter('draft')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                filterParam === 'draft'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-800 border-amber-200 hover:border-amber-400'
              )}
            >
              {filterParam === 'draft' && <Check className="w-3.5 h-3.5" />}
              Draft ({draftCount})
            </button>
          )}

          {suspendedCount > 0 && (
            <button
              type="button"
              onClick={() => onChangeFilter('suspended')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                filterParam === 'suspended'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-red-700 border-red-200 hover:border-red-400'
              )}
            >
              {filterParam === 'suspended' && <Check className="w-3.5 h-3.5" />}
              Suspended ({suspendedCount})
            </button>
          )}
        </div>
      )}

      {/* Body States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse motion-reduce:animate-none rounded-2xl border border-border overflow-hidden bg-white"
            >
              <div className="aspect-[4/3] w-full bg-gray-200" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-8 bg-gray-100 rounded-xl w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : properties.length === 0 ? (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-14 items-center text-center py-10 px-6 rounded-2xl border border-border bg-off-white/40">
          <Image
            src={assetPath('/graphics/no-host.svg')}
            alt="No host listing"
            width={240}
            height={240}
            className="w-full h-auto max-w-[180px] lg:max-w-[240px]"
          />
          <div className="lg:text-left mt-6 lg:mt-0">
            <h2 className="text-deep-teal">No properties yet</h2>
            <p className="mt-2 text-sm text-neutral-gray leading-relaxed max-w-[300px]">
              Open your space and heart to visiting pets with guided room and availability controls.
            </p>
            <button
              type="button"
              onClick={() => router.push('/profile/host/add-property')}
              disabled={isAccountBanned}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Your First Property
            </button>
          </div>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="rounded-2xl border border-border bg-off-white/50 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            No {filterParam} properties found
          </p>
          <button
            type="button"
            onClick={() => onChangeFilter('all')}
            className="text-xs font-semibold text-deep-teal underline underline-offset-2 cursor-pointer"
          >
            Show all properties
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {filteredProperties.map((property) => {
            const cover = getApiImageUrl(property.images?.[0]?.filePath)
            const rooms = normalizeRoomCategories(property.roomCategories)
            const roomCount = property.totalRoomCategories ?? rooms.length
            const minPrice = getLowestPrice(property.roomCategories)

            return (
              <article
                key={property.id}
                className="rounded-2xl border border-border bg-white overflow-hidden flex flex-col hover:border-deep-teal/40 transition-colors"
              >
                <div
                  onClick={() => router.push(`/profile/host/${property.id}`)}
                  className="relative aspect-[4/3] w-full bg-off-white overflow-hidden cursor-pointer"
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt={property.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-gray">
                      <Building2 className="w-10 h-10 opacity-40" />
                    </div>
                  )}

                  {/* Top solid status pill */}
                  <div className="absolute top-2.5 left-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-xs',
                        property.isBannedByAdmin
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : property.isActive
                          ? 'bg-white text-emerald-700 border-emerald-200'
                          : 'bg-white text-neutral-gray border-border'
                      )}
                    >
                      {property.isBannedByAdmin ? (
                        <>
                          <Ban className="w-3 h-3" />
                          Suspended
                        </>
                      ) : property.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Published
                        </>
                      ) : (
                        <>
                          <GlobeLock className="w-3 h-3" />
                          Draft
                        </>
                      )}
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-deep-teal border border-border tabular-nums">
                      <BedDouble className="w-3 h-3" />
                      {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h3
                      onClick={() => router.push(`/profile/host/${property.id}`)}
                      className="text-sm font-semibold text-foreground line-clamp-1 cursor-pointer hover:text-deep-teal transition-colors"
                    >
                      {property.title}
                    </h3>
                    <p className="text-xs text-neutral-gray flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {[property.district, property.province]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="font-semibold text-deep-teal tabular-nums">
                        {minPrice !== null
                          ? `From ฿${minPrice.toLocaleString()} / night`
                          : 'No room pricing yet'}
                      </span>
                      {property.avgRating > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" strokeWidth={0} />
                          {property.avgRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => onOpenCalendarForProperty(property.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-border text-xs font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/profile/host/${property.id}`)}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Manage
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
