'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import { ProductInfoTab } from './product-info-tab'
import { CategoryTab } from './category-tab'
import { AdMatchingTab } from './ad-matching-tab'

export type Store = {
  channel: 'cafe24' | 'smartstore'
  channelAccount: string
}

type Props = {
  brandId: string
  stores: Store[]
  activeMall: string
  activeChannel: 'cafe24' | 'smartstore' | null
}

type SubTab = 'info' | 'category' | 'ad-matching'

export function ProductsClient({ brandId, stores, activeMall, activeChannel }: Props) {
  const [tab, setTab] = useState<SubTab>('info')

  if (stores.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        연결된 스토어가 없습니다. 설정 &gt; 매체 연결에서 카페24 또는 스마트스토어를 등록하세요.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 스토어 선택 */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {stores.map((s) => {
          const active = s.channelAccount === activeMall
          const href = `/brands/${brandId}/products?mall=${encodeURIComponent(s.channelAccount)}`
          return (
            <Link
              key={`${s.channel}:${s.channelAccount}`}
              href={href as Route}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <span>{s.channelAccount}</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs',
                  active
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {s.channel === 'cafe24' ? '카페24' : '스마트스토어'}
              </span>
            </Link>
          )
        })}
      </div>

      {/* 서브탭 */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'info' as SubTab, label: '상품정보' },
          { key: 'category' as SubTab, label: '상품구분' },
          { key: 'ad-matching' as SubTab, label: '광고매칭' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm transition-colors',
              tab === t.key
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {tab === 'info' && (
        <ProductInfoTab brandId={brandId} mall={activeMall} channel={activeChannel} />
      )}
      {tab === 'category' && (
        <CategoryTab brandId={brandId} mall={activeMall} channel={activeChannel} />
      )}
      {tab === 'ad-matching' && (
        <AdMatchingTab brandId={brandId} channel={activeChannel} />
      )}
    </div>
  )
}
