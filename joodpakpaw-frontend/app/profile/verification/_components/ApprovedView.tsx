'use client'

import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { assetPath } from '@/lib/utils'

export function ApprovedView() {
  return (
    <motion.div
      key="approved"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center text-center py-8 px-6 gap-5"
    >
      <Image
        src={assetPath('/graphics/approved-verification.png')}
        alt="Identity Verified"
        width={200}
        height={200}
        className="object-contain"
        unoptimized
      />
      <div>
        <h2 className="text-xl font-bold text-deep-teal font-baloo2">Identity Verified</h2>
        <p className="text-sm text-neutral-gray mt-1.5 max-w-xs">
          Your identity has been confirmed. Your profile now shows a verified badge.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-positive-green/10 text-positive-green text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" />
        Verified
      </span>
    </motion.div>
  )
}
