import { ChevronLeft, ChevronRight } from 'lucide-react'

export function AdminPagination({
  page,
  totalPages,
  totalRows,
  limit,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalRows: number
  limit: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-400">
        {totalRows === 0
          ? 'No results'
          : `${(page - 1) * limit + 1}\u2013${Math.min(page * limit, totalRows)} of ${totalRows}`}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 min-w-[52px] text-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
