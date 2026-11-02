'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Flag, Home, Star, FileText, User, NotebookText, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMyReportById } from '@/lib/api'
import type { ReporterReportDetail } from '@/types/report'

const STATUS_CONFIG = {
  pending:  { label: 'Under Review', Icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  resolved: { label: 'Resolved',     Icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  dismissed:{ label: 'Dismissed',    Icon: XCircle,      color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200' },
}

const TYPE_LABEL: Record<string, string> = {
  property: 'Property Report',
  review: 'Review Report',
  unban_property: 'Unban Appeal',
}

const RESOLVED_ACTION_LABEL: Record<string, string> = {
  dismiss_report:           'Report Dismissed',
  warn_user:                'Warning Issued',
  deactivate_property:      'Property Deactivated',
  deactivate_all_properties:'All Properties Deactivated',
  delete_review:            'Review Removed',
  unban_property:           'Property Unbanned',
  unban_all_properties:     'All Properties Unbanned',
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-neutral-gray" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-neutral-gray/70 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 leading-snug">{value}</p>
      </div>
    </div>
  )
}

export default function ReportDetailPage() {
  const { reportId } = useParams()
  const [report, setReport] = useState<ReporterReportDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!reportId) return
    getMyReportById(Number(reportId))
      .then(setReport)
      .catch(() => toast.error('Failed to load report.'))
      .finally(() => setLoading(false))
  }, [reportId])

  if (loading) {
    return (
      <div className="px-5 lg:px-12 py-5 max-w-2xl mx-auto w-full space-y-4">
        <div className="animate-pulse h-16 bg-gray-100 rounded-2xl" />
        <div className="animate-pulse h-40 bg-gray-100 rounded-2xl" />
        <div className="animate-pulse h-28 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-neutral-gray">Report not found.</p>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[report.status]
  const StatusIcon = statusCfg.Icon

  const subject = report.type === 'review'
    ? report.reviewAuthor ? `${report.reviewAuthor.firstName} ${report.reviewAuthor.lastName}'s review` : '—'
    : report.property?.title ?? '—'

  const subjectIcon = report.type === 'review' ? Star : Home

  return (
    <div className="px-5 lg:px-12 py-5 lg:py-8 max-w-2xl mx-auto w-full space-y-4">

      {/* Status banner */}
      <div className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3.5', statusCfg.bg, statusCfg.border)}>
        <StatusIcon className={cn('w-5 h-5 shrink-0', statusCfg.color)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', statusCfg.color)}>{statusCfg.label}</p>
          {report.resolvedAction && (
            <p className="text-xs text-gray-500 mt-0.5">
              {RESOLVED_ACTION_LABEL[report.resolvedAction] ?? report.resolvedAction.replace(/_/g, ' ')}
            </p>
          )}
        </div>
        <span className="text-[10px] font-semibold text-gray-400">#{report.id}</span>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-1">
        <InfoRow icon={Flag}        label="Report Type" value={TYPE_LABEL[report.type] ?? report.type} />
        <InfoRow icon={FileText}    label="Category"    value={report.reportCategoryLabel} />
        <InfoRow icon={subjectIcon} label="Subject"     value={subject} />
        {report.propOwner && (
          <InfoRow icon={User} label="Property Owner" value={`${report.propOwner.firstName} ${report.propOwner.lastName}`} />
        )}
        <InfoRow
          icon={Clock}
          label="Submitted"
          value={format(new Date(report.createdAt), 'MMM d, yyyy · HH:mm')}
        />
      </div>

      {/* Description */}
      {report.description && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <NotebookText className="w-4 h-4 text-neutral-gray" />
            <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">Your Description</p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.description}</p>
        </div>
      )}

      {/* Admin note */}
      {report.adminNote && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <NotebookText className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Admin Note</p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.adminNote}</p>
        </div>
      )}

      {/* Images */}
      {report.images.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide mb-3">Attached Images</p>
          <div className="grid grid-cols-3 gap-2">
            {report.images.map((img) => (
              <a key={img.id} href={img.filePath} target="_blank" rel="noopener noreferrer">
                <img
                  src={img.filePath}
                  alt={img.fileName}
                  className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
