import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/dashboard/:path*', '/transactions/:path*', '/investments/:path*'],
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) {
    const url = new URL('/', req.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}
