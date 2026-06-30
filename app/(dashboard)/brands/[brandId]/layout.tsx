import { Sidebar } from '@/components/dashboard/sidebar'

export default async function BrandLayout({
  params,
  children,
}: {
  params: Promise<{ brandId: string }>
  children: React.ReactNode
}) {
  const { brandId } = await params
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <Sidebar brandId={brandId} />
      <main className="flex-1 p-4 md:p-6 pt-14 md:pt-6">{children}</main>
    </div>
  )
}
