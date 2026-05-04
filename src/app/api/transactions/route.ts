import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { addTx, getTxs } from '../../../lib/db'
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
  return NextResponse.json(await getTxs())
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    verifyJwt(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const price = Number(body.price || 0)
  const quantity = Number(body.quantity || body.amount || 0)
  const commission = Number(body.commission || 0)
  const tx = {
    id: uuid(),
    type: body.type,
    asset: body.asset,
    amount: Number(body.amount || price * quantity + commission),
    date: body.date,
    symbol: body.symbol,
    assetCategory: body.assetCategory,
    price,
    quantity,
    commission,
    bondReturn: body.bondReturn === undefined || body.bondReturn === '' ? undefined : Number(body.bondReturn),
    notes: body.notes,
  }
  await addTx(tx)
  return NextResponse.json(tx)
}
