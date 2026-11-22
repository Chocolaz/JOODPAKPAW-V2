'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/app/_components/AuthContext'
import { getVerificationStatus } from '@/lib/api'
import type { VerificationData } from '@/types/verification'
import { IntroView } from './_components/IntroView'
import { UploadForm } from './_components/UploadForm'
import { PendingView } from './_components/PendingView'
import { ApprovedView } from './_components/ApprovedView'
import { RejectedView } from './_components/RejectedView'

type Step = 'intro' | 'form'

export default function VerificationPage() {
  const { refreshAuth } = useAuth()
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
          onSubmitted={(res) => {
            setVerification(res.verification)
            if (res.autoApproved || res.verification?.status === 'approved') {
              void refreshAuth()
            }
          }}
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
    <div className="max-w-2xl w-full space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {showBack && (
              <button
                type="button"
                onClick={() => setStep('intro')}
                aria-label="Back to overview"
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-off-white transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-deep-teal" />
              </button>
            )}
            <h1 className="font-bold text-deep-teal">
              Identity verification
            </h1>
          </div>
          <p className="text-sm text-neutral-gray">
            Verify your government ID to unlock hosting and earn a verified badge.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-off-white border border-border hidden sm:flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-deep-teal" />
        </div>
      </header>

      {/* Content */}
      <motion.div
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {!loading && renderContent()}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
