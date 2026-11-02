'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Eye, Pencil } from 'lucide-react'
import { getHostProfile, getHostReviews } from '@/lib/api'
import { HostProfile, HostReview } from '@/types/hostProfile'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { useAuth } from '@/app/_components/AuthContext'
import { HostProfileSkeleton } from './_components/HostProfileSkeleton'
import { HostProfileHero } from './_components/HostProfileHero'
import { HostPropertiesSection } from './_components/HostPropertiesSection'
import { HostReviewsSection } from './_components/HostReviewsSection'
import { ReportReviewDrawer } from '@/app/_components/property-detail/ReportReviewDrawer'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: 'easeOut' as const },
  }),
}

export default function HostProfilePage() {
  const { hostId } = useParams<{ hostId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const { user } = useAuth()
  const isOwner = !!user && String(user.id) === hostId

  const [host, setHost] = useState<HostProfile | null>(null)
  const [chatRoomId, setChatRoomId] = useState<number | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [reportReviewId, setReportReviewId] = useState<number | null>(null)
  const [reviews, setReviews] = useState<HostReview[]>([])
  const [reviewPage, setReviewPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(true)

  // Initial parallel fetch
  useEffect(() => {
    if (!hostId) return
    setProfileLoading(true)
    setReviewsLoading(true)

    Promise.allSettled([
      getHostProfile(hostId),
      getHostReviews(hostId, 1, 6),
    ]).then(([profileResult, reviewsResult]) => {
      if (profileResult.status === 'fulfilled') {
        setHost(profileResult.value.host)
        setChatRoomId(profileResult.value.host.chatRoomId ?? null)
      } else {
        setProfileError('Failed to load host profile.')
      }
      setProfileLoading(false)

      if (reviewsResult.status === 'fulfilled') {
        setReviews(reviewsResult.value.data)
        setTotalPages(reviewsResult.value.totalPages)
        setTotalRows(reviewsResult.value.totalRows)
      }
      setReviewsLoading(false)
    })
  }, [hostId])

  // Paginated review fetch
  const handlePageChange = (page: number) => {
    if (!hostId || page === reviewPage) return
    setReviewPage(page)
    setReviewsLoading(true)
    getHostReviews(hostId, page, 6)
      .then((res) => {
        setReviews(res.data)
        setTotalPages(res.totalPages)
        setTotalRows(res.totalRows)
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false))
  }

  const handleSeeAll = () => {
    if (!hostId) return
    setReviewsLoading(true)
    getHostReviews(hostId, 1, totalRows)
      .then((res) => {
        setReviews(res.data)
        setTotalPages(1)
        setReviewPage(1)
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false))
  }

  if (profileLoading) return <HostProfileSkeleton />
  if (profileError || !host) return <ErrorState message={profileError ?? 'Host not found.'} />

  return (
    <div className="max-w-5xl mx-auto pb-24 lg:pb-10 lg:-mt-20 xl:-mt-24 relative">
      {/* Back button */}
      <button
        onClick={() => router.push(from ?? '/')}
        className="fixed top-4 left-4 z-10 flex items-center gap-1.5 pl-2 pr-3 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white hover:shadow-lg transition-all text-sm font-medium text-gray-700"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Owner preview banner */}
      {isOwner && (
        <div className="fixed top-4 right-4 z-10 md:left-1/2 md:right-auto md:-translate-x-1/2 flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-md text-sm font-medium whitespace-nowrap text-gray-700">
          <Eye className="w-4 h-4 shrink-0 text-deep-teal" />
          <span>Previewing your public profile</span>
          <button
            onClick={() => router.push('/profile/host')}
            className="flex items-center gap-1 pl-2.5 border-l border-gray-200 text-deep-teal hover:text-deep-teal/70 transition text-xs font-medium"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      )}

      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <HostProfileHero host={host} chatRoomId={chatRoomId} onChatCreated={setChatRoomId} />
      </motion.div>

      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <HostPropertiesSection properties={host.properties} />
      </motion.div>

      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
        <HostReviewsSection
          reviews={reviews}
          page={reviewPage}
          totalPages={totalPages}
          totalRows={totalRows}
          avgRating={host.avgRating}
          reviewCount={host.reviewCount}
          loading={reviewsLoading}
          onPageChange={handlePageChange}
          onSeeAll={handleSeeAll}
          onReport={isOwner ? (id) => setReportReviewId(id) : undefined}
        />
      </motion.div>
      {reportReviewId !== null && (
        <ReportReviewDrawer
          bookingId={reportReviewId}
          isOpen={reportReviewId !== null}
          onOpenChange={(open) => { if (!open) setReportReviewId(null) }}
        />
      )}
    </div>
  )
}
