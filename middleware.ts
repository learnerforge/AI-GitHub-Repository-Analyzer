import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 30 // requests per window per IP

const rateMap = new Map<string, { count: number; resetAt: number }>()

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '0')

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const now = Date.now()
    let entry = rateMap.get(ip)

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW }
      rateMap.set(ip, entry)
    }

    entry.count++
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - entry.count)))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > RATE_LIMIT_MAX) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  return response
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
