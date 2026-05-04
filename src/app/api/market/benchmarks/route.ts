import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Period = 'week' | 'month' | 'year'
type Benchmark = {
  label: string
  symbol: string
  color: string
}
type PricePoint = { date: string; close: number }

const benchmarks: Benchmark[] = [
  { label: 'Hang Seng Index', symbol: '^HSI', color: '#3b82f6' },
  { label: 'S&P 500', symbol: '^GSPC', color: '#06b6d4' },
  { label: 'CSI 300', symbol: '000300.SS', color: '#84cc16' },
  { label: 'Nikkei 225', symbol: '^N225', color: '#eab308' },
  { label: 'Straits Times', symbol: '^STI', color: '#7c3aed' },
  { label: 'Nasdaq Composite', symbol: '^IXIC', color: '#f472b6' },
]

const yahooHeaders = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function periodToRange(period: Period) {
  if (period === 'week') return '5d'
  if (period === 'year') return '1y'
  return '1mo'
}

function normalizePeriod(value: string | null): Period {
  if (value === 'week' || value === 'month' || value === 'year') return value
  return 'month'
}

function formatYahooDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function fetchBenchmark(benchmark: Benchmark, period: Period) {
  const encoded = encodeURIComponent(benchmark.symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=${periodToRange(period)}`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: yahooHeaders,
  })

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${benchmark.symbol}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const pricePoints: PricePoint[] = timestamps
    .map((timestamp: number, index: number) => ({
      date: formatYahooDate(timestamp),
      close: closes[index],
    }))
    .filter((point: { date: string; close: unknown }): point is PricePoint => typeof point.close === 'number')

  const first = pricePoints[0]?.close || 0
  const points = pricePoints.map(point => ({
    date: point.date,
    value: first > 0 ? ((point.close - first) / first) * 100 : 0,
  }))
  const lastReturn = points[points.length - 1]?.value ?? 0

  return {
    ...benchmark,
    points,
    lastReturn,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = normalizePeriod(searchParams.get('period'))
  const settled = await Promise.allSettled(benchmarks.map(benchmark => fetchBenchmark(benchmark, period)))
  const series = settled
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchBenchmark>>> => result.status === 'fulfilled')
    .map(result => result.value)

  const errors = settled
    .map((result, index) => (result.status === 'rejected' ? [benchmarks[index].symbol, result.reason instanceof Error ? result.reason.message : 'Request failed'] : null))
    .filter(Boolean)

  return NextResponse.json({ period, series, errors: Object.fromEntries(errors as [string, string][]) })
}
