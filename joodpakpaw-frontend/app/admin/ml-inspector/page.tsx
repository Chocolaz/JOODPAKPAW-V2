'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Activity,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  UserCheck,
  X,
} from 'lucide-react'
import {
  getAdminMlInspect,
  getAdminMlStatus,
  getProperties,
  refreshAdminMlCache,
  searchAdminMlProperties,
  searchAdminMlUsers,
} from '@/lib/api'
import type {
  MatchTier,
  MlSampleProperty,
  MlSampleUser,
  MlStatusResponse,
  Property,
  RecommendationMeta,
} from '@/types'
import { getApiImageUrl, getLowestPrice, assetPath, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type InspectMode = 'user' | 'cold-start' | 'similar'
type LocationPresetKey = 'global' | 'bangkok' | 'chiang-mai' | 'phuket'

const LOCATION_PRESETS: Record<
  LocationPresetKey,
  { label: string; shortLabel: string; lat: number | null; lng: number | null }
> = {
  global: {
    label: 'Global (No GPS)',
    shortLabel: 'Global',
    lat: null,
    lng: null,
  },
  bangkok: {
    label: 'Bangkok (13.76, 100.50)',
    shortLabel: 'Bangkok',
    lat: 13.76,
    lng: 100.5,
  },
  'chiang-mai': {
    label: 'Chiang Mai (18.79, 98.98)',
    shortLabel: 'Chiang Mai',
    lat: 18.79,
    lng: 98.98,
  },
  phuket: {
    label: 'Phuket (7.88, 98.39)',
    shortLabel: 'Phuket',
    lat: 7.88,
    lng: 98.39,
  },
}

const MODE_GUIDE: Record<InspectMode, { title: string; description: string }> =
  {
    user: {
      title: 'Personalized user',
      description:
        "Simulates Home 'Recommended for you' and '/recommended' using the 3-Stage Hybrid pipeline (Pet Safety, Energy/TF-IDF, Time-Decay, Bayesian Rating, and optional Geo-Boost)",
    },
    'cold-start': {
      title: 'Cold-start baseline',
      description:
        "Simulates Guest Home 'Popular picks to get started' using IMDB Bayesian Rating (65%) and Popularity (35%) with no pet or behavior bias",
    },
    similar: {
      title: 'Similar property',
      description:
        "Simulates Detail page 'Similar Properties' using item-to-item similarity (TF-IDF 55%, Pet Policy Jaccard 20%, Geo/Price 15%, Quality 10%)",
    },
  }

const TIER_STYLES: Record<MatchTier, { label: string; className: string }> = {
  all_pets: {
    label: 'Tier A · All pets',
    className: 'border-deep-teal/25 bg-deep-teal/5 text-deep-teal',
  },
  partial_pets: {
    label: 'Tier B · Partial pets',
    className: 'border-gray-200 bg-gray-100 text-gray-700',
  },
  cold_start: {
    label: 'Cold-start',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
  },
  similar: {
    label: 'Similar stay',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
  },
  context_fallback: {
    label: 'Context fallback',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

function getSampleUserHandle(user: MlSampleUser): string {
  const localPart = user.email?.split('@')[0]?.trim()
  if (localPart) return localPart
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || `User #${user.id}`
}

function getSampleUserTag(user: MlSampleUser): string {
  if (user.pets.length > 0) {
    const speciesList = Array.from(
      new Set(user.pets.map((p) => p.species).filter(Boolean))
    )
    if (speciesList.length === 1) {
      return `${user.pets.length} ${speciesList[0]}`
    }
    return `${user.pets.length} pets`
  }
  if (user.roles.some((r) => r.toLowerCase() === 'host')) {
    return 'Host · Self-guard'
  }
  if (user.roles.some((r) => r.toLowerCase() === 'admin')) {
    return 'Admin'
  }
  return 'No pets'
}

function formatRoleLabel(role: string): string {
  if (!role) return ''
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}

function clampPct(value: number | undefined | null): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value * 100)))
}

