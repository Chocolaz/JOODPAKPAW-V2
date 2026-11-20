'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Activity,
  Database,
  ExternalLink,
  Gauge,
  PawPrint,
  RefreshCw,
  Server,
  Sparkles,
  Star,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react'
import {
  getAdminMlInspect,
  getAdminMlStatus,
  getProperties,
  refreshAdminMlCache,
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
    const speciesList = Array.from(new Set(user.pets.map((p) => p.species).filter(Boolean)))
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

function clampPct(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value * 100)))
}

export default function AdminMlInspectorPage() {
  const [status, setStatus] = useState<MlStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [refreshingCache, setRefreshingCache] = useState(false)

  const [mode, setMode] = useState<InspectMode>('user')
  const [asUserIdInput, setAsUserIdInput] = useState<string>('')
  const [propertyIdInput, setPropertyIdInput] = useState<string>('')
  const [limit, setLimit] = useState<number>(12)

  const [fallbackProperties, setFallbackProperties] = useState<MlSampleProperty[]>([])
  const [results, setResults] = useState<Property[]>([])
  const [inspectMeta, setInspectMeta] = useState<RecommendationMeta | null>(null)
  const [inspectLoading, setInspectLoading] = useState(true)
  const [inspectError, setInspectError] = useState<string | null>(null)

  const fetchStatus = useCallback(async (): Promise<MlStatusResponse | null> => {
    setStatusLoading(true)
    try {
      const s = await getAdminMlStatus()
      setStatus(s)
      return s
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ML status')
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
    }) => {
      const activeMode = opts?.nextMode ?? mode
      const activeUserIdStr = opts?.nextUserId ?? asUserIdInput
      const activePropIdStr = opts?.nextPropertyId ?? propertyIdInput
      const activeLimit = opts?.nextLimit ?? limit

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
        })
        setResults(res.data)
        setInspectMeta(res.meta ?? null)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to inspect recommendations'
        setInspectError(msg)
        setResults([])
        setInspectMeta(null)
      } finally {
        setInspectLoading(false)
      }
    },
    [mode, asUserIdInput, propertyIdInput, limit]
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
        await runInspection({ nextMode: 'user', nextUserId: defaultId, nextLimit: 12 })
      } else {
        setMode('cold-start')
        await runInspection({ nextMode: 'cold-start', nextLimit: 12 })
      }

      if (!active) return

      const propsFromStatus = loadedStatus?.sampleProperties ?? []
      if (propsFromStatus.length > 0) {
        setPropertyIdInput((prev) => prev || String(propsFromStatus[0].id))
      } else {
        try {
          const res = await getProperties(1, 30)
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
      toast.error(err instanceof Error ? err.message : 'Failed to refresh ML cache')
    } finally {
      setRefreshingCache(false)
    }
  }

  const sampleUsers = status?.sampleUsers ?? []
  const defaultSampleUser =
    sampleUsers.find((u) => u.pets.length > 0) ?? sampleUsers[0]
  const activeSampleUser = sampleUsers.find(
    (u) => String(u.id) === asUserIdInput.trim()
  )
  const similarPropertyOptions: MlSampleProperty[] =
    status?.sampleProperties && status.sampleProperties.length > 0
      ? status.sampleProperties
      : fallbackProperties
  const isLive = status?.status === 'live'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Refresh Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
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
            Inspect 3-Stage Pet-Aware Hybrid rankings, match tiers, explainability reasons, and 4-part score breakdowns.
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
                {status?.mlServiceUrl || 'N/A'} · timeout {status?.timeoutMs ?? 1500}ms
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
                `${status?.catalogSize ?? 0} listings`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500">
            {statusLoading ? (
              <Skeleton className="h-4 w-36" />
            ) : status?.mlHealth ? (
              `DB connected: ${status.mlHealth.dbConnected ? 'Yes' : 'No'}`
            ) : (
              'In-process Prisma snapshot ready'
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
              ? `Source: ${inspectMeta.source === 'ml_service' ? 'joodpakpaw-ml' : 'in_process_fallback'}`
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
            Switch between personalized user personas, cold-start baseline, or item-to-item similarity.
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
                mode === 'user' && 'bg-deep-teal hover:bg-deep-teal/90 text-white'
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
              Personalized User (asUserId)
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
              Similar to Property
            </Button>
          </div>

          {/* Mode-Specific Controls */}
          {mode === 'user' && (
            <div className="space-y-3 pt-1">
              {/* Quick-select persona chips populated live from status.sampleUsers */}
              {statusLoading && sampleUsers.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-8 w-36 rounded-full" />
                  ))}
                </div>
              ) : sampleUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sampleUsers.map((user) => {
                    const selected = String(user.id) === asUserIdInput.trim()
                    const handle = getSampleUserHandle(user)
                    const tag = getSampleUserTag(user)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          const nextId = String(user.id)
                          setAsUserIdInput(nextId)
                          runInspection({ nextMode: 'user', nextUserId: nextId })
                        }}
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

              {/* Selected live user summary, behavior count & pet badges */}
              {activeSampleUser && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3 space-y-2.5 text-xs text-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
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
                      {activeSampleUser.behaviorCount === 1 ? 'behavior' : 'behaviors'}
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
                          <span className="font-semibold text-gray-900">{pet.name}</span>
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
                      {activeSampleUser.roles.some((r) => r.toLowerCase() === 'host')
                        ? 'No registered pets — verifies host self-owned properties are excluded.'
                        : 'No registered pets — evaluates cold-start & behavioral signals.'}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Select Live Persona</Label>
                  <Select
                    value={activeSampleUser ? String(activeSampleUser.id) : ''}
                    onValueChange={(val) => {
                      setAsUserIdInput(val)
                      runInspection({ nextMode: 'user', nextUserId: val })
                    }}
                    disabled={sampleUsers.length === 0}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue
                        placeholder={
                          statusLoading
                            ? 'Loading users...'
                            : sampleUsers.length > 0
                            ? 'Choose a persona...'
                            : 'No sample users'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleUsers.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          #{user.id} · {getSampleUserHandle(user)} ({getSampleUserTag(user)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asUserId" className="text-xs text-gray-600">
                    Custom User ID (asUserId)
                  </Label>
                  <Input
                    id="asUserId"
                    type="number"
                    min={1}
                    value={asUserIdInput}
                    onChange={(e) => setAsUserIdInput(e.target.value)}
                    placeholder={
                      defaultSampleUser ? `e.g. ${defaultSampleUser.id}` : 'User ID'
                    }
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
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

                <Button
                  type="button"
                  onClick={() => runInspection()}
                  disabled={inspectLoading}
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
                >
                  Inspect User Ranking
                </Button>
              </div>
            </div>
          )}

          {mode === 'cold-start' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
              <div className="sm:col-span-2 rounded-lg bg-sky-50/70 border border-sky-100 px-3.5 py-2.5 text-xs text-sky-900">
                Inspecting cold-start ranking (<code className="font-mono">0.65 * S_quality + 0.35 * S_popularity</code> with province diversity tie-breaking).
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
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
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={() => runInspection()}
                  disabled={inspectLoading}
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
                >
                  Run
                </Button>
              </div>
            </div>
          )}

          {mode === 'similar' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-1">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs text-gray-600">Select Property</Label>
                <Select
                  value={propertyIdInput}
                  onValueChange={(val) => {
                    setPropertyIdInput(val)
                    runInspection({ nextMode: 'similar', nextPropertyId: val })
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {similarPropertyOptions.map((prop) => (
                      <SelectItem key={prop.id} value={String(prop.id)}>
                        #{prop.id} · {prop.title} ({prop.province})
                        {prop.avgRating > 0 ? ` · ★ ${prop.avgRating.toFixed(1)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="similarPropId" className="text-xs text-gray-600">
                  Or Property ID
                </Label>
                <Input
                  id="similarPropId"
                  type="number"
                  min={1}
                  value={propertyIdInput}
                  onChange={(e) => setPropertyIdInput(e.target.value)}
                  placeholder="Property ID"
                  className="h-9"
                />
              </div>
              <Button
                type="button"
                onClick={() => runInspection()}
                disabled={inspectLoading}
                className="bg-accent-orange hover:bg-accent-orange/90 text-white cursor-pointer"
              >
                Inspect Similar
              </Button>
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
          </div>
          <span>
            Showing <strong className="text-gray-900">{results.length}</strong> ranked stays
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
            All candidates may have been filtered by Stage 1 pet safety or self-listing rules.
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

                  {/* 4-Part Score Breakdown */}
                  {bd && (
                    <div className="mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
}: {
  label: string
  sublabel: string
  value: number
}) {
  const pct = clampPct(value)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700" title={sublabel}>
          {label}
        </span>
        <span className="font-mono text-[11px] text-gray-500 tabular-nums">
          {value.toFixed(4)}
        </span>
      </div>
      <Progress value={pct} className="h-2 bg-gray-100" />
    </div>
  )
}
