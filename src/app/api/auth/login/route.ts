import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail } from '../../../../lib/db'
import { signJwt } from '../../../../lib/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const { email, password } = body
    const user = await findUserByEmail(email)
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const token = signJwt({ sub: user.id, email: user.email })
    const res = NextResponse.json({ token })
    res.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', path: '/' })
    return res
  } catch (err) {
    console.error('Login error', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Login failed: ${message}` }, { status: 500 })
  }
}
