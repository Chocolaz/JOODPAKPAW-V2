'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { createBooking, confirmPayment } from '@/lib/api'
import { ApiError } from '@/lib/errorHandling'
import { BookingDetail } from '@/types'
import { cn } from '@/lib/utils'
import { CheckCircle, CreditCard, Clock, X, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PaymentSectionProps {
  bookingDetails: BookingDetail
  isBookingLoading: boolean
  setIsBookingLoading: (loading: boolean) => void
  onCancel: () => void
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

type PaymentMode = 'now' | 'later'

export default function PaymentSection({
  bookingDetails,
  isBookingLoading,
  setIsBookingLoading,
  onCancel,
}: PaymentSectionProps) {
  const router = useRouter()

  const buildBookingBody = () => {
    const bookingOrders = Object.entries(bookingDetails.selectedRooms).map(
      ([id, count]) => ({
        roomCategoryId: Number(id),
        checkInDate: bookingDetails.checkInDate,
        checkOutDate: bookingDetails.checkOutDate,
        roomsBooked: count,
      })
    )
    if (bookingDetails.petProfileIds.length > 0) {
      return { PetProfileIDs: bookingDetails.petProfileIds, bookingOrders }
    }
    return { numberOfPets: bookingDetails.petCount, bookingOrders }
  }
  // Default to 'now' so the card list is visible immediately
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('now')
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [paymentState, setPaymentState] = useState<
    'idle' | 'booking' | 'processing' | 'success'
  >('idle')

  const selectedCardData =
    mockCreditCards.find((c) => c.id === selectedCard) ?? null
  const isReady =
    paymentMode === 'later' || (paymentMode === 'now' && selectedCard !== null)

  const handlePayLater = async () => {
    setIsBookingLoading(true)
    setPaymentState('booking')

    try {
      await createBooking(buildBookingBody())
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setPaymentState('success')
      toast.success('Booking created! You can pay later.')
      setTimeout(() => router.push('/profile/bookings'), 1500)
    } catch (err) {
      console.error('Booking failed:', err)
      let errorMessage = 'Booking failed. Please try again.'
      if (err instanceof ApiError) errorMessage = err.message
      toast.error(errorMessage)
      setPaymentState('idle')
    } finally {
      if (paymentState !== 'success') setIsBookingLoading(false)
    }
  }

  const handlePayNow = async () => {
    if (!selectedCard) return
    setIsBookingLoading(true)
    setPaymentState('processing')

    try {
      const booking = await createBooking(buildBookingBody())
      await confirmPayment(booking.id)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setPaymentState('success')
      toast.success('Payment successful and booking confirmed!')
      setTimeout(() => router.push('/profile/bookings'), 1500)
    } catch (err) {
      console.error('Payment failed:', err)
      let errorMessage = 'Payment failed. Please try again.'
      if (err instanceof ApiError) errorMessage = err.message
      toast.error(errorMessage)
      setPaymentState('idle')
    } finally {
      if (paymentState !== 'success') setIsBookingLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Processing overlay */}
      {paymentState !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center gap-4 mx-6">
            {paymentState === 'booking' && (
              <>
                <Spinner className="w-16 h-16" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Creating Booking...
                </h3>
                <p className="text-gray-600">
                  Please wait, we&apos;re reserving your spot.
                </p>
              </>
            )}
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
                <CheckCircle className="w-16 h-16 text-positive-green" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Booking Confirmed!
                </h3>
                <p className="text-gray-600">Redirecting to your bookings...</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-gray">
            Payment Method
          </h4>
          <div className="flex items-center gap-1 text-positive-green">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Secure payment</span>
          </div>
        </div>

        {/* Pay Now — primary, expanded by default */}
        <div
          className={cn(
            'rounded-2xl border-2 overflow-hidden transition-all duration-200',
            paymentMode === 'now'
              ? 'border-deep-teal shadow-sm'
              : 'border-gray-200'
          )}
        >
          {/* Header */}
          <button
            type="button"
            onClick={() => {
              setPaymentMode('now')
              setSelectedCard(null)
            }}
            className="w-full flex items-center justify-between px-5 py-4 bg-white"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  paymentMode === 'now' ? 'bg-deep-teal/10' : 'bg-gray-100'
                )}
              >
                <CreditCard
                  className={cn(
                    'w-5 h-5 transition-colors',
                    paymentMode === 'now' ? 'text-deep-teal' : 'text-gray-400'
                  )}
                />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'font-semibold text-sm',
                      paymentMode === 'now' ? 'text-deep-teal' : 'text-gray-700'
                    )}
                  >
                    Pay Now
                  </p>
                  {/* Recommended badge */}
                  <span className="text-[10px] font-semibold bg-deep-teal text-white px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-neutral-gray mt-0.5">
                  Instant confirmation, booking secured
                </p>
              </div>
            </div>

            {/* Active indicator dot */}
            <div
              className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                paymentMode === 'now'
                  ? 'border-deep-teal bg-deep-teal'
                  : 'border-gray-300'
              )}
            >
              {paymentMode === 'now' && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>
          </button>

          {/* Card list — always open when mode is 'now' */}
          <AnimatePresence initial={false}>
            {paymentMode === 'now' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 space-y-3">
                  {mockCreditCards.map((card) => {
                    const isSelected = selectedCard === card.id
                    return (
                      <motion.div
                        key={card.id}
                        onClick={() =>
                          setSelectedCard(isSelected ? null : card.id)
                        }
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'p-4 rounded-xl border-2 cursor-pointer bg-white transition-all duration-200 relative overflow-hidden',
                          isSelected
                            ? 'border-positive-green shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              className="absolute top-0 left-0 w-1 h-full bg-positive-green"
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              exit={{ scaleY: 0 }}
                              transition={{ duration: 0.15 }}
                            />
                          )}
                        </AnimatePresence>

                        <div className="flex justify-between items-center pl-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-gray-800">
                                {card.brand}
                              </p>
                              <AnimatePresence>
                                {isSelected && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="text-[11px] font-medium text-positive-green bg-positive-green/10 px-2 py-0.5 rounded-full"
                                  >
                                    Selected
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                            <p className="text-xs text-neutral-gray mt-0.5">
                              **** **** **** {card.last4}
                            </p>
                          </div>
                          <CreditCard
                            className={cn(
                              'w-5 h-5 transition-colors',
                              isSelected
                                ? 'text-positive-green'
                                : 'text-gray-300'
                            )}
                          />
                        </div>

                        <div className="mt-3 flex justify-between pl-2">
                          <div>
                            <p className="text-[11px] text-neutral-gray">
                              Card Holder
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {card.cardholderName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-neutral-gray">
                              Expires
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {card.expiryDate}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pay Later — secondary, subtle */}
        <button
          type="button"
          onClick={() => {
            setPaymentMode('later')
            setSelectedCard(null)
          }}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200',
            paymentMode === 'later'
              ? 'border-accent-orange/50 bg-accent-orange/5'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          )}
        >
          <div className="flex items-center gap-3">
            <Clock
              className={cn(
                'w-4 h-4 shrink-0 transition-colors',
                paymentMode === 'later' ? 'text-accent-orange' : 'text-gray-400'
              )}
            />
            <div className="text-left">
              <p
                className={cn(
                  'text-sm font-medium transition-colors',
                  paymentMode === 'later' ? 'text-accent-orange' : 'text-gray-500'
                )}
              >
                Pay Later
              </p>
              <p className="text-xs text-neutral-gray">
                Pay at check-in — no card needed now
              </p>
            </div>
          </div>

          <div
            className={cn(
              'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
              paymentMode === 'later'
                ? 'border-accent-orange bg-accent-orange'
                : 'border-gray-300'
            )}
          >
            {paymentMode === 'later' && (
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </div>
        </button>
      </div>

      {/* Slide-up footer — appears when ready */}
      <AnimatePresence>
        {isReady && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl rounded-t-3xl z-40"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          >
            <div className="max-w-[500px] mx-auto px-6 pt-5 pb-6 space-y-3">
              {/* Context summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'p-1.5 rounded-lg',
                      paymentMode === 'now'
                        ? 'bg-positive-green/10'
                        : 'bg-accent-orange/10'
                    )}
                  >
                    {paymentMode === 'now' ? (
                      <CreditCard className="w-4 h-4 text-positive-green" />
                    ) : (
                      <Clock className="w-4 h-4 text-accent-orange" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-gray leading-none">
                      {paymentMode === 'now' ? 'Paying with' : 'Payment method'}
                    </p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {paymentMode === 'now' && selectedCardData
                        ? `${selectedCardData.brand} ···· ${selectedCardData.last4}`
                        : 'Pay at check-in'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (paymentMode === 'now') setSelectedCard(null)
                    else setPaymentMode('now')
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Change selection"
                >
                  <X className="w-4 h-4 text-neutral-gray" />
                </button>
              </div>

              {/* Primary confirm button */}
              <Button
                onClick={paymentMode === 'now' ? handlePayNow : handlePayLater}
                disabled={isBookingLoading}
                className={cn(
                  'w-full h-12 text-white text-base font-semibold rounded-2xl',
                  paymentMode === 'now' ? 'bg-positive-green' : 'bg-accent-orange'
                )}
              >
                {isBookingLoading ? (
                  <Spinner />
                ) : paymentMode === 'now' ? (
                  'Pay Now'
                ) : (
                  'Confirm Booking'
                )}
              </Button>

              {/* Cancel */}
              <Button
                onClick={onCancel}
                disabled={isBookingLoading}
                variant="ghost"
                className="w-full h-10 text-sm text-neutral-gray hover:text-gray-800 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal footer before a card is selected */}
      <AnimatePresence>
        {!isReady && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white border-t z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="max-w-[500px] mx-auto px-6 py-4">
              <p className="text-center text-xs text-neutral-gray mb-3">
                Select a payment method above to continue
              </p>
              <Button
                onClick={onCancel}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-gray hover:text-gray-800 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
