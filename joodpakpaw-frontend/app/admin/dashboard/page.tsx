'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Flag,
  Users,
  Home,
  ShieldCheck,
  TrendingUp,
  Minus,
  ArrowRight,
} from 'lucide-react'

const POLL_INTERVAL = 30_000 // 30s
import {
  getAdminDashboard,
  getAdminReports,
  getAdminActionLogs,
  type AdminDashboardData,
} from '@/lib/api'
import type { AdminReportSummary } from '@/types/adminReport'
import type { AdminActionLog } from '@/types/adminActionLog'
import { formatDateRelative } from '../_utils'
import { UserAvatar } from '../_components/UserAvatar'
import { RefreshBar } from '../_components/RefreshBar'

const ACTION_LABEL: Record<string, string> = {
  deactivate_property:       'Deactivate Property',
  deactivate_all_properties: 'Deactivate All Properties',
  warn_user:                 'Warn User',
  delete_review:             'Delete Review',
  dismiss_report:            'Dismiss Report',
  unban_property:            'Unban Property',
  unban_all_properties:      'Unban All Properties',
}

const REPORT_TYPE_COLOR: Record<string, string> = {
  property:       'bg-red-50 text-red-600',
  review:         'bg-blue-50 text-blue-600',
  unban_property: 'bg-amber-50 text-amber-600',
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  property:       'Property',
  review:         'Review',
  unban_property: 'Unban',
}

function StatCard({
  label,
  value,
  thisMonth,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  thisMonth?: number
  icon: React.ElementType
  accent?: boolean
}) {
  const isUp = thisMonth != null && thisMonth > 0

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 ${accent ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-gray-200' : 'bg-gray-100'}`}>
          <Icon className="w-4.5 h-4.5 text-gray-600" strokeWidth={1.75} />
        </div>
        {thisMonth != null && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            isUp ? 'bg-green-50 text-positive-green' : 'bg-gray-100 text-gray-400'
          }`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {isUp ? `+${thisMonth}` : '0'}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-[32px] font-bold text-gray-900 font-baloo2 leading-none">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardData | null>(null)
  const [reports, setReports] = useState<AdminReportSummary[]>([])
  const [actions, setActions] = useState<AdminActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [dash, rpts, acts] = await Promise.all([
        getAdminDashboard(),
        getAdminReports({ page: 1, limit: 5 }),
        getAdminActionLogs({ page: 1, limit: 5 }),
      ])
      setStats(dash)
      setReports(rpts.data)
      setActions(acts.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) toast.error('Failed to load dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 rounded-xl bg-gray-100" />
          <div className="h-72 rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <RefreshBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={fetchData} />
      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Pending Reports"
            value={stats.pendingReports.total}
            thisMonth={stats.pendingReports.thisMonth}
            icon={Flag}
          />
          <StatCard
            label="Total Users"
            value={stats.totalUsers.total}
            thisMonth={stats.totalUsers.thisMonth}
            icon={Users}
          />
          <StatCard
            label="Active Properties"
            value={stats.activeProperties.total}
            thisMonth={stats.activeProperties.thisMonth}
            icon={Home}
            accent
          />
          <StatCard
            label="Pending Verifications"
            value={stats.pendingVerifications.total}
            thisMonth={stats.pendingVerifications.thisMonth}
            icon={ShieldCheck}
          />
        </div>
      )}

      {/* Two-column activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Reports */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">Recent Reports</h2>
            <Link href="/admin/reports" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {reports.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No reports yet</p>
            ) : reports.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${REPORT_TYPE_COLOR[r.type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {REPORT_TYPE_LABEL[r.type] ?? r.type}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">#{r.id}</span>
                  </div>
                  <p className="text-[13px] text-gray-700 truncate">{r.reportCategoryLabel}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <UserAvatar user={r.reporter} size="xs" />
                    <span className="text-[11px] text-gray-400">
                      {r.reporter.firstName} {r.reporter.lastName} · {formatDateRelative(r.createdAt)}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize mt-1 ${
                  r.status === 'pending' ? 'bg-orange-50 text-accent-orange' :
                  r.status === 'resolved' ? 'bg-green-50 text-positive-green' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">Recent Actions</h2>
            <Link href="/admin/action-logs" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {actions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No actions yet</p>
            ) : actions.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {ACTION_LABEL[a.action] ?? a.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-700 truncate">{a.messages}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <UserAvatar user={a.actor} size="xs" />
                    <span className="text-[11px] text-gray-400">
                      {a.actor.firstName} {a.actor.lastName} · {formatDateRelative(a.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
