'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft } from 'lucide-react'
import { getRoomCategories } from '@/lib/api'
import { RoomCategories } from '@/types'
import { RoomCategoryCard } from '@/app/_components/RoomCategoryCard'
import { AddRoomCategoryForm } from './AddRoomCategoryForm'
import { Spinner } from '@/components/ui/spinner'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false)

  const fetchRooms = useCallback(async () => {
    if (!propertyId) {
      setLoading(false)
      setError('Property ID not found.')
      return
    }
    try {
      setLoading(true)
      const res = await getRoomCategories(propertyId)
      setRooms(res.roomCategories)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch room categories.'
      )
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleAddSuccess = () => {
    fetchRooms()
    // onRoomsUpdate?.()
    setIsAddDrawerOpen(false) // Removed this line
  }

  const handleDeleteSuccess = (deletedCategoryId: number) => {
    setRooms((prevRooms) =>
      prevRooms.filter((room) => room.id !== deletedCategoryId)
    )
    // onRoomsUpdate?.()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>
  }

  return (
    <Drawer open={isAddDrawerOpen} onOpenChange={setIsAddDrawerOpen}>
      <div className="flex justify-center w-full">
        <div className="px-8 h-[60vh] space-y-4 text-left w-full max-w-[500px]">
          <DrawerTrigger asChild>
            <div className="px-6 py-8 border-2 border-dashed border-positive-green rounded-xl cursor-pointer hover:bg-green-50/50 transition-colors">
              <div className="font-medium text-deep-teal text-lg flex items-center justify-between w-full">
                <span>Add New Room</span>
                <Plus className="h-6 w-6 text-positive-green" />
              </div>
            </div>
          </DrawerTrigger>

          {rooms.length > 0 &&
            rooms.map((room) => (
              <RoomCategoryCard
                key={room.id}
                category={room}
                propertyId={propertyId}
                onDeleteSuccess={handleDeleteSuccess}
                showDeleteButton={true}
                isOnlyRoom={rooms.length === 1} // Added this line
              />
            ))}
        </div>
      </div>

      <DrawerContent>
        <DrawerHeader className="relative">
          <DrawerTitle className="flex items-center gap-2">
            <ChevronLeft
              className="w-6 h-6 text-neutral-gray"
              onClick={() => setIsAddDrawerOpen(false)}
            />
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
