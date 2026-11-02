'use client'

import Image from 'next/image'
import { Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { assetPath } from '@/lib/utils'

export function PendingView({ submittedAt }: { submittedAt?: string }) {
  return (
    <motion.div
      key="pending"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center py-8 px-6 gap-5"
    >
      <Image
        src={assetPath('/graphics/pending-verification.png')}
        alt="Under Review"
        width={200}
        height={200}
        className="object-contain"
        unoptimized
      />
      <div>
        <h2 className="text-xl font-bold text-deep-teal font-baloo2">Under Review</h2>
        <p className="text-sm text-neutral-gray mt-1.5 max-w-xs">
          We&apos;ll notify you once your identity has been reviewed.
        </p>
        {submittedAt && (
          <p className="text-xs text-neutral-gray/70 mt-3">
            Submitted on{' '}
            {new Date(submittedAt.replace(' ', 'T')).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent-orange/10 text-accent-orange text-sm font-medium">
        <Clock className="w-3.5 h-3.5" />
        Pending Review
      </span>
    </motion.div>
  )
}
