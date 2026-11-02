'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteFavoriteFolder,
  renameFavoriteFolder,
} from '@/lib/api'
import { FavoriteFolderDetail } from '@/types/favorite'
import {
  Edit,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'

interface FavoriteFolderMenuDrawerProps {
  folder: FavoriteFolderDetail
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onFolderDeleted: () => void
  onFolderRenamed: (newName: string) => void
}

export function FavoriteFolderMenuDrawer({
  folder,
  isOpen,
  onOpenChange,
  onFolderDeleted,
  onFolderRenamed,
}: FavoriteFolderMenuDrawerProps) {
  const [drawerContent, setDrawerContent] = useState<
    'options' | 'confirmDelete' | 'renameFolder'
  >('options')
  const [newFolderName, setNewFolderName] = useState(folder.name)

  const handleDrawerOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      // Reset to default view when drawer is closed
      setTimeout(() => {
        setDrawerContent('options')
        setNewFolderName(folder.name)
      }, 300)
    }
  }

  const handleDeleteFolder = async () => {
    try {
      await deleteFavoriteFolder(folder.id.toString())
      toast.success(`The folder "${folder.name}" has been removed.`)
      onFolderDeleted()
    } catch (err) {
      toast.error('Failed to delete folder. Please try again later.')
      console.error('Failed to delete folder:', err)
      onOpenChange(false)
    }
  }

  const handleRenameFolder = async () => {
    if (!newFolderName || newFolderName === folder.name) return

    try {
      await renameFavoriteFolder(folder.id.toString(), newFolderName)
      toast.success('Folder renamed successfully!')
      onFolderRenamed(newFolderName)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to rename folder. Please try again later.')
      console.error('Failed to rename folder:', err)
      onOpenChange(false)
    }
  }

  const renderDrawerContent = () => {
    if (drawerContent === 'confirmDelete') {
      return (
        <>
          <DrawerHeader className="flex items-center">
            <button
              onClick={() => setDrawerContent('options')}
              className="rounded-full hover:bg-gray-100 mr-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <DrawerTitle>Remove Folder?</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 min-h-[130px]">
            <p>
              The folder “{folder.name}” and all its shared links will be
              removed from your Favorites.
            </p>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-none shadow-none"
              >
                No, keep it
              </Button>
              <Button
                variant="outline"
                className="border-red-500  text-red-500"
                onClick={handleDeleteFolder}
              >
                Yes, remove
              </Button>
            </div>
          </div>
        </>
      )
    }

    if (drawerContent === 'renameFolder') {
      return (
        <>
          <DrawerHeader className="flex items-center">
            <button
              onClick={() => {
                setNewFolderName(folder.name)
                setDrawerContent('options')
              }}
              className="rounded-full hover:bg-gray-100 mr-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <DrawerTitle>Rename Folder</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 min-h-[130px]">
            <div className="space-y-2">
              <Input
                value={newFolderName}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setNewFolderName(e.target.value)
                  }
                }}
                placeholder="New folder name"
                maxLength={20}
              />
              <p className="text-right text-sm text-gray-500">
                {newFolderName.length}/20
              </p>
            </div>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                className="border-none shadow-none"
                onClick={() => {
                  setNewFolderName(folder.name)
                  setDrawerContent('options')
                  onOpenChange(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameFolder}
                className="bg-deep-teal px-4"
                disabled={
                  newFolderName.length === 0 ||
                  newFolderName === folder.name
                }
              >
                Confirm
              </Button>
            </div>
          </div>
        </>
      )
    }

    // Default 'options' view
    return (
      <>
        <DrawerHeader>
          <DrawerTitle>Menu</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 min-h-[130px]">
          <div
            className="flex items-center justify-between py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200"
            onClick={() => setDrawerContent('renameFolder')}
          >
            <div className="flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
          <div
            className="flex items-center justify-between py-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => setDrawerContent('confirmDelete')}
          >
            <div className="flex items-center text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete folder
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleDrawerOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">{renderDrawerContent()}</div>
      </DrawerContent>
    </Drawer>
  )
}
