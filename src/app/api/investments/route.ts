import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { addAsset, deleteAsset, getAssets, updateAsset } from '../../../lib/db'
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
  return NextResponse.json(await getAssets())
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
  const asset = {
    id: uuid(),
    name: body.name,
    type: body.type,
    symbol: body.symbol ? String(body.symbol).toUpperCase() : '',
    currentValue: Number(body.currentValue),
    purchasePrice: Number(body.purchasePrice),
    quantity: body.quantity === undefined || body.quantity === '' ? undefined : Number(body.quantity),
  }
  await addAsset(asset)
  return NextResponse.json(asset)
}

export async function PUT(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    verifyJwt(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const asset = {
    id: body.id,
    name: body.name,
    type: body.type,
    symbol: body.symbol ? String(body.symbol).toUpperCase() : '',
    currentValue: Number(body.currentValue),
    purchasePrice: Number(body.purchasePrice),
    quantity: body.quantity === undefined || body.quantity === '' ? undefined : Number(body.quantity),
  }
  await updateAsset(asset)
  return NextResponse.json(asset)
}

export async function DELETE(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    verifyJwt(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing asset id' }, { status: 400 })

  await deleteAsset(id)
  return NextResponse.json({ ok: true })
}
