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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { getRoomCategoryCalendars, updateRoomCategoryCalendars } from '@/lib/api'
import type { RoomCategories, RoomCategoryCalendarItem } from '@/types'
import { cn } from '@/lib/utils'

interface RoomCalendarDrawerProps {
  propertyId: number | string
  room: RoomCategories | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface PendingDayUpdate {
  unavailableRooms: number
  priceAdjustment: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PRICE_PRESETS = [0, 50, 100, 200, 300, 500, -50, -100]

function CalendarContent({
  propertyId,
  room,
  onClose,
  onSuccess,
}: {
  propertyId: number | string
  room: RoomCategories
  onClose: () => void
  onSuccess?: () => void
}) {
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const todayStr = useMemo(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [today])

  // Current viewed month (first day of month)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [calendars, setCalendars] = useState<RoomCategoryCalendarItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Selected date for editing ('YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  // Pending updates map: dateStr -> { unavailableRooms, priceAdjustment }
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, PendingDayUpdate>>({})

  // Form states for the selected date
  const [editUnavailableRooms, setEditUnavailableRooms] = useState<number>(0)
  const [editPriceAdjustment, setEditPriceAdjustment] = useState<number>(0)
  const [applyToAllMonth, setApplyToAllMonth] = useState(false)

  const monthYearLabel = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }, [currentMonth])

