import { notFound, redirect } from 'next/navigation'
import { isPositiveIntParam } from '@/lib/navigationGuard'

export default async function LegacyPropertyRedirect({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  const { propertyId } = await params
  if (!isPositiveIntParam(propertyId)) {
    notFound()
  }
  redirect(`/detail/${propertyId}`)
}
