'use client'

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
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteFolderCard } from './FavoriteFolderCard'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { Plus, ChevronLeft } from 'lucide-react'
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
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [folders, setFolders] = useState<FavoriteFolder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    Promise.resolve().then(() => {
      if (active) {
        setIsLoading(true)
        setError(null)
      }
    })
    getFavoriteFolders()
      .then((response) => {
        if (active) setFolders(response.favoriteFolders)
      })
      .catch(() => {
        if (active) {
          setError('Failed to load wishlists.')
          toast.error('Failed to load wishlists.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && currentView === 'create' && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(timer)
    }
  }, [isOpen, currentView])

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setTimeout(() => {
        setCurrentView('list')
        setNewFolderName('')
      }, 200)
    }
  }

  const handleSaveToFolder = async (folderId: number, folderName: string) => {
    if (currentFolderId != null && folderId === currentFolderId) {
      toast.info(`Already in ${folderName}`)
      handleOpenChange(false)
      return
    }
    setIsPosting(true)
    try {
      await moveFavorite({ propertyId, folderId })
      toast.success(`Saved to ${folderName}`)
      handleOpenChange(false)
      onSuccess?.(folderId)
    } catch {
      toast.error('Failed to save to wishlist.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleCreateAndSave = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) {
      toast.error('Wishlist name cannot be empty.')
      return
    }
    setIsPosting(true)
    try {
      await moveFavorite({ propertyId, folderName: trimmed })
      toast.success(`Saved to ${trimmed}`)
      setNewFolderName('')
      handleOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error('Failed to create and save wishlist.')
    } finally {
      setIsPosting(false)
    }
  }

  const bodyContent =
    currentView === 'list' ? (
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-3/4 bg-neutral-200 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm text-center py-8">{error}</div>
        ) : folders.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <p className="text-sm font-medium text-foreground">
              No wishlists yet
            </p>
            <p className="text-xs text-neutral-gray">
              Create your first wishlist to save this stay.
            </p>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto overscroll-contain modern-scrollbar pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-1">
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
        )}

        <div className="pt-2 border-t border-border">
          <Button
            type="button"
            className="w-full h-11 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl cursor-pointer font-semibold"
            onClick={() => setCurrentView('create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create new wishlist
          </Button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Input
            ref={inputRef}
            placeholder="e.g. Weekend Beach Stays"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim() && !isPosting) {
                handleCreateAndSave()
              }
            }}
          />
          <div className="text-xs text-neutral-gray text-right tabular-nums">
            {newFolderName.length} / 20
          </div>
        </div>
        <Button
          type="button"
          onClick={handleCreateAndSave}
          disabled={isPosting || !newFolderName.trim()}
          className="h-11 w-full bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl cursor-pointer font-semibold"
        >
          {isPosting ? 'Saving...' : 'Create & save'}
        </Button>
      </div>
    )

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {currentView === 'create' && (
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  aria-label="Back to wishlists"
                  className="w-8 h-8 rounded-full hover:bg-off-white flex items-center justify-center text-foreground transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <DialogTitle className="text-deep-teal">
                {currentView === 'list'
                  ? 'Save to wishlist'
                  : 'Create new wishlist'}
              </DialogTitle>
            </div>
          </DialogHeader>
          {bodyContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md sm:max-w-lg pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-5 pt-4 pb-3 flex flex-row items-center gap-2">
            {currentView === 'create' && (
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                aria-label="Back to wishlists"
                className="w-8 h-8 rounded-full hover:bg-off-white flex items-center justify-center text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <DrawerTitle className="text-deep-teal text-left">
              {currentView === 'list'
                ? 'Save to wishlist'
                : 'Create new wishlist'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-5">{bodyContent}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