  const canGoPrevMonth = useMemo(() => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const currentMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1)
    return prev >= currentMonthFirst
  }, [currentMonth, today])

  const { startDateStr, endDateStr, daysInMonth, firstDayOfWeek } = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()

    const sStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const eStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    return {
      startDateStr: sStr,
      endDateStr: eStr,
      daysInMonth: totalDays,
      firstDayOfWeek: firstDay.getDay(),
    }
  }, [currentMonth])

  // Fetch calendars when month or room changes
  const loadCalendars = useCallback(async () => {
    if (!room?.id || !propertyId) return
    setLoading(true)
    try {
      const res = await getRoomCategoryCalendars(
        propertyId,
        room.id,
        startDateStr,
        endDateStr
      )
      setCalendars(res.calendars || [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }, [propertyId, room?.id, startDateStr, endDateStr])

  useEffect(() => {
    loadCalendars()
  }, [loadCalendars])

  // Calendar item map for fast lookup
  const calendarMap = useMemo(() => {
    const map = new Map<string, RoomCategoryCalendarItem>()
    for (const item of calendars) {
      map.set(item.date, item)
    }
    return map
  }, [calendars])

  // Get effective values for any date
  const getDayValues = useCallback(
    (dateStr: string) => {
      const dbItem = calendarMap.get(dateStr)
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
      const availableRooms = Math.max(0, totalRooms - bookedRooms - unavailableRooms)

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

  // Sync editor fields when selected date changes
  useEffect(() => {
    if (!selectedDate) return
    const values = getDayValues(selectedDate)
    setEditUnavailableRooms(values.unavailableRooms)
    setEditPriceAdjustment(values.priceAdjustment)
    setApplyToAllMonth(false)
  }, [selectedDate, getDayValues])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    )
  }

  // Handle day click
  const handleDayClick = (dateStr: string) => {
    if (dateStr < todayStr) {
      toast.info('Past dates cannot be modified.')
      return
    }
    setSelectedDate(dateStr)
  }

  // Selected date details
  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null
    return getDayValues(selectedDate)
  }, [selectedDate, getDayValues])

  const maxUnavailable = useMemo(() => {
    if (!selectedDayInfo) return room.totalRoom
    return Math.max(0, room.totalRoom - selectedDayInfo.bookedRooms)
  }, [selectedDayInfo, room.totalRoom])

  // Apply changes to selected date (or all days in month)
  const handleApplyToDate = () => {
    if (!selectedDate) return

    if (room.basePrice + editPriceAdjustment <= 0) {
      toast.error('Effective price must be greater than ฿0')
      return
    }

    if (editUnavailableRooms < 0 || editUnavailableRooms > maxUnavailable) {
      toast.error(`Unavailable rooms must be between 0 and ${maxUnavailable}`)
      return
    }

    if (applyToAllMonth) {
      // Apply to all upcoming/valid dates in this month
      const newUpdates = { ...pendingUpdates }
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${currentMonth.getFullYear()}-${String(
          currentMonth.getMonth() + 1
        ).padStart(2, '0')}-${String(d).padStart(2, '0')}`

        if (dStr >= todayStr) {
          const item = calendarMap.get(dStr)
          const booked = item?.bookedRooms ?? 0
          const maxUnavailForDay = Math.max(0, room.totalRoom - booked)
          const boundedUnavail = Math.min(editUnavailableRooms, maxUnavailForDay)

          newUpdates[dStr] = {
            unavailableRooms: boundedUnavail,
            priceAdjustment: editPriceAdjustment,
          }
        }
      }
      setPendingUpdates(newUpdates)
      toast.success(`Applied settings to all upcoming days in ${monthYearLabel}`)
    } else {
      setPendingUpdates((prev) => ({
        ...prev,
        [selectedDate]: {
          unavailableRooms: editUnavailableRooms,
          priceAdjustment: editPriceAdjustment,
        },
      }))
      toast.success(`Updated settings for ${selectedDate}`)
    }
  }

  // Revert selected date to original API value
  const handleRevertSelected = () => {
    if (!selectedDate) return
    setPendingUpdates((prev) => {
      const copy = { ...prev }
      delete copy[selectedDate]
      return copy
    })
    toast.info(`Reverted changes for ${selectedDate}`)
  }

  // Discard all pending updates
  const handleDiscardAll = () => {
    setPendingUpdates({})
    toast.info('All unsaved changes discarded')
  }

  // Save all pending updates to backend API
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
        `Successfully saved availability & pricing for ${updatesPayload.length} day(s)`
      )
      setPendingUpdates({})
      await loadCalendars()
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

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8] text-neutral-900 select-none overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-neutral-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-warm-gold/15 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-warm-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-deep-teal truncate">
                {room.name}
              </h2>
              <Badge variant="outline" className="text-xs font-medium text-neutral-600 bg-neutral-50">
                {room.totalRoom} Total {room.totalRoom === 1 ? 'Room' : 'Rooms'}
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
              Base Price: <span className="font-semibold text-neutral-800">฿{room.basePrice.toLocaleString()}</span> / night
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body (Grid + Sidebar) */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[1fr_340px] divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
        {/* Left: Calendar Month View */}
        <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Month Navigation & Legend Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!canGoPrevMonth}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Legend */}
            <div className="flex items-center flex-wrap gap-2 text-[11px] text-neutral-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-positive-green" />
                Available
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
                Booked
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Blocked
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-warm-gold" />
                Custom Price
              </span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-3 sm:p-4 shadow-xs">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-semibold text-neutral-400">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            {loading ? (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 sm:h-24 w-full rounded-xl bg-neutral-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Leading blanks for month alignment */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-20 sm:h-24 rounded-xl bg-neutral-50/50 border border-transparent" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const dateStr = `${currentMonth.getFullYear()}-${String(
                    currentMonth.getMonth() + 1
                  ).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

                  const isPast = dateStr < todayStr
                  const isToday = dateStr === todayStr
                  const isSelected = selectedDate === dateStr
                  const dayVals = getDayValues(dateStr)

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDayClick(dateStr)}
                      disabled={isPast}
                      className={cn(
                        'relative flex flex-col justify-between p-1.5 sm:p-2 rounded-xl text-left border transition-colors h-20 sm:h-24 min-w-0',
                        isPast
                          ? 'bg-neutral-50/70 border-neutral-100 opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-deep-teal/5 border-deep-teal ring-2 ring-deep-teal/20 shadow-xs'
                          : dayVals.isModified
                          ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      )}
                    >
                      {/* Top row: day number + indicator */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={cn(
                            'text-xs sm:text-sm font-semibold tabular-nums leading-none',
                            isToday
                              ? 'w-5 h-5 rounded-full bg-deep-teal text-white flex items-center justify-center text-[11px]'
                              : isSelected
                              ? 'text-deep-teal'
                              : 'text-neutral-800'
                          )}
                        >
                          {dayNum}
                        </span>

                        {dayVals.isModified && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved edit" />
                        )}
                      </div>

                      {/* Middle: Effective Price */}
                      <div className="my-0.5 truncate">
                        <div className="text-[11px] sm:text-xs font-bold text-deep-teal tabular-nums leading-tight">
                          ฿{dayVals.effectivePrice.toLocaleString()}
                        </div>
                        {dayVals.priceAdjustment !== 0 && (
                          <span
                            className={cn(
                              'text-[9px] font-semibold tabular-nums leading-none',
                              dayVals.priceAdjustment > 0
                                ? 'text-positive-green'
                                : 'text-accent-orange'
                            )}
                          >
                            {dayVals.priceAdjustment > 0 ? `+฿${dayVals.priceAdjustment}` : `-฿${Math.abs(dayVals.priceAdjustment)}`}
                          </span>
                        )}
                      </div>

                      {/* Bottom status badges */}
                      <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {dayVals.bookedRooms > 0 ? (
                          <span className="text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-neutral-900 text-white font-medium flex items-center gap-0.5 truncate">
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                            {dayVals.bookedRooms} booked
                          </span>
                        ) : dayVals.unavailableRooms > 0 ? (
                          <span className="text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-medium flex items-center gap-0.5 truncate">
                            <Wrench className="w-2.5 h-2.5 shrink-0" />
                            {dayVals.unavailableRooms} blocked
                          </span>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] text-neutral-500 tabular-nums truncate">
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

        {/* Right: Day Editor Sidebar */}
        <div className="bg-white p-4 sm:p-6 flex flex-col justify-between overflow-y-auto">
          {selectedDate && selectedDayInfo ? (
            <div className="space-y-5">
              {/* Selected date header */}
              <div className="border-b border-neutral-100 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Day Settings
                  </span>
                  {selectedDayInfo.isModified && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200">
                      Modified
                    </Badge>
                  )}
                </div>
                <h3 className="text-base font-bold text-deep-teal mt-1">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              {/* Status summary cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-500 block">Total</span>
                  <span className="text-sm font-bold text-neutral-800 tabular-nums">
                    {room.totalRoom}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900 text-white border border-neutral-800">
                  <span className="text-[10px] text-neutral-300 block">Booked</span>
                  <span className="text-sm font-bold tabular-nums">
                    {selectedDayInfo.bookedRooms}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/60">
                  <span className="text-[10px] text-emerald-600 block">Available</span>
                  <span className="text-sm font-bold tabular-nums">
                    {selectedDayInfo.availableRooms}
                  </span>
                </div>
              </div>

              {/* Control 1: Block Rooms for Maintenance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                    Block for Maintenance
                  </label>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    Max: {maxUnavailable}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditUnavailableRooms((prev) => Math.max(0, prev - 1))}
                    disabled={editUnavailableRooms <= 0}
                    className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
                      else setEditUnavailableRooms(Math.min(maxUnavailable, Math.max(0, val)))
                    }}
                    className="flex-1 h-9 rounded-lg border border-neutral-200 text-center text-sm font-bold tabular-nums text-neutral-800 focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal"
                  />
                  <button
                    type="button"
                    onClick={() => setEditUnavailableRooms((prev) => Math.min(maxUnavailable, prev + 1))}
                    disabled={editUnavailableRooms >= maxUnavailable}
                    className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    +
                  </button>
                </div>

                {selectedDayInfo.bookedRooms > 0 && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 shrink-0" />
                    {selectedDayInfo.bookedRooms} booked room(s) cannot be blocked.
                  </p>
                )}
              </div>

              {/* Control 2: Daily Price Offset */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-neutral-500" />
                    Price Adjustment (THB)
                  </label>
                  <span className="text-xs text-neutral-400 tabular-nums">
                    Base: ฿{room.basePrice.toLocaleString()}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_PRESETS.map((preset) => {
                    const isSelectedPreset = editPriceAdjustment === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditPriceAdjustment(preset)}
                        className={cn(
                          'px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums border transition-colors',
                          isSelectedPreset
                            ? 'bg-deep-teal text-white border-deep-teal'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        )}
                      >
                        {preset === 0 ? '฿0 (Base)' : preset > 0 ? `+฿${preset}` : `-฿${Math.abs(preset)}`}
                      </button>
                    )
                  })}
                </div>

                {/* Custom price offset input */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-neutral-500">Custom Offset:</span>
                  <input
                    type="number"
                    value={editPriceAdjustment}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setEditPriceAdjustment(isNaN(val) ? 0 : val)
                    }}
                    className="flex-1 h-9 rounded-lg border border-neutral-200 px-3 text-sm font-semibold tabular-nums text-neutral-800 focus:outline-none focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal"
                  />
                </div>

                {/* Live Effective Price preview */}
                <div className="p-3 rounded-xl bg-warm-gold/10 border border-warm-gold/20 flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-neutral-600">Effective Nightly Price</span>
                  <span className="text-sm font-bold text-deep-teal tabular-nums">
                    ฿{Math.max(1, room.basePrice + editPriceAdjustment).toLocaleString()}
                  </span>
                </div>

                {room.basePrice + editPriceAdjustment <= 0 && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Effective price must be greater than ฿0.
                  </p>
                )}
              </div>

              {/* Bulk Month Apply Checkbox */}
              <label className="flex items-start gap-2 p-2.5 rounded-xl border border-neutral-200/70 hover:bg-neutral-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={applyToAllMonth}
                  onChange={(e) => setApplyToAllMonth(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-deep-teal focus:ring-deep-teal"
                />
                <div className="text-xs text-neutral-700">
                  <span className="font-semibold block">Apply to all upcoming days</span>
                  <span className="text-[11px] text-neutral-500">
                    Apply this maintenance and pricing to all upcoming days in {monthYearLabel}.
                  </span>
                </div>
              </label>

              {/* Action buttons for selected day */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleApplyToDate}
                  className="flex-1 bg-deep-teal hover:bg-deep-teal/90 text-white text-xs font-semibold py-2 rounded-xl"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {applyToAllMonth ? 'Apply to Month' : 'Apply to Day'}
                </Button>

                {selectedDayInfo.isModified && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRevertSelected}
                    className="text-xs text-neutral-600 py-2 rounded-xl"
                    title="Revert day changes"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">Select a date on the calendar</p>
              <p className="text-xs mt-1">Click any upcoming date to adjust availability and daily pricing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="px-6 py-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          {pendingCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-neutral-800">
                <strong className="text-deep-teal">{pendingCount}</strong> day(s) have unsaved changes
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-500 text-xs sm:text-sm">
              <Check className="w-4 h-4 text-positive-green shrink-0" />
              <span>Calendar is up to date</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscardAll}
              disabled={saving}
              className="text-xs sm:text-sm text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-xl"
            >
              Discard
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={pendingCount === 0 || saving}
            className="bg-deep-teal hover:bg-deep-teal/90 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl shadow-xs disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

export function RoomCalendarDrawer({
  propertyId,
  room,
  isOpen,
  onOpenChange,
  onSuccess,
}: RoomCalendarDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const handleClose = () => onOpenChange(false)

  if (!room) return null

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 overflow-hidden max-w-5xl w-full h-[90vh] flex flex-col gap-0 [&>button]:hidden rounded-2xl border-none shadow-2xl">
          <VisuallyHidden>
            <DialogTitle>Room Availability & Pricing Calendar</DialogTitle>
          </VisuallyHidden>
          <CalendarContent
            propertyId={propertyId}
            room={room}
            onClose={handleClose}
            onSuccess={onSuccess}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94dvh] flex flex-col outline-none rounded-t-2xl">
        <VisuallyHidden>
          <DrawerTitle>Room Availability & Pricing Calendar</DrawerTitle>
        </VisuallyHidden>
        <div className="flex-1 min-h-0 flex flex-col">
          <CalendarContent
            propertyId={propertyId}
            room={room}
            onClose={handleClose}
            onSuccess={onSuccess}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
