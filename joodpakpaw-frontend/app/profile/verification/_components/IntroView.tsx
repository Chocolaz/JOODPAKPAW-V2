'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { assetPath } from '@/lib/utils'

export function IntroView({ onStart }: { onStart: () => void }) {
  const [showPDPA, setShowPDPA] = useState(false)
  const [acceptPDPA, setAcceptPDPA] = useState(false)
  const benefits = [
    {
      image: '/graphics/benefit-1.png',
      title: 'Build Trust',
      desc: 'A verified badge shows hosts and guests you are who you say you are.',
    },
    {
      image: '/graphics/benefit-2.png',
      title: 'Verified Identity',
      desc: 'Unlock full access to bookings and host features on JoodPakPaw.',
    },
  ]

  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col gap-7"
    >
      {/* Hero */}
      <div className="flex justify-center">
        <Image
          src={assetPath('/graphics/verification.png')}
          alt="Identity Verification"
          width={200}
          height={200}
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Benefit cards */}
      <div className="grid grid-cols-2 gap-3">
        {benefits.map((b) => (
          <div
            key={b.title}
            className="bg-white border border-gray-100 rounded-[20px] p-4 flex flex-col items-center text-center gap-3 shadow-sm"
          >
            <Image
              src={assetPath(b.image)}
              alt={b.title}
              width={90}
              height={90}
              className="object-contain"
              unoptimized
            />
            <div>
              <p className="text-sm font-semibold text-deep-teal">{b.title}</p>
              <p className="text-xs text-neutral-gray mt-1 leading-relaxed">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* What you'll need */}
      <div className="bg-off-white rounded-[20px] px-4 py-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">
          What you&apos;ll need
        </p>
        <div className="flex flex-col gap-2.5">
          {[
            "A government-issued ID (passport, national ID, or driver's license)",
            'A selfie of yourself holding the ID next to your face',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-deep-teal/10 text-deep-teal text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PDPA Policy */}
      <div className="bg-white border border-gray-100 rounded-[20px] overflow-hidden">
        <button
          onClick={() => setShowPDPA(!showPDPA)}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        >
          <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">
            PDPA Privacy Policy
          </p>
          <ChevronDown className={`w-4 h-4 text-neutral-gray transition-transform ${showPDPA ? 'rotate-180' : ''}`} />
        </button>
        {showPDPA && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
            <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">Data Collection & Storage</p>
              <p>
                JoodPakPaw collects and securely stores your government-issued ID and selfie images solely for identity verification purposes. Your personal data is encrypted and protected with industry-standard security measures.
              </p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">Purpose of Use</p>
              <p>
                Your documents and photos are used exclusively to verify your identity and issue a verified badge on your profile. We will not share this information with third parties without your explicit consent.
              </p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">Data Retention</p>
              <p>
                Your identity documents will be retained for as long as necessary to maintain your verified status. You may request deletion of your documents at any time through your profile settings.
              </p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">Your Rights</p>
              <p>
                Under PDPA regulations, you have the right to access, correct, and delete your personal data. For any inquiries, please contact our support team.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Accept PDPA Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptPDPA}
          onChange={(e) => setAcceptPDPA(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-accent-orange focus:ring-accent-orange cursor-pointer mt-0.5 shrink-0"
        />
        <span className="text-xs text-gray-700 leading-relaxed">
          I understand and accept the PDPA Privacy Policy regarding the collection and use of my government-issued ID and photos for identity verification.
        </span>
      </label>

      {/* CTA */}
      <button
        onClick={onStart}
        disabled={!acceptPDPA}
        className="w-full py-3.5 rounded-full bg-accent-orange text-white text-sm font-semibold hover:bg-accent-orange/90 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Get Started
        <ChevronRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
