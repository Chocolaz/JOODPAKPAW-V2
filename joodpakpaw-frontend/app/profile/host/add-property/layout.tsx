'use client'

import { AddPropertyProvider } from './_context/AddPropertyContext'

export default function AddPropertyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AddPropertyProvider>
      <div className="overflow-x-hidden">{children}</div>
    </AddPropertyProvider>
  )
}
