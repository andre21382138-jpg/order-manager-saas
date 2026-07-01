import { Header } from '@/components/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-screen-2xl p-4">{children}</main>
    </div>
  )
}
