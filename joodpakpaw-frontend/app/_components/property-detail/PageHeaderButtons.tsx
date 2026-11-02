'use client'

import { Property } from '@/types'
import { ChevronLeft, Share2, Globe, GlobeLock, Flag } from 'lucide-react'
import { HostActionMenu } from '@/app/profile/host/_components/HostActionMenu'

interface PageHeaderButtonsProps {
  property?: Property
  onBackClick: () => void
  onShareClick: () => void
  onDeleteClick?: () => void
  onGlobeClick?: () => void
  isPropertyActive?: boolean
  disablePublish?: boolean
  onDataChange?: () => void
  onReportClick?: () => void
}

export function PageHeaderButtons({
  property,
  onBackClick,
  onShareClick,
  onDeleteClick,
  onGlobeClick,
  isPropertyActive,
  disablePublish,
  onDataChange,
  onReportClick,
}: PageHeaderButtonsProps) {
  return (
    <>
      <button
        onClick={onBackClick}
        className="fixed top-4 left-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-gray-100 transition"
      >
        <ChevronLeft className="w-6 h-6 text-gray-800" />
      </button>

      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        {onReportClick && (
          <button
            onClick={onReportClick}
            className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-gray-100 transition"
            title="Report this property"
          >
            <Flag className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <button
          onClick={onShareClick}
          className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-gray-100 transition"
        >
          <Share2 className="w-5 h-5 text-gray-800" />
        </button>
        {onGlobeClick && (
          <button
            onClick={onGlobeClick}
            className={`p-2 bg-white/80 backdrop-blur-sm rounded-full shadow transition ${
              disablePublish
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-gray-100'
            }`}
            title={
              disablePublish
                ? 'Cannot publish: At least one room category is required.'
                : isPropertyActive
                  ? 'Unpublish Property'
                  : 'Publish Property'
            }
          >
            {isPropertyActive ? (
              <Globe className="w-5 h-5 text-gray-800" />
            ) : (
              <GlobeLock className="w-5 h-5 text-gray-800" />
            )}
          </button>
        )}
        {property && onDataChange && (
          <HostActionMenu
            property={property}
            onDeleteClick={onDeleteClick}
            onDataChange={onDataChange}
          />
        )}
      </div>
    </>
  )
}
