import { Skeleton } from '@/components/ui/skeleton'

export function HostProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Hero */}
      <div className="px-5 lg:px-12 pt-16 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-10">
          <Skeleton className="w-24 h-24 lg:w-32 lg:h-32 rounded-full mx-auto lg:mx-0 shrink-0" />
          <div className="flex-1 mt-4 lg:mt-0 space-y-3">
            <Skeleton className="h-8 w-48 mx-auto lg:mx-0" />
            <Skeleton className="h-4 w-36 mx-auto lg:mx-0" />
            <div className="flex gap-2 justify-center lg:justify-start mt-2">
              <Skeleton className="h-8 w-40 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full lg:max-w-xs rounded-full mt-2" />
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="px-5 lg:px-12 border-t pt-8">
        <Skeleton className="h-6 w-32 mb-5" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square w-full bg-gray-200 rounded-[20px]" />
              <div className="mt-2 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="px-5 lg:px-12 border-t pt-8 mt-8">
        <Skeleton className="h-6 w-24 mb-5" />
        <Skeleton className="h-28 w-full rounded-2xl mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
