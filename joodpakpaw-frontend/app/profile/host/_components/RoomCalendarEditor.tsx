'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Wrench,
  Check,
  RotateCcw,
  AlertCircle,
  X,
  BedDouble,
  Loader2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRoomCategoryCalendars, updateRoomCategoryCalendars } from '@/lib/api'
import type { RoomCategories, RoomCategoryCalendarItem } from '@/types'
import { cn } from '@/lib/utils'

interface RoomCalendarEditorProps {
  propertyId: number | string
  room: RoomCategories
  mode?: 'modal' | 'embedded'
  onClose?: () => void
  onSuccess?: () => void
}

interface PendingDayUpdate {
  unavailableRooms: number
  priceAdjustment: number
}

type BulkScope = 'range' | 'weekends' | 'month'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PRICE_PRESETS = [0, 50, 100, 200, 300, 500, -50, -100]
const MAX_ADVANCE_BOOKING_DAYS = 180

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function RoomCalendarEditor({
  propertyId,
  room,
  mode = 'modal',
  onClose,
  onSuccess,
}: RoomCalendarEditorProps) {
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const todayStr = useMemo(() => toDateStr(today), [today])

  const maxAdvanceDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + MAX_ADVANCE_BOOKING_DAYS)
    return d
  }, [today])

  const maxAdvanceDateStr = useMemo(
    () => toDateStr(maxAdvanceDate),
    [maxAdvanceDate]
  )

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const [calendars, setCalendars] = useState<RoomCategoryCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Click-range selection ('YYYY-MM-DD')
  const [rangeStart, setRangeStart] = useState<string | null>(todayStr)
  const [rangeEnd, setRangeEnd] = useState<string | null>(todayStr)
  const [bulkScope, setBulkScope] = useState<BulkScope>('range')

  const [pendingUpdates, setPendingUpdates] = useState<
    Record<string, PendingDayUpdate>
  >({})

  const [editUnavailableRooms, setEditUnavailableRooms] = useState<number>(0)
  const [editPriceAdjustment, setEditPriceAdjustment] = useState<number>(0)

  const monthYearLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [currentMonth]
  )

  const canGoPrevMonth = useMemo(() => {
    const prev = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    )
    const currentMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1)
    return prev >= currentMonthFirst
  }, [currentMonth, today])

  const canGoNextMonth = useMemo(() => {
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    )
    const maxMonthFirst = new Date(
      maxAdvanceDate.getFullYear(),
      maxAdvanceDate.getMonth(),
      1
    )
    return next <= maxMonthFirst
  }, [currentMonth, maxAdvanceDate])

  const { startDateStr, endDateStr, daysInMonth, firstDayOfWeek } =
    useMemo(() => {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const totalDays = lastDay.getDate()

      const sStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const eStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        totalDays
      ).padStart(2, '0')}`

      return {
        startDateStr: sStr,
        endDateStr: eStr,
        daysInMonth: totalDays,
        firstDayOfWeek: firstDay.getDay(),
      }
    }, [currentMonth])

  const calendarMap = useMemo(() => {
    const map = new Map<string, RoomCategoryCalendarItem>()
    for (const item of calendars) {
      map.set(item.date, item)
    }
    return map
  }, [calendars])

  const getDayValues = useCallback(
    (
      dateStr: string,
      mapOverride?: Map<string, RoomCategoryCalendarItem>
    ) => {
      const lookup = mapOverride ?? calendarMap
      const dbItem = lookup.get(dateStr)
      const pending = pendingUpdates[dateStr]

      const bookedRooms = dbItem?.bookedRooms ?? 0
      const totalRooms = room.totalRoom
      const basePrice = Number(room.basePrice)

      const unavailableRooms = pending
        ? pending.unavailableRooms
        : dbItem?.unavailableRooms ?? 0

      const priceAdjustment = pending
        ? pending.priceAdjustment
        : dbItem?.priceAdjustment ?? 0

      const effectivePrice = Math.max(1, basePrice + priceAdjustment)
      const availableRooms = Math.max(
        0,
        totalRooms - bookedRooms - unavailableRooms
      )

      return {
        bookedRooms,
        totalRooms,
        basePrice,
        unavailableRooms,
        priceAdjustment,
        effectivePrice,
        availableRooms,
        isModified: !!pending,
      }
    },
    [calendarMap, pendingUpdates, room.totalRoom, room.basePrice]
  )

  const loadMonth = useCallback(
    async (sDate: string, eDate: string) => {
      if (!room?.id || !propertyId) return
      try {
        const res = await getRoomCategoryCalendars(
          propertyId,
          room.id,
          sDate,
          eDate
        )
        const list = res.calendars || []
        setCalendars(list)
        if (rangeStart) {
          const map = new Map<string, RoomCategoryCalendarItem>()
          for (const item of list) map.set(item.date, item)
          const pending = pendingUpdates[rangeStart]
          const dbItem = map.get(rangeStart)
          setEditUnavailableRooms(
            pending ? pending.unavailableRooms : dbItem?.unavailableRooms ?? 0
          )
          setEditPriceAdjustment(
            pending ? pending.priceAdjustment : dbItem?.priceAdjustment ?? 0
          )
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load calendar data'
        )
      } finally {
        setLoading(false)
      }
    },
    [propertyId, room?.id, rangeStart, pendingUpdates]
  )

  useEffect(() => {
    let cancelled = false
    if (!room?.id || !propertyId) return
    getRoomCategoryCalendars(propertyId, room.id, startDateStr, endDateStr)
      .then((res) => {
        if (cancelled) return
        const list = res.calendars || []
        setCalendars(list)
        if (todayStr >= startDateStr && todayStr <= endDateStr) {
          const dbItem = list.find((item) => item.date === todayStr)
          setEditUnavailableRooms(dbItem?.unavailableRooms ?? 0)
          setEditPriceAdjustment(dbItem?.priceAdjustment ?? 0)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to load calendar data'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId, room?.id, startDateStr, endDateStr, todayStr])

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    )
    setLoading(true)
    setCurrentMonth(next)
  }

  const handleNextMonth = () => {
    if (!canGoNextMonth) return
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    )
    setLoading(true)
    setCurrentMonth(next)
  }

  const syncEditorToDate = (dateStr: string) => {
    const values = getDayValues(dateStr)
    setEditUnavailableRooms(values.unavailableRooms)
    setEditPriceAdjustment(values.priceAdjustment)
  }

  const handleDayClick = (dateStr: string) => {
    if (dateStr < todayStr) {
      toast.info('Past dates cannot be modified.')
      return
    }
    if (dateStr > maxAdvanceDateStr) {
      toast.info(
        `Dates beyond the ${MAX_ADVANCE_BOOKING_DAYS}-day booking window cannot be modified.`
      )
      return
    }

    setBulkScope('range')

    if (!rangeStart || (rangeStart && rangeEnd && rangeStart !== rangeEnd)) {
      setRangeStart(dateStr)
      setRangeEnd(dateStr)
      syncEditorToDate(dateStr)
    } else if (rangeStart === dateStr) {
      syncEditorToDate(dateStr)
    } else {
      const start = rangeStart < dateStr ? rangeStart : dateStr
      const end = rangeStart < dateStr ? dateStr : rangeStart
      setRangeStart(start)
      setRangeEnd(end)
      syncEditorToDate(start)
    }
  }

  const activeDateSet = useMemo(() => {
    const set = new Set<string>()
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`
      if (dStr < todayStr || dStr > maxAdvanceDateStr) continue

      if (bulkScope === 'weekends') {
        const dow = new Date(year, month, d).getDay()
        if (dow === 5 || dow === 6) {
          set.add(dStr)
        }
      } else if (bulkScope === 'month') {
        set.add(dStr)
      } else if (rangeStart && rangeEnd) {
        if (dStr >= rangeStart && dStr <= rangeEnd) {
          set.add(dStr)
        }
      }
    }
    return set
  }, [
    bulkScope,
    currentMonth,
    daysInMonth,
    maxAdvanceDateStr,
    rangeEnd,
    rangeStart,
    todayStr,
  ])

  const selectedDayInfo = useMemo(() => {
    if (!rangeStart) return null
    return getDayValues(rangeStart)
  }, [rangeStart, getDayValues])

  const maxUnavailable = useMemo(() => {
    if (activeDateSet.size > 1) return room.totalRoom
    if (!selectedDayInfo) return room.totalRoom
    return Math.max(0, room.totalRoom - selectedDayInfo.bookedRooms)
  }, [activeDateSet.size, selectedDayInfo, room.totalRoom])

  const handleApplyChanges = () => {
    if (room.basePrice + editPriceAdjustment <= 0) {
      toast.error('Effective price must be greater than ฿0')
      return
    }

    if (editUnavailableRooms < 0 || editUnavailableRooms > maxUnavailable) {
      toast.error(`Unavailable rooms must be between 0 and ${maxUnavailable}`)
      return
    }

    const targets = Array.from(activeDateSet).sort()
    if (targets.length === 0) {
      toast.info('No eligible dates selected for this month.')
      return
    }

    setPendingUpdates((prev) => {
      const next = { ...prev }
      for (const dStr of targets) {
        const item = calendarMap.get(dStr)
        const booked = item?.bookedRooms ?? 0
        const maxUnavailForDay = Math.max(0, room.totalRoom - booked)
        next[dStr] = {
          unavailableRooms: Math.min(editUnavailableRooms, maxUnavailForDay),
          priceAdjustment: editPriceAdjustment,
        }
      }
      return next
    })

    const label =
      bulkScope === 'weekends'
        ? `${targets.length} weekend day(s) in ${monthYearLabel}`
        : bulkScope === 'month'
        ? `${targets.length} upcoming day(s) in ${monthYearLabel}`
        : targets.length === 1
        ? targets[0]
        : `${targets[0]} to ${targets[targets.length - 1]} (${targets.length} days)`

    toast.success(`Staged changes for ${label}`)
  }

  const handleRevertSelection = () => {
    const targets = Array.from(activeDateSet)
    if (targets.length === 0) return
    setPendingUpdates((prev) => {
      const copy = { ...prev }
      for (const d of targets) delete copy[d]
      return copy
    })
    toast.info('Reverted staged changes for selection')
  }

  const handleDiscardAll = () => {
    setPendingUpdates({})
    toast.info('All unsaved changes discarded')
  }

  const handleSaveAll = async () => {
    const updateEntries = Object.entries(pendingUpdates)
    if (updateEntries.length === 0) return

    setSaving(true)
    try {
      const updatesPayload = updateEntries.map(([date, val]) => ({
        date,
        unavailableRooms: val.unavailableRooms,
        priceAdjustment: val.priceAdjustment,
      }))

      await updateRoomCategoryCalendars(propertyId, room.id, updatesPayload)
      toast.success(
        `Saved availability & pricing for ${updatesPayload.length} day(s)`
      )
      setPendingUpdates({})
      await loadMonth(startDateStr, endDateStr)
      onSuccess?.()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to save calendar updates. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = Object.keys(pendingUpdates).length

  const targetSummaryText = useMemo(() => {
    if (bulkScope === 'weekends') {
      return `All upcoming Fri & Sat in ${monthYearLabel} (${activeDateSet.size} days)`
    }
    if (bulkScope === 'month') {
      return `All upcoming days in ${monthYearLabel} (${activeDateSet.size} days)`
    }
    if (rangeStart && rangeEnd && rangeStart !== rangeEnd) {
      return `${rangeStart} to ${rangeEnd} (${activeDateSet.size} days)`
    }
    if (rangeStart) {
      return new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return 'Select a date or range'
  }, [bulkScope, monthYearLabel, activeDateSet.size, rangeStart, rangeEnd])

  return (
    <div
      className={cn(
        'flex flex-col bg-off-white/40 text-foreground select-none',
        mode === 'modal'
          ? 'h-full overflow-hidden'
          : 'rounded-2xl border border-border overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 bg-white border-b border-border flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-off-white border border-border flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-deep-teal" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-deep-teal truncate">{room.name}</h3>
              <Badge
                variant="outline"
                className="text-xs font-medium text-neutral-gray bg-off-white tabular-nums"
              >
                {room.totalRoom} {room.totalRoom === 1 ? 'Room' : 'Rooms'}
              </Badge>
            </div>
            <p className="text-xs text-neutral-gray mt-0.5 tabular-nums">
              Base price{' '}
              <span className="font-semibold text-foreground">
                ฿{room.basePrice.toLocaleString()}
              </span>{' '}
              / night
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-gray hover:text-foreground hover:bg-off-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Body */}
      <div
        className={cn(
          'flex-1 min-h-0 lg:grid lg:grid-cols-[1fr_340px] divide-y lg:divide-y-0 lg:divide-x divide-border',
          mode === 'modal' && 'overflow-y-auto lg:overflow-hidden'
        )}
      >
        {/* Left: Month View */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto modern-scrollbar">
          {/* Month Navigation & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!canGoPrevMonth}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-off-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm sm:text-base font-bold text-deep-teal min-w-[140px] text-center">
                {monthYearLabel}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!canGoNextMonth}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-off-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center flex-wrap gap-2 text-xs text-neutral-gray">
              <span className="px-2 py-0.5 rounded-md bg-off-white border border-border text-deep-teal font-medium">
                Click start &amp; end for range
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                Amber = staged
              </span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-2xl border border-border p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-semibold text-neutral-gray">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 sm:h-24 w-full rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div
                    key={`blank-${i}`}
                    className="h-20 sm:h-24 rounded-xl bg-off-white/40 border border-transparent"
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const dateStr = `${currentMonth.getFullYear()}-${String(
                    currentMonth.getMonth() + 1
                  ).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

                  const isPast = dateStr < todayStr
                  const isBeyondWindow = dateStr > maxAdvanceDateStr
                  const isDisabledDay = isPast || isBeyondWindow
                  const isToday = dateStr === todayStr
                  const isInActiveSet = activeDateSet.has(dateStr)
                  const isCap =
                    bulkScope === 'range' &&
                    (dateStr === rangeStart || dateStr === rangeEnd)
                  const dayVals = getDayValues(dateStr)

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDayClick(dateStr)}
                      disabled={isDisabledDay}
                      className={cn(
                        'relative flex flex-col justify-between p-1.5 sm:p-2 rounded-xl text-left border transition-colors h-20 sm:h-24 min-w-0 cursor-pointer',
                        isDisabledDay
                          ? 'bg-off-white/50 border-border/50 opacity-40 cursor-not-allowed'
                          : isCap
                          ? 'bg-deep-teal/10 border-deep-teal ring-2 ring-deep-teal/20'
                          : isInActiveSet
                          ? 'bg-deep-teal/5 border-deep-teal/50'
                          : dayVals.isModified
                          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                          : 'bg-white border-border hover:border-deep-teal/40'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={cn(
                            'text-xs sm:text-sm font-semibold tabular-nums leading-none',
                            isToday
                              ? 'w-5 h-5 rounded-full bg-deep-teal text-white flex items-center justify-center text-[11px]'
                              : isCap || isInActiveSet
                              ? 'text-deep-teal'
                              : 'text-foreground'
                          )}
                        >
                          {dayNum}
                        </span>
                        {dayVals.isModified && (
                          <span className="text-[10px] font-semibold px-1 rounded bg-amber-200 text-amber-900">
                            Edit
                          </span>
                        )}
                      </div>

                      {isBeyondWindow ? (
                        <span className="text-[10px] font-medium text-neutral-gray">
                          Closed
                        </span>
                      ) : (
                        <div className="my-0.5 truncate">
                          <div className="text-[11px] sm:text-xs font-bold text-deep-teal tabular-nums leading-tight">
                            ฿{dayVals.effectivePrice.toLocaleString()}
                          </div>
                          {dayVals.priceAdjustment !== 0 && (
                            <span
                              className={cn(
                                'text-[10px] font-semibold tabular-nums leading-none',
                                dayVals.priceAdjustment > 0
                                  ? 'text-positive-green'
                                  : 'text-accent-orange'
                              )}
                            >
                              {dayVals.priceAdjustment > 0
                                ? `+฿${dayVals.priceAdjustment}`
                                : `-฿${Math.abs(dayVals.priceAdjustment)}`}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {isBeyondWindow ? (
                          <span className="text-[10px] text-neutral-gray truncate tabular-nums">
                            &gt; {MAX_ADVANCE_BOOKING_DAYS}d
                          </span>
                        ) : dayVals.bookedRooms > 0 ? (
                          <span className="text-[10px] px-1 rounded bg-foreground text-white font-medium flex items-center gap-0.5 truncate tabular-nums">
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                            {dayVals.bookedRooms} booked
                          </span>
                        ) : dayVals.unavailableRooms > 0 ? (
                          <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-900 font-medium flex items-center gap-0.5 truncate tabular-nums">
                            <Wrench className="w-2.5 h-2.5 shrink-0" />
                            {dayVals.unavailableRooms} blocked
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-gray tabular-nums truncate">
                            {dayVals.availableRooms} avail
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Smart Range & Day Editor */}
        <div className="bg-white p-4 sm:p-5 flex flex-col justify-between overflow-y-auto modern-scrollbar">
          {selectedDayInfo || activeDateSet.size > 0 ? (
            <div className="space-y-4">
              {/* Target Scope Header */}
              <div className="border-b border-border pb-3 space-y-2">
                <p className="text-xs font-semibold text-neutral-gray">
                  Target dates &amp; bulk scope
                </p>
                <h4 className="text-deep-teal tabular-nums leading-snug">
                  {targetSummaryText}
                </h4>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(
                    [
                      { id: 'range', label: 'Selected' },
                      { id: 'weekends', label: 'Fri–Sat' },
                      { id: 'month', label: 'Full Month' },
                    ] as const
                  ).map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setBulkScope(scope.id)}
                      className={cn(
                        'py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
                        bulkScope === scope.id
                          ? 'bg-deep-teal text-white border-deep-teal'
                          : 'bg-off-white/60 text-foreground border-border hover:border-deep-teal/40'
                      )}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single-Day Snapshot (when inspecting 1 day) */}
              {bulkScope === 'range' &&
                rangeStart === rangeEnd &&
                selectedDayInfo && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-off-white border border-border">
                      <span className="text-[11px] text-neutral-gray block">
                        Total
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {room.totalRoom}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-foreground text-white">
                      <span className="text-[11px] text-white/75 block">
                        Booked
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {selectedDayInfo.bookedRooms}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                      <span className="text-[11px] text-emerald-700 block">
                        Avail
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {selectedDayInfo.availableRooms}
                      </span>
                    </div>
                  </div>
                )}

              {/* Control 1: Maintenance Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-neutral-gray" />
                    Block for Maintenance
                  </label>
                  <span className="text-xs text-neutral-gray tabular-nums">
                    Max {maxUnavailable}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditUnavailableRooms((prev) => Math.max(0, prev - 1))
                    }
                    disabled={editUnavailableRooms <= 0}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-off-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={maxUnavailable}
                    value={editUnavailableRooms}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (isNaN(val)) setEditUnavailableRooms(0)
                      else
                        setEditUnavailableRooms(
                          Math.min(maxUnavailable, Math.max(0, val))
                        )
                    }}
                    className="flex-1 h-9 rounded-lg border border-border text-center text-sm font-bold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditUnavailableRooms((prev) =>
                        Math.min(maxUnavailable, prev + 1)
                      )
                    }
                    disabled={editUnavailableRooms >= maxUnavailable}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-off-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {selectedDayInfo &&
                  selectedDayInfo.bookedRooms > 0 &&
                  activeDateSet.size === 1 && (
                    <p className="text-xs text-amber-700 flex items-center gap-1">
                      <Lock className="w-3 h-3 shrink-0" />
                      {selectedDayInfo.bookedRooms} booked room(s) protected.
                    </p>
                  )}
              </div>

              {/* Control 2: Price Offset */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-neutral-gray" />
                    Price Adjustment (THB)
                  </label>
                  <span className="text-xs text-neutral-gray tabular-nums">
                    Base ฿{room.basePrice.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PRICE_PRESETS.map((preset) => {
                    const isSelectedPreset = editPriceAdjustment === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditPriceAdjustment(preset)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums border transition-colors cursor-pointer',
                          isSelectedPreset
                            ? 'bg-deep-teal text-white border-deep-teal'
                            : 'bg-off-white text-foreground border-border hover:border-deep-teal/40'
                        )}
                      >
                        {preset === 0
                          ? '฿0 (Base)'
                          : preset > 0
                          ? `+฿${preset}`
                          : `-฿${Math.abs(preset)}`}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-neutral-gray">Custom:</span>
                  <input
                    type="number"
                    value={editPriceAdjustment}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setEditPriceAdjustment(isNaN(val) ? 0 : val)
                    }}
                    className="flex-1 h-9 rounded-lg border border-border px-3 text-sm font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal"
                  />
                </div>

                <div className="p-3 rounded-xl bg-off-white border border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-gray">
                    Effective Nightly Price
                  </span>
                  <span className="text-sm font-bold text-deep-teal tabular-nums">
                    ฿{Math.max(1, room.basePrice + editPriceAdjustment).toLocaleString()}
                  </span>
                </div>

                {room.basePrice + editPriceAdjustment <= 0 && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Effective price must be greater than ฿0.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleApplyChanges}
                  className="flex-1 bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold rounded-xl h-10"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Apply ({activeDateSet.size} {activeDateSet.size === 1 ? 'day' : 'days'})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRevertSelection}
                  className="text-xs text-neutral-gray rounded-xl h-10"
                  title="Revert staged changes for selection"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-gray">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">Select a date or range</p>
              <p className="text-xs mt-1">
                Click any date or switch to Fri–Sat / Full Month to stage bulk updates.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="px-5 py-3.5 bg-white border-t border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 tabular-nums">
              <strong>{pendingCount}</strong> day(s) have unsaved edits
            </span>
          ) : (
            <div className="flex items-center gap-2 text-neutral-gray text-xs sm:text-sm">
              <Check className="w-4 h-4 text-positive-green shrink-0" />
              <span>Calendar is up to date</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardAll}
              disabled={saving}
              className="text-xs text-neutral-gray hover:text-red-600 rounded-xl"
            >
              Discard
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={pendingCount === 0 || saving}
            className="bg-accent-orange hover:bg-accent-orange/90 text-white text-xs sm:text-sm font-semibold px-5 rounded-xl disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Calendar'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
