'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Gauge,
  Info,
  Loader2,
  MapPin,
  PawPrint,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Star,
  UserCheck,
  Users,
  X,
  Zap,
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
import { Badge } from '@/components/ui/badge'
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
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

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

const MODE_GUIDE: Record<
  InspectMode,
  { title: string; description: string; tintClass: string }
> = {
  user: {
    title: 'Personalized User (Persona)',
    description:
      "Simulates Home 'Recommended for You' & '/recommended' — runs full 3-Stage Hybrid (Pet Safety + Energy/TF-IDF + Time-Decay + Bayesian + optional Geo-Boost).",
    tintClass: 'border-deep-teal/20 bg-deep-teal/5 text-deep-teal',
  },
  'cold-start': {
    title: 'Cold-Start Baseline',
    description:
      "Simulates Guest Home 'Popular Picks to Get Started' — baseline ranking using IMDB Bayesian Rating (65%) + Popularity (35%) with no pet or behavior bias.",
    tintClass: 'border-sky-200 bg-sky-50/70 text-sky-900',
  },
  similar: {
    title: 'Similar Property',
    description:
      "Simulates Detail Page 'Similar Properties' — Item-to-Item similarity (TF-IDF 55% + Pet Policy Jaccard 20% + Geo/Price 15% + Quality 10%).",
    tintClass: 'border-violet-200 bg-violet-50/70 text-violet-900',
  },
}

