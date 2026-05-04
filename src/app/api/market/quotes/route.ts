import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Quote = {
  symbol: string
  shortName?: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency?: string
  marketTime?: string
}

const yahooHeaders = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function toMarketTime(timestamp: unknown) {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : undefined
}

async function fetchQuote(symbol: string): Promise<Quote> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: yahooHeaders,
  })

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  const meta = result?.meta || {}
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const numericCloses = closes.filter((close: unknown): close is number => typeof close === 'number')
  const price = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : numericCloses[numericCloses.length - 1] ?? null
  const previousClose =
    typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : numericCloses.length > 1 ? numericCloses[numericCloses.length - 2] : null
  const change = typeof price === 'number' && typeof previousClose === 'number' ? price - previousClose : null

  if (!result || typeof price !== 'number') throw new Error('No quote data returned')

  return {
    symbol: meta.symbol || symbol,
    shortName: meta.shortName || meta.longName,
    price,
    change,
    changePercent: typeof change === 'number' && previousClose ? (change / previousClose) * 100 : null,
    currency: meta.currency,
    marketTime: toMarketTime(meta.regularMarketTime),
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbolsParam = searchParams.get('symbols') || ''
  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {} })
  }

  const settled = await Promise.allSettled(symbols.map(symbol => fetchQuote(symbol)))
  const quotes: Record<string, Quote> = {}
  const errors: Record<string, string> = {}

  settled.forEach((result, index) => {
    const requestedSymbol = symbols[index]

    if (result.status === 'fulfilled') {
      quotes[requestedSymbol] = result.value
    } else {
      errors[requestedSymbol] = result.reason instanceof Error ? result.reason.message : 'Failed to fetch quote'
    }
  })

  return NextResponse.json({ quotes, errors })
}
