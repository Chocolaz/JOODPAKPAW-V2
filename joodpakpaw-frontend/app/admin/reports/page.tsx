'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  getAdminReports,
  getAdminReportById,
  takeReportAction,
  createChatRoom,
} from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import type {
  AdminReportSummary,
  AdminReportDetail,
  ReportAction,
} from '@/types/adminReport'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import {
  ZoomIn,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldOff,
  Trash2,
  Ban,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Star,
  MessageCircle,
} from 'lucide-react'
import { formatDate, formatDateRelative } from '../_utils'
import { StatusBadge } from '../_components/StatusBadge'
import { RefreshBar } from '../_components/RefreshBar'

const POLL_INTERVAL = 30_000
import { UserAvatar } from '../_components/UserAvatar'
import { ImageLightbox } from '../_components/ImageLightbox'
import { InfoRow } from '../_components/InfoRow'
import { AdminPagination } from '../_components/AdminPagination'
import { AdminDetailPanel } from '../_components/AdminDetailPanel'

const STATUS_CONFIG = {
  pending: {
    pill: 'bg-orange-50 text-accent-orange border-orange-200',
    dot: 'bg-accent-orange',
    icon: Clock,
  },
  resolved: {
    pill: 'bg-green-50 text-positive-green border-green-200',
    dot: 'bg-positive-green',
    icon: CheckCircle2,
  },
  dismissed: {
    pill: 'bg-gray-100 text-gray-500 border-gray-200',
    dot: 'bg-gray-400',
    icon: XCircle,
  },
}

type TypeFilter = 'all' | 'property' | 'review' | 'unban_property'
type StatusFilter = 'all' | 'pending' | 'resolved' | 'dismissed'

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All Reports' },
  { key: 'property', label: 'Property Reports' },
  { key: 'review', label: 'Review Reports' },
  { key: 'unban_property', label: 'Host Appeal' },
]

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
]

const ACTION_CONFIG: Record<
  ReportAction,
  {
    label: string
    description: string
    icon: React.ElementType
    buttonClass: string
    confirmClass: string
    appliesTo: Array<'property' | 'review' | 'unban_property'>
  }
> = {
  dismiss_report: {
    label: 'Dismiss Report',
    description:
      'Mark as dismissed — no action taken against the reported content.',
    icon: XCircle,
    buttonClass: 'border border-gray-200 text-gray-600 hover:bg-gray-50',
    confirmClass: 'bg-gray-700 text-white hover:bg-gray-800',
    appliesTo: ['property', 'review', 'unban_property'],
  },
  warn_user: {
    label: 'Warn User',
    description:
      'Send a warning notification to the responsible user.',
    icon: AlertTriangle,
    buttonClass:
      'border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100',
    confirmClass: 'bg-amber-600 text-white hover:bg-amber-700',
    appliesTo: ['property', 'review'],
  },
  deactivate_property: {
    label: 'Deactivate Property',
    description:
      'Ban this property — host cannot reactivate it. All bookings will be cancelled.',
    icon: Ban,
    buttonClass:
      'border border-red-200 text-red-700 bg-red-50 hover:bg-red-100',
    confirmClass: 'bg-red-600 text-white hover:bg-red-700',
    appliesTo: ['property'],
  },
  deactivate_all_properties: {
    label: 'Deactivate All Properties',
    description:
      'Ban all properties owned by this host. All bookings across every property will be cancelled.',
    icon: ShieldOff,
    buttonClass:
      'border border-red-200 text-red-700 bg-red-50 hover:bg-red-100',
    confirmClass: 'bg-red-700 text-white hover:bg-red-800',
    appliesTo: ['property'],
  },
  delete_review: {
    label: 'Delete Review',
    description: 'Resolve report and permanently delete the review.',
    icon: Trash2,
    buttonClass:
      'border border-red-200 text-red-700 bg-red-50 hover:bg-red-100',
    confirmClass: 'bg-red-600 text-white hover:bg-red-700',
    appliesTo: ['review'],
  },
  unban_property: {
    label: 'Unban Property',
    description:
      'Lift the ban on this property — host will be able to reactivate it.',
    icon: CheckCircle2,
    buttonClass:
      'border border-green-200 text-green-700 bg-green-50 hover:bg-green-100',
    confirmClass: 'bg-positive-green text-white hover:bg-green-600',
    appliesTo: ['unban_property'],
  },
  unban_all_properties: {
    label: 'Unban All Properties',
    description: 'Lift the ban on all properties owned by this host.',
    icon: CheckCircle2,
    buttonClass:
      'border border-green-200 text-green-700 bg-green-50 hover:bg-green-100',
    confirmClass: 'bg-positive-green text-white hover:bg-green-600',
    appliesTo: ['unban_property'],
  },
}

