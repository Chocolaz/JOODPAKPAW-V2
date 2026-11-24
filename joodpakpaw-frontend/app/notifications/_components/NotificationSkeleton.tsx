export function NotificationSkeleton() {
  return (
    <div className="space-y-5 p-4 md:p-6">
      {[0, 1].map((g) => (
        <div key={g} className="space-y-2.5">
          <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
          <div className="bg-white rounded-2xl overflow-hidden border border-border divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-start gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse motion-reduce:animate-none"
              >
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-neutral-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-3/4" />
                  <div className="h-3.5 bg-neutral-200 rounded w-1/2" />
                  <div className="h-3 bg-neutral-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
