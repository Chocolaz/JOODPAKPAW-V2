'use client'

import Image from 'next/image'
import { RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { assetPath } from '@/lib/utils'

export function RejectedView({
  reason,
  onResubmit,
}: {
  reason?: string
  onResubmit: () => void
}) {
  return (
    <motion.div
      key="rejected"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center py-8 px-6 gap-5"
    >
      <Image
        src={assetPath('/graphics/rejected-verification.png')}
        alt="Verification Rejected"
        width={200}
        height={200}
        className="object-contain"
        unoptimized
      />
      <div>
        <h2 className="text-xl font-bold text-deep-teal font-baloo2">Verification Rejected</h2>
        <p className="text-sm text-neutral-gray mt-1.5 max-w-xs">
          Your submission was not approved. Please review the reason below and resubmit.
        </p>
      </div>
      {reason && (
        <div className="w-full max-w-sm bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-left">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Reason</p>
          <p className="text-sm text-red-700 leading-relaxed">&ldquo;{reason}&rdquo;</p>
        </div>
      )}
      <button
        onClick={onResubmit}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-deep-teal text-white text-sm font-semibold hover:bg-deep-teal/90 active:scale-95 transition-all duration-150"
      >
        <RefreshCw className="w-4 h-4" />
        Resubmit Verification
      </button>
    </motion.div>
  )
}
