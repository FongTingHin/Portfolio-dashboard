import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type AssetType = 'Stock' | 'Mutual Fund' | 'ETF/Fund'
type SearchResult = {
  symbol: string
  name: string
  exchange?: string
  type: AssetType
}

const yahooHeaders = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function isFundLike(value: string) {
  return /\b(fund|etf|trust|index|portfolio|asset management|closed-end|income fund|overwrite)\b/i.test(value)
}

function classifyQuote(quote: Record<string, unknown>): AssetType | null {
  const quoteType = String(quote.quoteType || '').toUpperCase()
  const descriptor = `${quote.shortname || ''} ${quote.longname || ''} ${quote.industry || ''} ${quote.industryDisp || ''}`

  if (quoteType === 'MUTUALFUND') return 'Mutual Fund'
  if (quoteType === 'ETF') return 'ETF/Fund'
  if (quoteType === 'EQUITY' && isFundLike(descriptor)) return 'ETF/Fund'
  if (quoteType === 'EQUITY') return 'Stock'

  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').trim()

  if (query.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: yahooHeaders,
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 })
  }

  const data = await res.json()
  const quotes = Array.isArray(data?.quotes) ? data.quotes : []
  const results: SearchResult[] = quotes
    .map((quote: Record<string, unknown>) => {
      const type = classifyQuote(quote)
      const symbol = typeof quote.symbol === 'string' ? quote.symbol : ''
      const name = typeof quote.shortname === 'string' ? quote.shortname : typeof quote.longname === 'string' ? quote.longname : symbol

      if (!type || !symbol) return null

      return {
        symbol,
        name,
        exchange: typeof quote.exchDisp === 'string' ? quote.exchDisp : typeof quote.exchange === 'string' ? quote.exchange : undefined,
        type,
      }
    })
    .filter((result: SearchResult | null): result is SearchResult => result !== null)

  return NextResponse.json({ results })
}
