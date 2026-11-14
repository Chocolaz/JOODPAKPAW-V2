'use client'

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FavoriteFolderCard } from './FavoriteFolderCard'
import { Plus, Loader2, ChevronLeft } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { getFavoriteFolders, moveFavorite } from '@/lib/api'
import { FavoriteFolder } from '@/types/favorite'
import { toast } from 'sonner'

interface FavoriteDrawerProps {
  propertyId: number
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  currentFolderId?: number | null
  onSuccess?: (folderId?: number) => void
}

export function FavoriteDrawer({
  propertyId,
  isOpen,
  onOpenChange,
  currentFolderId,
  onSuccess,
}: FavoriteDrawerProps) {
  const [folders, setFolders] = useState<FavoriteFolder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset to default view when drawer opens
      setCurrentView('list')
      const fetchFolders = async () => {
        setIsLoading(true)
        setError(null)
        try {
          const response = await getFavoriteFolders()
          setFolders(response.favoriteFolders)
        } catch (_err) {
          setError('Failed to fetch folders.')
          toast.error('Failed to fetch folders.')
        } finally {
          setIsLoading(false)
        }
      }
      fetchFolders()
    }
  }, [isOpen])

  useEffect(() => {
    if (currentView === 'create' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentView])

  const handleSaveToFolder = async (folderId: number, folderName: string) => {
    if (currentFolderId != null && folderId === currentFolderId) {
      toast.info(`Already in ${folderName}`)
      onOpenChange(false)
      return
    }
    setIsPosting(true)
    try {
      await moveFavorite({ propertyId, folderId })
      toast.success(`Moved to ${folderName}`)
      onOpenChange(false)
      onSuccess?.(folderId)
    } catch (_err) {
      toast.error('Failed to move to folder.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleCreateAndSave = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name cannot be empty.')
      return
    }
    setIsPosting(true)
    try {
      await moveFavorite({ propertyId, folderName: newFolderName })
      toast.success(`Saved to ${newFolderName}!`)
      setNewFolderName('')
      onOpenChange(false)
      onSuccess?.()
    } catch (_err) {
      toast.error('Failed to create and save.')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl pb-6">
          {currentView === 'list' && (
            <div>
              <DrawerHeader className="px-5 pt-4 pb-2">
                <DrawerTitle className="text-lg font-semibold text-deep-teal">
                  Select wishlist
                </DrawerTitle>
              </DrawerHeader>
              <div>
                {isLoading ? (
                  <div className="flex justify-center items-center h-36 px-5">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center px-5 py-6">{error}</div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[55vh] overflow-y-auto px-5 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {folders.map((folder) => (
                          <FavoriteFolderCard
                            key={folder.id}
                            folder={folder}
                            onClick={handleSaveToFolder}
                            disabled={isPosting}
                            isCurrent={currentFolderId === folder.id}
                            widthClass="w-full"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="px-5 pt-1 flex justify-center">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto sm:min-w-[220px] h-11 px-6 bg-deep-teal hover:bg-deep-teal/90 text-white hover:text-white border-deep-teal rounded-xl cursor-pointer"
                        onClick={() => setCurrentView('create')}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create new wishlist
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'create' && (
            <div className="mx-auto w-full max-w-md">
              <DrawerHeader className="flex items-center justify-start gap-2 px-5 pt-4 pb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-none"
                  onClick={() => setCurrentView('list')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <DrawerTitle className="text-start text-lg font-semibold text-deep-teal">
                  Create your wishlist
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-5 pt-2 space-y-3">
                <Input
                  ref={inputRef}
                  placeholder="Wishlist name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  maxLength={20}
                />
                <div className="text-xs text-neutral-gray text-right tabular-nums">
                  {newFolderName.length}/20
                </div>
                <Button
                  onClick={handleCreateAndSave}
                  disabled={isPosting}
                  className="h-11 w-full bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl cursor-pointer"
                >
                  Create &amp; Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
