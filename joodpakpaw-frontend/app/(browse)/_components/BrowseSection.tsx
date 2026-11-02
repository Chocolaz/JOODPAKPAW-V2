'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PropertyCard } from '@/app/_components/PropertyCard'
import { Property } from '@/types'
import { assetPath, cn } from '@/lib/utils'

const SECTION_LIMIT = 7

interface BrowseSectionProps {
  title: string
  icon?: React.ReactNode
  properties: Property[]
  totalCount?: number
  showHeartIcon?: boolean
  showPetPolicyChip?: boolean
  seeAllHref?: string
}

export function BrowseSection({
  title,
  icon,
  properties,
  totalCount,
  showHeartIcon,
  showPetPolicyChip,
  seeAllHref,
}: BrowseSectionProps) {
  if (properties.length === 0) return null

  const count = totalCount ?? properties.length
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const card = scrollRef.current.querySelector('[data-card]') as HTMLElement
    if (!card) return
    const amount = card.offsetWidth + 16 // card width + gap-4
    scrollRef.current.scrollBy({
      left: dir === 'right' ? amount : -amount,
      behavior: 'smooth',
    })
  }

  const displayProperties = properties.slice(0, SECTION_LIMIT)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-10 lg:mb-0 lg:py-10 lg:border-b lg:border-gray-100"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          {icon}
          {seeAllHref && count > SECTION_LIMIT ? (
            <Link href={seeAllHref} className="group flex items-center gap-1.5">
              <h5 className="text-lg lg:text-xl xl:text-2xl font-semibold text-deep-teal underline-offset-4 group-hover:underline group-hover:text-accent-orange transition-colors">
                {title}
              </h5>
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-neutral-gray group-hover:text-accent-orange transition-colors translate-x-0 group-hover:translate-x-0.5 duration-200" />
            </Link>
          ) : (
            <h5 className="text-lg lg:text-xl xl:text-2xl font-semibold text-deep-teal">
              {title}
            </h5>
          )}
        </div>

        {/* Desktop arrow controls — only when see-all exists */}
        <div
          className={cn(
            'items-center gap-1',
            seeAllHref && count > SECTION_LIMIT ? 'hidden lg:flex' : 'hidden'
          )}
        >
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-neutral-gray hover:border-deep-teal hover:text-deep-teal transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards — horizontal scroll on mobile, fixed-width row on desktop */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 pr-10 snap-x snap-mandatory lg:mx-0 lg:px-0 lg:pr-10"
      >
        {displayProperties.map((property) => (
          <div
            key={property.id}
            data-card
            className="w-44 shrink-0 snap-start lg:w-[calc((100%-6*1rem)/7)]"
          >
            <PropertyCard
              property={property}
              showPetPolicyChip={showPetPolicyChip}
              showHeartIcon={showHeartIcon}
            />
          </div>
        ))}

        {/* See All card — only when there are more properties than the limit */}
        {seeAllHref && count > SECTION_LIMIT && (
          <div
            data-card
            className="w-44 shrink-0 snap-start lg:w-[calc((100%-6*1rem)/7)]"
          >
            <Link
              href={seeAllHref}
              className="group flex flex-col items-center justify-center gap-3 aspect-square w-full rounded-[20px] bg-white border border-gray-100 shadow-sm hover:border-deep-teal hover:shadow-md transition-all duration-300 overflow-hidden relative"
            >
              <div className="relative w-3/4 aspect-square">
                <Image
                  src={assetPath('/graphics/see-all.png')}
                  alt="See all"
                  fill
                  unoptimized
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="text-sm font-semibold text-deep-teal group-hover:text-accent-orange transition-colors">
                See All
              </span>
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  )
}
