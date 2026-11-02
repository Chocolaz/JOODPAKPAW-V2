'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  getAdminVerifications,
  getAdminVerificationById,
  approveVerification,
  rejectVerification,
} from '@/lib/api'
import type {
  AdminVerificationSummary,
  AdminVerificationDetail,
} from '@/types/adminVerification'
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ZoomIn,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { formatDate, formatDateRelative } from '../_utils'
import { RefreshBar } from '../_components/RefreshBar'

const POLL_INTERVAL = 30_000
import { StatusBadge } from '../_components/StatusBadge'
import { UserAvatar } from '../_components/UserAvatar'
import { ImageLightbox } from '../_components/ImageLightbox'
import { AdminPagination } from '../_components/AdminPagination'
import { AdminDetailPanel } from '../_components/AdminDetailPanel'

const STATUS_CONFIG = {
  pending: {
    pill: 'bg-orange-50 text-accent-orange border-orange-200',
    dot: 'bg-accent-orange',
    icon: Clock,
    stripe: 'bg-accent-orange',
  },
  approved: {
    pill: 'bg-green-50 text-positive-green border-green-200',
    dot: 'bg-positive-green',
    icon: ShieldCheck,
    stripe: 'bg-positive-green',
  },
  rejected: {
    pill: 'bg-red-50 text-red-500 border-red-200',
    dot: 'bg-red-400',
    icon: ShieldX,
    stripe: 'bg-red-400',
  },
}

