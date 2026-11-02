'use client'

import { AddPetProvider } from './_context/AddPetContext'

export default function AddPetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AddPetProvider>{children}</AddPetProvider>
}
