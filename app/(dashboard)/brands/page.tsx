import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function BrandsPage() {
  const supabase = await createServerClient()
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color')
    .order('created_at', { ascending: false })

  if (!brands || brands.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <h2 className="text-lg font-semibold">브랜드가 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            첫 브랜드를 추가하면 매체 연동과 데이터 수집을 시작할 수 있습니다.
          </p>
          <Button disabled>+ 브랜드 추가 (Plan 2에서 활성화)</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">브랜드</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: brand.color ?? '#94a3b8' }}
                  />
                  <span className="font-semibold">{brand.name}</span>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
