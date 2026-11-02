'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { confirmPayment } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { cn } from '@/lib/utils'
import { CheckCircle, CreditCard, Clock } from 'lucide-react'

interface PendingPaymentSectionProps {
  bookingId: number
  createdAt: string
  onPaymentSuccess: () => void
  onExpired: () => void
}

const mockCreditCards = [
  {
    id: 1,
    brand: 'Visa',
    last4: '1234',
    cardholderName: 'John Doe',
    expiryDate: '12/25',
  },
  {
    id: 2,
    brand: 'MasterCard',
    last4: '5678',
    cardholderName: 'Jane Smith',
    expiryDate: '08/26',
  },
]

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function PendingPaymentSection({
  bookingId,
  createdAt,
  onPaymentSuccess,
  onExpired,
}: PendingPaymentSectionProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [paymentState, setPaymentState] = useState<
    'idle' | 'processing' | 'success'
  >('idle')
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)

  const calcRemaining = useCallback(() => {
    const created = new Date(createdAt).getTime()
    const deadline = created + 24 * 60 * 60 * 1000
    return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
  }, [createdAt])

  useEffect(() => {
    setRemainingSeconds(calcRemaining())
    const interval = setInterval(() => {
      const remaining = calcRemaining()
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onExpired()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [calcRemaining, onExpired])

  const isUrgent = remainingSeconds < 3600 // less than 1 hour

  const handlePayment = async () => {
    if (!selectedCard) return
    setPaymentState('processing')

    try {
      await confirmPayment(bookingId)

      await new Promise((resolve) => setTimeout(resolve, 1500))

      setPaymentState('success')
      toast.success('Payment successful! Booking confirmed.')

      setTimeout(() => {
        onPaymentSuccess()
      }, 1500)
    } catch (err) {
      console.error('Payment failed:', err)
      let errorMessage = 'Payment failed. Please try again.'
      if (err instanceof ApiError) {
        errorMessage = err.message
      }
      toast.error(errorMessage)
      setPaymentState('idle')
    }
  }

  return (
    <div className="relative">
      {paymentState !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center gap-4">
            {paymentState === 'processing' && (
              <>
                <Spinner className="w-16 h-16" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Processing Payment...
                </h3>
                <p className="text-gray-600">
                  Please wait, we&apos;re securing your transaction.
                </p>
              </>
            )}
            {paymentState === 'success' && (
              <>
                <div>
                  <CheckCircle className="w-16 h-16 text-positive-green" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Payment Successful!
                </h3>
                <p className="text-gray-600">Your booking is now confirmed.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 space-y-4">
        {/* Countdown banner */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-3',
            isUrgent ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          )}
        >
          <Clock
            className={cn(
              'w-5 h-5 shrink-0',
              isUrgent ? 'text-red-500' : 'text-amber-500'
            )}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                isUrgent ? 'text-red-600' : 'text-amber-700'
              )}
            >
              {formatCountdown(remainingSeconds)} remaining
            </p>
            <p className="text-xs text-neutral-gray">
              Complete payment within 24 hours or this booking will be automatically cancelled.
            </p>
          </div>
        </div>

        <h4 className="text-sm font-semibold text-deep-teal uppercase tracking-wide">
          Complete Payment
        </h4>
        <p className="text-xs text-neutral-gray">
          Select a payment method to confirm your booking.
        </p>

        <div className="grid gap-3">
          {mockCreditCards.map((card) => (
            <div
              key={card.id}
              onClick={() => setSelectedCard(card.id)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer bg-white shadow-sm',
                {
                  'border-positive-green shadow-md':
                    selectedCard === card.id,
                  'border-gray-200 hover:border-gray-300':
                    selectedCard !== card.id,
                }
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm text-gray-800">
                    {card.brand}
                  </p>
                  <p className="text-xs text-neutral-gray">
                    **** **** **** {card.last4}
                  </p>
                </div>
                <CreditCard className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mt-3 flex justify-between items-end">
                <div>
                  <p className="text-xs text-neutral-gray">Card Holder</p>
                  <p className="font-medium text-xs text-gray-700">
                    {card.cardholderName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-gray">Expires</p>
                  <p className="font-medium text-xs text-gray-700">
                    {card.expiryDate}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handlePayment}
          disabled={!selectedCard || paymentState !== 'idle'}
          className="w-full h-12 bg-positive-green hover:bg-positive-green/90 text-white font-semibold text-base rounded-xl"
        >
          {paymentState === 'processing' ? (
            <Spinner className="size-5" />
          ) : (
            'Confirm Payment'
          )}
        </Button>
      </div>
    </div>
  )
}
