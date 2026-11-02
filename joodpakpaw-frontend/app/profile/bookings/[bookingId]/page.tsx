'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getBookingById, cancelBooking } from '@/lib/api'
import { FullBookingDetail } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import BookingDetailDisplay from './_components/BookingDetailDisplay'
import ReviewSection from './_components/ReviewSection'
import PendingPaymentSection from './_components/PendingPaymentSection'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { ReportPropertyDrawer } from '@/app/_components/property-detail/ReportPropertyDrawer'
import { Flag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function BookingDetailSkeleton() {
  return (
    <div className="container mx-auto max-w-[550px] px-5 pt-4 pb-10 space-y-4">
      {/* Status banner skeleton */}
      <div className="animate-pulse rounded-2xl p-3.5 bg-gray-100 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-gray-200" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-3 bg-gray-200 rounded w-40" />
        </div>
      </div>

      {/* Property card skeleton */}
      <div className="animate-pulse rounded-2xl p-4 bg-gray-50 border border-gray-100 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="w-5 h-5 bg-gray-200 rounded" />
      </div>

      {/* Stay details skeleton */}
      <div className="animate-pulse rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200" />
            <div className="space-y-1.5">
              <div className="h-2.5 bg-gray-200 rounded w-14" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-2.5 bg-gray-200 rounded w-10" />
            </div>
          </div>
          <div className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200" />
            <div className="space-y-1.5">
              <div className="h-2.5 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-2.5 bg-gray-200 rounded w-10" />
            </div>
          </div>
        </div>
        <div className="flex divide-x divide-gray-100 border-t border-gray-100 bg-gray-100/50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 flex items-center justify-center gap-1.5 py-3">
              <div className="w-3.5 h-3.5 rounded bg-gray-200" />
              <div className="h-3.5 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Rooms & pricing skeleton */}
      <div className="animate-pulse rounded-2xl p-4 bg-gray-50 border border-gray-100 space-y-4">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="flex justify-between p-3 bg-gray-100 rounded-xl">
              <div className="space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-3.5 bg-gray-200 rounded w-14" />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between">
          <div className="space-y-1">
            <div className="h-4 bg-gray-200 rounded w-10" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-20" />
        </div>
      </div>

      {/* Booking meta skeleton */}
      <div className="flex gap-2 px-1">
        <div className="animate-pulse h-3 bg-gray-200 rounded w-20" />
        <div className="animate-pulse h-3 bg-gray-200 rounded w-36" />
      </div>
    </div>
  )
}

export default function BookingDetailPage() {
  const { bookingId } = useParams()
  const [bookingDetails, setBookingDetails] =
    useState<FullBookingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const handleBookingUpdate = (updatedFields: Partial<FullBookingDetail>) => {
    setBookingDetails((prevDetails) =>
      prevDetails ? { ...prevDetails, ...updatedFields } : null
    )
  }

  const handleCancelBooking = async () => {
    setIsCancelling(true)
    try {
      if (bookingId) {
        await cancelBooking(bookingId as string)
        toast.success('Booking cancelled successfully.')
        handleBookingUpdate({ bookingStatus: 'cancelled' })
        setIsCancelModalOpen(false)
      }
    } catch (error) {
      toast.error('Failed to cancel booking.')
      console.error(error)
    } finally {
      setIsCancelling(false)
    }
  }

  useEffect(() => {
    if (bookingId) {
      const fetchBookingDetails = async () => {
        try {
          setIsLoading(true)
          const data = await getBookingById(bookingId as string)
          setBookingDetails(data)
        } catch (err) {
          console.error('Failed to fetch booking details:', err)
          setError('Failed to load booking details.')
          toast.error('Failed to load booking details.')
        } finally {
          setIsLoading(false)
        }
      }
      fetchBookingDetails()
    }
  }, [bookingId])

  const status = bookingDetails?.bookingStatus.toUpperCase()
  const isPending = status === 'PENDING'
  const isSuccessful = status === 'SUCCESSFUL'

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <BookingDetailSkeleton />
        </motion.div>
      ) : error ? (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center text-red-500 mt-10"
        >
          <p>{error}</p>
        </motion.div>
      ) : !bookingDetails ? (
        <motion.div
          key="not-found"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center text-gray-500 mt-10"
        >
          <p>No booking details found.</p>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <BookingDetailDisplay bookingDetails={bookingDetails} />

          <div className="container mx-auto max-w-[550px] px-5 space-y-4 pb-8">
            {isPending && (
              <PendingPaymentSection
                bookingId={bookingDetails.id}
                createdAt={bookingDetails.createdAt}
                onPaymentSuccess={() => {
                  handleBookingUpdate({ bookingStatus: 'confirmed' })
                }}
                onExpired={() => {
                  handleBookingUpdate({ bookingStatus: 'cancelled' })
                  toast.error('Booking has been automatically cancelled due to payment timeout.')
                }}
              />
            )}

            {isSuccessful && (
              <ReviewSection
                bookingId={bookingId as string}
                existingRating={bookingDetails.rating}
                existingComment={bookingDetails.comment}
              />
            )}

            {isSuccessful && bookingDetails.bookingOrders[0]?.propertyId && (
              <button
                onClick={() => setReportOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                Report this property
              </button>
            )}

            {isPending && (
              <Button
                className="w-full text-base h-12 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={isCancelling}
              >
                {isCancelling ? <Spinner className="size-4 mr-2" /> : null}
                Cancel Booking
              </Button>
            )}
          </div>

          <ConfirmationModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            onConfirm={handleCancelBooking}
            title="Cancel Booking"
            message="Are you sure you want to cancel this booking? <p/> This action cannot be undone."
            titleClassName="text-destructive"
            confirmButtonClassName="bg-destructive hover:bg-destructive/90"
          />

          {bookingDetails.bookingOrders[0]?.propertyId && (
            <ReportPropertyDrawer
              propertyId={bookingDetails.bookingOrders[0].propertyId}
              isOpen={reportOpen}
              onOpenChange={setReportOpen}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
