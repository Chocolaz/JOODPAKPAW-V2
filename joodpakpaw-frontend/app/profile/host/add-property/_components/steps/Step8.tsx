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
  const { formData, setHighestStepReached, clearAddPropertySession } =
    useAddProperty()
  const propertyId = formData.propertyId

  const [rooms, setRooms] = useState<RoomCategories[]>([])
  const [loading, setLoading] = useState(Boolean(propertyId))
  const [error, setError] = useState<string | null>(
    propertyId ? null : 'Property ID not found.'
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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

  const handleNext = () => {
    setHighestStepReached(8)
    router.push('/profile/host/add-property/9')
  }

  if (loading) {
    return (
      <>
        <div className="w-full text-center mt-6 pb-24 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-48 bg-gray-200 rounded-lg mx-auto mb-3" />
          <div className="h-4 w-72 bg-gray-100 rounded mx-auto mb-8" />
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
          </div>
        </div>
        <StepNavigation backText="Later" nextText="Continue" isNextDisabled />
      </>
    )
  }

  return (
    <div className="w-full text-center mt-6 pb-28">
      <h3 className="mb-1 text-deep-teal">Set up your rooms</h3>
      <p className="text-neutral-gray text-sm mb-8">
        Add at least one room type so pet owners can book stays.
      </p>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className="space-y-3 text-left max-w-2xl mx-auto">
          {error && <p className="text-red-600 text-center text-sm">{error}</p>}

          <DialogTrigger asChild>
            <button
              type="button"
              className="w-full px-5 py-6 border-2 border-dashed border-positive-green rounded-2xl cursor-pointer hover:bg-off-white transition-colors flex items-center justify-between"
            >
              <span className="font-semibold text-deep-teal">Add Room Type</span>
              <Plus className="h-5 w-5 text-positive-green" />
            </button>
          </DialogTrigger>

          {rooms.map((room) => (
            <RoomCategoryCard
              key={room.id}
              category={room}
              propertyId={propertyId!}
              showDeleteButton
              onDeleteSuccess={reloadRooms}
              isOnlyRoom={rooms.length === 1}
            />
          ))}
        </div>

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-deep-teal">
              Add Room Category
            </DialogTitle>
          </DialogHeader>
          {propertyId && (
            <AddRoomCategoryForm
              propertyId={propertyId}
              onAddSuccess={() => {
                void reloadRooms()
                setIsDialogOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <StepNavigation
        onBack={() => {
          clearAddPropertySession()
          router.push('/profile/host?tab=properties')
        }}
        backText="Later"
        onNext={handleNext}
        nextText="Continue"
        isNextDisabled={rooms.length === 0}
      />
    </div>
  )
}
