'use client'

import {
  getHostPropertyById,
  updateHostPropertyIsActive,
  deleteProperty,
} from '@/lib/api'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import { usePropertyLoader } from '@/app/_hooks/usePropertyLoader'
import { PropertyImageGallery } from '@/app/_components/property-detail/PropertyImageGallery'
import { PropertyHeader } from '@/app/_components/property-detail/PropertyHeader'
import { PropertyFacilities } from '@/app/_components/property-detail/PropertyFacilities'
import { PropertyLocation } from '@/app/_components/property-detail/PropertyLocation'
import { PropertyReviews } from '@/app/_components/property-detail/PropertyReviews'
import { PropertyRoomCategories } from '@/app/_components/property-detail/PropertyRoomCategories'
import { ReportReviewDrawer } from '@/app/_components/property-detail/ReportReviewDrawer'
import { useRouter } from 'next/navigation'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { PageHeaderButtons } from '@/app/_components/property-detail/PageHeaderButtons'
import { toast } from 'sonner'
import { useState } from 'react'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import { normalizeRoomCategories } from '@/lib/utils'
import type { RoomCategories } from '@/types'
import { useUserProfile } from '@/app/profile/_hooks/useUserProfile'
import { PropertyBookingsSection } from './_components/PropertyBookingsSection'
import { AddRoomCategoryForm } from '../_components/AddRoomCategoryForm'
import {
  Plus,
  ChevronLeft,
  Globe,
  GlobeLock,
  Star,
  CalendarDays,
  Home,
  CheckCircle2,
  XCircle,
  Pencil,
  Ban,
  Clock,
} from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditPropertyForm } from '../_components/EditPropertyForm'
import { EditRoomCategoryForm } from '../_components/EditRoomCategoryForm'
import { UnbanPropertyDrawer } from '../_components/UnbanPropertyDrawer'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: 'easeOut' as const },
  }),
}

