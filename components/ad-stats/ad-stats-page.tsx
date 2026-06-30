'use client'

export function AdStatsPage({
  brand,
  hasCredential,
}: {
  brand: { id: string; name: string }
  hasCredential: boolean
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{brand.name} — 광고 분석</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        hasCredential: {String(hasCredential)} (Task 4에서 본격 구현)
      </p>
    </div>
  )
}
