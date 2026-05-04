import path from 'path'
import bcrypt from 'bcryptjs'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { v4 as uuid } from 'uuid'

export type Asset = { id: string; name: string; type: string; symbol?: string; currentValue: number; purchasePrice: number; quantity?: number }
export type Tx = {
  id: string
  type: string
  asset: string
  amount: number
  date: string
  symbol?: string
  assetCategory?: string
  price?: number
  quantity?: number
  commission?: number
  bondReturn?: number
  notes?: string
}
export type History = { date: string; value: number }
export type User = { id: string; email: string; passwordHash: string }

type DbSchema = { assets: Asset[]; transactions: Tx[]; history: History[]; users: User[] }

const dbFile = path.join(process.cwd(), 'data', 'db.json')
const adapter = new JSONFile<DbSchema>(dbFile)
const defaultData: DbSchema = { assets: [], transactions: [], history: [], users: [] }
const db = new Low<DbSchema>(adapter, defaultData)

async function readDb() {
  await db.read()
  if (!db.data) {
    db.data = { assets: [], transactions: [], history: [], users: [] }
  }
  if (db.data.users.length === 0 || !db.data.users[0].passwordHash) {
    const seedUser: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: bcrypt.hashSync('password', 8),
    }
    db.data.users = [seedUser]
    await db.write()
  }
  return db.data
}

async function writeDb(data: DbSchema) {
  db.data = data
  await db.write()
}

function normalizeSymbol(symbol?: string) {
  return symbol ? String(symbol).trim().toUpperCase() : ''
}

function normalizeText(value?: string) {
  return value ? String(value).trim().toLowerCase() : ''
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function roundQuantity(value: number) {
  return Math.round(value * 1000000) / 1000000
}

function txQuantity(tx: Tx) {
  const quantity = Number(tx.quantity)
  if (Number.isFinite(quantity) && quantity > 0) return quantity

  const amount = Number(tx.amount)
  const price = Number(tx.price)
  if (Number.isFinite(amount) && amount > 0 && Number.isFinite(price) && price > 0) return amount / price

  return undefined
}

function findMatchingAssetIndex(assets: Asset[], tx: Tx) {
  const symbol = normalizeSymbol(tx.symbol)
  if (symbol) {
    const symbolMatch = assets.findIndex(asset => normalizeSymbol(asset.symbol) === symbol)
    if (symbolMatch >= 0) return symbolMatch
  }

  const assetName = normalizeText(tx.asset)
  const assetType = normalizeText(tx.assetCategory)

  return assets.findIndex(asset => {
    if (normalizeText(asset.name) !== assetName) return false
    return !assetType || normalizeText(asset.type) === assetType
  })
}

function applyTxToAssets(data: DbSchema, tx: Tx) {
  const txType = normalizeText(tx.type)
  if (txType !== 'buy' && txType !== 'sell') return

  const amount = Number(tx.amount)
  if (!Number.isFinite(amount) || amount <= 0) return

  const direction = txType === 'buy' ? 1 : -1
  const quantity = txQuantity(tx)
  const price = Number(tx.price)
  const assetIndex = findMatchingAssetIndex(data.assets, tx)

  if (assetIndex < 0) {
    if (direction < 0) return

    data.assets.push({
      id: uuid(),
      name: tx.asset,
      type: tx.assetCategory || 'Other',
      symbol: normalizeSymbol(tx.symbol),
      currentValue: roundMoney(amount),
      purchasePrice: roundMoney(amount),
      quantity: quantity === undefined ? undefined : roundQuantity(quantity),
    })
    return
  }

  const asset = data.assets[assetIndex]
  const existingQuantity = Number(asset.quantity)
  const inferredQuantity =
    Number.isFinite(existingQuantity) && existingQuantity >= 0
      ? existingQuantity
      : Number.isFinite(price) && price > 0
        ? asset.currentValue / price
        : undefined
  const updatedQuantity =
    quantity === undefined || inferredQuantity === undefined
      ? asset.quantity
      : Math.max(0, roundQuantity(inferredQuantity + direction * quantity))

  data.assets[assetIndex] = {
    ...asset,
    name: asset.name || tx.asset,
    type: asset.type || tx.assetCategory || 'Other',
    symbol: normalizeSymbol(asset.symbol || tx.symbol),
    currentValue: Math.max(0, roundMoney(asset.currentValue + direction * amount)),
    purchasePrice: Math.max(0, roundMoney(asset.purchasePrice + direction * amount)),
    quantity: updatedQuantity,
  }
}

export async function getAssets() {
  const data = await readDb()
  return data.assets
}

export async function addAsset(asset: Asset) {
  const data = await readDb()
  data.assets.push(asset)
  await writeDb(data)
}

export async function updateAsset(updated: Asset) {
  const data = await readDb()
  data.assets = data.assets.map(a => (a.id === updated.id ? updated : a))
  await writeDb(data)
}

export async function deleteAsset(id: string) {
  const data = await readDb()
  data.assets = data.assets.filter(a => a.id !== id)
  await writeDb(data)
}

export async function getTxs() {
  const data = await readDb()
  return data.transactions
}

export async function addTx(tx: Tx) {
  const data = await readDb()
  data.transactions.push(tx)
  applyTxToAssets(data, tx)
  await writeDb(data)
}

export async function getHistory() {
  const data = await readDb()
  return data.history
}

export async function findUserByEmail(email: string) {
  const data = await readDb()
  return data.users.find(u => u.email === email) || null
}
