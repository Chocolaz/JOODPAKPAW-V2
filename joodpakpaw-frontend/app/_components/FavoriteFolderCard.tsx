'use client'

import { FavoriteFolder } from '@/types/favorite'
import Image from 'next/image'
import { cn, assetPath } from '@/lib/utils'

interface FavoriteFolderCardProps {
  folder: FavoriteFolder
  onClick: (folderId: number, folderName: string) => void
  disabled: boolean
  widthClass?: string
  isCurrent?: boolean
}

export function FavoriteFolderCard({
  folder,
  onClick,
  disabled,
  widthClass = 'w-36',
  isCurrent = false,
}: FavoriteFolderCardProps) {
  return (
    <button
      className={cn(
        'block shrink-0 cursor-pointer disabled:opacity-50 text-left',
        widthClass
      )}
      onClick={() => onClick(folder.id, folder.name)}
      disabled={disabled}
    >
      <div className="aspect-square w-full relative">
        <Image
          src={folder.firstPropertyImage || assetPath('/graphics/no-room.png')}
          alt={folder.name}
          fill
          unoptimized
          className={cn(
            'object-cover rounded-[20px] shadow-md',
            isCurrent && 'ring-2 ring-deep-teal ring-offset-2'
          )}
        />
        {isCurrent && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-deep-teal text-white text-[11px] font-medium">
            Current
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-deep-teal truncate">
          {folder.name}
        </p>
        <p className="text-xs text-neutral-gray">
          Saved {folder.propertyCount}{' '}
          {folder.propertyCount !== 1 ? 'places' : 'place'}
        </p>
      </div>
    </button>
  )
}