const ACTION_PRESETS: Record<ReportAction, string[]> = {
  deactivate_property: [
    'Severe violation of safety standards',
    'Multiple verified pet hygiene complaints',
    'Misrepresentation of facility capabilities',
    'Unresponsive host during pet incident',
  ],
  deactivate_all_properties: [
    'Critical platform policy violation by host',
    'Host account banned due to fraudulent activities',
    'Severe repeated guest complaints across listings',
  ],
  warn_user: [
    'First warning: please adhere to marketplace guidelines',
    'Maintain accurate facility photos and description',
    'Ensure timely daily updates to pet owners',
  ],
  delete_review: [
    'Review contains vulgar or abusive language',
    'Review contains irrelevant competitor advertisement',
    'Review violates privacy policies by sharing PII',
  ],
  unban_property: [
    'Host submitted verified proof of facility improvements',
    'Corrective action plan reviewed and accepted',
    'Suspension lifted upon successful appeal',
  ],
  unban_all_properties: [
    'Account compliance verified upon comprehensive review',
    'Host successfully fulfilled appeal requirements',
    'Global suspension revoked',
  ],
  dismiss_report: [
    'Insufficient evidence of violation',
    'Reported content conforms to platform policies',
    'Matter resolved between parties amicably',
  ],
}

function normalizeReportType(
  rawType?: string | null,
  detail?: Partial<AdminReportDetail>
): 'property' | 'review' | 'unban_property' {
  const t = (rawType ?? '').toLowerCase().trim()
  if (t === 'property' || t === 'report_property' || t === 'property_report') {
    return 'property'
  }
  if (t === 'review' || t === 'report_review' || t === 'review_report') {
    return 'review'
  }
  if (t === 'unban' || t === 'unban_property' || t === 'appeal') {
    return 'unban_property'
  }
  if (detail?.reportedReview) return 'review'
  if (detail?.property) return 'property'
  return 'unban_property'
}

