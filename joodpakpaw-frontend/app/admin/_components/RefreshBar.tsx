'use client'

import { RefreshCw } from 'lucide-react'

interface RefreshBarProps {
  lastUpdated: Date | null
  refreshing: boolean
  onRefresh: () => void
}

export function RefreshBar({ lastUpdated, refreshing, onRefresh }: RefreshBarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <span className="text-xs text-gray-400">
        {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}
      </span>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  )
}
