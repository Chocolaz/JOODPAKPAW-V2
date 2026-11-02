import { redirect } from 'next/navigation'

export default async function LegacyPropertyRedirect({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  const { propertyId } = await params
  redirect(`/detail/${propertyId}`)
}
