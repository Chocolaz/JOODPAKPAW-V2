'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft } from 'lucide-react'
import { getRoomCategories } from '@/lib/api'
import { RoomCategories } from '@/types'
import { RoomCategoryCard } from '@/app/_components/RoomCategoryCard'
import { AddRoomCategoryForm } from './AddRoomCategoryForm'
import { RoomCalendarDrawer } from './RoomCalendarDrawer'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

interface ManageRoomsProps {
  propertyId: number
}

export function ManageRooms({ propertyId }: ManageRoomsProps) {
  const [rooms, setRooms] = useState<RoomCategories[]>([])
  const [loading, setLoading] = useState(Boolean(propertyId))
  const [error, setError] = useState<string | null>(
    propertyId ? null : 'Property ID not found.'
  )
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false)
  const [calendarRoom, setCalendarRoom] = useState<RoomCategories | null>(null)

  const reloadRooms = useCallback(async () => {
    if (!propertyId) return
    try {
      const res = await getRoomCategories(propertyId)
      setRooms(res.roomCategories)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch room categories.'
      )
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    let cancelled = false
    if (!propertyId) return
    getRoomCategories(propertyId)
      .then((res) => {
        if (!cancelled) {
          setRooms(res.roomCategories)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch room categories.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  const handleAddSuccess = () => {
    void reloadRooms()
    setIsAddDrawerOpen(false)
  }

  const handleDeleteSuccess = (deletedCategoryId: number) => {
    setRooms((prevRooms) =>
      prevRooms.filter((room) => room.id !== deletedCategoryId)
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-6 space-y-3 max-w-[500px] mx-auto w-full">
        <div className="h-20 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
        <div className="h-24 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-600 text-sm text-center p-4">{error}</div>
  }

  return (
    <Drawer open={isAddDrawerOpen} onOpenChange={setIsAddDrawerOpen}>
      <div className="flex justify-center w-full">
        <div className="px-6 pb-8 max-h-[60vh] overflow-y-auto modern-scrollbar space-y-4 text-left w-full max-w-[500px]">
          <DrawerTrigger asChild>
            <button
              type="button"
              className="w-full px-5 py-6 border-2 border-dashed border-positive-green rounded-2xl cursor-pointer hover:bg-off-white transition-colors"
            >
              <div className="font-semibold text-deep-teal text-base flex items-center justify-between w-full">
                <span>Add New Room Category</span>
                <Plus className="h-5 w-5 text-positive-green" />
              </div>
            </button>
          </DrawerTrigger>

          {rooms.length > 0 &&
            rooms.map((room) => (
              <RoomCategoryCard
                key={room.id}
                category={room}
                propertyId={propertyId}
                onDeleteSuccess={handleDeleteSuccess}
                showDeleteButton={true}
                isOnlyRoom={rooms.length === 1}
                onManageCalendar={(r) => setCalendarRoom(r)}
              />
            ))}
        </div>
      </div>

      <RoomCalendarDrawer
        propertyId={propertyId}
        room={calendarRoom}
        isOpen={!!calendarRoom}
        onOpenChange={(open) => !open && setCalendarRoom(null)}
        onSuccess={reloadRooms}
      />

      <DrawerContent>
        <DrawerHeader className="relative">
          <DrawerTitle className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddDrawerOpen(false)}
              className="p-1 rounded-full hover:bg-off-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-gray" />
            </button>
            <span>Add Room Category</span>
          </DrawerTitle>
        </DrawerHeader>

        <AddRoomCategoryForm
          propertyId={propertyId}
          onAddSuccess={handleAddSuccess}
        />
      </DrawerContent>
    </Drawer>
  )
}