export default function HostPropertyDetailPage() {
  const { property, loading, error, refreshProperty } =
    usePropertyLoader(getHostPropertyById)
  const { profile } = useUserProfile()
  const router = useRouter()
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isAddRoomDrawerOpen, setIsAddRoomDrawerOpen] = useState(false)
  const [reportReviewId, setReportReviewId] = useState<number | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomCategories | null>(null)
  const [isAppealOpen, setIsAppealOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleShare = async () => {
    if (navigator.share && property) {
      const publicUrl = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/detail/${property.id}`
      try {
        await navigator.share({ title: property.title, text: `Check out this property: ${property.title}`, url: publicUrl })
      } catch (err: unknown) {
        console.error('Error sharing:', err)
      }
    }
  }

  const confirmPublishAction = async () => {
    if (!property || isUpdatingStatus) return
    setShowPublishModal(false)
    setIsUpdatingStatus(true)
    try {
      const newStatus = !property.isActive
      await updateHostPropertyIsActive(property.id.toString(), newStatus)
      toast.success(`Property successfully ${newStatus ? 'published' : 'unpublished'}.`)
      refreshProperty()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update property status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const roomCategoriesCount =
    property && property.roomCategories
      ? Array.isArray(property.roomCategories) ? property.roomCategories.length : 1
      : 0

  const handleGlobeClick = () => {
    if (!property) return
    if (property.isBannedByAdmin) return
    if (!property.isActive && roomCategoriesCount === 0) {
      toast.error('Please add a room category first.')
      return
    }
    setShowPublishModal(true)
  }

  const confirmDelete = async () => {
    if (!property || isDeleting) return
    setShowDeleteModal(false)
    setIsDeleting(true)
    try {
      await deleteProperty(property.id.toString())
      toast.success('Property deleted successfully.')
      router.push('/profile/host?tab=properties')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete property.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBack = () => router.back()

  if (loading || isUpdatingStatus || isDeleting) return null
  if (error) return <ErrorState message={error} />
  if (!property) return <ErrorState message="Property not found." />

  const roomCategoriesArray = normalizeRoomCategories(property.roomCategories)
  const startingPrice = roomCategoriesArray.length > 0
    ? Math.min(...roomCategoriesArray.map((r) => r.basePrice))
    : undefined

  const publishModalTitle = property.isActive ? 'Unpublish This Property?' : 'Publish This Property?'
  const publishModalMessage = property.isActive
    ? `Are you sure you want to unpublish "${property.title}"?<br />It will no longer be visible to the public.`
    : `Are you sure you want to publish "${property.title}"?<br />It will become visible to the public.`

  return (
    <div className="max-w-6xl mx-auto relative lg:pt-6 pb-32 lg:pb-10">
      {/* Desktop back button (below DesktopNav) */}
      <button
        onClick={handleBack}
        className="hidden lg:flex fixed top-24 xl:top-28 left-6 z-10 items-center gap-1.5 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <PageHeaderButtons
        property={property}
        onBackClick={handleBack}
        onShareClick={handleShare}
        onDeleteClick={() => setShowDeleteModal(true)}
        onGlobeClick={handleGlobeClick}
        isPropertyActive={property.isActive}
        disablePublish={!property.isActive && roomCategoriesCount === 0}
        onDataChange={refreshProperty}
      />

      {/* Modals */}
      <ConfirmationModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={confirmPublishAction}
        title={publishModalTitle}
        message={publishModalMessage}
        titleClassName="text-deep-teal"
        confirmButtonClassName={property.isActive ? 'bg-accent-orange' : 'bg-positive-green'}
      />
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete This Property?"
        message={`Are you sure you want to permanently delete "${property.title}"? This action cannot be undone.`}
        titleClassName="text-red-500"
        confirmButtonClassName="bg-red-500"
      />

      <UnbanPropertyDrawer
        propertyId={property.id}
        isOpen={isAppealOpen}
        onOpenChange={setIsAppealOpen}
        onSuccess={refreshProperty}
      />

      {/* Gallery */}
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <PropertyImageGallery images={property.images} />
      </motion.div>

      {/* Body */}
      <div className="px-4 md:px-8 lg:px-2 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start lg:mt-2">
        {/* Left: content */}
        <div className="min-w-0">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <PropertyHeader property={property} />
          </motion.div>

          {/* Banned banner */}
          {property.isBannedByAdmin && (
            profile?.isBannedAllProperties ? (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3 lg:hidden">
                <Ban className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">Your account has been suspended</p>
                  <p className="text-xs text-red-500 mt-0.5">Submit an account-level appeal from your host dashboard.</p>
                </div>
              </div>
            ) : property.hasPendingUnbanRequest ? (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3 lg:hidden">
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-700">Appeal Under Review</p>
                  <p className="text-xs text-amber-600 mt-0.5">We'll notify you once it's been reviewed.</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex flex-col gap-3 lg:hidden">
                <div className="flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700">This property has been suspended</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      {(property.unbanRequestCount ?? 0) >= 2
                        ? 'Maximum appeals reached.'
                        : 'It is no longer visible to guests. You may submit an appeal to request a review.'}
                    </p>
                  </div>
                </div>
                {(property.unbanRequestCount ?? 0) < 2 && (
                  <button
                    onClick={() => setIsAppealOpen(true)}
                    className="w-full text-sm font-semibold text-red-600 border border-red-300 rounded-xl py-2.5 hover:bg-red-100 transition-colors"
                  >
                    Submit Appeal
                  </button>
                )}
              </div>
            )
          )}

          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
            <PropertyFacilities
              facilities={property.facilities}
              description={property.description}
            />
          </motion.div>

          {/* Room categories + add room */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
            {roomCategoriesArray.length > 0 ? (
              <PropertyRoomCategories
                propertyId={property.id}
                roomCategories={roomCategoriesArray}
                onDeleteSuccess={refreshProperty}
                showDeleteButton={true}
                onEdit={(cat) => setEditingRoom(cat)}
              />
            ) : (
              <div className="border-t pt-8 mt-10">
                <h3 className="mb-3 text-deep-teal">Room Categories</h3>
                <p className="text-neutral-gray mb-4">No room categories added yet.</p>
              </div>
            )}
            <div className={cn('lg:hidden', roomCategoriesArray.length > 0 ? 'mt-4' : '')}>
              <button
                type="button"
                onClick={() => setIsAddRoomDrawerOpen(true)}
                className="w-full px-6 py-5 border-2 border-dashed border-positive-green rounded-xl cursor-pointer hover:bg-green-50/50 transition-colors"
              >
                <div className="font-medium text-deep-teal text-base flex items-center justify-between w-full">
                  <span>Add Room Category</span>
                  <Plus className="h-5 w-5 text-positive-green" />
                </div>
              </button>
            </div>

            {/* Mobile: Drawer */}
            {!isDesktop && (
              <Drawer open={isAddRoomDrawerOpen} onOpenChange={setIsAddRoomDrawerOpen}>
                <DrawerContent>
                  <DrawerHeader className="relative">
                    <DrawerTitle className="flex items-center gap-2">
                      <ChevronLeft
                        className="w-6 h-6 text-neutral-gray cursor-pointer"
                        onClick={() => setIsAddRoomDrawerOpen(false)}
                      />
                      <span>Add Room Category</span>
                    </DrawerTitle>
                  </DrawerHeader>
                  <AddRoomCategoryForm
                    propertyId={property.id}
                    onAddSuccess={() => {
                      setIsAddRoomDrawerOpen(false)
                      refreshProperty()
                    }}
                  />
                </DrawerContent>
              </Drawer>
            )}

            {/* Desktop: Dialog */}
            {isDesktop && (
              <Dialog open={isAddRoomDrawerOpen} onOpenChange={setIsAddRoomDrawerOpen}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
                  <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
                    <DialogTitle className="text-lg text-deep-teal">Add Room Category</DialogTitle>
                  </DialogHeader>
                  <AddRoomCategoryForm
                    propertyId={property.id}
                    variant="desktop"
                    onAddSuccess={() => {
                      setIsAddRoomDrawerOpen(false)
                      refreshProperty()
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}
          </motion.div>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <PropertyReviews
              avgRating={property.avgRating}
              reviewCount={property.reviewCount ?? 0}
              reviews={property.reviews}
              onReportReview={(id) => setReportReviewId(id)}
            />
          </motion.div>

          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <PropertyLocation property={property} />
          </motion.div>

          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <PropertyBookingsSection
              propertyId={property.id}
              propertyTitle={property.title}
            />
          </motion.div>
        </div>

        {/* Right: sticky host management panel (desktop only) */}
        <motion.div
          className="hidden lg:block"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="sticky top-6 flex flex-col gap-3">
            {/* Status card */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Status</p>
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full',
                  property.isBannedByAdmin
                    ? 'bg-red-100 text-red-600'
                    : property.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                )}>
                  {property.isBannedByAdmin
                    ? <><Ban className="w-3.5 h-3.5" /> Suspended</>
                    : property.isActive
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Published</>
                      : <><GlobeLock className="w-3.5 h-3.5" /> Draft</>
                  }
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {[
                  { icon: Star, label: 'Rating', value: property.avgRating > 0 ? property.avgRating.toFixed(1) : '—', color: 'text-yellow-500' },
                  { icon: Home, label: 'Rooms', value: roomCategoriesArray.length, color: 'text-deep-teal' },
                  { icon: CalendarDays, label: 'Reviews', value: property.reviewCount ?? 0, color: 'text-accent-orange' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col items-center py-3 gap-0.5">
                    <Icon className={cn('w-4 h-4', color)} />
                    <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
                    <p className="text-[10px] text-neutral-gray uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {startingPrice && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <p className="text-sm text-neutral-gray">Starting from</p>
                  <p className="text-lg font-bold text-deep-teal">฿{startingPrice.toLocaleString()}</p>
                </div>
              )}

              {/* Publish toggle */}
              <button
                onClick={handleGlobeClick}
                disabled={property.isBannedByAdmin || (!property.isActive && roomCategoriesCount === 0)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition',
                  property.isBannedByAdmin
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                    : property.isActive
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-deep-teal text-white hover:bg-deep-teal/90',
                  !property.isActive && roomCategoriesCount === 0 && 'opacity-40 cursor-not-allowed'
                )}
              >
                {property.isActive
                  ? <><XCircle className="w-4 h-4" /> Unpublish</>
                  : <><Globe className="w-4 h-4" /> Publish</>
                }
              </button>

              {/* Edit button */}
              <button
                onClick={() => setIsEditDialogOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                <Pencil className="w-4 h-4" />
                Edit Property
              </button>

              {/* Add Room Category button */}
              <button
                onClick={() => setIsAddRoomDrawerOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-positive-green text-positive-green hover:bg-green-50 transition"
              >
                <Plus className="w-4 h-4" />
                Add Room Category
              </button>

              {/* Delete button */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition"
              >
                <XCircle className="w-4 h-4" />
                Delete Property
              </button>

              {/* Suspended info + appeal (desktop, banned only) */}
              {property.isBannedByAdmin && (
                profile?.isBannedAllProperties ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <Ban className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-700">Your account has been suspended</p>
                      <p className="text-xs text-red-500 mt-1">Submit an account-level appeal from your host dashboard.</p>
                    </div>
                  </div>
                ) : property.hasPendingUnbanRequest ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-700">Appeal Under Review</p>
                      <p className="text-xs text-amber-600 mt-0.5">We'll notify you once it's been reviewed.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
                    <p className="text-xs text-red-500 leading-relaxed">
                      {(property.unbanRequestCount ?? 0) >= 2
                        ? 'Maximum appeals reached.'
                        : 'It is no longer visible to guests. You may submit an appeal to request a review.'}
                    </p>
                    {(property.unbanRequestCount ?? 0) < 2 && (
                      <button
                        onClick={() => setIsAppealOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-100 transition"
                      >
                        <Ban className="w-4 h-4" />
                        Submit Appeal
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </motion.div>

        {/* Edit property dialog (desktop) */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
            <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
              <DialogTitle className="text-lg text-deep-teal">Edit Property</DialogTitle>
            </DialogHeader>
            <EditPropertyForm
              property={property}
              variant="desktop"
              onSuccess={() => {
                setIsEditDialogOpen(false)
                refreshProperty()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Room Category — Mobile Drawer */}
      {!isDesktop && editingRoom && (
        <Drawer open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
          <DrawerContent>
            <DrawerHeader className="relative">
              <DrawerTitle className="flex items-center gap-2">
                <ChevronLeft className="w-6 h-6 text-neutral-gray cursor-pointer" onClick={() => setEditingRoom(null)} />
                <span>Edit Room Category</span>
              </DrawerTitle>
            </DrawerHeader>
            <EditRoomCategoryForm
              propertyId={property.id}
              category={editingRoom}
              onEditSuccess={() => { setEditingRoom(null); refreshProperty() }}
            />
          </DrawerContent>
        </Drawer>
      )}

      {/* Edit Room Category — Desktop Dialog */}
      {isDesktop && (
        <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
            <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
              <DialogTitle className="text-lg text-deep-teal">Edit Room Category</DialogTitle>
            </DialogHeader>
            {editingRoom && (
              <EditRoomCategoryForm
                propertyId={property.id}
                category={editingRoom}
                variant="desktop"
                onEditSuccess={() => { setEditingRoom(null); refreshProperty() }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

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
