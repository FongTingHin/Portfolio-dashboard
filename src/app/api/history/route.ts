import { NextResponse } from 'next/server'
import { getHistory } from '../../../lib/db'
import { getTokenFromRequest, verifyJwt } from '../../../lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    verifyJwt(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await getHistory())
}
