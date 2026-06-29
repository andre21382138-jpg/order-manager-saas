import { createServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export async function Header() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="font-bold">Order Manager SaaS</div>
        <div className="flex items-center gap-3 text-sm">
          {user && <span className="text-muted-foreground">{user.email}</span>}
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">로그아웃</Button>
          </form>
        </div>
      </div>
    </header>
  )
}
