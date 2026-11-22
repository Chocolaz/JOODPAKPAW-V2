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
  const pillBtnClass =
    'w-11 h-11 inline-flex items-center justify-center rounded-full bg-white border border-border shadow-sm text-deep-teal hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer'

  return (
    <>
      <button
        type="button"
        aria-label="Go back"
        onClick={onBackClick}
        className={`fixed top-4 left-4 z-10 ${pillBtnClass}`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        {onReportClick && (
          <button
            type="button"
            aria-label="Report this property"
            onClick={onReportClick}
            className={`${pillBtnClass} text-neutral-gray hover:text-deep-teal`}
            title="Report this property"
          >
            <Flag className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          aria-label="Share property"
          onClick={onShareClick}
          className={pillBtnClass}
        >
          <Share2 className="w-5 h-5" />
        </button>
        {onGlobeClick && (
          <button
            type="button"
            aria-label={isPropertyActive ? 'Unpublish Property' : 'Publish Property'}
            onClick={onGlobeClick}
            className={`${pillBtnClass} ${
              disablePublish ? 'cursor-not-allowed opacity-50' : ''
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
              <Globe className="w-5 h-5" />
            ) : (
              <GlobeLock className="w-5 h-5" />
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
