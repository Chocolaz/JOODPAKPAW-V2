'use client'

import { AppHeader } from '@/app/_components/AppHeader'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getFavoriteFolders, createFavoriteFolder } from '@/lib/api'
import { FavoriteFolder } from '@/types/favorite'
import { FavoriteFolderCard } from '@/app/_components/FavoriteFolderCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, FolderPlus, Loader2, Search, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/_components/AuthContext'
import { useAuthModal } from '@/app/_context/AuthModalContext'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import Image from 'next/image'
import { assetPath } from '@/lib/utils'

function WishlistSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="space-y-2.5">
          <Skeleton className="aspect-square w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-3/4 bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-1/2 bg-neutral-200 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}

export default function FavoritesPage() {
  const [folders, setFolders] = useState<FavoriteFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { openAuthModal } = useAuthModal()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const fetchFolders = useCallback(async () => {
    if (!isAuthenticated) {
      setFolders([])
      setIsLoading(false)
      return
    }
    try {
      setError(null)
      const response = await getFavoriteFolders()
      setFolders(response.favoriteFolders)
    } catch {
      setError('Failed to load wishlists.')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!authLoading) {
      fetchFolders()
    }
  }, [fetchFolders, authLoading])

  useEffect(() => {
    if (isModalOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])

  const totalSavedStays = useMemo(
    () => folders.reduce((sum, f) => sum + (f.propertyCount ?? 0), 0),
    [folders]
  )

  const handleFolderClick = (folderId: number) => {
    router.push(`/favorites/${folderId}`)
  }

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    setIsCreating(true)
    try {
      await createFavoriteFolder(trimmed)
      toast.success(`"${trimmed}" wishlist created`)
      setNewFolderName('')
      setIsModalOpen(false)
      setIsLoading(true)
      await fetchFolders()
    } catch {
      toast.error('Failed to create wishlist.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      setTimeout(() => setNewFolderName(''), 200)
    }
  }

  const renderContent = () => {
    if (isLoading || authLoading) {
      return <WishlistSkeletonGrid />
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-border bg-white p-10 text-center space-y-4 max-w-md mx-auto mt-8">
          <p className="text-sm text-red-600">{error}</p>
          <Button
            type="button"
            onClick={() => {
              setIsLoading(true)
              fetchFolders()
            }}
            className="bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl cursor-pointer"
          >
            Try again
          </Button>
        </div>
      )
    }

    if (!isAuthenticated) {
      return (
        <div className="rounded-2xl border border-border bg-white px-6 py-12 text-center max-w-md mx-auto mt-4">
          <Image
            src={assetPath('/graphics/no-fav.png')}
            alt="Sign in to view wishlists"
            width={180}
            height={180}
            className="mx-auto"
            priority
          />
          <h2 className="font-semibold text-deep-teal mt-4">
            Sign in to save your favorite stays
          </h2>
          <p className="text-sm text-neutral-gray mt-1.5 leading-relaxed">
            Create wishlists for your next trip and revisit pet-friendly places
            anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 mt-6 justify-center">
            <Button
              type="button"
              onClick={() =>
                openAuthModal('login', { returnUrl: '/favorites' })
              }
              className="h-11 px-6 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold cursor-pointer"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </Button>
            <Button
              type="button"
              onClick={() => router.push('/')}
              variant="outline"
              className="h-11 px-5 rounded-xl border-border text-foreground hover:bg-off-white/70 font-medium cursor-pointer"
            >
              <Search className="mr-2 h-4 w-4" />
              Explore stays
            </Button>
          </div>
        </div>
      )
    }

    if (folders.length === 0) {
      return (
        <div className="rounded-2xl border border-border bg-white px-6 py-12 text-center max-w-md mx-auto mt-4">
          <Image
            src={assetPath('/graphics/no-fav.png')}
            alt="No wishlists yet"
            width={180}
            height={180}
            className="mx-auto"
            priority
          />
          <h2 className="font-semibold text-deep-teal mt-4">
            No wishlists yet
          </h2>
          <p className="text-sm text-neutral-gray mt-1.5 leading-relaxed">
            Save pet-friendly stays you love and organize them into wishlists
            for upcoming trips.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 mt-6 justify-center">
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-6 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold cursor-pointer"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Create wishlist
            </Button>
            <Button
              type="button"
              onClick={() => router.push('/')}
              variant="outline"
              className="h-11 px-5 rounded-xl border-border text-foreground hover:bg-off-white/70 font-medium cursor-pointer"
            >
              <Search className="mr-2 h-4 w-4" />
              Explore stays
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {/* Create New Wishlist Card */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="block w-full cursor-pointer text-left group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal rounded-2xl"
        >
          <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-border group-hover:border-deep-teal flex flex-col items-center justify-center transition-colors bg-off-white/40 group-hover:bg-deep-teal/[0.04]">
            <div className="w-12 h-12 rounded-full bg-deep-teal/10 group-hover:bg-deep-teal/15 flex items-center justify-center transition-colors mb-2">
              <Plus className="w-6 h-6 text-deep-teal" />
            </div>
            <span className="text-sm font-semibold text-deep-teal">
              New wishlist
            </span>
          </div>
          <div className="mt-2.5 px-0.5 space-y-0.5">
            <p className="text-sm font-semibold text-deep-teal">
              Create wishlist
            </p>
            <p className="text-xs text-neutral-gray">Organize your saved stays</p>
          </div>
        </button>

        {/* Wishlist Cards */}
        {folders.map((folder) => (
          <FavoriteFolderCard
            key={folder.id}
            folder={folder}
            onClick={(folderId) => handleFolderClick(folderId)}
            disabled={false}
            widthClass="w-full"
          />
        ))}
      </div>
    )
  }

  const createForm = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Input
          ref={inputRef}
          placeholder="e.g. Summer Trips, Bangkok Stays"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          maxLength={20}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newFolderName.trim() && !isCreating) {
              handleCreateFolder()
            }
          }}
        />
        <p className="text-xs text-neutral-gray text-right tabular-nums">
          {newFolderName.length} / 20
        </p>
      </div>
      <Button
        type="button"
        onClick={handleCreateFolder}
        disabled={isCreating || !newFolderName.trim()}
        className="w-full h-11 rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white font-semibold disabled:opacity-50 cursor-pointer"
      >
        {isCreating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <FolderPlus className="mr-2 h-4 w-4" />
            Create wishlist
          </>
        )}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="lg:hidden">
        <AppHeader title="Wishlists" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-[calc(3.5rem+1.25rem)] pb-24 lg:pt-8 lg:pb-12 space-y-6">
        {/* Desktop Editorial Header */}
        <div className="hidden lg:flex items-end justify-between gap-4 pb-5 border-b border-border">
          <div className="space-y-1">
            <h1 className="font-bold text-deep-teal">Wishlists</h1>
            <p className="text-sm text-neutral-gray tabular-nums">
              {isAuthenticated && folders.length > 0
                ? `${folders.length} ${folders.length === 1 ? 'wishlist' : 'wishlists'}, ${totalSavedStays} saved ${totalSavedStays === 1 ? 'stay' : 'stays'}`
                : 'Save stays you love and organize them for your next trip'}
            </p>
          </div>

          {isAuthenticated && (
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-deep-teal hover:bg-deep-teal/90 text-white text-sm font-semibold cursor-pointer"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New wishlist
            </Button>
          )}
        </div>

        {renderContent()}
      </div>

      {/* Create Wishlist — Dialog on Desktop, Drawer on Mobile */}
      {isDesktop ? (
        <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-deep-teal">
                Create new wishlist
              </DialogTitle>
            </DialogHeader>
            {createForm}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isModalOpen} onOpenChange={handleModalOpenChange}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <DrawerHeader>
                <DrawerTitle className="text-deep-teal">
                  Create new wishlist
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-4">{createForm}</div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