const TIER_STYLES: Record<MatchTier, { label: string; className: string }> = {
  all_pets: {
    label: 'Tier A · All Pets',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  partial_pets: {
    label: 'Tier B · Partial Pets',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  cold_start: {
    label: 'Cold-Start',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  similar: {
    label: 'Similar Stay',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
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
    return 'Host · Self-Guard'
  }
  if (user.roles.some((r) => r.toLowerCase() === 'admin')) {
    return 'Admin'
  }
  return 'No pets'
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
          setInspectError('Select or enter a valid positive Property ID.')
          setResults([])
          setInspectMeta(null)
          setInspectLoading(false)
          return
        }
      }

      if (activeMode === 'user' && activeUserIdStr.trim() !== '') {
        const parsedUser = parseInt(activeUserIdStr, 10)
        if (!Number.isSafeInteger(parsedUser) || parsedUser <= 0) {
          setInspectError('User ID must be a positive integer.')
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
          ? `ML & fallback caches refreshed (${res.catalogSize} properties)`
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
          <div className="flex flex-wrap items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-accent-orange" />
            <h2 className="text-xl font-bold text-gray-900 font-baloo2">
              Hybrid ML Recommendation Inspector
            </h2>
            {!statusLoading && status && (
              <Badge
                variant="outline"
                className={
                  isLive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {isLive ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Live ML
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    In-Process Fallback Active
                  </span>
                )}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Inspect 3-Stage Pet-Aware Hybrid rankings, match tiers, explainability
            reasons, and multi-factor score breakdowns.
          </p>
        </div>

        <Button
          onClick={handleRefreshCache}
          disabled={refreshingCache}
          className="bg-deep-teal hover:bg-deep-teal/90 text-white cursor-pointer"
        >
          <RefreshCw
            className={cn('w-4 h-4', refreshingCache && 'animate-spin')}
          />
          {refreshingCache ? 'Refreshing Cache...' : 'Refresh ML Cache'}
        </Button>
      </div>

      {/* Engine Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Server className="w-3.5 h-3.5 text-gray-400" />
              Engine Mode
            </CardDescription>
            <CardTitle className="text-lg font-bold text-gray-900">
              {statusLoading ? (
                <Skeleton className="h-6 w-32" />
              ) : isLive ? (
                'Live ML Service'
              ) : (
                'Fallback Engine'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 truncate">
            {statusLoading ? (
              <Skeleton className="h-4 w-44" />
            ) : (
              <span title={status?.mlServiceUrl}>
                {status?.mlServiceUrl || 'N/A'} · timeout{' '}
                {status?.timeoutMs ?? 1500}ms
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Database className="w-3.5 h-3.5 text-gray-400" />
              Catalog Snapshot
            </CardDescription>
            <CardTitle className="text-lg font-bold text-gray-900 tabular-nums">
              {statusLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                `${(status?.totalActiveProperties ?? status?.catalogSize ?? 0).toLocaleString()} listings`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">
            {statusLoading ? (
              <Skeleton className="h-4 w-36" />
            ) : status?.mlHealth ? (
              `DB connected: ${status.mlHealth.dbConnected ? 'Yes' : 'No'}${
                status.totalUsers != null
                  ? ` · ${status.totalUsers.toLocaleString()} users`
                  : ''
              }`
            ) : (
              `In-process Prisma snapshot ready${
                status?.totalUsers != null
                  ? ` · ${status.totalUsers.toLocaleString()} users`
                  : ''
              }`
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Snapshot Age
            </CardDescription>
            <CardTitle className="text-lg font-bold text-gray-900 tabular-nums">
              {statusLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                `${(status?.snapshotAgeSeconds ?? 0).toFixed(1)}s`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">
            60s TTL snapshot cache
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Gauge className="w-3.5 h-3.5 text-gray-400" />
              Query Latency
            </CardDescription>
            <CardTitle className="text-lg font-bold text-gray-900 tabular-nums">
              {inspectLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : inspectMeta?.latencyMs != null ? (
                `${inspectMeta.latencyMs} ms`
              ) : (
                '—'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">
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
      <Card className="border-gray-100 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900">
            Inspection Target
          </CardTitle>
          <CardDescription>
            Switch between personalized user personas, cold-start baseline, or
            item-to-item similarity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'user' ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                mode === 'user' &&
                  'bg-deep-teal hover:bg-deep-teal/90 text-white'
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
              <UserCheck className="w-3.5 h-3.5" />
              Personalized User (Persona)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'cold-start' ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                mode === 'cold-start' &&
                  'bg-deep-teal hover:bg-deep-teal/90 text-white'
              )}
              onClick={() => {
                setMode('cold-start')
                runInspection({ nextMode: 'cold-start' })
              }}
            >
              <Activity className="w-3.5 h-3.5" />
              Cold-Start Baseline
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'similar' ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                mode === 'similar' &&
                  'bg-deep-teal hover:bg-deep-teal/90 text-white'
              )}
              onClick={() => {
                setMode('similar')
                runInspection({ nextMode: 'similar' })
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Similar Property
            </Button>
          </div>

          {/* Mode Guide Banner */}
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed',
              activeModeGuide.tintClass
            )}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{activeModeGuide.title}:</span>{' '}
              <span>{activeModeGuide.description}</span>
            </div>
          </div>

          {/* Mode-Specific Controls */}
          {mode === 'user' && (
            <div className="space-y-3.5 pt-1">
              {/* Featured Demo Personas (max 6) + Total Users Badge */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-600">
                    Featured Demo Personas
                  </span>
                  {status?.totalUsers != null && (
                    <Badge
                      variant="outline"
                      className="border-gray-200 bg-gray-50 text-gray-600 text-[11px] tabular-nums"
                    >
                      <Users className="w-3 h-3 mr-1 text-deep-teal" />
                      {status.totalUsers.toLocaleString()} total users
                    </Badge>
                  )}
                </div>

                {statusLoading && featuredUsers.length === 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-8 w-36 rounded-full" />
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
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                            selected
                              ? 'border-deep-teal bg-deep-teal/10 text-deep-teal'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          )}
                        >
                          {handle} ({tag}) · #{user.id}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              {/* Selected live user summary, behavior count & pet badges */}
              {activeSampleUser && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3 space-y-2.5 text-xs text-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-gray-500">
                        #{activeSampleUser.id}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {`${activeSampleUser.firstName} ${activeSampleUser.lastName}`.trim() ||
                          getSampleUserHandle(activeSampleUser)}
                      </span>
                      <span className="font-semibold text-deep-teal">
                        {activeSampleUser.email}
                      </span>
                      {activeSampleUser.roles.map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide border-gray-200 bg-white text-gray-600"
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <Badge
                      variant="outline"
                      className="border-deep-teal/20 bg-deep-teal/5 text-deep-teal text-[11px] tabular-nums"
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      {activeSampleUser.behaviorCount}{' '}
                      {activeSampleUser.behaviorCount === 1
                        ? 'behavior'
                        : 'behaviors'}
                    </Badge>
                  </div>

                  {activeSampleUser.pets.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeSampleUser.pets.map((pet) => (
                        <div
                          key={pet.id}
                          className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] text-gray-700"
                        >
                          <PawPrint className="w-3 h-3 text-accent-orange shrink-0" />
                          <span className="font-semibold text-gray-900">
                            {pet.name}
                          </span>
                          <span className="text-gray-500">· {pet.species}</span>
                          {pet.weight != null && (
                            <span className="text-gray-500 tabular-nums">
                              · {pet.weight} kg
                            </span>
                          )}
                          {pet.sizeName && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                              {pet.sizeName}
                            </span>
                          )}
                          {pet.energyRating != null && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 tabular-nums">
                              <Zap className="w-2.5 h-2.5" />
                              L{pet.energyRating}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      {activeSampleUser.roles.some(
                        (r) => r.toLowerCase() === 'host'
                      )
                        ? 'No registered pets — verifies host self-owned properties are excluded.'
                        : 'No registered pets — evaluates cold-start & behavioral signals.'}
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
                    className="text-xs text-gray-600"
                  >
                    Search Any User (Email, Name, or ID)
                  </Label>
                  <Popover
                    open={userSearchOpen && userSearchQuery.trim().length > 0}
                    onOpenChange={setUserSearchOpen}
                  >
                    <PopoverAnchor asChild>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                          placeholder="Search email, name, or #ID..."
                          className="h-9 pl-8 pr-8 text-sm"
                          autoComplete="off"
                        />
                        {userSearchLoading ? (
                          <Loader2 className="w-3.5 h-3.5 text-deep-teal animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                        ) : userSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setUserSearchQuery('')
                              setUserSearchResults([])
                              setUserSearchOpen(false)
                            }}
                            aria-label="Clear user search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-[var(--radix-popover-trigger-width)] sm:w-[440px] max-w-[calc(100vw-2.5rem)] p-1.5 shadow-lg border-gray-200 bg-white"
                    >
                      {userSearchLoading && userSearchResults.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-deep-teal" />
                          Searching users...
                        </div>
                      ) : userSearchError ? (
                        <div className="px-3 py-3 text-xs text-red-600">
                          {userSearchError}
                        </div>
                      ) : userSearchResults.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-gray-500 text-center">
                          No matching users found for &ldquo;
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
                                  'w-full text-left px-2.5 py-2 rounded-md transition-colors hover:bg-gray-50 cursor-pointer space-y-1',
                                  isSelected && 'bg-deep-teal/5'
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] text-gray-400 shrink-0">
                                      #{user.id}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-900 truncate">
                                      {fullName}
                                    </span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-deep-teal/5 border border-deep-teal/15 px-2 py-0.5 text-[10px] font-medium text-deep-teal shrink-0 tabular-nums">
                                    <Activity className="w-2.5 h-2.5" />
                                    {user.behaviorCount}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                                  <span className="truncate text-deep-teal/90">
                                    {user.email}
                                  </span>
                                  {user.pets.length > 0 ? (
                                    user.pets.slice(0, 3).map((pet) => (
                                      <span
                                        key={pet.id}
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                      >
                                        <PawPrint className="w-2.5 h-2.5 text-accent-orange" />
                                        {pet.species}
                                        {pet.sizeName ? ` · ${pet.sizeName}` : ''}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                      {getSampleUserTag(user)}
                                    </span>
                                  )}
                                  {user.pets.length > 3 && (
                                    <span className="text-[10px] text-gray-400">
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
                  <Label htmlFor="asUserId" className="text-xs text-gray-600">
                    User ID (asUserId)
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
                      defaultSampleUser
                        ? `e.g. ${defaultSampleUser.id}`
                        : 'User ID'
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {/* Optional Location Simulation Preset */}
                <div className="lg:col-span-3 space-y-1.5">
                  <Label className="text-xs text-gray-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-deep-teal" />
                    Location Simulation
                  </Label>
                  <Select
                    value={locationKey}
                    onValueChange={(val) => {
                      const nextLoc = val as LocationPresetKey
                      setLocationKey(nextLoc)
                      runInspection({ nextLocationKey: nextLoc })
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
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
                  <Label className="text-xs text-gray-600">Limit</Label>
                  <Select
                    value={String(limit)}
                    onValueChange={(val) => {
                      const nextLim = Number(val)
                      setLimit(nextLim)
                      runInspection({ nextLimit: nextLim })
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
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
                    className="w-full h-9 bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
                  >
                    Inspect Ranking
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mode === 'cold-start' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pt-1">
              <div className="lg:col-span-5 space-y-1.5">
                <Label className="text-xs text-gray-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-deep-teal" />
                  Location Simulation (Optional Geo-Boost)
                </Label>
                <Select
                  value={locationKey}
                  onValueChange={(val) => {
                    const nextLoc = val as LocationPresetKey
                    setLocationKey(nextLoc)
                    runInspection({ nextLocationKey: nextLoc })
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
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
                <Label className="text-xs text-gray-600">Result Limit</Label>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    const nextLim = Number(val)
                    setLimit(nextLim)
                    runInspection({ nextLimit: nextLim })
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
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
                  className="w-full h-9 bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
                >
                  Run Cold-Start Inspection
                </Button>
              </div>
            </div>
          )}

          {mode === 'similar' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {activeSelectedProperty ? (
                  <div className="inline-flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
                    <span className="text-gray-500">Target Property:</span>
                    <span className="font-mono text-[11px] text-gray-500">
                      #{activeSelectedProperty.id}
                    </span>
                    <span className="font-semibold text-gray-900">
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
                  <Badge
                    variant="outline"
                    className="border-gray-200 bg-gray-50 text-gray-600 text-[11px] tabular-nums"
                  >
                    <Building2 className="w-3 h-3 mr-1 text-deep-teal" />
                    {(
                      status?.totalActiveProperties ??
                      status?.catalogSize ??
                      0
                    ).toLocaleString()}{' '}
                    active properties
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                {/* Debounced Server-Side Property Search Box */}
                <div className="sm:col-span-2 lg:col-span-5 space-y-1.5">
                  <Label
                    htmlFor="propSearchInput"
                    className="text-xs text-gray-600"
                  >
                    Search Any Property (Title, Province, or ID)
                  </Label>
                  <Popover
                    open={propSearchOpen && propSearchQuery.trim().length > 0}
                    onOpenChange={setPropSearchOpen}
                  >
                    <PopoverAnchor asChild>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                          placeholder="Search title, province, or #ID..."
                          className="h-9 pl-8 pr-8 text-sm"
                          autoComplete="off"
                        />
                        {propSearchLoading ? (
                          <Loader2 className="w-3.5 h-3.5 text-deep-teal animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                        ) : propSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPropSearchQuery('')
                              setPropSearchResults([])
                              setPropSearchOpen(false)
                            }}
                            aria-label="Clear property search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-[var(--radix-popover-trigger-width)] sm:w-[440px] max-w-[calc(100vw-2.5rem)] p-1.5 shadow-lg border-gray-200 bg-white"
                    >
                      {propSearchLoading && propSearchResults.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-deep-teal" />
                          Searching properties...
                        </div>
                      ) : propSearchError ? (
                        <div className="px-3 py-3 text-xs text-red-600">
                          {propSearchError}
                        </div>
                      ) : propSearchResults.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-gray-500 text-center">
                          No matching properties found for &ldquo;
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
                                  'w-full text-left px-2.5 py-2 rounded-md transition-colors hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-2',
                                  isSelected && 'bg-deep-teal/5'
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] text-gray-400 shrink-0">
                                      #{prop.id}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-900 truncate">
                                      {prop.title}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                    {prop.province}
                                  </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 shrink-0 tabular-nums">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-500" />
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
                  <Label className="text-xs text-gray-600">
                    Quick Picks (Top 12)
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
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose quick pick..." />
                    </SelectTrigger>
                    <SelectContent>
                      {similarPropertyOptions.map((prop) => (
                        <SelectItem key={prop.id} value={String(prop.id)}>
                          #{prop.id} · {prop.title} ({prop.province})
                          {prop.avgRating > 0
                            ? ` · ★ ${prop.avgRating.toFixed(1)}`
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
                    className="text-xs text-gray-600"
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
                    className="h-9 text-sm"
                  />
                </div>

                {/* Inspect Similar Button */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <Button
                    type="button"
                    onClick={() => runInspection()}
                    disabled={inspectLoading}
                    className="w-full h-9 bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
                  >
                    Inspect Similar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Header */}
      {inspectMeta && !inspectLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-gray-100 px-4 py-3 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              <strong className="text-gray-900">Strategy:</strong>{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">
                {inspectMeta.strategy}
              </code>
            </span>
            <span>
              <strong className="text-gray-900">Source:</strong>{' '}
              {inspectMeta.source}
            </span>
            {inspectMeta.totalCandidates != null && (
              <span>
                <strong className="text-gray-900">Candidates:</strong>{' '}
                {inspectMeta.totalCandidates}
              </span>
            )}
            {mode !== 'similar' && locationKey !== 'global' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-deep-teal/5 border border-deep-teal/15 px-2 py-0.5 text-[11px] font-medium text-deep-teal">
                <MapPin className="w-3 h-3" />
                {activeLocationPreset.label}
              </span>
            )}
          </div>
          <span>
            Showing <strong className="text-gray-900">{results.length}</strong>{' '}
            ranked stays
          </span>
        </div>
      )}

      {/* Results List */}
      {inspectLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-gray-100 shadow-none p-5">
              <div className="flex flex-col md:flex-row gap-4">
                <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : inspectError ? (
        <Card className="border-red-200 bg-red-50/40 shadow-none p-6 text-center">
          <p className="text-sm font-semibold text-red-700">{inspectError}</p>
          <p className="text-xs text-red-600 mt-1">
            Verify the target ID exists and is active, or refresh the ML cache.
          </p>
        </Card>
      ) : results.length === 0 ? (
        <Card className="border-gray-100 shadow-none p-10 text-center">
          <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">
            No matching properties returned
          </p>
          <p className="text-xs text-gray-500 mt-1">
            All candidates may have been filtered by Stage 1 pet safety or
            self-listing rules.
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
                className="border-gray-100 shadow-none hover:border-gray-200 transition-colors"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Rank + Image + Core Info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-deep-teal/10 text-deep-teal font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                        #{index + 1}
                      </div>
                      <img
                        src={imgUrl}
                        alt={prop.title}
                        className="w-20 h-20 rounded-xl object-cover bg-gray-100 border border-gray-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/detail/${prop.id}`}
                            target="_blank"
                            className="font-semibold text-gray-900 hover:text-deep-teal transition-colors flex items-center gap-1 truncate"
                          >
                            <span className="truncate">{prop.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          </Link>
                          <span className="text-xs text-gray-400 font-mono">
                            ID #{prop.id}
                          </span>
                          {tierMeta && (
                            <Badge
                              variant="outline"
                              className={cn('text-[11px]', tierMeta.className)}
                            >
                              {tierMeta.label}
                            </Badge>
                          )}
                          {bd?.distanceKm != null && (
                            <Badge
                              variant="outline"
                              className="border-deep-teal/20 bg-deep-teal/5 text-deep-teal text-[11px] tabular-nums"
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              {formatDistanceKm(bd.distanceKm)}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>
                            {prop.district}, {prop.province}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500" />
                            {prop.avgRating > 0
                              ? `${prop.avgRating.toFixed(1)} (${prop.reviewCount ?? 0})`
                              : 'New'}
                          </span>
                          {lowestPrice !== null && (
                            <span className="font-semibold text-deep-teal tabular-nums">
                              ฿{lowestPrice.toLocaleString()}/night
                            </span>
                          )}
                        </div>

                        {/* Explainable Match Reasons */}
                        {prop.matchReasons && prop.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {prop.matchReasons.map((reason, rIdx) => (
                              <span
                                key={rIdx}
                                className="inline-flex items-center gap-1 rounded-full bg-deep-teal/5 border border-deep-teal/10 px-2.5 py-0.5 text-[11px] font-medium text-deep-teal"
                              >
                                <Sparkles className="w-3 h-3 text-accent-orange shrink-0" />
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Final Score Badge */}
                    <div className="lg:text-right shrink-0 flex lg:flex-col items-center lg:items-end justify-between gap-1 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-100">
                      <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                        Final Score
                      </span>
                      <span className="text-2xl font-bold text-deep-teal font-baloo2 tabular-nums leading-none">
                        {prop.recommendationScore != null
                          ? prop.recommendationScore.toFixed(4)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Part Score Breakdown */}
                  {bd && (
                    <div
                      className={cn(
                        'mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3.5',
                        hasGeoBar ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                      )}
                    >
                      <ScoreBar
                        label="S_content (40%)"
                        sublabel="TF-IDF Content"
                        value={bd.sContent}
                      />
                      <ScoreBar
                        label="S_compat (30%)"
                        sublabel="Pet & Energy Fit"
                        value={bd.sCompat}
                      />
                      <ScoreBar
                        label="S_quality (20%)"
                        sublabel="Bayesian Rating"
                        value={bd.sQuality}
                      />
                      <ScoreBar
                        label="S_popularity (10%)"
                        sublabel="Time-Decayed Signals"
                        value={bd.sPopularity}
                      />
                      {bd.sGeo != null && (
                        <ScoreBar
                          label="S_geo (Geo-Boost)"
                          sublabel={
                            bd.distanceKm != null
                              ? `Proximity (${formatDistanceKm(bd.distanceKm)})`
                              : 'Location Proximity Boost'
                          }
                          value={bd.sGeo}
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
  pill,
}: {
  label: string
  sublabel: string
  value: number
  pill?: string
}) {
  const pct = clampPct(value)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1 text-xs">
        <span
          className="font-medium text-gray-700 truncate flex items-center gap-1"
          title={sublabel}
        >
          <span>{label}</span>
          {pill && (
            <span className="rounded bg-deep-teal/10 px-1 py-0.2 text-[10px] font-medium text-deep-teal tabular-nums shrink-0">
              {pill}
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-gray-500 tabular-nums shrink-0">
          {value.toFixed(4)}
        </span>
      </div>
      <Progress value={pct} className="h-2 bg-gray-100" />
    </div>
  )
}
