'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { assetPath } from '@/lib/utils'

const steps = [
  {
    title: 'Tell us about your space',
    description:
      'Share details about your home and environment so pet owners know exactly what to expect.',
    image: '/graphics/steps/tell-us.svg',
    alt: 'Tell us about your space',
  },
  {
    title: 'Make it stand out',
    description:
      'Highlight what makes your space special. Features and photos to attract more furry guests!',
    image: '/graphics/steps/make-it.svg',
    alt: 'Make it stand out',
  },
  {
    title: 'Publish Your Listing',
    description:
      'Go live and welcome pets to stay! You can always update your listing anytime.',
    image: '/graphics/steps/publish.svg',
    alt: 'Publish Your Listing',
  },
]

export default function AddPropertyPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-full px-5 lg:px-12 max-w-[500px] lg:max-w-[1440px] mx-auto">
      {/* Mobile layout */}
      <div className="lg:hidden flex flex-col mt-10 pb-28">
        <h1 className="text-2xl font-bold mb-2 text-deep-teal">
          Become a Host
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          It&apos;s simple to get started — just follow three steps.
        </p>

        <div className="space-y-0 text-left">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`flex items-center justify-between gap-4 py-7 ${
                index < steps.length - 1 ? 'border-b border-black/8' : ''
              }`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1.5 text-deep-teal">
                  {step.title}
                </h3>
                <p className="text-sm text-neutral-gray leading-relaxed">
                  {step.description}
                </p>
              </div>
              <div className="shrink-0">
                <Image
                  src={assetPath(step.image)}
                  alt={step.alt}
                  width={72}
                  height={72}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="lg:hidden fixed bottom-2 left-0 right-0 bg-white border-t border-gray-100 py-4 px-10 z-10 max-w-[500px] mx-auto">
        <Link href="/profile/host/add-property/1" className="w-full">
          <Button className="interact-button bg-accent-orange! w-full">
            Get Started
          </Button>
        </Link>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col items-center py-16 xl:py-20">
        <div className="text-center mb-14 xl:mb-16">
          <p className="text-accent-orange font-semibold text-sm uppercase tracking-widest mb-3">
            Host with Joodpakpaw
          </p>
          <h1 className="text-4xl xl:text-5xl font-bold text-deep-teal mb-4">
            Become a Host
          </h1>
          <p className="text-neutral-gray text-base xl:text-lg max-w-lg mx-auto leading-relaxed">
            It&apos;s simple to get started — just follow three steps.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 xl:gap-8 w-full max-w-4xl xl:max-w-5xl">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col items-center text-center bg-white rounded-[20px] border border-gray-100 shadow-sm px-8 py-10 xl:px-10 xl:py-12 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative mb-6">
                <Image
                  src={assetPath(step.image)}
                  alt={step.alt}
                  width={96}
                  height={96}
                  className="xl:w-28 xl:h-28"
                />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent-orange text-white text-xs font-bold flex items-center justify-center shadow-sm">
                  {index + 1}
                </span>
              </div>
              <h3 className="font-bold text-lg xl:text-xl text-deep-teal mb-3 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm xl:text-base text-neutral-gray leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 xl:mt-14">
          <Link href="/profile/host/add-property/1">
            <Button className="interact-button bg-accent-orange! px-12 py-3 text-base font-semibold rounded-full">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