// ── Report Detail Panel ───────────────────────────────────────────────────────
function ReportPanel({
  id,
  onClose,
  onUpdated,
}: {
  id: number
  onClose: () => void
  onUpdated: () => void
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [detail, setDetail] = useState<AdminReportDetail | null>(null)
  const [contacting, setContacting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<{
    src: string
    label: string
  } | null>(null)
  const [pendingAction, setPendingAction] = useState<ReportAction | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [acting, setActing] = useState(false)
  const [showDangerConfirm, setShowDangerConfirm] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAdminReportById(id)
      .then((res) =>
        setDetail({
          ...res,
          type: normalizeReportType(res.type, res),
        })
      )
      .catch(() => toast.error('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleContactReporter = async () => {
    if (!detail || contacting) return
    setContacting(true)
    try {
      const room = await createChatRoom(
        detail.reporter.id,
        `Hi ${detail.reporter.firstName}, I'm reaching out from JoodPakPaw Admin regarding Report #${detail.id} (${detail.reportCategoryLabel}).`
      )
      router.push(`/chat/${room.id}?from=/admin/reports`)
    } catch {
      toast.error('Failed to open chat with reporter.')
    } finally {
      setContacting(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!detail || !pendingAction) return
    setActing(true)
    try {
      await takeReportAction(id, pendingAction, adminNote.trim() || undefined)
      toast.success(`Action taken: ${ACTION_CONFIG[pendingAction].label}`)
      onUpdated()
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to take action.')
    } finally {
      setActing(false)
    }
  }

  const handleCancelAction = () => {
    setPendingAction(null)
    setAdminNote('')
    setShowDangerConfirm(false)
  }

  const handleConfirmClick = () => {
    if (pendingAction === 'deactivate_all_properties') {
      setShowDangerConfirm(true)
    } else {
      handleConfirmAction()
    }
  }

  const cfg = detail
    ? STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG]
    : null

  const stripeColor = !detail
    ? 'bg-gray-200'
    : detail.status === 'pending'
      ? 'bg-accent-orange'
      : detail.status === 'resolved'
        ? 'bg-positive-green'
        : 'bg-gray-400'

  const panelHeader = (
    <>
      <div className="min-w-0">
        <p className="font-semibold text-[15px] text-gray-900 font-baloo2 leading-tight">
          Report #{id}
        </p>
        {detail && (
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {detail.type} · {detail.reportCategoryLabel}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {detail && cfg && (
          <StatusBadge status={detail.status} statusConfig={STATUS_CONFIG} />
        )}
      </div>
    </>
  )

  return (
    <>
      <AdminDetailPanel
        stripeColor={stripeColor}
        header={panelHeader}
        onClose={onClose}
        width="w-[500px]"
      >
        {loading ? (
          <div className="p-6 flex flex-col gap-5">
            {[60, 80, 100, 120].map((h, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-xl animate-pulse"
                style={{ height: h }}
              />
            ))}
          </div>
        ) : detail ? (
          <div className="px-6 py-5 flex flex-col gap-6">
            {/* Reporter */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Reported By
              </p>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <UserAvatar user={detail.reporter} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-semibold text-gray-900">
                      {detail.reporter.firstName} {detail.reporter.lastName}
                    </p>
                    {detail.type === 'property' && detail.isVerifiedGuest && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        Verified Guest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {detail.reporter.email} · #{detail.reporter.id}
                  </p>
                </div>
                {detail.reporter.id !== user?.id && (
                  <button
                    type="button"
                    onClick={handleContactReporter}
                    disabled={contacting}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-deep-teal hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {contacting ? 'Opening...' : 'Message'}
                  </button>
                )}
              </div>
            </section>

            {/* Target info */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {detail.type === 'property'
                  ? 'Reported Property'
                  : detail.type === 'unban_property'
                    ? 'Appeal Details'
                    : 'Reported Review'}
              </p>
              <dl className="divide-y divide-gray-100 bg-gray-50 rounded-xl border border-gray-100 px-4">
                {(detail.type === 'property' ||
                  detail.type === 'unban_property') &&
                  detail.property && (
                    <>
                      <InfoRow
                        label="Property"
                        value={`${detail.property.title} (#${detail.property.id})`}
                      />
                      {detail.propOwner && (
                        <InfoRow
                          label="Host"
                          value={`${detail.propOwner.firstName} ${detail.propOwner.lastName}`}
                          sub={detail.propOwner.email}
                        />
                      )}
                    </>
                  )}
                {detail.type === 'unban_property' && !detail.property && (
                  <InfoRow
                    label="Host"
                    value={`${detail.reporter.firstName} ${detail.reporter.lastName}`}
                    sub={detail.reporter.email}
                  />
                )}
                {detail.type === 'review' && (
                  <>
                    {detail.reviewAuthor && (
                      <InfoRow
                        label="Review by"
                        value={`${detail.reviewAuthor.firstName} ${detail.reviewAuthor.lastName}`}
                        sub={detail.reviewAuthor.email}
                      />
                    )}
                    {detail.property && (
                      <InfoRow
                        label="On property"
                        value={`${detail.property.title} (#${detail.property.id})`}
                      />
                    )}
                  </>
                )}
                <InfoRow label="Category" value={detail.reportCategoryLabel} />
                <InfoRow
                  label="Reported"
                  value={formatDate(detail.createdAt)}
                />
                <InfoRow label="Status" value={detail.status} />
                {detail.resolvedAction && (
                  <InfoRow
                    label="Action taken"
                    value={detail.resolvedAction.replace(/_/g, ' ')}
                  />
                )}
              </dl>
            </section>

            {/* Reported Review Content card (for review reports) */}
            {detail.type === 'review' && detail.reportedReview && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Reported Review Content
                  </p>
                  <span className="text-[11px] text-gray-400 font-mono">
                    Booking #{detail.reportedReview.bookingId}
                  </span>
                </div>
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < (detail.reportedReview?.rating ?? 0)
                              ? 'text-accent-orange fill-accent-orange'
                              : 'text-gray-200 fill-gray-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-gray-700 ml-1.5">
                        {detail.reportedReview.rating ?? 'N/A'}/5
                      </span>
                    </div>
                    {detail.reportedReview.reviewedAt && (
                      <span className="text-xs text-gray-400">
                        {formatDate(detail.reportedReview.reviewedAt)}
                      </span>
                    )}
                  </div>

                  {detail.reportedReview.comment ? (
                    <p className="text-sm text-gray-800 leading-relaxed bg-white/80 rounded-lg p-3 border border-amber-100">
                      {detail.reportedReview.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No text comment provided.</p>
                  )}

                  {detail.reportedReview.images && detail.reportedReview.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {detail.reportedReview.images.map((imgSrc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightbox({ src: imgSrc, label: `Review photo ${idx + 1}` })}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in"
                        >
                          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {detail.reportedReview.hostReply && (
                    <div className="bg-white/90 border border-gray-200 rounded-lg p-3 mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-deep-teal">Host Reply:</span>
                        {detail.reportedReview.hostRepliedAt && (
                          <span className="text-[10px] text-gray-400">
                            {formatDate(detail.reportedReview.hostRepliedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed italic">
                        &ldquo;{detail.reportedReview.hostReply}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Suspension & Appeal History (for Host Appeals) */}
            {detail.type === 'unban_property' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Suspension &amp; Appeal History
                  </p>
                  {detail.suspensionContext && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      Attempt {detail.suspensionContext.appealAttempt} of {detail.suspensionContext.maxAppeals || 2}
                    </span>
                  )}
                </div>
                <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-4 flex flex-col gap-2.5">
                  {(detail.suspensionContext?.priorBanReason || detail.suspensionReason) && (
                    <div>
                      <p className="text-xs font-semibold text-red-900">Original Suspension Reason:</p>
                      <p className="text-xs text-red-800 leading-relaxed mt-0.5 bg-white/70 rounded-lg p-2.5 border border-red-100">
                        {detail.suspensionContext?.priorBanReason || detail.suspensionReason}
                      </p>
                    </div>
                  )}
                  {detail.suspensionContext?.priorBannedAt && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Suspended on:</span>
                      <span className="font-medium text-gray-700">
                        {formatDate(detail.suspensionContext.priorBannedAt)}
                      </span>
                    </div>
                  )}
                  {detail.lastAppealNote && (
                    <div className="mt-1">
                      <p className="text-xs font-semibold text-gray-800">Prior Appeal Decision Note:</p>
                      <p className="text-xs text-gray-600 leading-relaxed mt-0.5 bg-white/70 rounded-lg p-2.5 border border-gray-200 italic">
                        &ldquo;{detail.lastAppealNote}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Description */}
            {detail.description && (
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Reporter&apos;s Description
                </p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-2 border-l-gray-400">
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    &ldquo;{detail.description}&rdquo;
                  </p>
                </div>
              </section>
            )}

            {/* Admin note */}
            {detail.adminNote && (
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Admin Note
                </p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {detail.adminNote}
                  </p>
                </div>
              </section>
            )}

            {/* Images */}
            {detail.images && detail.images.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Attached Images ({detail.images.length})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {detail.images.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: img.filePath,
                          label: `Image ${idx + 1}`,
                        })
                      }
                      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 group cursor-zoom-in w-full"
                    >
                      <img
                        src={img.filePath}
                        alt={`Report image ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Actions — pending only */}
            {detail.status === 'pending' && (
              <section className="pb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Take Action
                </p>

                {pendingAction ? (
                  // Confirmation view
                  <div className="flex flex-col gap-3">
                    {pendingAction === 'deactivate_all_properties' ? (
                      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldOff className="w-4 h-4 text-red-600 shrink-0" />
                          <p className="text-sm font-bold text-red-700">
                            {ACTION_CONFIG[pendingAction].label}
                          </p>
                          <span className="ml-auto text-[10px] font-bold bg-red-200 text-red-700 px-2 py-0.5 rounded-full tracking-wider uppercase">
                            Danger
                          </span>
                        </div>
                        <p className="text-xs text-red-600 leading-relaxed">
                          {ACTION_CONFIG[pendingAction].description}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          {pendingAction === 'dismiss_report' && detail.type === 'unban_property'
                            ? 'Reject Appeal'
                            : pendingAction === 'warn_user' && detail.type === 'review'
                              ? 'Warn Review Author'
                              : ACTION_CONFIG[pendingAction].label}
                        </p>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {pendingAction === 'dismiss_report' && detail.type === 'unban_property'
                            ? 'Reject this unban appeal. The host will be notified and their appeal quota (1/2, 2/2) will be updated.'
                            : ACTION_CONFIG[pendingAction].description}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                        Admin note{' '}
                        <span className="text-red-400">*required</span>
                      </label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder={
                          detail.type === 'unban_property'
                            ? 'Explain your decision to the host…'
                            : 'Internal note about this decision…'
                        }
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
                      />
                      {pendingAction && ACTION_PRESETS[pendingAction] && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ACTION_PRESETS[pendingAction].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setAdminNote(preset)}
                              className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition cursor-pointer text-left"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleCancelAction}
                        disabled={acting}
                        className="py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmClick}
                        disabled={acting || !adminNote.trim()}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${ACTION_CONFIG[pendingAction].confirmClass}`}
                      >
                        {acting ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          React.createElement(
                            ACTION_CONFIG[pendingAction].icon,
                            { className: 'w-4 h-4' }
                          )
                        )}
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  // Action buttons
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      Object.entries(ACTION_CONFIG) as [
                        ReportAction,
                        (typeof ACTION_CONFIG)[ReportAction],
                      ][]
                    )
                      .filter(([action, cfg]) => {
                        if (!cfg.appliesTo.includes(detail.type)) return false
                        if (detail.type === 'unban_property') {
                          const isUnbanAll =
                            detail.reportCategoryLabel ===
                            'Unban All Properties'
                          if (isUnbanAll) return action !== 'unban_property'
                          return action !== 'unban_all_properties'
                        }
                        return true
                      })
                      .map(([action, cfg]) => {
                        const Icon = cfg.icon
                        const isDanger = action === 'deactivate_all_properties'
                        const displayLabel =
                          action === 'dismiss_report' && detail.type === 'unban_property'
                            ? 'Reject Appeal'
                            : action === 'warn_user' && detail.type === 'review'
                              ? 'Warn Author'
                              : cfg.label
                        return (
                          <button
                            key={action}
                            onClick={() => setPendingAction(action)}
                            className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${isDanger ? 'bg-red-600 text-white hover:bg-red-700 border-2 border-red-800/30' : cfg.buttonClass}`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="text-left">{displayLabel}</span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            Failed to load report details.
          </div>
        )}
      </AdminDetailPanel>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}

      <ConfirmationModal
        isOpen={showDangerConfirm}
        onClose={() => setShowDangerConfirm(false)}
        onConfirm={() => {
          setShowDangerConfirm(false)
          handleConfirmAction()
        }}
        title="Deactivate All Properties?"
        message="This will <strong>ban every property</strong> this host owns and <strong>cancel all bookings</strong>. This cannot be undone automatically."
        titleClassName="text-red-600"
        confirmButtonClassName="bg-red-600 hover:bg-red-700 text-white"
      />
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminReportsPage() {
  const [type, setType] = useState<TypeFilter>('property')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [orderBy, setOrderBy] = useState('createdAt')
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')
  const [data, setData] = useState<AdminReportSummary[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [serverPendingCount, setServerPendingCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const LIMIT = 20

  const handleSort = (col: string) => {
    if (orderBy === col) setSort((s) => (s === 'asc' ? 'desc' : 'asc'))
    else {
      setOrderBy(col)
      setSort('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (orderBy !== col)
      return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return sort === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-accent-orange" />
    ) : (
      <ChevronDown className="w-3 h-3 text-accent-orange" />
    )
  }

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await getAdminReports({
        type: type === 'all' ? undefined : type,
        status: status === 'all' ? undefined : status,
        page,
        limit: LIMIT,
        orderBy,
        sort,
      })
      setData(res.data)
      setTotalRows(res.totalRows)
      setTotalPages(res.totalPages)
      if (res.attributes?.pendingCount !== undefined) {
        setServerPendingCount(res.attributes.pendingCount)
      }
      setLastUpdated(new Date())
    } catch {
      if (!silent) toast.error('Failed to load reports.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [type, status, page, orderBy, sort])

  useEffect(() => {
    setPage(1)
    setSelectedId(null)
  }, [type, status])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const pendingCount =
    serverPendingCount !== null
      ? serverPendingCount
      : data.filter((d) => d.status === 'pending').length

  return (
    <div>
      <RefreshBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={fetchData} />
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: 'Total reports', value: totalRows, accent: false },
          { label: 'Pending review', value: pendingCount, accent: true },
          { label: 'Showing', value: data.length, accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 px-5 py-4"
          >
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            <p
              className={`text-3xl font-bold font-baloo2 leading-none ${
                accent && value > 0 ? 'text-accent-orange' : 'text-gray-900'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200 pb-4">
        {TYPE_TABS.map((tab) => {
          const active = type === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setType(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-5">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.key
          const cfg = STATUS_CONFIG[tab.key as keyof typeof STATUS_CONFIG]
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                active
                  ? tab.key === 'all'
                    ? 'bg-gray-900 text-white'
                    : cfg
                      ? `border ${cfg.pill}`
                      : 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {type === 'all' ? (
                <>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon col="status" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="flex items-center gap-1">
                      Date <SortIcon col="createdAt" />
                    </span>
                  </th>
                  <th className="px-4 py-3" />
                </>
              ) : type === 'property' || type === 'unban_property' ? (
                <>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  {type === 'property' && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Reports
                    </th>
                  )}
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon col="status" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="flex items-center gap-1">
                      Date <SortIcon col="createdAt" />
                    </span>
                  </th>
                  <th className="px-4 py-3" />
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Review Author
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon col="status" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="flex items-center gap-1">
                      Date <SortIcon col="createdAt" />
                    </span>
                  </th>
                  <th className="px-4 py-3" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({
                    length: type === 'property' ? 7 : type === 'all' ? 7 : 6,
                  }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div
                        className="h-3.5 bg-gray-100 rounded-full animate-pulse"
                        style={{ width: `${[48, 60, 40, 20, 30, 35, 18][j]}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={type === 'property' || type === 'all' ? 7 : 6}
                  className="px-4 py-16 text-center"
                >
                  <p className="text-sm font-semibold text-gray-700 font-baloo2">
                    No reports found
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Try a different filter
                  </p>
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isPending = row.status === 'pending'
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors group relative"
                  >
                    {/* Reporter */}
                    <td className="px-4 py-3.5 relative">
                      {isPending && (
                        <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full bg-accent-orange" />
                      )}
                      <div className="flex items-center gap-2">
                        <UserAvatar user={row.reporter} size="xs" />
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900 leading-tight">
                            {row.reporter.firstName} {row.reporter.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            User ID: {row.reporter.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {type === 'all' ? (
                      <>
                        <td className="px-4 py-3.5">
                          {row.property ? (
                            <div>
                              <p className="text-[13px] font-medium text-gray-800 leading-tight">
                                {row.property.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                Property ID: {row.property.id}
                              </p>
                            </div>
                          ) : row.reviewAuthor ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar user={row.reviewAuthor} size="xs" />
                              <p className="text-[13px] font-medium text-gray-800 leading-tight">
                                {row.reviewAuthor.firstName}{' '}
                                {row.reviewAuthor.lastName}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              row.type === 'unban_property'
                                ? 'bg-amber-100 text-amber-700'
                                : row.type === 'review'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {row.type === 'unban_property'
                              ? 'Appeal'
                              : row.type === 'review'
                                ? 'Review'
                                : 'Property'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                            {row.reportCategoryLabel}
                          </span>
                        </td>
                      </>
                    ) : type === 'property' || type === 'unban_property' ? (
                      <>
                        <td className="px-4 py-3.5">
                          {row.property ? (
                            <div>
                              <p className="text-[13px] font-medium text-gray-800 leading-tight">
                                {row.property.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                Property ID: {row.property.id}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                            {row.reportCategoryLabel}
                          </span>
                        </td>
                        {type === 'property' && (
                          <td className="px-4 py-3.5">
                            {row.reportCount != null && row.reportCount > 0 ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                  row.reportCount >= 3
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {row.reportCount >= 3 && '⚑ '}
                                {row.reportCount}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3.5">
                          {row.reviewAuthor ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar user={row.reviewAuthor} size="xs" />
                              <div>
                                <p className="text-[13px] font-medium text-gray-800 leading-tight">
                                  {row.reviewAuthor.firstName}{' '}
                                  {row.reviewAuthor.lastName}
                                </p>
                                <p className="text-xs text-gray-400">
                                  User ID: {row.reviewAuthor.id}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                            {row.reportCategoryLabel}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={row.status}
                        statusConfig={STATUS_CONFIG}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-gray-800">
                        {formatDateRelative(row.createdAt)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(row.createdAt)}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-medium text-gray-400 group-hover:text-accent-orange transition-colors">
                        {isPending ? 'Review →' : 'View →'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          limit={LIMIT}
          onPageChange={setPage}
        />
      </div>

      {selectedId !== null && (
        <ReportPanel
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  )
}
