'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import Image from 'next/image'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { cn, assetPath } from '@/lib/utils'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Property } from '@/types'
import { Grid2x2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface PropertyImageGalleryProps {
  images: Property['images']
}

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Thumb({
  src,
  index,
  onClick,
  className,
}: {
  src: string
  index: number
  onClick: (i: number) => void
  className?: string
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onClick(index)}
      className={cn(
        'relative block w-full h-full cursor-pointer overflow-hidden group bg-off-white/60 text-left',
        className
      )}
    >
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none bg-neutral-200 animate-pulse motion-reduce:animate-none z-0" />
      )}
      <Image
        src={src}
        alt={`Property photo ${index + 1}`}
        fill
        unoptimized
        onLoad={() => setIsLoaded(true)}
        className={cn(
          'object-cover transition-transform duration-300 group-hover:scale-[1.03]',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </button>
  )
}

function MobileCarouselSlide({
  src,
  index,
  onClick,
}: {
  src: string
  index: number
  onClick: () => void
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block w-full aspect-[4/3] overflow-hidden cursor-pointer bg-off-white/60"
    >
      {!isLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none bg-neutral-200 animate-pulse motion-reduce:animate-none z-0" />
      )}
      <Image
        src={src}
        alt={`Property photo ${index + 1}`}
        fill
        unoptimized
        onLoad={() => setIsLoaded(true)}
        className={cn(
          'object-cover transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </button>
  )
}

export function PropertyImageGallery({
  images: propImages,
}: PropertyImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  )
  const autoplay = useRef(Autoplay({ delay: 3800, stopOnInteraction: true }))

  useEffect(() => {
    if (!carouselApi) return
    const syncSlide = () => setCurrentSlide(carouselApi.selectedScrollSnap())
    queueMicrotask(syncSlide)
    carouselApi.on('select', syncSlide)
    return () => {
      carouselApi.off('select', syncSlide)
    }
  }, [carouselApi])

  const images = propImages?.length
    ? propImages.map((img) => {
        let url = img.filePath
        if (!url.startsWith('http')) {
          url = url.replace(/^(https?:)?\/*/, '')
          url = `http://${url}`
        }
        return url.replace(/(?<!:)\/\//g, '/')
      })
    : [assetPath('/graphics/no-image.svg')]

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const count = images.length

  const renderDesktopGrid = () => {
    if (count === 1) {
      return (
        <div className="relative rounded-2xl overflow-hidden border border-border h-[440px] xl:h-[480px]">
          <Thumb src={images[0]} index={0} onClick={openLightbox} />
        </div>
      )
    }

    if (count === 2) {
      return (
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl overflow-hidden border border-border h-[440px] xl:h-[480px]">
          <Thumb src={images[0]} index={0} onClick={openLightbox} />
          <Thumb src={images[1]} index={1} onClick={openLightbox} />
        </div>
      )
    }

    if (count === 3) {
      return (
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl overflow-hidden border border-border h-[440px] xl:h-[480px]">
          <Thumb src={images[0]} index={0} onClick={openLightbox} />
          <div className="grid grid-rows-2 gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} />
            <Thumb src={images[2]} index={2} onClick={openLightbox} />
          </div>
        </div>
      )
    }

    if (count === 4) {
      return (
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl overflow-hidden border border-border h-[440px] xl:h-[480px]">
          <Thumb src={images[0]} index={0} onClick={openLightbox} />
          <div className="grid grid-rows-2 gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <Thumb src={images[2]} index={2} onClick={openLightbox} />
              <Thumb src={images[3]} index={3} onClick={openLightbox} />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl overflow-hidden border border-border h-[440px] xl:h-[480px]">
        <Thumb src={images[0]} index={0} onClick={openLightbox} />
        <div className="grid grid-rows-2 gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} />
            <Thumb src={images[2]} index={2} onClick={openLightbox} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <Thumb src={images[3]} index={3} onClick={openLightbox} />
            <Thumb src={images[4]} index={4} onClick={openLightbox} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-white border border-border text-foreground text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          <Grid2x2 className="w-4 h-4 text-deep-teal" />
          <span className="tabular-nums">Show all {count} photos</span>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: full-bleed carousel with crisp counter badge */}
      <div className="md:hidden w-full relative">
        <Carousel
          className="w-full"
          setApi={setCarouselApi}
          plugins={prefersReducedMotion ? [] : [autoplay.current]}
          opts={{ loop: count > 1 }}
        >
          <CarouselContent>
            {images.map((src, i) => (
              <CarouselItem key={i}>
                <MobileCarouselSlide
                  src={src}
                  index={i}
                  onClick={() => openLightbox(i)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {count > 1 && (
          <>
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-foreground/80 text-white text-xs font-medium tabular-nums pointer-events-none">
              {currentSlide + 1} / {count}
            </div>
            <div className="flex justify-center items-center gap-1.5 mt-2.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-colors duration-200',
                    i === currentSlide ? 'bg-deep-teal' : 'bg-neutral-300'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tablet+: 5-photo mosaic */}
      <div className="hidden md:block">{renderDesktopGrid()}</div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={images.map((src) => ({ src }))}
        index={currentIndex}
        on={{ view: ({ index }) => setCurrentIndex(index) }}
        carousel={{ finite: count <= 1, imageFit: 'contain' }}
        controller={{ closeOnBackdropClick: true }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.85)' } }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </>
  )
}
