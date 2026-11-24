'use client'

import { useState, useEffect, useCallback } from 'react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { getFavoriteFolderById } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import {
  classifyNavigationError,
  parsePositiveIntParam,
} from '@/lib/navigationGuard'
import { FavoriteFolderDetail } from '@/types/favorite'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { AppHeader } from '@/app/_components/AppHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  Edit,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react'
import {
  FavoriteFolderMenuDrawer,
  type FolderMenuView,
} from '../_components/FavoriteFolderMenuDrawer'

function FolderDetailSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="space-y-2.5">
          <Skeleton className="aspect-[4/3] sm:aspect-square w-full rounded-2xl bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-3/4 bg-neutral-200 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-1/2 bg-neutral-200 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}

export default function FavoriteFolderDetailPage() {
  const params = useParams()
  const validFolderId = parsePositiveIntParam(params.folderId)
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [folder, setFolder] = useState<FavoriteFolderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(validFolderId !== null)
  const [error, setError] = useState<string | null>(null)
  const [guardState, setGuardState] = useState<
    'ok' | 'forbidden' | 'unauthorized' | 'not_found'
  >('ok')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuInitialView, setMenuInitialView] =
    useState<FolderMenuView>('options')

  const fetchFolder = useCallback(async () => {
    if (validFolderId === null) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await getFavoriteFolderById(String(validFolderId))
      setFolder(response)
    } catch (err) {
      const kind = classifyNavigationError(err)
      if (kind === 'forbidden') {
        setGuardState('forbidden')
        router.replace('/forbidden')
        return
      }
      if (kind === 'unauthorized') {
        setGuardState('unauthorized')
        router.replace('/favorites')
        return
      }
      if (kind === 'not_found') {
        setGuardState('not_found')
        return
      }
      setError('Failed to fetch wishlist details.')
    } finally {
      setIsLoading(false)
    }
  }, [validFolderId, router])

  useEffect(() => {
    if (validFolderId === null || authLoading) return
    if (!isAuthenticated) {
      router.replace('/favorites')
      return
    }
    fetchFolder()
  }, [validFolderId, authLoading, isAuthenticated, fetchFolder, router])

  if (validFolderId === null || guardState === 'not_found') {
    notFound()
  }

  if (
    guardState === 'forbidden' ||
    guardState === 'unauthorized' ||
    (!authLoading && !isAuthenticated)
  ) {
    return null
  }

  const openMenu = (view: FolderMenuView) => {
    setMenuInitialView(view)
    setIsMenuOpen(true)
  }

  const handleFolderDeleted = () => {
    router.push('/favorites')
  }

  const handleFolderRenamed = (newName: string) => {
    setFolder((prev) => (prev ? { ...prev, name: newName } : null))
  }

  const menuButton = (
    <button
      type="button"
      onClick={() => openMenu('options')}
      aria-label="Wishlist options"
      className="w-10 h-10 rounded-full hover:bg-off-white flex items-center justify-center text-deep-teal transition-colors cursor-pointer"
    >
      <MoreHorizontal className="w-5 h-5" />
    </button>
  )

  const renderContent = () => {
    if (isLoading) {
      return <FolderDetailSkeletonGrid />
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-border bg-white p-10 text-center space-y-4 max-w-md mx-auto mt-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button
            type="button"
            onClick={fetchFolder}
            className="bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl cursor-pointer"
          >
            Try again
          </Button>
        </div>
      )
    }

    if (!folder || folder.properties.length === 0) {
      return (
        <div className="rounded-2xl border border-border bg-white px-6 py-12 text-center max-w-md mx-auto mt-6 space-y-3">
          <h2 className="font-semibold text-deep-teal">
            No stays in this wishlist yet
          </h2>
          <p className="text-sm text-neutral-gray leading-relaxed">
            Tap the heart icon on any pet-friendly stay to save it here.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => router.push('/')}
              className="h-11 px-6 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-semibold cursor-pointer"
            >
              <Search className="mr-2 h-4 w-4" />
              Explore stays
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
        {folder.properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            showHeartIcon
            favoriteFolderId={validFolderId}
            href={`/detail/${property.id}?fromFavorites=true&folderId=${validFolderId}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="lg:hidden">
        <AppHeader
          title={folder?.name || 'Wishlist'}
          backPath="/favorites"
          menu={folder ? menuButton : undefined}
        />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-[calc(3.5rem+1.25rem)] pb-24 lg:pt-6 lg:pb-12 space-y-6">
        {/* Desktop Editorial Breadcrumb & Folder Header */}
        <div className="hidden lg:block space-y-3 pb-5 border-b border-border">
          <button
            type="button"
            onClick={() => router.push('/favorites')}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-gray hover:text-deep-teal transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to wishlists</span>
          </button>

          {folder ? (
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <h1 className="font-bold text-deep-teal truncate">
                  {folder.name}
                </h1>
                <p className="text-sm text-neutral-gray tabular-nums">
                  {folder.properties.length} saved{' '}
                  {folder.properties.length === 1 ? 'stay' : 'stays'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openMenu('renameFolder')}
                  className="h-10 px-4 rounded-xl border-border text-deep-teal hover:bg-off-white/70 font-medium cursor-pointer"
                >
                  <Edit className="mr-1.5 h-4 w-4" />
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openMenu('confirmDelete')}
                  className="h-10 px-4 rounded-xl border-border text-red-600 hover:bg-red-50 hover:border-red-200 font-medium cursor-pointer"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Skeleton className="h-8 w-56 bg-neutral-200 motion-reduce:animate-none" />
          )}
        </div>

        {/* Mobile Subheading (count under AppHeader) */}
        {folder && (
          <p className="lg:hidden text-xs text-neutral-gray tabular-nums">
            {folder.properties.length} saved{' '}
            {folder.properties.length === 1 ? 'stay' : 'stays'}
          </p>
        )}

        {renderContent()}
      </div>

      {folder && (
        <FavoriteFolderMenuDrawer
          folder={folder}
          isOpen={isMenuOpen}
          initialView={menuInitialView}
          onOpenChange={setIsMenuOpen}
          onFolderDeleted={handleFolderDeleted}
          onFolderRenamed={handleFolderRenamed}
        />
      )}
    </div>
  )
}
