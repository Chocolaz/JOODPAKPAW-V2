'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Flag, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMyReports } from '@/lib/api'
import type { ReporterReportSummary } from '@/types/report'

const LIMIT = 20

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  className: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
  dismissed:{ label: 'Dismissed',className: 'bg-gray-100 text-gray-500' },
}

const TYPE_CONFIG = {
  property:      { label: 'Property', className: 'bg-red-50 text-red-500' },
  review:        { label: 'Review',   className: 'bg-blue-50 text-blue-500' },
  unban_property:{ label: 'Appeal',   className: 'bg-amber-50 text-amber-600' },
}

function getSubject(report: ReporterReportSummary): string {
  if (report.property) return report.property.title
  if (report.reviewAuthor) return `${report.reviewAuthor.firstName} ${report.reviewAuthor.lastName}'s review`
  return '—'
}

export default function MyReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<ReporterReportSummary[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyReports({ page, limit: LIMIT })
      setData(res.data)
      setTotalPages(res.totalPages)
    } catch {
      toast.error('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="px-5 lg:px-12 py-5 lg:py-8 max-w-2xl mx-auto w-full">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Flag className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No reports submitted yet</p>
          <p className="text-xs text-neutral-gray">Your submitted reports will appear here.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.map((report) => {
              const status = STATUS_CONFIG[report.status]
              const type = TYPE_CONFIG[report.type]
              return (
                <button
                  key={report.id}
                  onClick={() => router.push(`/profile/reports/${report.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-gray-200 hover:shadow-md transition-all duration-200 active:scale-[0.99]"
                >
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Flag className="w-4 h-4 text-red-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', type.className)}>
                        {type.label}
                      </span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.className)}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">{getSubject(report)}</p>
                    <p className="text-xs text-neutral-gray mt-0.5">{report.reportCategoryLabel}</p>
                    <p className="text-[11px] text-neutral-gray/60 mt-1">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm font-medium text-deep-teal disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-gray">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm font-medium text-deep-teal disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
