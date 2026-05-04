import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type DividendEvent = { date: string; amount: number }

const yahooHeaders = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function toUnixSeconds(date: string | null, fallback: Date) {
  const parsed = date ? new Date(`${date}T00:00:00Z`) : fallback
  const safeDate = Number.isNaN(parsed.getTime()) ? fallback : parsed

  return Math.floor(safeDate.getTime() / 1000)
}

function formatYahooDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function fetchDividends(symbol: string, period1: number, period2: number) {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?period1=${period1}&period2=${period2}&interval=1d&events=div`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: yahooHeaders,
  })

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)

  const data = await res.json()
  const yahooError = data?.chart?.error
  if (yahooError) throw new Error(yahooError.description || yahooError.code || 'Yahoo Finance returned an error')

  const result = data?.chart?.result?.[0]
  const dividends = result?.events?.dividends || {}
  const events: DividendEvent[] = Object.values(dividends)
    .map((event: any) => ({
      date: formatYahooDate(event.date),
      amount: event.amount,
    }))
    .filter((event): event is DividendEvent => typeof event.date === 'string' && typeof event.amount === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))

  return { symbol, events }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbols = (searchParams.get('symbols') || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)

  if (symbols.length === 0) {
    return NextResponse.json({ dividends: {}, errors: {} })
  }

  const now = new Date()
  const fallbackStart = new Date(now)
  fallbackStart.setFullYear(fallbackStart.getFullYear() - 10)

  const period1 = toUnixSeconds(searchParams.get('start'), fallbackStart)
  const period2 = toUnixSeconds(searchParams.get('end'), now)
  const settled = await Promise.allSettled(symbols.map(symbol => fetchDividends(symbol, period1, period2)))
  const dividends: Record<string, DividendEvent[]> = {}
  const errors: Record<string, string> = {}

  settled.forEach((result, index) => {
    const symbol = symbols[index]

    if (result.status === 'fulfilled') {
      dividends[symbol] = result.value.events
    } else {
      errors[symbol] = result.reason instanceof Error ? result.reason.message : 'Failed to fetch dividends'
    }
  })

  return NextResponse.json({ dividends, errors })
}
