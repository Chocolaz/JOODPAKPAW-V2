export function NotificationSkeleton() {
  return (
    <div className="space-y-4 pt-3">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="px-4 md:px-5 py-1.5 h-4 w-16 bg-gray-200 rounded animate-pulse mx-4 md:mx-5 mb-2" />
          <div className="bg-white rounded-2xl mx-4 md:mx-5 overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 md:gap-4 px-4 md:px-6 py-3.5 md:py-5 animate-pulse">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2 md:space-y-2.5">
                  <div className="h-3.5 md:h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 md:h-3.5 bg-gray-200 rounded w-1/2" />
                  <div className="h-2.5 md:h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
