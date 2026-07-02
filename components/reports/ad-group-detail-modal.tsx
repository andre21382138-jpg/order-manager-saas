'use client'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBrowserClient } from '@/lib/supabase/client'
import { getCategoryAdGroupDetails, type DateRange } from '@/lib/queries/reports'

function fmtWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function AdGroupDetailModal({
  brandId,
  categoryId,
  categoryName,
  range,
  onClose,
}: {
  brandId: string
  categoryId: string
  categoryName: string
  range: DateRange
  onClose: () => void
}) {
  const supabase = createBrowserClient()
  const details = useSWR(
    ['ag-details', brandId, categoryId, range.from, range.to],
    () => getCategoryAdGroupDetails(supabase, brandId, categoryId, range)
  )

  const rows = details.data ?? []
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0)
  const totalConversionRevenue = rows.reduce((s, r) => s + r.conversionRevenue, 0)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="!max-w-[min(95vw,1000px)] w-full">
        <DialogHeader>
          <DialogTitle>{categoryName} — 광고그룹별 광고 세부내역</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs md:grid-cols-5">
            <div><span className="text-muted-foreground">총 광고비</span><br /><b>{fmtWon(totalCost)}</b></div>
            <div><span className="text-muted-foreground">노출</span><br /><b>{fmtCount(totalImpressions)}</b></div>
            <div><span className="text-muted-foreground">클릭</span><br /><b>{fmtCount(totalClicks)}</b></div>
            <div><span className="text-muted-foreground">전환수</span><br /><b>{fmtCount(totalConversions)}</b></div>
            <div><span className="text-muted-foreground">전환매출</span><br /><b>{fmtWon(totalConversionRevenue)}</b></div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">캠페인</th>
                  <th className="py-2 pr-4">광고그룹</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">광고비</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">노출</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">클릭</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">CPC</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">전환수</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">전환매출</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {details.isLoading && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-muted-foreground">불러오는 중...</td>
                  </tr>
                )}
                {!details.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-muted-foreground">
                      매칭된 광고그룹이 없거나 기간 내 광고 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const roas = r.cost === 0 ? 0 : (r.conversionRevenue / r.cost) * 100
                  const cpc = r.clicks === 0 ? 0 : r.cost / r.clicks
                  return (
                    <tr key={r.adGroupId} className="border-b">
                      <td className="py-2 pr-4">{r.campaignName || '-'}</td>
                      <td className="py-2 pr-4 font-medium">{r.adGroupName || r.adGroupId}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.cost)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.impressions)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.clicks)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">
                        {r.clicks === 0 ? '—' : fmtWon(cpc)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtCount(r.conversions)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">{fmtWon(r.conversionRevenue)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right">
                        {r.cost === 0 ? '—' : `${roas.toFixed(0)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
