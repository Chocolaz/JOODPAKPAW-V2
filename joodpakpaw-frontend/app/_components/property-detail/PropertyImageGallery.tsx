'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { cn } from '@/lib/utils'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Property } from '@/types'
import { assetPath } from '@/lib/utils'
import { Grid2x2 } from 'lucide-react'

interface PropertyImageGalleryProps {
  images: Property['images']
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
  return (
    <div
      className={cn('relative cursor-pointer overflow-hidden group', className)}
      onClick={() => onClick(index)}
    >
      <Image
        src={src}
        alt={`Image ${index + 1}`}
        fill
        unoptimized
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  )
}

export function PropertyImageGallery({ images: propImages }: PropertyImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const autoplay = useRef(Autoplay({ delay: 3500, stopOnInteraction: true }))

  useEffect(() => {
    if (!carouselApi) return
    setCurrentSlide(carouselApi.selectedScrollSnap())
    carouselApi.on('select', () => setCurrentSlide(carouselApi.selectedScrollSnap()))
  }, [carouselApi])

  const images = propImages?.length
    ? propImages.map((img) => {
        let url = img.filePath
        if (!url.startsWith('http')) {
          url = url.replace(/^(https?:)?\/*/,'')
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

  // Desktop adaptive grid — height fixed at 480px
  const renderDesktopGrid = () => {
    if (count === 1) {
      return (
        <Thumb
          src={images[0]} index={0} onClick={openLightbox}
          className="w-full rounded-2xl h-[480px]"
        />
      )
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden" style={{ height: 480 }}>
          <Thumb src={images[0]} index={0} onClick={openLightbox} className="w-full h-full" />
          <Thumb src={images[1]} index={1} onClick={openLightbox} className="w-full h-full" />
        </div>
      )
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden" style={{ height: 480 }}>
          <Thumb src={images[0]} index={0} onClick={openLightbox} className="w-full h-full" />
          <div className="grid grid-rows-2 gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} className="w-full h-full" />
            <Thumb src={images[2]} index={2} onClick={openLightbox} className="w-full h-full" />
          </div>
        </div>
      )
    }

    if (count === 4) {
      return (
        <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden" style={{ height: 480 }}>
          <Thumb src={images[0]} index={0} onClick={openLightbox} className="w-full h-full" />
          <div className="grid grid-rows-2 gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} className="w-full h-full" />
            <div className="grid grid-cols-2 gap-2">
              <Thumb src={images[2]} index={2} onClick={openLightbox} className="w-full h-full" />
              <Thumb src={images[3]} index={3} onClick={openLightbox} className="w-full h-full" />
            </div>
          </div>
        </div>
      )
    }

    // 5+ — large left + 2×2 grid right + "show all" button
    return (
      <div className="relative grid grid-cols-2 gap-2 rounded-2xl overflow-hidden" style={{ height: 480 }}>
        <Thumb src={images[0]} index={0} onClick={openLightbox} className="w-full h-full" />
        <div className="grid grid-rows-2 gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Thumb src={images[1]} index={1} onClick={openLightbox} className="w-full h-full" />
            <Thumb src={images[2]} index={2} onClick={openLightbox} className="w-full h-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Thumb src={images[3]} index={3} onClick={openLightbox} className="w-full h-full" />
            <Thumb src={images[4]} index={4} onClick={openLightbox} className="w-full h-full" />
          </div>
        </div>
        <button
          onClick={() => openLightbox(0)}
          className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-800 text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-white transition-colors"
        >
          <Grid2x2 className="w-4 h-4" />
          Show all {count} photos
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: swipeable carousel + dot indicators */}
      <div className="md:hidden w-full pb-2">
        <Carousel className="w-full" setApi={setCarouselApi} plugins={[autoplay.current]} opts={{ loop: true }}>
          <CarouselContent>
            {images.map((src, i) => (
              <CarouselItem key={i}>
                <div
                  className="relative w-full aspect-[4/3] overflow-hidden cursor-pointer"
                  onClick={() => openLightbox(i)}
                >
                  <Image src={src} alt={`Image ${i + 1}`} fill unoptimized className="object-cover" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {count > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-2.5">
            {images.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentSlide ? 'w-4 bg-deep-teal' : 'w-1.5 bg-gray-300',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tablet+: adaptive grid */}
      <div className="hidden md:block pb-4">
        {renderDesktopGrid()}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={images.map((src) => ({ src }))}
        index={currentIndex}
        on={{ view: ({ index }) => setCurrentIndex(index) }}
        carousel={{ finite: count <= 1, imageFit: 'contain' }}
        controller={{ closeOnBackdropClick: true }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0,0,0,0.8)' } }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </>
  )
}
