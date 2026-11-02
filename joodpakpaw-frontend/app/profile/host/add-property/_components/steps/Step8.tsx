'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { RoomCategoryCard } from '@/app/_components/RoomCategoryCard'
import { AddRoomCategoryForm } from '../../../_components/AddRoomCategoryForm'
import { useAddProperty } from '../../_context/AddPropertyContext'
import { getRoomCategories } from '@/lib/api'
import { RoomCategories } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { StepNavigation } from '../StepNavigation'

export function Step8() {
  const router = useRouter()
  const { formData, setHighestStepReached, clearAddPropertySession } = useAddProperty()
  const propertyId = formData.propertyId

  const [rooms, setRooms] = useState<RoomCategories[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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
      setError(err instanceof Error ? err.message : 'Failed to fetch room categories.')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleNext = () => {
    setHighestStepReached(8)
    router.push('/profile/host/add-property/9')
  }

  if (loading) {
    return (
      <>
        <div className="w-full text-center mt-6 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded-lg mx-auto mb-3" />
          <div className="h-4 w-72 bg-gray-100 rounded mx-auto mb-8" />
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="h-20 rounded-xl bg-gray-100" />
            <div className="h-20 rounded-xl bg-gray-100" />
          </div>
        </div>
        <StepNavigation backText="Later" nextText="Continue" isNextDisabled />
      </>
    )
  }

  return (
    <div className="w-full text-center mt-6 pb-24">
      <h3 className="mb-1 text-deep-teal">Set up your rooms</h3>
      <p className="text-neutral-gray text-sm mb-8">
        Add at least one room type for pets to stay in.
      </p>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className="space-y-3 text-left max-w-2xl mx-auto">
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}

          <DialogTrigger asChild>
            <button className="w-full px-5 py-6 border-2 border-dashed border-positive-green rounded-xl cursor-pointer hover:bg-green-50/50 transition-colors flex items-center justify-between">
              <span className="font-medium text-deep-teal">Add Room Type</span>
              <Plus className="h-5 w-5 text-positive-green" />
            </button>
          </DialogTrigger>

          {rooms.map((room) => (
            <RoomCategoryCard
              key={room.id}
              category={room}
              propertyId={propertyId!}
              showDeleteButton
              onDeleteSuccess={fetchRooms}
              isOnlyRoom={rooms.length === 1}
            />
          ))}
        </div>

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Room Category</DialogTitle>
          </DialogHeader>
          {propertyId && (
            <AddRoomCategoryForm
              propertyId={propertyId}
              onAddSuccess={() => {
                fetchRooms()
                setIsDialogOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <StepNavigation
        onBack={() => {
          clearAddPropertySession()
          router.push('/profile/host')
        }}
        backText="Later"
        onNext={handleNext}
        nextText="Continue"
        isNextDisabled={rooms.length === 0}
      />
    </div>
  )
}
