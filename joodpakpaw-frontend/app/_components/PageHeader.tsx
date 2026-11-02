import Image from 'next/image'
import { assetPath } from '@/lib/utils'

interface PageHeaderProps {
  title?: string
  isHost?: boolean
}

export function PageHeader({ title, isHost }: PageHeaderProps) {
  const imageSrc = assetPath('/graphics/home.svg')

  return (
    <header className="flex items-center gap-8 lg:gap-16 py-4 lg:py-10">
      {/* Text side */}
      <div className="flex-1 lg:max-w-[480px]">
        {title ? (
          <h1 className="mt-7 lg:mt-0 text-deep-teal text-2xl lg:text-4xl xl:text-5xl font-bold">
            {title}
          </h1>
        ) : (
          <div className="lg:space-y-4">
            <div className="flex items-center gap-2 lg:block">
              <h4 className="mt-7 lg:mt-0 text-deep-teal text-xl lg:text-4xl xl:text-5xl lg:leading-tight font-bold">
                Discover Local Pet Hotels &amp; Care Homes Near You
              </h4>
              {isHost && (
                <span className="mt-7 lg:mt-0 rounded-full bg-orange-500 px-3 py-1 text-sm font-semibold text-white shrink-0">
                  Host
                </span>
              )}
            </div>
            <p className="hidden lg:block text-neutral-gray text-lg lg:text-xl mt-3">
              Find the perfect home away from home for your furry friends.
            </p>
          </div>
        )}
      </div>

      {/* Image side */}
      <div
        className="relative w-1/2 lg:w-[45%] shrink-0 mt-4 lg:mt-0"
        style={{ aspectRatio: '390/144' }}
      >
        <Image
          src={imageSrc}
          alt="Illustration of pets and a house"
          fill
          priority
        />
      </div>
    </header>
  )
}
