import { RotateCcw } from 'lucide-react'

interface StatusConfig {
  pill: string
  dot: string
}

export function StatusBadge({
  status,
  resubmit,
  statusConfig,
}: {
  status: string
  resubmit?: boolean
  statusConfig: Record<string, StatusConfig>
}) {
  const cfg = statusConfig[status]
  if (!cfg) return null

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )

  if (!resubmit) return badge

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badge}
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
        <RotateCcw className="w-2.5 h-2.5" />
        Resubmit
      </span>
    </div>
  )
}
