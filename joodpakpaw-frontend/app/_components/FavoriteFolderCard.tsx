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
      type="button"
      className={cn(
        'group block shrink-0 cursor-pointer disabled:opacity-50 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal rounded-2xl',
        widthClass
      )}
      onClick={() => onClick(folder.id, folder.name)}
      disabled={disabled}
    >
      <div
        className={cn(
          'aspect-square w-full relative rounded-2xl border bg-off-white/60 overflow-hidden transition-colors',
          isCurrent
            ? 'border-deep-teal ring-2 ring-deep-teal/30'
            : 'border-border group-hover:border-foreground/25'
        )}
      >
        <Image
          src={folder.firstPropertyImage || assetPath('/graphics/no-room.png')}
          alt={folder.name}
          fill
          unoptimized
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {isCurrent && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-deep-teal text-white text-[11px] font-semibold">
            Current
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5 space-y-0.5">
        <p className="text-sm font-semibold text-deep-teal truncate">
          {folder.name}
        </p>
        <p className="text-xs text-neutral-gray tabular-nums">
          {folder.propertyCount} saved{' '}
          {folder.propertyCount === 1 ? 'stay' : 'stays'}
        </p>
      </div>
    </button>
  )
}
