import Image from 'next/image'
import { assetPath } from '@/lib/utils'

interface BrowseHeroProps {
  /** Optional slot rendered between the text and the graphic on desktop (e.g. SearchBar) */
  searchBar?: React.ReactNode
  /** 'row' = desktop side-by-side, 'column' = mobile stacked */
  layout?: 'row' | 'column'
}

export function BrowseHero({ searchBar, layout = 'column' }: BrowseHeroProps) {
  const text = (
    <div className={layout === 'row' ? 'space-y-3' : 'space-y-1'}>
      <h4
        className={
          layout === 'row'
            ? 'text-deep-teal text-2xl xl:text-3xl leading-tight font-bold'
            : 'text-deep-teal text-2xl font-bold leading-tight'
        }
      >
        Discover Local Pet Hotels &amp; Care Homes Near You
      </h4>
      <p
        className={
          layout === 'row'
            ? 'text-neutral-gray text-sm xl:text-base'
            : 'text-neutral-gray text-sm'
        }
      >
        Find the perfect home away from home for your furry friends.
      </p>
    </div>
  )

  const graphic = (
    <div
      className={layout === 'row' ? 'relative flex-[0.6] shrink-0 ml-auto' : 'relative w-full'}
      style={{ aspectRatio: '390/144' }}
    >
      <Image
        src={assetPath('/graphics/home.svg')}
        alt="Illustration of pets and a house"
        fill
        priority
      />
    </div>
  )

  if (layout === 'row') {
    return (
      <div className="flex items-center gap-8 xl:gap-12 py-3">
        <div className="flex-1 max-w-[380px] space-y-3">
          {text}
          {searchBar}
        </div>
        {graphic}
      </div>
    )
  }

  return (
    <div className="mt-4 pb-4 flex flex-col gap-3">
      {graphic}
      {text}
    </div>
  )
}
