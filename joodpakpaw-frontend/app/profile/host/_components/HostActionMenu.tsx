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
      setView('menu')
    }
  }

  const handleSuccess = () => {
    onDataChange?.()
    setIsOpen(false)
    setView('menu')
  }

  if (!property) {
    return null
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label="Property actions"
          className="w-11 h-11 inline-flex items-center justify-center bg-white border border-border rounded-full shadow-sm hover:bg-off-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5 text-deep-teal" />
        </button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button
                type="button"
                onClick={() => setView('menu')}
                className="p-2 rounded-full hover:bg-off-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 text-neutral-gray" />
              </button>
            )}
            <DrawerTitle className="grow text-start text-deep-teal">
              {view === 'menu'
                ? 'Manage Property'
                : view === 'edit'
                ? 'Edit Property'
                : 'Manage Rooms'}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        {view === 'menu' && (
          <div className="px-4 pb-6">
            <div className="flex flex-col space-y-2">
              <button
                type="button"
                onClick={() => setView('edit')}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-off-white transition-colors text-left cursor-pointer"
              >
                <Pencil className="w-5 h-5 text-deep-teal" />
                <span className="text-sm font-medium text-foreground">
                  Edit Property
                </span>
              </button>
              <button
                type="button"
                onClick={() => setView('rooms')}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-off-white transition-colors text-left cursor-pointer"
              >
                <BedDouble className="w-5 h-5 text-deep-teal" />
                <span className="text-sm font-medium text-foreground">
                  Manage Rooms &amp; Calendar
                </span>
              </button>
              {onDeleteClick && (
                <DrawerClose asChild>
                  <button
                    type="button"
                    onClick={onDeleteClick}
                    className="flex items-center gap-3 p-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      Delete Property
                    </span>
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
