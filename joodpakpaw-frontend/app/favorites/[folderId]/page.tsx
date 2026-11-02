'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getFavoriteFolderById } from '@/lib/api'
import { FavoriteFolderDetail } from '@/types/favorite'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { AppHeader } from '@/app/_components/AppHeader'
import { Loader2, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FavoriteFolderMenuDrawer } from '../_components/FavoriteFolderMenuDrawer'

export default function FavoriteFolderDetailPage() {
  const params = useParams()
  const folderId = params.folderId as string
  const router = useRouter()

  const [folder, setFolder] = useState<FavoriteFolderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (folderId) {
      const fetchFolder = async () => {
        setIsLoading(true)
        try {
          const response = await getFavoriteFolderById(folderId)
          setFolder(response)
        } catch (err) {
          setError('Failed to fetch folder details.')
        } finally {
          setIsLoading(false)
        }
      }
      fetchFolder()
    }
  }, [folderId])

  const handleFolderDeleted = () => {
    router.push('/favorites')
  }

  const handleFolderRenamed = (newName: string) => {
    setFolder((prev) => (prev ? { ...prev, name: newName } : null))
  }

  const menuButton = (
    <button
      onClick={() => setIsMenuOpen(true)}
      className="rounded-full hover:bg-gray-100"
    >
      <Menu className="w-6 h-6 text-neutral-gray" />
    </button>
  )

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-red-500 text-center flex flex-col items-center justify-center h-64">
          <p>{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      )
    }

    if (!folder || folder.properties.length === 0) {
      return (
        <div className="text-center text-gray-500">This folder is empty.</div>
      )
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {folder.properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            showHeartIcon={true}
            favoriteFolderId={Number(folderId)}
            href={`/detail/${property.id}?fromFavorites=true&folderId=${folderId}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <AppHeader title="" backPath="/favorites" menu={menuButton} />
      <div className="container mx-auto px-4 py-8">
        {folder && (
          <>
            <h4 className="text-xl font-semibold mb-4">{folder.name}</h4>
            <FavoriteFolderMenuDrawer
              folder={folder}
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
              onFolderDeleted={handleFolderDeleted}
              onFolderRenamed={handleFolderRenamed}
            />
          </>
        )}
        {renderContent()}
      </div>
    </div>
  )
}