// ── Side Panel ───────────────────────────────────────────────────────────────
function VerificationPanel({
  id,
  onClose,
  onUpdated,
}: {
  id: number
  onClose: () => void
  onUpdated: () => void
}) {
  const [detail, setDetail] = useState<AdminVerificationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [lightbox, setLightbox] = useState<{
    src: string
    label: string
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminVerificationById(id)
      .then((res) => setDetail(res.verification))
      .catch(() => toast.error('Failed to load verification.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleApprove = async () => {
    if (!detail) return
    setActing(true)
    try {
      await approveVerification(detail.id)
      toast.success(
        `${detail.user.firstName} ${detail.user.lastName} is now verified.`
      )
      onUpdated()
      onClose()
    } catch {
      toast.error('Failed to approve.')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!detail || !rejectReason.trim()) {
      toast.error('Rejection reason is required.')
      return
    }
    setActing(true)
    try {
      await rejectVerification(detail.id, rejectReason.trim())
      toast.success('Rejected — host has been notified.')
      onUpdated()
      onClose()
    } catch {
      toast.error('Failed to reject.')
    } finally {
      setActing(false)
    }
  }

  const cfg = detail
    ? STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG]
    : null

  const stripeColor = !detail
    ? 'bg-gray-200'
    : detail.status === 'pending'
      ? 'bg-accent-orange'
      : detail.status === 'approved'
        ? 'bg-positive-green'
        : 'bg-red-400'

  const panelHeader = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        {detail && <UserAvatar user={detail.user} size="md" />}
        <div className="min-w-0">
          {detail ? (
            <>
              <p className="font-semibold text-[15px] text-gray-900 font-baloo2 leading-tight truncate">
                {detail.user.firstName} {detail.user.lastName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {detail.user.email}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-gray-500">
              Verification #{id}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {detail && cfg && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
          </span>
        )}
      </div>
    </>
  )

  const resubmitNotice = detail?.isResubmit ? (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
      <RotateCcw className="w-3.5 h-3.5 text-accent-orange shrink-0" />
      <p className="text-xs text-accent-orange font-medium">
        Resubmission — previous rejection reason shown below
      </p>
    </div>
  ) : undefined

  return (
    <>
      <AdminDetailPanel
        stripeColor={stripeColor}
        header={panelHeader}
        headerExtra={resubmitNotice}
        onClose={onClose}
      >
        {loading ? (
          <div className="p-6 flex flex-col gap-5">
            {[60, 48, 120, 100].map((h, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-xl animate-pulse"
                style={{ height: h }}
              />
            ))}
          </div>
        ) : detail ? (
          <div className="px-6 py-5 flex flex-col gap-6">
            {/* Info rows */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Details
              </p>
              <dl className="divide-y divide-gray-100">
                {[
                  { label: 'Verification ID', value: `#${detail.id}` },
                  { label: 'User ID', value: `#${detail.user.id}` },
                  { label: 'Submitted', value: formatDate(detail.submittedAt) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-2.5"
                  >
                    <dt className="text-sm text-gray-500">{label}</dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Previous rejection */}
            {detail.previousRejectDescription && (
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Previous Rejection
                </p>
                <div className="border-l-2 border-accent-orange pl-4 py-1">
                  <p className="text-sm text-gray-600 italic leading-relaxed">
                    &ldquo;{detail.previousRejectDescription}&rdquo;
                  </p>
                </div>
              </section>
            )}

            {/* Rejection reason */}
            {detail.status === 'rejected' && detail.rejectDescription && (
              <section>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Rejection Reason
                </p>
                <div className="border-l-2 border-red-400 pl-4 py-1">
                  <p className="text-sm text-red-600 italic leading-relaxed">
                    &ldquo;{detail.rejectDescription}&rdquo;
                  </p>
                </div>
              </section>
            )}

            {/* Photos */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Submitted Photos
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'ID Photo', src: detail.idPhoto },
                  { label: 'Selfie with ID', src: detail.selfieWithId },
                ].map((photo) => (
                  <div key={photo.label} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-500">
                      {photo.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({ src: photo.src, label: photo.label })
                      }
                      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 group cursor-zoom-in w-full"
                    >
                      <Image
                        src={photo.src}
                        alt={photo.label}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions — pending only */}
            {detail.status === 'pending' && (
              <section className="pb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Decision
                </p>

                {rejecting ? (
                  <div className="flex flex-col gap-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <p className="text-sm font-semibold text-red-700 mb-0.5">
                        Rejection reason <span className="text-red-400">*</span>
                      </p>
                      <p className="text-xs text-red-400 mb-3">
                        The host will see this message in their app.
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. ID photo is blurry. Please resubmit with a clearer image."
                        rows={3}
                        className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setRejecting(false)
                          setRejectReason('')
                        }}
                        className="py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={acting || !rejectReason.trim()}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {acting ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={acting}
                      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-deep-teal text-white text-sm font-semibold hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {acting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={acting}
                      className="flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            Failed to load details.
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
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function AdminVerificationsPage() {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [orderBy, setOrderBy] = useState('submittedAt')
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')
  const [data, setData] = useState<AdminVerificationSummary[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
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
      const res = await getAdminVerifications({
        status: status === 'all' ? undefined : status,
        page,
        limit: LIMIT,
        orderBy,
        sort,
      })
      setTotalRows(res.totalRows)
      setTotalPages(res.totalPages)
      const sorted = [...res.data].sort((a, b) => {
        let aVal: string | number
        let bVal: string | number
        if (orderBy === 'submittedAt') {
          aVal = new Date(a.submittedAt.replace(' ', 'T')).getTime()
          bVal = new Date(b.submittedAt.replace(' ', 'T')).getTime()
        } else if (orderBy === 'status') {
          aVal = a.status
          bVal = b.status
        } else {
          aVal = a.id
          bVal = b.id
        }
        if (aVal < bVal) return sort === 'asc' ? -1 : 1
        if (aVal > bVal) return sort === 'asc' ? 1 : -1
        return 0
      })
      setData(sorted)
      setLastUpdated(new Date())
    } catch {
      if (!silent) toast.error('Failed to load verifications.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [status, page, orderBy, sort])

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const pendingCount = data.filter((d) => d.status === 'pending').length

  return (
    <div>
      <RefreshBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={fetchData} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label: 'Total submissions', value: totalRows, accent: false },
          { label: 'Awaiting review', value: pendingCount, accent: true },
          { label: 'Showing', value: data.length, accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 px-5 py-4"
          >
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            <p
              className={`text-3xl font-bold font-baloo2 leading-none ${accent && value > 0 ? 'text-accent-orange' : 'text-gray-900'}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
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
              {[
                { label: 'Host', col: 'id' },
                { label: 'Email', col: null },
                { label: 'Submitted', col: 'submittedAt' },
                { label: 'Status', col: 'status' },
                { label: '', col: null },
              ].map(({ label, col }) => (
                <th
                  key={label || 'action'}
                  onClick={() => col && handleSort(col)}
                  className={`px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${col ? 'cursor-pointer hover:text-gray-900 select-none' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {col && <SortIcon col={col} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div
                        className="h-3.5 bg-gray-100 rounded-full animate-pulse"
                        style={{
                          width: ['48%', '68%', '40%', '30%', '18%'][j],
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-sm font-semibold text-gray-700 font-baloo2">
                    No verifications found
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
                    <td className="px-4 py-3.5">
                      {isPending && (
                        <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full bg-accent-orange" />
                      )}
                      <div className="flex items-center gap-3">
                        <UserAvatar user={row.user} />
                        <div>
                          <p className="text-[13.5px] font-semibold text-gray-900">
                            {row.user.firstName} {row.user.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            #{row.user.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">
                      {row.user.email}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-gray-800">
                        {formatDateRelative(row.submittedAt)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(row.submittedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={row.status}
                        resubmit={row.isResubmit}
                        statusConfig={STATUS_CONFIG}
                      />
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
        <VerificationPanel
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  )
}
