import { Suspense } from 'react'
import { BrowseLayoutClient } from './_components/BrowseLayoutClient'

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <BrowseLayoutClient>{children}</BrowseLayoutClient>
    </Suspense>
  )
}
