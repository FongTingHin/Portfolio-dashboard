import { NextResponse } from 'next/server'
import { getTokenFromRequest, verifyJwt } from '../../../../lib/auth'

export async function GET(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
  try {
    const data = verifyJwt(token)
    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
