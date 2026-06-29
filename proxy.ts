import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/auth/callback')

  // 비로그인 + 보호된 경로 → /login
  if (!user && !isAuthPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 로그인 + 로그인/홈 페이지 → /brands
  if (user && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/brands', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
