'use client'

import React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import type { RoomCategories } from '@/types'
import { RoomCalendarEditor } from './RoomCalendarEditor'

interface RoomCalendarDrawerProps {
  propertyId: number | string
  room: RoomCategories | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
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
        <DialogContent className="p-0 overflow-hidden max-w-5xl w-full h-[88vh] flex flex-col gap-0 [&>button]:hidden rounded-2xl border border-border shadow-xl">
          <VisuallyHidden>
            <DialogTitle>Room Availability &amp; Pricing Calendar</DialogTitle>
          </VisuallyHidden>
          <RoomCalendarEditor
            key={`${propertyId}-${room.id}`}
            propertyId={propertyId}
            room={room}
            mode="modal"
            onClose={handleClose}
            onSuccess={onSuccess}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] flex flex-col outline-none rounded-t-2xl">
        <VisuallyHidden>
          <DrawerTitle>Room Availability &amp; Pricing Calendar</DrawerTitle>
        </VisuallyHidden>
        <div className="flex-1 min-h-0 flex flex-col">
          <RoomCalendarEditor
            key={`${propertyId}-${room.id}`}
            propertyId={propertyId}
            room={room}
            mode="modal"
            onClose={handleClose}
            onSuccess={onSuccess}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
