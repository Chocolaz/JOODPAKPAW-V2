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
import Link from 'next/link'
import Image from 'next/image'
import { useMediaQuery } from '@/app/_hooks/useMediaQuery'
import { PageHeaderButtons } from '@/app/_components/property-detail/PageHeaderButtons'
import { toast } from 'sonner'
import { useState } from 'react'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import {
  assetPath,
  cn,
  getApiImageUrl,
  normalizeRoomCategories,
} from '@/lib/utils'
import type { RoomCategories } from '@/types'
import { useAuth } from '@/app/_components/AuthContext'
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
  ExternalLink,
  Share2,
  BedDouble,
  Eye,
} from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
import { RoomCalendarDrawer } from '../_components/RoomCalendarDrawer'

type PropertyHubTab = 'rooms' | 'bookings' | 'preview'

export default function HostPropertyDetailPage() {
  const { property, loading, error, refreshProperty } =
    usePropertyLoader(getHostPropertyById)
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const router = useRouter()

  const [activeSubTab, setActiveSubTab] = useState<PropertyHubTab>('rooms')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isAddRoomDrawerOpen, setIsAddRoomDrawerOpen] = useState(false)
  const [reportReviewId, setReportReviewId] = useState<number | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomCategories | null>(null)
  const [calendarRoom, setCalendarRoom] = useState<RoomCategories | null>(null)
  const [isAppealOpen, setIsAppealOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleShare = async () => {
    if (!property) return
    const publicUrl = `${window.location.origin}${
      process.env.NEXT_PUBLIC_BASE_PATH || ''
    }/detail/${property.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title,
          text: `Check out this property: ${property.title}`,
          url: publicUrl,
        })
      } catch {
        // user dismissed share sheet
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Public listing URL copied to clipboard.')
    }
  }

  const confirmPublishAction = async () => {
    if (!property || isUpdatingStatus) return
    setShowPublishModal(false)
    setIsUpdatingStatus(true)
    try {
      const newStatus = !property.isActive
      await updateHostPropertyIsActive(property.id.toString(), newStatus)
      toast.success(
        `Property successfully ${newStatus ? 'published' : 'unpublished'}.`
      )
      refreshProperty()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update property status.'
      )
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const roomCategoriesCount =
    property && property.roomCategories
      ? Array.isArray(property.roomCategories)
        ? property.roomCategories.length
        : 1
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
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete property.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBack = () => router.push('/profile/host?tab=properties')

  if (loading || isUpdatingStatus || isDeleting) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 pb-16 space-y-5">
        <div className="h-9 w-64 bg-gray-200 rounded-lg animate-pulse motion-reduce:animate-none" />
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 space-y-5 lg:space-y-0">
          <div className="space-y-4">
            <div className="h-12 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
            <div className="h-36 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
            <div className="h-36 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-80 rounded-2xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    )
  }

  if (error) return <ErrorState message={error} />
  if (!property) return <ErrorState message="Property not found." />

  const roomCategoriesArray = normalizeRoomCategories(property.roomCategories)
  const startingPrice =
    roomCategoriesArray.length > 0
      ? Math.min(...roomCategoriesArray.map((r) => r.basePrice))
      : undefined
  const isVerifiedHost = Boolean(user?.isVerifiedHost || profile?.isVerifiedHost)

  const publishModalTitle = property.isActive
    ? 'Unpublish This Property?'
    : 'Publish This Property?'
  const publishModalMessage = property.isActive
    ? `Are you sure you want to unpublish "${property.title}"?<br />It will no longer be visible to the public.`
    : `Are you sure you want to publish "${property.title}"?<br />It will become visible to the public.`

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative pt-4 lg:pt-6 pb-28 lg:pb-12">
      {/* Mobile floating action header only (< lg) */}
      <div className="lg:hidden">
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
      </div>

      {/* Desktop Editorial Breadcrumb Top Bar */}
      <div className="hidden lg:flex items-center justify-between gap-4 pb-5 border-b border-border mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/profile/host?tab=properties"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-medium text-deep-teal hover:bg-off-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Host Listings
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-deep-teal truncate">{property.title}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                  property.isBannedByAdmin
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : property.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-off-white text-neutral-gray border-border'
                )}
              >
                {property.isBannedByAdmin
                  ? 'Suspended'
                  : property.isActive
                  ? 'Published'
                  : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-neutral-gray mt-0.5 truncate">
              {[property.district, property.province, property.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {property.isActive && !property.isBannedByAdmin && (
            <Link
              href={`/detail/${property.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-white text-xs font-medium text-deep-teal hover:bg-off-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Public View
            </Link>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-white text-xs font-medium text-foreground hover:bg-off-white transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={confirmPublishAction}
        title={publishModalTitle}
        message={publishModalMessage}
        titleClassName="text-deep-teal"
        confirmButtonClassName={
          property.isActive ? 'bg-accent-orange' : 'bg-positive-green'
        }
      />
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete This Property?"
        message={`Are you sure you want to permanently delete "${property.title}"? This action cannot be undone.`}
        titleClassName="text-red-600"
        confirmButtonClassName="bg-red-600"
      />

      <UnbanPropertyDrawer
        propertyId={property.id}
        isOpen={isAppealOpen}
        onOpenChange={setIsAppealOpen}
        onSuccess={refreshProperty}
        quota={property.unbanRequestCount ?? 0}
        suspensionReason={property.suspensionReason}
        lastAppealNote={property.lastAppealNote}
      />

      <RoomCalendarDrawer
        propertyId={property.id}
        room={calendarRoom}
        isOpen={!!calendarRoom}
        onOpenChange={(open) => !open && setCalendarRoom(null)}
        onSuccess={refreshProperty}
      />

      {/* Verification Banner (Hallmark warm --off-white + clay shield) */}
      {!isVerifiedHost && (
        <div className="mb-5 bg-off-white border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-14 lg:mt-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 p-1">
              <Image
                src={assetPath('/icons/clay-shield-verify.webp')}
                alt="Verified Host Shield"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-deep-teal">
                Verify your host identity
              </h4>
              <p className="text-xs text-neutral-gray mt-0.5">
                Earn the Verified Host badge to increase booking confidence with pet owners.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/profile/verification')}
            className="shrink-0 px-4 py-2 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
          >
            Verify Identity
          </button>
        </div>
      )}

      {/* Mobile Gallery Hero (< lg) */}
      <div className={cn('lg:hidden mb-4', isVerifiedHost && 'mt-0')}>
        <PropertyImageGallery images={property.images} />
        <div className="mt-3">
          <PropertyHeader property={property} />
        </div>
      </div>

      {/* Main 2-Column Property Management Hub */}
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
        {/* Left Main Content with Sub-Tabs */}
        <div className="min-w-0 space-y-5">
          {/* Mobile Suspension Alert */}
          {property.isBannedByAdmin &&
            (profile?.isBannedAllProperties ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex flex-col gap-2 lg:hidden">
                <div className="flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800">
                      Your account has been suspended
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      Submit an account-level appeal from your host workspace.
                    </p>
                  </div>
                </div>
              </div>
            ) : property.hasPendingUnbanRequest ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-center gap-3 lg:hidden">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Appeal Under Review
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    We will notify you once it has been reviewed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex flex-col gap-3 lg:hidden">
                <div className="flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-red-800">
                        Property Suspended
                      </p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-red-700 border border-red-200 tabular-nums">
                        {Math.max(0, 2 - (property.unbanRequestCount ?? 0))}/2
                      </span>
                    </div>
                    {property.suspensionReason && (
                      <p className="text-xs text-red-700 mt-1">
                        Reason: {property.suspensionReason}
                      </p>
                    )}
                  </div>
                </div>
                {(property.unbanRequestCount ?? 0) < 2 && (
                  <button
                    type="button"
                    onClick={() => setIsAppealOpen(true)}
                    className="w-full text-sm font-semibold text-red-700 bg-white border border-red-300 rounded-xl py-2 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    Submit Appeal
                  </button>
                )}
              </div>
            ))}

          {/* Sub-Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto hide-scrollbar">
            {(
              [
                {
                  id: 'rooms',
                  label: `Rooms & Calendar (${roomCategoriesArray.length})`,
                  icon: BedDouble,
                },
                { id: 'bookings', label: 'Property Bookings', icon: CalendarDays },
                { id: 'preview', label: 'Listing Preview & Reviews', icon: Eye },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon
              const active = activeSubTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors cursor-pointer',
                    active
                      ? 'bg-deep-teal text-white border-deep-teal'
                      : 'bg-off-white/70 text-deep-teal border-border hover:bg-off-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Sub-Tab 1: Rooms & Calendar */}
          {activeSubTab === 'rooms' && (
            <div className="space-y-5">
              {/* Compact Photo Strip on Desktop */}
              {property.images && property.images.length > 0 && (
                <div className="hidden lg:flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-off-white/40">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {property.images.slice(0, 4).map((img, i) => {
                      const src = getApiImageUrl(img.filePath)
                      if (!src) return null
                      return (
                        <div
                          key={img.id}
                          className="relative w-16 h-12 rounded-xl overflow-hidden border border-border shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`${property.title} photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )
                    })}
                    <div className="pl-1">
                      <p className="text-xs font-semibold text-foreground tabular-nums">
                        {property.images.length}{' '}
                        {property.images.length === 1 ? 'photo' : 'photos'} uploaded
                      </p>
                      <p className="text-xs text-neutral-gray">
                        Manage photos in Edit Property
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('preview')}
                    className="px-3.5 py-2 rounded-xl bg-white border border-border text-xs font-semibold text-deep-teal hover:bg-off-white transition-colors shrink-0 cursor-pointer"
                  >
                    Open Full Preview
                  </button>
                </div>
              )}

              {roomCategoriesArray.length > 0 ? (
                <PropertyRoomCategories
                  propertyId={property.id}
                  roomCategories={roomCategoriesArray}
                  onDeleteSuccess={refreshProperty}
                  showDeleteButton={true}
                  onEdit={(cat) => setEditingRoom(cat)}
                  onManageCalendar={(cat) => setCalendarRoom(cat)}
                />
              ) : (
                <div className="rounded-2xl border border-border bg-off-white/40 p-8 text-center space-y-2">
                  <h3 className="text-deep-teal">No room categories yet</h3>
                  <p className="text-xs text-neutral-gray">
                    Add at least one room category before publishing this property.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsAddRoomDrawerOpen(true)}
                className="w-full px-6 py-5 border-2 border-dashed border-positive-green rounded-2xl cursor-pointer hover:bg-off-white transition-colors"
              >
                <div className="font-semibold text-deep-teal text-sm sm:text-base flex items-center justify-between w-full">
                  <span>Add Room Category</span>
                  <Plus className="h-5 w-5 text-positive-green" />
                </div>
              </button>
            </div>
          )}

          {/* Sub-Tab 2: Property Bookings */}
          {activeSubTab === 'bookings' && (
            <PropertyBookingsSection
              propertyId={property.id}
              propertyTitle={property.title}
            />
          )}

          {/* Sub-Tab 3: Listing Preview & Reviews */}
          {activeSubTab === 'preview' && (
            <div className="space-y-6">
              <div className="hidden lg:block">
                <PropertyImageGallery images={property.images} />
                <div className="mt-4">
                  <PropertyHeader property={property} />
                </div>
              </div>

              <PropertyFacilities
                facilities={property.facilities}
                description={property.description}
              />

              <PropertyReviews
                avgRating={property.avgRating}
                reviewCount={property.reviewCount ?? 0}
                reviews={property.reviews}
                onReportReview={(id) => setReportReviewId(id)}
              />

              <PropertyLocation property={property} />
            </div>
          )}
        </div>

        {/* Right: Laptop-Safe Sticky Control Rail (desktop lg+) */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto modern-scrollbar flex flex-col gap-3">
            <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Listing Control
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border',
                    property.isBannedByAdmin
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : property.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-off-white text-neutral-gray border-border'
                  )}
                >
                  {property.isBannedByAdmin ? (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      Suspended
                    </>
                  ) : property.isActive ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Published
                    </>
                  ) : (
                    <>
                      <GlobeLock className="w-3.5 h-3.5" />
                      Draft
                    </>
                  )}
                </span>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-xl overflow-hidden bg-off-white/40">
                {[
                  {
                    icon: Star,
                    label: 'Rating',
                    value:
                      property.avgRating > 0
                        ? property.avgRating.toFixed(1)
                        : '—',
                    color: 'text-amber-500',
                  },
                  {
                    icon: Home,
                    label: 'Rooms',
                    value: roomCategoriesArray.length,
                    color: 'text-deep-teal',
                  },
                  {
                    icon: CalendarDays,
                    label: 'Reviews',
                    value: property.reviewCount ?? 0,
                    color: 'text-accent-orange',
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col items-center py-3 gap-0.5">
                    <Icon className={cn('w-4 h-4', color)} />
                    <p className="text-base font-bold text-foreground leading-none tabular-nums">
                      {value}
                    </p>
                    <p className="text-xs text-neutral-gray">{label}</p>
                  </div>
                ))}
              </div>

              {startingPrice !== undefined && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-xs text-neutral-gray">Starting price</p>
                  <p className="text-base font-bold text-deep-teal tabular-nums">
                    ฿{startingPrice.toLocaleString()} / night
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleGlobeClick}
                  disabled={
                    property.isBannedByAdmin ||
                    (!property.isActive && roomCategoriesCount === 0)
                  }
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                    property.isBannedByAdmin
                      ? 'bg-off-white text-neutral-gray cursor-not-allowed opacity-40'
                      : property.isActive
                      ? 'bg-off-white text-deep-teal border border-border hover:bg-gray-100'
                      : 'bg-deep-teal text-white hover:bg-deep-teal/90',
                    !property.isActive &&
                      roomCategoriesCount === 0 &&
                      'opacity-40 cursor-not-allowed'
                  )}
                >
                  {property.isActive ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      Unpublish to Draft
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Publish Listing
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-off-white transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Property
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddRoomDrawerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-positive-green text-positive-green hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Room Category
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Delete Property
                </button>
              </div>

              {/* Desktop Suspension Info + Appeal */}
              {property.isBannedByAdmin &&
                (profile?.isBannedAllProperties ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Ban className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-800">
                          Account Suspended
                        </p>
                        <p className="text-xs text-red-700 mt-0.5">
                          Submit an account-level appeal from your host workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : property.hasPendingUnbanRequest ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">
                        Appeal Under Review
                      </p>
                    </div>
                    <p className="text-xs text-amber-700">
                      We will notify you once reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-red-800">
                        Suspended Property
                      </p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-red-700 border border-red-200 tabular-nums">
                        {Math.max(0, 2 - (property.unbanRequestCount ?? 0))}/2
                      </span>
                    </div>
                    {property.suspensionReason && (
                      <p className="text-xs text-red-700 leading-relaxed">
                        Reason: {property.suspensionReason}
                      </p>
                    )}
                    {(property.unbanRequestCount ?? 0) < 2 && (
                      <button
                        type="button"
                        onClick={() => setIsAppealOpen(true)}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        Submit Appeal
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Add Room Category — Mobile Drawer */}
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

      {/* Add Room Category — Desktop Dialog */}
      {isDesktop && (
        <Dialog open={isAddRoomDrawerOpen} onOpenChange={setIsAddRoomDrawerOpen}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
            <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
              <DialogTitle className="text-lg text-deep-teal">
                Add Room Category
              </DialogTitle>
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

      {/* Edit property dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
          <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
            <DialogTitle className="text-lg text-deep-teal">
              Edit Property
            </DialogTitle>
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

      {/* Edit Room Category — Mobile Drawer */}
      {!isDesktop && editingRoom && (
        <Drawer
          open={!!editingRoom}
          onOpenChange={(open) => !open && setEditingRoom(null)}
        >
          <DrawerContent>
            <DrawerHeader className="relative">
              <DrawerTitle className="flex items-center gap-2">
                <ChevronLeft
                  className="w-6 h-6 text-neutral-gray cursor-pointer"
                  onClick={() => setEditingRoom(null)}
                />
                <span>Edit Room Category</span>
              </DrawerTitle>
            </DrawerHeader>
            <EditRoomCategoryForm
              propertyId={property.id}
              category={editingRoom}
              onEditSuccess={() => {
                setEditingRoom(null)
                refreshProperty()
              }}
            />
          </DrawerContent>
        </Drawer>
      )}

      {/* Edit Room Category — Desktop Dialog */}
      {isDesktop && (
        <Dialog
          open={!!editingRoom}
          onOpenChange={(open) => !open && setEditingRoom(null)}
        >
          <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col h-[88vh] gap-0">
            <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
              <DialogTitle className="text-lg text-deep-teal">
                Edit Room Category
              </DialogTitle>
            </DialogHeader>
            {editingRoom && (
              <EditRoomCategoryForm
                propertyId={property.id}
                category={editingRoom}
                variant="desktop"
                onEditSuccess={() => {
                  setEditingRoom(null)
                  refreshProperty()
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {reportReviewId !== null && (
        <ReportReviewDrawer
          bookingId={reportReviewId}
          isOpen={reportReviewId !== null}
          onOpenChange={(open) => {
            if (!open) setReportReviewId(null)
          }}
        />
      )}
    </div>
  )
}
