import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const proxyConfig = {
  matcher: '/profile/:path*',
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow main /profile page
  if (pathname === '/profile') return NextResponse.next()

  // Let the client handle auth — no server-side redirect to preserve SPA remount
  return NextResponse.next()
}
