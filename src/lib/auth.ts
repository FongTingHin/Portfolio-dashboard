import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signJwt(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: '2h' })
}

export function verifyJwt(token: string) {
  return jwt.verify(token, SECRET)
}

export function getTokenFromRequest(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.replace('Bearer ', '')
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='))
  if (!match) return null
  return decodeURIComponent(match.split('=')[1])
}