function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`
  }
  if (distanceKm < 100) {
    return `${distanceKm.toFixed(1)} km`
  }
  return `${Math.round(distanceKm).toLocaleString()} km`
}

export default function AdminMlInspectorPage() {
  const [status, setStatus] = useState<MlStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [refreshingCache, setRefreshingCache] = useState(false)

  const [mode, setMode] = useState<InspectMode>('user')
  const [asUserIdInput, setAsUserIdInput] = useState<string>('')
  const [propertyIdInput, setPropertyIdInput] = useState<string>('')
  const [limit, setLimit] = useState<number>(12)
  const [locationKey, setLocationKey] = useState<LocationPresetKey>('global')

  // Scalable User Search (300ms debounced server-side search)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<MlSampleUser[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [userSearchError, setUserSearchError] = useState<string | null>(null)
  const [selectedUserDetail, setSelectedUserDetail] =
    useState<MlSampleUser | null>(null)
  const userSearchSeqRef = useRef(0)

  // Scalable Property Search (300ms debounced server-side search)
  const [propSearchQuery, setPropSearchQuery] = useState('')
  const [propSearchResults, setPropSearchResults] = useState<
    MlSampleProperty[]
  >([])
  const [propSearchLoading, setPropSearchLoading] = useState(false)
  const [propSearchOpen, setPropSearchOpen] = useState(false)
  const [propSearchError, setPropSearchError] = useState<string | null>(null)
  const [selectedPropertyDetail, setSelectedPropertyDetail] =
    useState<MlSampleProperty | null>(null)
  const propSearchSeqRef = useRef(0)

  const [fallbackProperties, setFallbackProperties] = useState<
    MlSampleProperty[]
  >([])
  const [results, setResults] = useState<Property[]>([])
  const [inspectMeta, setInspectMeta] = useState<RecommendationMeta | null>(
    null
  )
  const [inspectLoading, setInspectLoading] = useState(true)
  const [inspectError, setInspectError] = useState<string | null>(null)

  const fetchStatus = useCallback(async (): Promise<MlStatusResponse | null> => {
    setStatusLoading(true)
    try {
      const s = await getAdminMlStatus()
      setStatus(s)
      return s
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load ML status'
      )
      return null
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const runInspection = useCallback(
    async (opts?: {
      nextMode?: InspectMode
      nextUserId?: string
      nextPropertyId?: string
      nextLimit?: number
      nextLocationKey?: LocationPresetKey
    }) => {
      const activeMode = opts?.nextMode ?? mode
      const activeUserIdStr = opts?.nextUserId ?? asUserIdInput
      const activePropIdStr = opts?.nextPropertyId ?? propertyIdInput
      const activeLimit = opts?.nextLimit ?? limit
      const activeLocKey = opts?.nextLocationKey ?? locationKey
      const activeLoc = LOCATION_PRESETS[activeLocKey]

      if (activeMode === 'similar') {
        const parsedProp = parseInt(activePropIdStr, 10)
        if (!Number.isSafeInteger(parsedProp) || parsedProp <= 0) {
          setInspectError('Select or enter a valid positive property ID')
          setResults([])
          setInspectMeta(null)
          setInspectLoading(false)
          return
        }
      }

      if (activeMode === 'user' && activeUserIdStr.trim() !== '') {
        const parsedUser = parseInt(activeUserIdStr, 10)
        if (!Number.isSafeInteger(parsedUser) || parsedUser <= 0) {
          setInspectError('User ID must be a positive integer')
          setResults([])
          setInspectMeta(null)
          setInspectLoading(false)
          return
        }
      }

      setInspectLoading(true)
      setInspectError(null)
      try {
        const res = await getAdminMlInspect({
          mode: activeMode,
          asUserId:
            activeMode === 'user' && activeUserIdStr.trim() !== ''
              ? parseInt(activeUserIdStr, 10)
              : undefined,
          propertyId:
            activeMode === 'similar'
              ? parseInt(activePropIdStr, 10)
              : undefined,
          limit: activeLimit,
          lat: activeMode !== 'similar' ? activeLoc.lat : undefined,
          lng: activeMode !== 'similar' ? activeLoc.lng : undefined,
        })
        setResults(res.data)
        setInspectMeta(res.meta ?? null)
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to inspect recommendations'
        setInspectError(msg)
        setResults([])
        setInspectMeta(null)
      } finally {
        setInspectLoading(false)
      }
    },
    [mode, asUserIdInput, propertyIdInput, limit, locationKey]
  )

  useEffect(() => {
    let active = true

    const init = async () => {
      const loadedStatus = await fetchStatus()
      if (!active) return

      const users = loadedStatus?.sampleUsers ?? []
      const defaultUser = users.find((u) => u.pets.length > 0) ?? users[0]

      if (defaultUser) {
        const defaultId = String(defaultUser.id)
        setAsUserIdInput(defaultId)
        setSelectedUserDetail(defaultUser)
        await runInspection({
          nextMode: 'user',
          nextUserId: defaultId,
          nextLimit: 12,
        })
      } else {
        setMode('cold-start')
        await runInspection({ nextMode: 'cold-start', nextLimit: 12 })
      }

      if (!active) return

      const propsFromStatus = loadedStatus?.sampleProperties ?? []
      if (propsFromStatus.length > 0) {
        setPropertyIdInput((prev) => prev || String(propsFromStatus[0].id))
        setSelectedPropertyDetail((prev) => prev ?? propsFromStatus[0])
      } else {
        try {
          const res = await getProperties(1, 12)
          if (!active) return
          const list: MlSampleProperty[] = (res.data || []).map((p) => ({
            id: p.id,
            title: p.title,
            province: p.province,
            avgRating: p.avgRating,
          }))
          setFallbackProperties(list)
          if (list.length > 0) {
            setPropertyIdInput((prev) => prev || String(list[0].id))
            setSelectedPropertyDetail((prev) => prev ?? list[0])
          }
        } catch {
          // Ignore fallback catalog errors
        }
      }
    }

    init()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced Server-Side User Search (300ms)
  useEffect(() => {
    const trimmed = userSearchQuery.trim()
    if (!trimmed) {
      userSearchSeqRef.current += 1
      setUserSearchResults([])
      setUserSearchLoading(false)
      setUserSearchError(null)
      return
    }

    const seq = ++userSearchSeqRef.current
    setUserSearchLoading(true)
    setUserSearchError(null)

    const timer = window.setTimeout(async () => {
      try {
        const matched = await searchAdminMlUsers(trimmed, 10)
        if (seq !== userSearchSeqRef.current) return
        setUserSearchResults(matched)
        setUserSearchOpen(true)
      } catch (err) {
        if (seq !== userSearchSeqRef.current) return
        setUserSearchResults([])
        setUserSearchError(
          err instanceof Error ? err.message : 'Failed to search users'
        )
        setUserSearchOpen(true)
      } finally {
        if (seq === userSearchSeqRef.current) {
          setUserSearchLoading(false)
        }
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [userSearchQuery])

  // Debounced Server-Side Property Search (300ms)
  useEffect(() => {
    const trimmed = propSearchQuery.trim()
    if (!trimmed) {
      propSearchSeqRef.current += 1
      setPropSearchResults([])
      setPropSearchLoading(false)
      setPropSearchError(null)
      return
    }

    const seq = ++propSearchSeqRef.current
    setPropSearchLoading(true)
    setPropSearchError(null)

    const timer = window.setTimeout(async () => {
      try {
        const matched = await searchAdminMlProperties(trimmed, 10)
        if (seq !== propSearchSeqRef.current) return
        setPropSearchResults(matched)
        setPropSearchOpen(true)
      } catch (err) {
        if (seq !== propSearchSeqRef.current) return
        setPropSearchResults([])
        setPropSearchError(
          err instanceof Error ? err.message : 'Failed to search properties'
        )
        setPropSearchOpen(true)
      } finally {
        if (seq === propSearchSeqRef.current) {
          setPropSearchLoading(false)
        }
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [propSearchQuery])

  const handleRefreshCache = async () => {
    setRefreshingCache(true)
    try {
      const res = await refreshAdminMlCache()
      toast.success(
        res.mlServiceRefreshed
          ? `ML and fallback caches refreshed (${res.catalogSize} properties)`
          : `Fallback cache refreshed (${res.catalogSize} properties · ML service unreachable)`
      )
      await Promise.all([fetchStatus(), runInspection()])
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to refresh ML cache'
      )
    } finally {
      setRefreshingCache(false)
    }
  }

  const handleSelectUser = (user: MlSampleUser) => {
    const nextId = String(user.id)
    setSelectedUserDetail(user)
    setAsUserIdInput(nextId)
    setUserSearchOpen(false)
    runInspection({ nextMode: 'user', nextUserId: nextId })
  }

  const handleSelectProperty = (prop: MlSampleProperty) => {
    const nextId = String(prop.id)
    setSelectedPropertyDetail(prop)
    setPropertyIdInput(nextId)
    setPropSearchOpen(false)
    runInspection({ nextMode: 'similar', nextPropertyId: nextId })
  }

  const sampleUsers = status?.sampleUsers ?? []
  const featuredUsers = sampleUsers.slice(0, 6)
  const defaultSampleUser =
    featuredUsers.find((u) => u.pets.length > 0) ?? featuredUsers[0]

  const activeSampleUser =
    (selectedUserDetail &&
    String(selectedUserDetail.id) === asUserIdInput.trim()
      ? selectedUserDetail
      : undefined) ??
    sampleUsers.find((u) => String(u.id) === asUserIdInput.trim())

  const similarPropertyOptions: MlSampleProperty[] = (
    status?.sampleProperties && status.sampleProperties.length > 0
      ? status.sampleProperties
      : fallbackProperties
  ).slice(0, 12)

  const activeSelectedProperty =
    (selectedPropertyDetail &&
    String(selectedPropertyDetail.id) === propertyIdInput.trim()
      ? selectedPropertyDetail
      : undefined) ??
    similarPropertyOptions.find((p) => String(p.id) === propertyIdInput.trim())

  const activeLocationPreset = LOCATION_PRESETS[locationKey]
  const activeModeGuide = MODE_GUIDE[mode]
  const isLive = status?.status === 'live'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Refresh Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <SlidersHorizontal
              className="w-5 h-5 text-deep-teal/75 shrink-0"
              strokeWidth={1.5}
            />
            <h2 className="text-xl font-semibold text-gray-900 font-baloo2">
              Hybrid ML recommendation inspector
            </h2>
            {!statusLoading && status && (
              <span className="inline-flex items-center gap-2 rounded-md border border-gray-200/80 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    isLive ? 'bg-emerald-600' : 'bg-amber-500'
                  )}
                />
                {isLive ? 'Live ML' : 'Fallback active'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Inspect 3-Stage Pet-Aware Hybrid rankings, match tiers, and
            multi-factor score breakdowns
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleRefreshCache}
          disabled={refreshingCache}
          className="h-9 rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 cursor-pointer"
        >
          <RefreshCw
            className={cn('w-4 h-4', refreshingCache && 'animate-spin')}
            strokeWidth={1.5}
          />
          {refreshingCache ? 'Refreshing cache' : 'Refresh ML cache'}
        </Button>
      </div>

      {/* Engine Status Cards — pure numbers & labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border-gray-200/80 shadow-none bg-white">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Engine mode
            </CardDescription>
            <CardTitle className="text-lg font-semibold text-gray-900">
              {statusLoading ? (
                <div className="h-6 w-32 rounded-md bg-gray-100" />
              ) : isLive ? (
                'Live ML service'
              ) : (
                'Fallback engine'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 text-xs text-gray-500 truncate tabular-nums">
            {statusLoading ? (
              <div className="h-4 w-44 rounded bg-gray-100" />
            ) : (
              <span title={status?.mlServiceUrl}>
                {status?.mlServiceUrl || 'N/A'} · timeout{' '}
                {status?.timeoutMs ?? 1500} ms
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-gray-200/80 shadow-none bg-white">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Catalog snapshot
            </CardDescription>
            <CardTitle className="text-lg font-semibold text-gray-900 tabular-nums">
              {statusLoading ? (
                <div className="h-6 w-24 rounded-md bg-gray-100" />
              ) : (
                `${(status?.totalActiveProperties ?? status?.catalogSize ?? 0).toLocaleString()} listings`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 text-xs text-gray-500 tabular-nums">
            {statusLoading ? (
              <div className="h-4 w-36 rounded bg-gray-100" />
            ) : status?.mlHealth ? (
              `DB connected: ${status.mlHealth.dbConnected ? 'Yes' : 'No'}${
                status.totalUsers != null
                  ? ` · ${status.totalUsers.toLocaleString()} users`
                  : ''
              }`
            ) : (
              `Prisma snapshot ready${
                status?.totalUsers != null
                  ? ` · ${status.totalUsers.toLocaleString()} users`
                  : ''
              }`
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-gray-200/80 shadow-none bg-white">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Snapshot age
            </CardDescription>
            <CardTitle className="text-lg font-semibold text-gray-900 tabular-nums">
              {statusLoading ? (
                <div className="h-6 w-20 rounded-md bg-gray-100" />
              ) : (
                `${(status?.snapshotAgeSeconds ?? 0).toFixed(1)} s`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 text-xs text-gray-500 tabular-nums">
            60 s TTL snapshot cache
          </CardContent>
        </Card>

        <Card className="rounded-xl border-gray-200/80 shadow-none bg-white">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Query latency
            </CardDescription>
            <CardTitle className="text-lg font-semibold text-gray-900 tabular-nums">
              {inspectLoading ? (
                <div className="h-6 w-20 rounded-md bg-gray-100" />
              ) : inspectMeta?.latencyMs != null ? (
                `${inspectMeta.latencyMs} ms`
              ) : (
                '—'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 text-xs text-gray-500">
            {inspectMeta
              ? `Source: ${
                  inspectMeta.source === 'ml_service'
                    ? 'joodpakpaw-ml'
                    : 'in_process_fallback'
                }`
              : 'Run an inspection query'}
          </CardContent>
        </Card>
      </div>

      {/* Mode & Target Selector */}
      <Card className="rounded-xl border-gray-200/80 shadow-none bg-white">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-base font-semibold text-gray-900">
            Inspection target
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Switch between personalized user personas, cold-start baseline, or
            item-to-item similarity
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0 space-y-4">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'user' ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-lg px-3 text-sm font-medium transition-colors duration-150 cursor-pointer',
                mode === 'user'
                  ? 'bg-deep-teal hover:bg-deep-teal/90 text-white border-transparent'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => {
                setMode('user')
                const resolvedUserId =
                  asUserIdInput.trim() !== ''
                    ? asUserIdInput.trim()
                    : defaultSampleUser
                    ? String(defaultSampleUser.id)
                    : ''
                if (resolvedUserId && resolvedUserId !== asUserIdInput) {
                  setAsUserIdInput(resolvedUserId)
                }
                runInspection({ nextMode: 'user', nextUserId: resolvedUserId })
              }}
            >
              <UserCheck className="w-4 h-4" strokeWidth={1.5} />
              Personalized user
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'cold-start' ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-lg px-3 text-sm font-medium transition-colors duration-150 cursor-pointer',
                mode === 'cold-start'
                  ? 'bg-deep-teal hover:bg-deep-teal/90 text-white border-transparent'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => {
                setMode('cold-start')
                runInspection({ nextMode: 'cold-start' })
              }}
            >
              <Activity className="w-4 h-4" strokeWidth={1.5} />
              Cold-start baseline
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'similar' ? 'default' : 'outline'}
              className={cn(
                'h-9 rounded-lg px-3 text-sm font-medium transition-colors duration-150 cursor-pointer',
                mode === 'similar'
                  ? 'bg-deep-teal hover:bg-deep-teal/90 text-white border-transparent'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => {
                setMode('similar')
                runInspection({ nextMode: 'similar' })
              }}
            >
              <Building2 className="w-4 h-4" strokeWidth={1.5} />
              Similar property
            </Button>
          </div>

          {/* Mode Guide Banner — quiet neutral surface */}
          <div className="rounded-lg border border-gray-200/80 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-600">
            <span className="font-medium text-gray-900">
              {activeModeGuide.title}:
            </span>{' '}
            <span>{activeModeGuide.description}</span>
          </div>

          {/* Mode-Specific Controls */}
          {mode === 'user' && (
            <div className="space-y-4 pt-1">
              {/* Featured Demo Personas (max 6) + Total Users count */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    Featured demo personas
                  </span>
                  {status?.totalUsers != null && (
                    <span className="text-xs font-mono text-gray-500 tabular-nums">
                      {status.totalUsers.toLocaleString()} total users
                    </span>
                  )}
                </div>

                {statusLoading && featuredUsers.length === 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-8 w-36 rounded-lg bg-gray-100"
                      />
                    ))}
                  </div>
                ) : featuredUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {featuredUsers.map((user) => {
                      const selected = String(user.id) === asUserIdInput.trim()
                      const handle = getSampleUserHandle(user)
                      const tag = getSampleUserTag(user)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer tabular-nums',
                            selected
                              ? 'border-deep-teal bg-deep-teal/5 text-deep-teal'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                          )}
                        >
                          {handle} ({tag}) · #{user.id}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              {/* Selected live user summary, behavior count & pet profiles */}
              {activeSampleUser && (
                <div className="rounded-lg bg-gray-50 border border-gray-200/80 p-4 space-y-3 text-xs text-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-400 tabular-nums">
                        #{activeSampleUser.id}
                      </span>
                      <span className="font-medium text-gray-900">
                        {`${activeSampleUser.firstName} ${activeSampleUser.lastName}`.trim() ||
                          getSampleUserHandle(activeSampleUser)}
                      </span>
                      <span className="text-gray-500">
                        {activeSampleUser.email}
                      </span>
                      {activeSampleUser.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-md border border-gray-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600"
                        >
                          {formatRoleLabel(role)}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono text-xs text-deep-teal tabular-nums">
                      {activeSampleUser.behaviorCount}{' '}
                      {activeSampleUser.behaviorCount === 1
                        ? 'behavior'
                        : 'behaviors'}
                    </span>
                  </div>

                  {activeSampleUser.pets.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeSampleUser.pets.map((pet) => (
                        <div
                          key={pet.id}
                          className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-white border border-gray-200/80 px-2.5 py-1 text-[11px] text-gray-700"
                        >
                          <span className="font-medium text-gray-900">
                            {pet.name}
                          </span>
                          <span className="text-gray-500">· {pet.species}</span>
                          {pet.weight != null && (
                            <span className="text-gray-500 tabular-nums">
                              · {pet.weight} kg
                            </span>
                          )}
                          {pet.sizeName && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              {pet.sizeName}
                            </span>
                          )}
                          {pet.energyRating != null && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-700 tabular-nums">
                              L{pet.energyRating}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {activeSampleUser.roles.some(
                        (r) => r.toLowerCase() === 'host'
                      )
                        ? 'No registered pets — verifies host self-owned properties are excluded'
                        : 'No registered pets — evaluates cold-start and behavioral signals'}
                    </p>
                  )}
                </div>
              )}

              {/* Scalable Server-Side User Search + Direct User ID + Location Preset + Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                {/* Debounced User Search Box */}
                <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                  <Label
                    htmlFor="userSearchInput"
                    className="text-xs font-medium text-gray-500"
                  >
                    Search user
                  </Label>
                  <Popover
                    open={userSearchOpen && userSearchQuery.trim().length > 0}
                    onOpenChange={setUserSearchOpen}
                  >
                    <PopoverAnchor asChild>
                      <div className="relative">
                        <Search
                          className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          strokeWidth={1.5}
                        />
                        <Input
                          id="userSearchInput"
                          type="text"
                          value={userSearchQuery}
                          onChange={(e) => {
                            setUserSearchQuery(e.target.value)
                            if (e.target.value.trim().length > 0) {
                              setUserSearchOpen(true)
                            }
                          }}
                          onFocus={() => {
                            if (userSearchQuery.trim().length > 0) {
                              setUserSearchOpen(true)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setUserSearchOpen(false)
                            }
                          }}
                          placeholder="Email, name, or #ID"
                          className="h-9 rounded-lg pl-9 pr-8 text-sm border-gray-200"
                          autoComplete="off"
                        />
                        {userSearchLoading ? (
                          <Loader2
                            className="w-4 h-4 text-deep-teal animate-spin absolute right-2.5 top-1/2 -translate-y-1/2"
                            strokeWidth={1.5}
                          />
                        ) : userSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setUserSearchQuery('')
                              setUserSearchResults([])
                              setUserSearchOpen(false)
                            }}
                            aria-label="Clear user search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        ) : null}
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-[var(--radix-popover-trigger-width)] sm:w-[440px] max-w-[calc(100vw-2rem)] rounded-xl p-2 shadow-md border-gray-200/80 bg-white"
                    >
                      {userSearchLoading && userSearchResults.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
                          <Loader2
                            className="w-3.5 h-3.5 animate-spin text-deep-teal"
                            strokeWidth={1.5}
                          />
                          Searching users
                        </div>
                      ) : userSearchError ? (
                        <div className="px-3 py-3 text-xs text-red-600">
                          {userSearchError}
                        </div>
                      ) : userSearchResults.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-gray-500 text-center">
                          No matching users for &ldquo;
                          {userSearchQuery.trim()}&rdquo;
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                          {userSearchResults.map((user) => {
                            const fullName =
                              `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
                              getSampleUserHandle(user)
                            const isSelected =
                              String(user.id) === asUserIdInput.trim()
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleSelectUser(user)}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 hover:bg-gray-50 cursor-pointer space-y-1',
                                  isSelected && 'bg-deep-teal/5'
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-gray-400 shrink-0 tabular-nums">
                                      #{user.id}
                                    </span>
                                    <span className="text-xs font-medium text-gray-900 truncate">
                                      {fullName}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[11px] text-gray-500 shrink-0 tabular-nums">
                                    {user.behaviorCount} events
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                                  <span className="truncate text-gray-600">
                                    {user.email}
                                  </span>
                                  {user.pets.length > 0 ? (
                                    user.pets.slice(0, 3).map((pet) => (
                                      <span
                                        key={pet.id}
                                        className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700"
                                      >
                                        {pet.species}
                                        {pet.sizeName ? ` · ${pet.sizeName}` : ''}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                      {getSampleUserTag(user)}
                                    </span>
                                  )}
                                  {user.pets.length > 3 && (
                                    <span className="text-[10px] text-gray-400 tabular-nums">
                                      +{user.pets.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Direct Custom User ID */}
                <div className="lg:col-span-2 space-y-1.5">
                  <Label
                    htmlFor="asUserId"
                    className="text-xs font-medium text-gray-500"
                  >
                    User ID
                  </Label>
                  <Input
                    id="asUserId"
                    type="number"
                    min={1}
                    value={asUserIdInput}
                    onChange={(e) => setAsUserIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runInspection()
                    }}
                    placeholder={
                      defaultSampleUser ? `${defaultSampleUser.id}` : 'User ID'
                    }
                    className="h-9 rounded-lg text-sm tabular-nums border-gray-200"
                  />
                </div>

                {/* Optional Location Simulation Preset */}
                <div className="lg:col-span-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500">
                    Location simulation
                  </Label>
                  <Select
                    value={locationKey}
                    onValueChange={(val) => {
                      const nextLoc = val as LocationPresetKey
                      setLocationKey(nextLoc)
                      runInspection({ nextLocationKey: nextLoc })
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-sm border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(LOCATION_PRESETS) as [
                          LocationPresetKey,
                          (typeof LOCATION_PRESETS)[LocationPresetKey],
                        ][]
                      ).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Result Limit */}
                <div className="lg:col-span-1 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500">
                    Limit
                  </Label>
                  <Select
                    value={String(limit)}
                    onValueChange={(val) => {
                      const nextLim = Number(val)
                      setLimit(nextLim)
                      runInspection({ nextLimit: nextLim })
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-sm border-gray-200 tabular-nums">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Top 6</SelectItem>
                      <SelectItem value="12">Top 12</SelectItem>
                      <SelectItem value="20">Top 20</SelectItem>
                      <SelectItem value="30">Top 30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Inspect Trigger */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <Button
                    type="button"
                    onClick={() => runInspection()}
                    disabled={inspectLoading}
                    className="w-full h-9 rounded-lg bg-deep-teal hover:bg-deep-teal/90 text-white transition-colors duration-150 cursor-pointer"
                  >
                    Inspect ranking
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mode === 'cold-start' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pt-1">
              <div className="lg:col-span-5 space-y-1.5">
                <Label className="text-xs font-medium text-gray-500">
                  Location simulation
                </Label>
                <Select
                  value={locationKey}
                  onValueChange={(val) => {
                    const nextLoc = val as LocationPresetKey
                    setLocationKey(nextLoc)
                    runInspection({ nextLocationKey: nextLoc })
                  }}
                >
                  <SelectTrigger className="h-9 rounded-lg text-sm border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(LOCATION_PRESETS) as [
                        LocationPresetKey,
                        (typeof LOCATION_PRESETS)[LocationPresetKey],
                      ][]
                    ).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-gray-500">
                  Result limit
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    const nextLim = Number(val)
                    setLimit(nextLim)
                    runInspection({ nextLimit: nextLim })
                  }}
                >
                  <SelectTrigger className="h-9 rounded-lg text-sm border-gray-200 tabular-nums">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Top 6</SelectItem>
                    <SelectItem value="12">Top 12</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="30">Top 30</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <Button
                  type="button"
                  onClick={() => runInspection()}
                  disabled={inspectLoading}
                  className="w-full h-9 rounded-lg bg-deep-teal hover:bg-deep-teal/90 text-white transition-colors duration-150 cursor-pointer"
                >
                  Run cold-start inspection
                </Button>
              </div>
            </div>
          )}

          {mode === 'similar' && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {activeSelectedProperty ? (
                  <div className="inline-flex flex-wrap items-center gap-2 text-xs text-gray-700">
                    <span className="text-gray-500">Target property</span>
                    <span className="font-mono text-gray-400 tabular-nums">
                      #{activeSelectedProperty.id}
                    </span>
                    <span className="font-medium text-gray-900">
                      {activeSelectedProperty.title}
                    </span>
                    <span className="text-gray-500">
                      ({activeSelectedProperty.province})
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">
                    Choose a quick pick or search across all active properties
                  </span>
                )}
                {(status?.totalActiveProperties ?? status?.catalogSize) !=
                  null && (
                  <span className="text-xs font-mono text-gray-500 tabular-nums">
                    {(
                      status?.totalActiveProperties ??
                      status?.catalogSize ??
                      0
                    ).toLocaleString()}{' '}
                    active properties
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                {/* Debounced Server-Side Property Search Box */}
                <div className="sm:col-span-2 lg:col-span-5 space-y-1.5">
                  <Label
                    htmlFor="propSearchInput"
                    className="text-xs font-medium text-gray-500"
                  >
                    Search property
                  </Label>
                  <Popover
                    open={propSearchOpen && propSearchQuery.trim().length > 0}
                    onOpenChange={setPropSearchOpen}
                  >
                    <PopoverAnchor asChild>
                      <div className="relative">
                        <Search
                          className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          strokeWidth={1.5}
                        />
                        <Input
                          id="propSearchInput"
                          type="text"
                          value={propSearchQuery}
                          onChange={(e) => {
                            setPropSearchQuery(e.target.value)
                            if (e.target.value.trim().length > 0) {
                              setPropSearchOpen(true)
                            }
                          }}
                          onFocus={() => {
                            if (propSearchQuery.trim().length > 0) {
                              setPropSearchOpen(true)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setPropSearchOpen(false)
                            }
                          }}
                          placeholder="Title, province, or #ID"
                          className="h-9 rounded-lg pl-9 pr-8 text-sm border-gray-200"
                          autoComplete="off"
                        />
                        {propSearchLoading ? (
                          <Loader2
                            className="w-4 h-4 text-deep-teal animate-spin absolute right-2.5 top-1/2 -translate-y-1/2"
                            strokeWidth={1.5}
                          />
                        ) : propSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPropSearchQuery('')
                              setPropSearchResults([])
                              setPropSearchOpen(false)
                            }}
                            aria-label="Clear property search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        ) : null}
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-[var(--radix-popover-trigger-width)] sm:w-[440px] max-w-[calc(100vw-2rem)] rounded-xl p-2 shadow-md border-gray-200/80 bg-white"
                    >
                      {propSearchLoading && propSearchResults.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
                          <Loader2
                            className="w-3.5 h-3.5 animate-spin text-deep-teal"
                            strokeWidth={1.5}
                          />
                          Searching properties
                        </div>
                      ) : propSearchError ? (
                        <div className="px-3 py-3 text-xs text-red-600">
                          {propSearchError}
                        </div>
                      ) : propSearchResults.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-gray-500 text-center">
                          No matching properties for &ldquo;
                          {propSearchQuery.trim()}&rdquo;
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                          {propSearchResults.map((prop) => {
                            const isSelected =
                              String(prop.id) === propertyIdInput.trim()
                            return (
                              <button
                                key={prop.id}
                                type="button"
                                onClick={() => handleSelectProperty(prop)}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-2',
                                  isSelected && 'bg-deep-teal/5'
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-gray-400 shrink-0 tabular-nums">
                                      #{prop.id}
                                    </span>
                                    <span className="text-xs font-medium text-gray-900 truncate">
                                      {prop.title}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                    {prop.province}
                                  </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 shrink-0 tabular-nums">
                                  <Star
                                    className="w-3 h-3 fill-yellow-400 text-yellow-500"
                                    strokeWidth={1.5}
                                  />
                                  {prop.avgRating > 0
                                    ? prop.avgRating.toFixed(1)
                                    : 'New'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Quick Picks (Top 12) */}
                <div className="lg:col-span-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500">
                    Quick picks
                  </Label>
                  <Select
                    value={
                      similarPropertyOptions.some(
                        (p) => String(p.id) === propertyIdInput.trim()
                      )
                        ? propertyIdInput.trim()
                        : ''
                    }
                    onValueChange={(val) => {
                      const picked = similarPropertyOptions.find(
                        (p) => String(p.id) === val
                      )
                      if (picked) {
                        handleSelectProperty(picked)
                      } else {
                        setPropertyIdInput(val)
                        runInspection({
                          nextMode: 'similar',
                          nextPropertyId: val,
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-sm border-gray-200">
                      <SelectValue placeholder="Choose quick pick" />
                    </SelectTrigger>
                    <SelectContent>
                      {similarPropertyOptions.map((prop) => (
                        <SelectItem key={prop.id} value={String(prop.id)}>
                          #{prop.id} · {prop.title} ({prop.province})
                          {prop.avgRating > 0
                            ? ` · ${prop.avgRating.toFixed(1)}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direct Property ID */}
                <div className="lg:col-span-2 space-y-1.5">
                  <Label
                    htmlFor="similarPropId"
                    className="text-xs font-medium text-gray-500"
                  >
                    Property ID
                  </Label>
                  <Input
                    id="similarPropId"
                    type="number"
                    min={1}
                    value={propertyIdInput}
                    onChange={(e) => setPropertyIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runInspection()
                    }}
                    placeholder="Property ID"
                    className="h-9 rounded-lg text-sm tabular-nums border-gray-200"
                  />
                </div>

                {/* Inspect Similar Button */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <Button
                    type="button"
                    onClick={() => runInspection()}
                    disabled={inspectLoading}
                    className="w-full h-9 rounded-lg bg-deep-teal hover:bg-deep-teal/90 text-white transition-colors duration-150 cursor-pointer"
                  >
                    Inspect similar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Header */}
      {inspectMeta && !inspectLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-gray-200/80 px-4 py-3 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium text-gray-700">Strategy</span>
              <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">
                {inspectMeta.strategy}
              </code>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium text-gray-700">Source</span>
              <span className="font-mono text-[11px] text-gray-600">
                {inspectMeta.source}
              </span>
            </span>
            {inspectMeta.totalCandidates != null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <span className="font-medium text-gray-700">Candidates</span>
                <span className="font-mono text-[11px] text-gray-600">
                  {inspectMeta.totalCandidates.toLocaleString()}
                </span>
              </span>
            )}
            {mode !== 'similar' && locationKey !== 'global' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-deep-teal/20 bg-deep-teal/5 px-2 py-0.5 text-[11px] font-medium text-deep-teal tabular-nums">
                <MapPin className="w-3 h-3" strokeWidth={1.5} />
                {activeLocationPreset.label}
              </span>
            )}
          </div>
          <span className="tabular-nums">
            Showing{' '}
            <span className="font-medium text-gray-900">{results.length}</span>{' '}
            ranked stays
          </span>
        </div>
      )}

      {/* Results List */}
      {inspectLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="rounded-xl border-gray-200/80 shadow-none bg-white p-5"
            >
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 rounded bg-gray-100" />
                  <div className="h-4 w-1/2 rounded bg-gray-100" />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="h-8 w-full rounded bg-gray-100" />
                    <div className="h-8 w-full rounded bg-gray-100" />
                    <div className="h-8 w-full rounded bg-gray-100" />
                    <div className="h-8 w-full rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : inspectError ? (
        <Card className="rounded-xl border-red-200/80 bg-red-50/40 shadow-none p-6 text-center">
          <p className="text-sm font-medium text-red-700">{inspectError}</p>
          <p className="text-xs text-red-600/80 mt-1">
            Verify the target ID exists and is active, or refresh the ML cache
          </p>
        </Card>
      ) : results.length === 0 ? (
        <Card className="rounded-xl border-gray-200/80 bg-white shadow-none p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <SlidersHorizontal
              className="w-5 h-5 text-gray-400"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-sm font-medium text-gray-800">
            No matching properties returned
          </p>
          <p className="text-xs text-gray-500 mt-1">
            All candidates may have been filtered by Stage 1 pet safety or
            self-listing rules
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((prop, index) => {
            const imgUrl =
              getApiImageUrl(prop.images?.[0]?.filePath) ||
              assetPath('/graphics/welcome.svg')
            const lowestPrice = getLowestPrice(prop.roomCategories)
            const tierMeta = prop.matchTier
              ? TIER_STYLES[prop.matchTier]
              : undefined
            const bd = prop.scoreBreakdown
            const hasGeoBar = bd?.sGeo != null

            return (
              <Card
                key={prop.id}
                className="rounded-xl border-gray-200/80 bg-white shadow-none hover:border-gray-300 transition-colors duration-150"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Rank + Image + Core Info */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-mono font-medium text-xs flex items-center justify-center shrink-0 tabular-nums">
                        #{index + 1}
                      </div>
                      <img
                        src={imgUrl}
                        alt={prop.title}
                        className="w-20 h-20 rounded-lg object-cover bg-gray-100 border border-gray-200/80 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/detail/${prop.id}`}
                            target="_blank"
                            className="font-medium text-gray-900 hover:text-deep-teal transition-colors flex items-center gap-1.5 truncate"
                          >
                            <span className="truncate">{prop.title}</span>
                            <ExternalLink
                              className="w-3.5 h-3.5 shrink-0 text-gray-400"
                              strokeWidth={1.5}
                            />
                          </Link>
                          <span className="text-xs text-gray-400 font-mono tabular-nums">
                            ID #{prop.id}
                          </span>
                          {tierMeta && (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                                tierMeta.className
                              )}
                            >
                              {tierMeta.label}
                            </span>
                          )}
                          {bd?.distanceKm != null && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 tabular-nums">
                              <MapPin className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
                              {formatDistanceKm(bd.distanceKm)}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>
                            {prop.district}, {prop.province}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star
                              className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500"
                              strokeWidth={1.5}
                            />
                            {prop.avgRating > 0
                              ? `${prop.avgRating.toFixed(1)} (${prop.reviewCount ?? 0})`
                              : 'New'}
                          </span>
                          {lowestPrice !== null && (
                            <span className="font-medium text-gray-900 tabular-nums">
                              ฿{lowestPrice.toLocaleString()}/night
                            </span>
                          )}
                        </div>

                        {/* Explainable Match Reasons — JoodPakPaw signature dot */}
                        {prop.matchReasons && prop.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {prop.matchReasons.map((reason, rIdx) => (
                              <span
                                key={rIdx}
                                className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 border border-gray-200/80 px-2 py-0.5 text-[11px] font-medium text-deep-teal/85"
                              >
                                <span
                                  aria-hidden="true"
                                  className="w-1.5 h-1.5 rounded-full bg-accent-orange shrink-0"
                                />
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Final Score Column */}
                    <div className="lg:text-right shrink-0 flex lg:flex-col items-center lg:items-end justify-between gap-1 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-200/80">
                      <span className="text-xs font-medium text-gray-500">
                        Final score
                      </span>
                      <span className="text-2xl font-semibold text-deep-teal font-baloo2 tabular-nums leading-none">
                        {prop.recommendationScore != null
                          ? prop.recommendationScore.toFixed(4)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Part Score Breakdown — stepped neutral-to-teal bars */}
                  {bd && (
                    <div
                      className={cn(
                        'mt-4 pt-4 border-t border-gray-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4',
                        hasGeoBar ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                      )}
                    >
                      <ScoreBar
                        label="S_content (40%)"
                        sublabel="TF-IDF content match"
                        value={bd.sContent}
                        barClassName="bg-deep-teal"
                      />
                      <ScoreBar
                        label="S_compat (30%)"
                        sublabel="Pet and energy fit"
                        value={bd.sCompat}
                        barClassName="bg-deep-teal/75"
                      />
                      <ScoreBar
                        label="S_quality (20%)"
                        sublabel="Bayesian rating"
                        value={bd.sQuality}
                        barClassName="bg-gray-500"
                      />
                      <ScoreBar
                        label="S_popularity (10%)"
                        sublabel="Time-decayed signals"
                        value={bd.sPopularity}
                        barClassName="bg-gray-400"
                      />
                      {bd.sGeo != null && (
                        <ScoreBar
                          label="S_geo (Boost)"
                          sublabel={
                            bd.distanceKm != null
                              ? `Proximity (${formatDistanceKm(bd.distanceKm)})`
                              : 'Location proximity boost'
                          }
                          value={bd.sGeo}
                          barClassName="bg-deep-teal/55"
                          pill={
                            bd.distanceKm != null
                              ? formatDistanceKm(bd.distanceKm)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ScoreBar({
  label,
  sublabel,
  value,
  barClassName,
  pill,
}: {
  label: string
  sublabel: string
  value: number
  barClassName: string
  pill?: string
}) {
  const pct = clampPct(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className="font-medium text-gray-700 truncate flex items-center gap-1.5"
          title={sublabel}
        >
          <span className="truncate">{label}</span>
          {pill && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-600 tabular-nums shrink-0">
              {pill}
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-gray-500 tabular-nums shrink-0">
          {value.toFixed(4)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className={cn(
            'h-full w-full rounded-full transition-transform duration-200 ease-out',
            barClassName
          )}
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>
    </div>
  )
}
