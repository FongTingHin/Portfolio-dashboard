import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Period = 'week' | 'month' | 'year'
type PricePoint = { date: string; close: number }

const yahooHeaders = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function normalizePeriod(value: string | null): Period {
  if (value === 'week' || value === 'month' || value === 'year') return value
  return 'month'
}

function periodToRange(period: Period) {
  if (period === 'week') return '5d'
  if (period === 'year') return '1y'
  return '1mo'
}

function formatYahooDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function fetchPriceHistory(symbol: string, period: Period) {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=${periodToRange(period)}`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: yahooHeaders,
  })

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)

  const data = await res.json()
  const yahooError = data?.chart?.error
  if (yahooError) throw new Error(yahooError.description || yahooError.code || 'Yahoo Finance returned an error')

  const result = data?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const points: PricePoint[] = timestamps
    .map((timestamp: number, index: number) => ({
      date: formatYahooDate(timestamp),
      close: closes[index],
    }))
    .filter((point: { date: string; close: unknown }): point is PricePoint => typeof point.close === 'number')

  if (points.length === 0) throw new Error('No historical prices returned')

  return {
    symbol,
    points,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = normalizePeriod(searchParams.get('period'))
  const symbols = (searchParams.get('symbols') || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)

  if (symbols.length === 0) {
    return NextResponse.json({ period, series: {}, errors: {} })
  }

  const settled = await Promise.allSettled(symbols.map(symbol => fetchPriceHistory(symbol, period)))
  const series: Record<string, PricePoint[]> = {}
  const errors: Record<string, string> = {}

  settled.forEach((result, index) => {
    const symbol = symbols[index]

    if (result.status === 'fulfilled') {
      series[symbol] = result.value.points
    } else {
      errors[symbol] = result.reason instanceof Error ? result.reason.message : 'Failed to fetch historical prices'
    }
  })

  return NextResponse.json({ period, series, errors })
}
