'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ByTypeRow } from '@/lib/queries/ad-stats'

const TYPE_LABEL: Record<string, string> = {
  WEB_SITE: '파워링크',
  SHOPPING: '쇼핑검색',
  POWER_CONTENTS: '파워컨텐츠',
  BRAND_SEARCH: '브랜드검색',
  BRAND_SEARCH_ADS: '브랜드검색ADS',
  PLACE: '플레이스',
  unknown: '미분류',
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function roas(r: ByTypeRow): string {
  return r.cost === 0 ? '—' : `${((r.conversion_revenue / r.cost) * 100).toFixed(0)}%`
}

function ctr(r: ByTypeRow): string {
  return r.impressions === 0 ? '—' : `${((r.clicks / r.impressions) * 100).toFixed(2)}%`
}

function cpc(r: ByTypeRow): string {
  return r.clicks === 0 ? '—' : `₩${Math.round(r.cost / r.clicks).toLocaleString('ko-KR')}`
}

export function CampaignTypeTable({ data, isLoading }: { data: ByTypeRow[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 광고영역별 광고 성과</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">광고영역</th>
                <th className="py-2 pr-4 text-right">광고비</th>
                <th className="py-2 pr-4 text-right">노출</th>
                <th className="py-2 pr-4 text-right">클릭</th>
                <th className="py-2 pr-4 text-right">CTR</th>
                <th className="py-2 pr-4 text-right">CPC</th>
                <th className="py-2 pr-4 text-right">전환수</th>
                <th className="py-2 pr-4 text-right">전환매출</th>
                <th className="py-2 pr-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted-foreground">로딩 중...</td>
                </tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted-foreground">데이터 없음</td>
                </tr>
              )}
              {data.map((r) => (
                <tr key={r.type} className="border-b">
                  <td className="py-2 pr-4">{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td className="py-2 pr-4 text-right">₩{fmt(r.cost)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.impressions)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.clicks)}</td>
                  <td className="py-2 pr-4 text-right">{ctr(r)}</td>
                  <td className="py-2 pr-4 text-right">{cpc(r)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.conversions)}</td>
                  <td className="py-2 pr-4 text-right">₩{fmt(r.conversion_revenue)}</td>
                  <td className="py-2 pr-4 text-right">{roas(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
