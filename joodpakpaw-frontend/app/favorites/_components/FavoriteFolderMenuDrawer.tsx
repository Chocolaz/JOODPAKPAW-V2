'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteFavoriteFolder, renameFavoriteFolder } from '@/lib/api'
import { FavoriteFolderDetail } from '@/types/favorite'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { Edit, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'

export type FolderMenuView = 'options' | 'confirmDelete' | 'renameFolder'

interface FavoriteFolderMenuDrawerProps {
  folder: FavoriteFolderDetail
  isOpen: boolean
  initialView?: FolderMenuView
  onOpenChange: (isOpen: boolean) => void
  onFolderDeleted: () => void
  onFolderRenamed: (newName: string) => void
}

function FolderMenuBody({
  folder,
  view,
  onViewChange,
  onClose,
  onFolderDeleted,
  onFolderRenamed,
}: {
  folder: FavoriteFolderDetail
  view: FolderMenuView
  onViewChange: (v: FolderMenuView) => void
  onClose: () => void
  onFolderDeleted: () => void
  onFolderRenamed: (newName: string) => void
}) {
  const [newFolderName, setNewFolderName] = useState(folder.name)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDeleteFolder = async () => {
    setIsSubmitting(true)
    try {
      await deleteFavoriteFolder(folder.id.toString())
      toast.success(`Wishlist "${folder.name}" has been removed.`)
      onFolderDeleted()
    } catch {
      toast.error('Failed to delete wishlist. Please try again.')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRenameFolder = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed || trimmed === folder.name) return

    setIsSubmitting(true)
    try {
      await renameFavoriteFolder(folder.id.toString(), trimmed)
      toast.success('Wishlist renamed!')
      onFolderRenamed(trimmed)
      onClose()
    } catch {
      toast.error('Failed to rename wishlist. Please try again.')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (view === 'confirmDelete') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground/85 leading-relaxed">
          The wishlist &ldquo;{folder.name}&rdquo; and its saved stays list
          will be removed from your Wishlists.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDeleteFolder}
            disabled={isSubmitting}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            {isSubmitting ? 'Removing...' : 'Delete wishlist'}
          </Button>
        </div>
      </div>
    )
  }

  if (view === 'renameFolder') {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Input
            value={newFolderName}
            onChange={(e) => {
              if (e.target.value.length <= 20) {
                setNewFolderName(e.target.value)
              }
            }}
            placeholder="Wishlist name"
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim() && !isSubmitting) {
                handleRenameFolder()
              }
            }}
          />
          <p className="text-right text-xs text-neutral-gray tabular-nums">
            {newFolderName.length} / 20
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl cursor-pointer"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRenameFolder}
            className="rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white px-5 cursor-pointer"
            disabled={
              isSubmitting ||
              newFolderName.trim().length === 0 ||
              newFolderName.trim() === folder.name
            }
          >
            {isSubmitting ? 'Saving...' : 'Save name'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      <button
        type="button"
        className="w-full flex items-center justify-between py-3.5 px-1 hover:bg-off-white/60 transition-colors cursor-pointer text-left"
        onClick={() => onViewChange('renameFolder')}
      >
        <div className="flex items-center text-sm font-medium text-foreground">
          <Edit className="mr-2.5 h-4 w-4 text-deep-teal" />
          Rename wishlist
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-gray" />
      </button>
      <button
        type="button"
        className="w-full flex items-center justify-between py-3.5 px-1 hover:bg-red-50/60 transition-colors cursor-pointer text-left"
        onClick={() => onViewChange('confirmDelete')}
      >
        <div className="flex items-center text-sm font-medium text-red-600">
          <Trash2 className="mr-2.5 h-4 w-4" />
          Delete wishlist
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-gray" />
      </button>
    </div>
  )
}

export function FavoriteFolderMenuDrawer({
  folder,
  isOpen,
  initialView = 'options',
  onOpenChange,
  onFolderDeleted,
  onFolderRenamed,
}: FavoriteFolderMenuDrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [activeView, setActiveView] = useState<FolderMenuView>(initialView)

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (open) {
      setActiveView(initialView)
    }
  }

  const title =
    (isDesktop ? initialView : activeView) === 'confirmDelete'
      ? 'Delete wishlist?'
      : (isDesktop ? initialView : activeView) === 'renameFolder'
        ? 'Rename wishlist'
        : 'Wishlist options'

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-deep-teal">{title}</DialogTitle>
          </DialogHeader>
          {isOpen && (
            <FolderMenuBody
              key={`${folder.id}-${initialView}-desktop`}
              folder={folder}
              view={activeView}
              onViewChange={setActiveView}
              onClose={() => onOpenChange(false)}
              onFolderDeleted={onFolderDeleted}
              onFolderRenamed={onFolderRenamed}
            />
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="flex flex-row items-center gap-2">
            {activeView !== 'options' && (
              <button
                type="button"
                aria-label="Back to options"
                onClick={() => setActiveView('options')}
                className="w-8 h-8 rounded-full hover:bg-off-white flex items-center justify-center text-foreground cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <DrawerTitle className="text-deep-teal">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            {isOpen && (
              <FolderMenuBody
                key={`${folder.id}-${initialView}-mobile`}
                folder={folder}
                view={activeView}
                onViewChange={setActiveView}
                onClose={() => onOpenChange(false)}
                onFolderDeleted={onFolderDeleted}
                onFolderRenamed={onFolderRenamed}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
