import { redirect } from 'next/navigation'

export default async function BrandHomeRedirect({
  params,
}: {
  params: Promise<{ brandId: string }>
}) {
  const { brandId } = await params
  redirect(`/brands/${brandId}/orders`)
}
