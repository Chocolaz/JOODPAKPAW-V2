'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getVerificationStatus } from '@/lib/api'
import type { VerificationData } from '@/types/verification'
import { IntroView } from './_components/IntroView'
import { UploadForm } from './_components/UploadForm'
import { PendingView } from './_components/PendingView'
import { ApprovedView } from './_components/ApprovedView'
import { RejectedView } from './_components/RejectedView'

type Step = 'intro' | 'form'

export default function VerificationPage() {
  const router = useRouter()
  const [verification, setVerification] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('intro')

  useEffect(() => {
    getVerificationStatus()
      .then((res) => setVerification(res.verification))
      .catch(() => setVerification(null))
      .finally(() => setLoading(false))
  }, [])

  const currentStatus = verification?.status

  const renderContent = () => {
    if (currentStatus === 'pending')
      return <PendingView submittedAt={verification?.submittedAt} />
    if (currentStatus === 'approved') return <ApprovedView />

    // Resubmit: rejected but user clicked "Resubmit" — show upload form
    if (step === 'form') {
      return (
        <UploadForm
          onSubmitted={() =>
            setVerification({ ...verification, status: 'pending' } as VerificationData)
          }
        />
      )
    }

    if (currentStatus === 'rejected') {
      return (
        <RejectedView
          reason={verification?.rejectDescription ?? undefined}
          onResubmit={() => setStep('form')}
        />
      )
    }

    return <IntroView onStart={() => setStep('form')} />
  }

  const showBack = step === 'form' && currentStatus !== 'pending' && currentStatus !== 'approved'

  return (
    <div className="h-[calc(100dvh-56px)] overflow-y-auto lg:h-auto lg:overflow-visible">
    <div className="p-5 lg:px-12 max-w-2xl mx-auto w-full pb-28 lg:pb-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => (showBack ? setStep('intro') : router.back())}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-gray" />
          </button>
          <ShieldCheck className="w-5 h-5 text-deep-teal shrink-0" />
          <h1 className="text-xl font-bold text-deep-teal font-baloo2">
            Identity Verification
          </h1>
        </div>
        <p className="text-sm text-neutral-gray lg:pl-11">
          Verify your identity to get a verified badge on your profile.
        </p>
      </div>

      {/* Content */}
      <motion.div
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {!loading && renderContent()}
        </AnimatePresence>
      </motion.div>
    </div>
    </div>
  )
}
