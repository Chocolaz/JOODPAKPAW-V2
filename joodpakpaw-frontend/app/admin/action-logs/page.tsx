'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { getAdminActionLogs } from '@/lib/api'
import type { AdminActionLog } from '@/types/adminActionLog'
import { UserAvatar } from '@/app/admin/_components/UserAvatar'
import { AdminPagination } from '@/app/admin/_components/AdminPagination'
import { formatDate } from '@/app/admin/_utils'

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  deactivate_property:      { label: 'Deactivate Property',       className: 'bg-red-100 text-red-700' },
  deactivate_all_properties:{ label: 'Deactivate All Properties', className: 'bg-red-100 text-red-700' },
  warn_user:                { label: 'Warn User',                 className: 'bg-amber-100 text-amber-700' },
  delete_review:            { label: 'Delete Review',             className: 'bg-red-100 text-red-700' },
  dismiss_report:           { label: 'Dismiss Report',            className: 'bg-gray-100 text-gray-600' },
  unban_property:           { label: 'Unban Property',            className: 'bg-green-100 text-green-700' },
  unban_all_properties:     { label: 'Unban All Properties',      className: 'bg-green-100 text-green-700' },
}


function ActionTag({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action]
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${cfg?.className ?? 'bg-gray-100 text-gray-600'}`}>
      {cfg?.label ?? action.replace(/_/g, ' ')}
    </span>
  )
}

export default function AdminActionLogsPage() {
  const [data, setData] = useState<AdminActionLog[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedNote, setSelectedNote] = useState<string | null>(null)

  const LIMIT = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminActionLogs({ page, limit: LIMIT })
      setData(res.data)
      setTotalRows(res.totalRows)
      setTotalPages(res.totalPages)
    } catch {
      toast.error('Failed to load action logs.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-7">
        {[
          { label: 'Total actions', value: totalRows },
          { label: 'Showing', value: data.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            <p className="text-3xl font-bold font-baloo2 leading-none text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reason / Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-3.5 bg-gray-100 rounded-full animate-pulse" style={{ width: `${[30, 40, 35, 50, 60][j]}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-sm font-semibold text-gray-700 font-baloo2">No action logs found</p>
                </td>
              </tr>
            ) : (
              data.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  {/* Time */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <p className="text-[13px] font-medium text-gray-800">{formatDate(log.createdAt)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  </td>

                  {/* Admin */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={log.actor} size="sm" />
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900 leading-tight">
                          {log.actor.firstName} {log.actor.lastName}
                        </p>
                        <p className="text-xs text-gray-400">ID: {log.actor.id}</p>
                      </div>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3.5">
                    <ActionTag action={log.action} />
                    <p className="text-xs text-gray-400 mt-1">{log.modelName} #{log.recordId}</p>
                  </td>

                  {/* Target */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={log.target} size="sm" />
                      <div>
                        <p className="text-[13px] font-medium text-gray-800 leading-tight">
                          {log.target.firstName} {log.target.lastName}
                        </p>
                        <p className="text-xs text-gray-400">ID: {log.target.id}</p>
                      </div>
                    </div>
                  </td>

                  {/* Reason */}
                  <td className="px-4 py-3.5 max-w-[240px]">
                    {log.messages ? (
                      <button
                        onClick={() => setSelectedNote(log.messages)}
                        className="text-left text-sm text-gray-600 leading-relaxed line-clamp-2 hover:text-deep-teal hover:underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        {log.messages}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          limit={LIMIT}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Note modal */}
      {selectedNote !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Reason / Note</p>
              <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedNote}</p>
          </div>
        </div>
      )}
    </div>
  )
}
