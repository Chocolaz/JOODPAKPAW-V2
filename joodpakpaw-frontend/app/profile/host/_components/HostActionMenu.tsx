'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Menu, Pencil, Trash2, ChevronLeft, BedDouble } from 'lucide-react'
import { Property } from '@/types'
import { EditPropertyForm } from './EditPropertyForm'
import { ManageRooms } from './ManageRooms'

interface HostActionMenuProps {
  property?: Property
  onDeleteClick?: () => void
  onDataChange?: () => void
}

export function HostActionMenu({
  property,
  onDeleteClick,
  onDataChange,
}: HostActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'edit' | 'rooms'>('menu')

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      if (view === 'edit' || view === 'rooms') {
        onDataChange?.()
      }
      setView('menu') // Reset view when drawer closes
    }
  }

  const handleSuccess = () => {
    onDataChange?.()
    setIsOpen(false) // Close drawer on success
    setView('menu')
  }

  if (!property) {
    return null
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-gray-100 transition">
          <Menu className="w-5 h-5 text-gray-800" />
        </button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <div className="flex items-center">
            {view !== 'menu' && (
              <button
                onClick={() => setView('menu')}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 ease-in-out"
              >
                <ChevronLeft className="w-6 h-6 text-neutral-gray" />
              </button>
            )}
            <DrawerTitle className="grow text-start">
              {view === 'menu'
                ? 'Menu'
                : view === 'edit'
                  ? 'Edit Property'
                  : 'Manage Rooms'}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        {view === 'menu' && (
          <div className="px-4">
            <div className="flex flex-col space-y-2 mb-4">
              <button
                onClick={() => setView('edit')}
                className="flex items-center gap-3 p-2 rounded-lg border-b hover:bg-gray-100 transition text-left"
              >
                <Pencil className="w-5 h-5 text-gray-700" />
                <span>Edit Property</span>
              </button>
              <button
                onClick={() => setView('rooms')}
                className="flex items-center gap-3 p-2 rounded-lg border-b hover:bg-gray-100 transition text-left"
              >
                <BedDouble className="w-5 h-5 text-gray-700" />
                <span>Add Room</span>
              </button>
              {onDeleteClick && (
                <DrawerClose asChild>
                  <button
                    onClick={onDeleteClick}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-100/50 transition text-left"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <span className="text-red-500">Delete</span>
                  </button>
                </DrawerClose>
              )}
            </div>
          </div>
        )}

        {view === 'edit' && (
          <EditPropertyForm property={property} onSuccess={handleSuccess} />
        )}

        {view === 'rooms' && <ManageRooms propertyId={property.id} />}
      </DrawerContent>
    </Drawer>
  )
}
