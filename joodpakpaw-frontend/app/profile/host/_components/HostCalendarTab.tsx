'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble, Building2, CalendarDays, Plus } from 'lucide-react'
import { getRoomCategories } from '@/lib/api'
import { Property, RoomCategories } from '@/types'
import { cn } from '@/lib/utils'
import { RoomCalendarEditor } from './RoomCalendarEditor'

interface HostCalendarTabProps {
  properties: Property[]
  initialPropertyId?: number | null
}

export function HostCalendarTab({
  properties,
  initialPropertyId,
}: HostCalendarTabProps) {
  const router = useRouter()

  const defaultPropertyId = useMemo(() => {
    if (
      initialPropertyId &&
      properties.some((p) => p.id === initialPropertyId)
    ) {
      return initialPropertyId
    }
    return properties[0]?.id ?? null
  }, [initialPropertyId, properties])

  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
    defaultPropertyId
  )
  const [rooms, setRooms] = useState<RoomCategories[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [loadingRooms, setLoadingRooms] = useState(
    defaultPropertyId !== null
  )

  const activePropertyId = useMemo(() => {
    if (
      selectedPropertyId &&
      properties.some((p) => p.id === selectedPropertyId)
    ) {
      return selectedPropertyId
    }
    return defaultPropertyId
  }, [selectedPropertyId, properties, defaultPropertyId])

  const fetchRoomsForProperty = useCallback(async (propId: number) => {
    try {
      const res = await getRoomCategories(propId)
      const list = res.roomCategories || []
      setRooms(list)
      setSelectedRoomId((prev) =>
        prev && list.some((r) => r.id === prev) ? prev : list[0]?.id ?? null
      )
    } catch {
      setRooms([])
      setSelectedRoomId(null)
    } finally {
      setLoadingRooms(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!activePropertyId) return
    getRoomCategories(activePropertyId)
      .then((res) => {
        if (cancelled) return
        const list = res.roomCategories || []
        setRooms(list)
        setSelectedRoomId((prev) =>
          prev && list.some((r) => r.id === prev) ? prev : list[0]?.id ?? null
        )
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([])
          setSelectedRoomId(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRooms(false)
      })
    return () => {
      cancelled = true
    }
  }, [activePropertyId])

  const handlePropertyChange = (newId: number) => {
    setSelectedPropertyId(newId)
    setLoadingRooms(true)
    void fetchRoomsForProperty(newId)
  }

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null,
    [rooms, selectedRoomId]
  )

  if (properties.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-off-white/40 p-10 text-center space-y-3">
        <CalendarDays className="w-10 h-10 text-neutral-gray/50 mx-auto" />
        <h3 className="text-deep-teal">No properties for calendar management</h3>
        <p className="text-xs text-neutral-gray max-w-sm mx-auto">
          Create your first property listing and room categories to control nightly pricing and maintenance blocks.
        </p>
        <button
          type="button"
          onClick={() => router.push('/profile/host/add-property')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-orange text-white text-xs font-semibold hover:bg-accent-orange/90 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header & Property Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-deep-teal">Smart Availability &amp; Pricing</h1>
          <p className="text-xs text-neutral-gray mt-0.5">
            Select a property and room category, then click start &amp; end dates or target Fri–Sat weekends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-deep-teal shrink-0" />
          <select
            value={activePropertyId ?? ''}
            onChange={(e) => handlePropertyChange(Number(e.target.value))}
            aria-label="Select property"
            className="px-3.5 py-2 rounded-xl border border-border bg-white text-xs sm:text-sm font-semibold text-deep-teal focus:outline-none focus:ring-2 focus:ring-deep-teal/20"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Room Category Switcher */}
      {loadingRooms ? (
        <div className="h-96 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none border border-border" />
      ) : rooms.length === 0 || !activeRoom || !activePropertyId ? (
        <div className="rounded-2xl border border-border bg-off-white/40 p-10 text-center space-y-3">
          <BedDouble className="w-10 h-10 text-neutral-gray/50 mx-auto" />
          <h3 className="text-foreground">No room categories yet</h3>
          <p className="text-xs text-neutral-gray max-w-sm mx-auto">
            Add a room category inside this property before setting seasonal rates or maintenance blocks.
          </p>
          {activePropertyId && (
            <button
              type="button"
              onClick={() => router.push(`/profile/host/${activePropertyId}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-deep-teal text-white text-xs font-semibold hover:bg-deep-teal/90 transition-colors cursor-pointer"
            >
              Manage Property Rooms
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {rooms.map((rm) => {
              const isSelected = rm.id === activeRoom.id
              return (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => setSelectedRoomId(rm.id)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer tabular-nums',
                    isSelected
                      ? 'bg-deep-teal text-white border-deep-teal'
                      : 'bg-white text-foreground border-border hover:border-deep-teal/40'
                  )}
                >
                  <BedDouble className="w-3.5 h-3.5 shrink-0" />
                  <span>{rm.name}</span>
                  <span
                    className={cn(
                      'text-[11px]',
                      isSelected ? 'text-white/80' : 'text-neutral-gray'
                    )}
                  >
                    ฿{rm.basePrice.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          <RoomCalendarEditor
            key={`${activePropertyId}-${activeRoom.id}`}
            propertyId={activePropertyId}
            room={activeRoom}
            mode="embedded"
            onSuccess={() => fetchRoomsForProperty(activePropertyId)}
          />
        </>
      )}
    </div>
  )
}
