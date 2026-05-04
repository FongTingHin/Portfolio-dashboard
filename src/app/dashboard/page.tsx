"use client"

import React, { useEffect, useMemo, useState } from 'react'
import PortfolioChart, { type ChartHoverState } from '../../components/PortfolioChart'

type Asset = { id: string; name: string; type: string; symbol?: string; currentValue: number; purchasePrice: number; quantity?: number }
type Tx = {
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
type Point = { date: string; value: number }
type MarketPricePoint = { date: string; close: number }
type AssetCategory = 'Bond' | 'Stock' | 'Mutual Fund' | 'ETF/Fund'
type SearchCategory = Exclude<AssetCategory, 'Bond'>
type SearchResult = { symbol: string; name: string; exchange?: string; type: SearchCategory }
type Quote = {
  symbol: string
  shortName?: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency?: string
  marketTime?: string
}
type DividendEvent = { date: string; amount: number }
type Period = 'week' | 'month' | 'year'
type PerformancePanel = 'return' | 'asset' | 'earn'
type TransactionPanel = 'trades' | 'dividends'
type DistributionPanel = 'asset' | 'type'
type BenchmarkSeries = { label: string; symbol: string; color: string; points: Point[]; lastReturn: number }
type CalendarCell = { date: Date; key: string; day: number; inMonth: boolean; earn?: number; returnRate?: number }
type DistributionRow = { key: string; label: string; detail: string; value: number; color: string; percent: number }
type DistributionSegment = DistributionRow & { startAngle: number; endAngle: number }

const distributionColors = ['#3f86ff', '#43c9dc', '#ff8a1c', '#00d18f', '#a78bfa', '#f64e7b', '#facc15', '#94a3b8']

const periodOptions: { label: string; value: Period }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
]

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toPeriodReturnPoints(points: Point[]) {
  const first = points[0]?.value || 0

  return points.map(p => ({
    date: p.date,
    value: first > 0 ? ((p.value - first) / first) * 100 : 0,
  }))
}

function toDailyEarnPoints(points: Point[]) {
  return points.map((p, i) => ({
    date: p.date,
    value: i === 0 ? 0 : p.value - points[i - 1].value,
  }))
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function buildCalendarCells(monthDate: Date, earnPoints: Point[], total: number) {
  const earnByDate = new Map(earnPoints.map(point => [point.date, point.value]))
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstDay.getDay())
  const cells: CalendarCell[] = []

  for (let i = 0; i < 42; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = dateKey(date)
    const earn = earnByDate.get(key)

    cells.push({
      date,
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      earn,
      returnRate: earn !== undefined && total > 0 ? (earn / total) * 100 : undefined,
    })
  }

  return cells
}

function formatUsd(value: number) {
  return `$${Math.abs(value).toFixed(2)} USD`
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

function formatAxisUsd(value: number) {
  return `$${value.toFixed(0)}`
}

function formatSignedUsd(value: number) {
  return `${value >= 0 ? '+' : '-'}${formatUsd(value)}`
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`
}

function formatTrendDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(parsed)
}

function formatTransactionDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function formatCalendarMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}`
}

function panelClass(activePanel: PerformancePanel | null, panel: PerformancePanel, extra = '') {
  return `card performance-card panel-card ${activePanel === panel ? 'expanded' : 'compact'} ${extra}`.trim()
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function emptyTransactionForm() {
  return {
    assetCategory: 'Stock' as AssetCategory,
    asset: '',
    symbol: '',
    type: 'sell',
    price: '',
    quantity: '1',
    commission: '0',
    bondReturn: '',
    date: todayInputValue(),
    notes: '',
  }
}

function emptyDividendForm() {
  return {
    asset: '',
    symbol: '',
    assetCategory: 'Stock' as AssetCategory,
    date: todayInputValue(),
    amount: '0.00',
    notes: '',
  }
}

function searchCategoryLabel(category: SearchCategory) {
  if (category === 'ETF/Fund') return 'ETFs/Funds'
  if (category === 'Mutual Fund') return 'Mutual funds'
  return 'Stocks'
}

function compactUsd(value: number) {
  return `${value.toFixed(2)} USD`
}

function polarToCartesian(center: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  }
}

function donutSegmentPath(startAngle: number, endAngle: number, outerRadius = 112, innerRadius = 50, center = 140) {
  const safeEndAngle = endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle
  const outerStart = polarToCartesian(center, outerRadius, startAngle)
  const outerEnd = polarToCartesian(center, outerRadius, safeEndAngle)
  const innerEnd = polarToCartesian(center, innerRadius, safeEndAngle)
  const innerStart = polarToCartesian(center, innerRadius, startAngle)
  const largeArcFlag = safeEndAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function normalizeHoldingText(value?: string) {
  return value ? value.trim().toLowerCase() : ''
}

function isBuyTx(tx: Tx) {
  return normalizeHoldingText(tx.type) === 'buy'
}

function isSellTx(tx: Tx) {
  return normalizeHoldingText(tx.type) === 'sell'
}

function isDividendTx(tx: Tx) {
  return normalizeHoldingText(tx.type) === 'dividend'
}

function assetMatchesTransaction(asset: Asset, tx: Tx) {
  const assetSymbol = normalizeHoldingText(asset.symbol)
  const txSymbol = normalizeHoldingText(tx.symbol)

  if (assetSymbol && txSymbol) return assetSymbol === txSymbol

  return (
    normalizeHoldingText(asset.name) === normalizeHoldingText(tx.asset) &&
    (!tx.assetCategory || normalizeHoldingText(asset.type) === normalizeHoldingText(tx.assetCategory))
  )
}

function transactionQuantity(tx: Tx) {
  const quantity = Number(tx.quantity)
  if (Number.isFinite(quantity) && quantity > 0) return quantity

  const amount = Number(tx.amount)
  const price = Number(tx.price)
  if (Number.isFinite(amount) && amount > 0 && Number.isFinite(price) && price > 0) return amount / price
  if (Number.isFinite(amount) && amount > 0) return amount

  return 0
}

function transactionBuyCost(tx: Tx, quantity: number) {
  const price = Number(tx.price)
  const commission = Number(tx.commission || 0)
  const amount = Number(tx.amount)

  if (Number.isFinite(price) && price > 0) return price * quantity + commission
  if (Number.isFinite(amount) && amount > 0) return amount
  return 0
}

function transactionSellProceeds(tx: Tx, quantity: number) {
  const price = Number(tx.price)
  const commission = Number(tx.commission || 0)
  const amount = Number(tx.amount)

  if (Number.isFinite(price) && price > 0) return Math.max(0, price * quantity - commission)
  if (Number.isFinite(amount) && amount > 0) return amount
  return 0
}

function buildHoldingLots(asset: Asset, txs: Tx[], fallbackQuantity: number) {
  const assetTxs = txs
    .filter(tx => assetMatchesTransaction(asset, tx))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  if (assetTxs.length === 0) {
    return fallbackQuantity > 0 ? [{ startDate: '1900-01-01', endDate: undefined as string | undefined, quantity: fallbackQuantity }] : []
  }

  const openLots: { startDate: string; quantity: number }[] = []
  const closedLots: { startDate: string; endDate?: string; quantity: number }[] = []

  assetTxs.forEach(tx => {
    const txQty = transactionQuantity(tx)
    if (txQty <= 0) return

    if (isBuyTx(tx)) {
      openLots.push({ startDate: tx.date, quantity: txQty })
      return
    }

    if (!isSellTx(tx)) return

    let remainingSellQty = txQty
    while (remainingSellQty > 0 && openLots.length > 0) {
      const lot = openLots[0]
      const closedQty = Math.min(lot.quantity, remainingSellQty)

      closedLots.push({
        startDate: lot.startDate,
        endDate: tx.date,
        quantity: closedQty,
      })

      lot.quantity -= closedQty
      remainingSellQty -= closedQty
      if (lot.quantity <= 0.000001) openLots.shift()
    }
  })

  return [
    ...closedLots,
    ...openLots.map(lot => ({
      startDate: lot.startDate,
      endDate: undefined as string | undefined,
      quantity: lot.quantity,
    })),
  ]
}

function calculateRealizedGain(asset: Asset, txs: Tx[]) {
  const assetTxs = txs
    .filter(tx => assetMatchesTransaction(asset, tx))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const lots: { quantity: number; costPerShare: number }[] = []
  let realizedGain = 0

  assetTxs.forEach(tx => {
    const quantity = transactionQuantity(tx)
    if (quantity <= 0) return

    if (isBuyTx(tx)) {
      const buyCost = transactionBuyCost(tx, quantity)
      lots.push({
        quantity,
        costPerShare: quantity > 0 ? buyCost / quantity : 0,
      })
      return
    }

    if (!isSellTx(tx)) return

    const proceeds = transactionSellProceeds(tx, quantity)
    const proceedsPerShare = quantity > 0 ? proceeds / quantity : 0
    let remainingSellQty = quantity

    while (remainingSellQty > 0 && lots.length > 0) {
      const lot = lots[0]
      const closedQty = Math.min(lot.quantity, remainingSellQty)

      realizedGain += closedQty * (proceedsPerShare - lot.costPerShare)
      lot.quantity -= closedQty
      remainingSellQty -= closedQty

      if (lot.quantity <= 0.000001) lots.shift()
    }
  })

  return realizedGain
}

function calculateTotalDividend(asset: Asset, txs: Tx[], events: DividendEvent[], fallbackQuantity: number) {
  const lots = buildHoldingLots(asset, txs, fallbackQuantity)
  const manualDividends = txs.reduce((sum, tx) => {
    if (!isDividendTx(tx) || !assetMatchesTransaction(asset, tx)) return sum

    const amount = Number(tx.amount)
    return Number.isFinite(amount) ? sum + amount : sum
  }, 0)

  return manualDividends + events.reduce((sum, event) => {
    const shares = lots.reduce((lotSum, lot) => {
      const inHoldingWindow = lot.startDate <= event.date && (!lot.endDate || event.date < lot.endDate)

      return inHoldingWindow ? lotSum + lot.quantity : lotSum
    }, 0)

    return sum + shares * event.amount
  }, 0)
}

function dividendSharesForDate(asset: Asset, txs: Tx[], dividendDate: string, fallbackQuantity: number) {
  return buildHoldingLots(asset, txs, fallbackQuantity).reduce((sum, lot) => {
    const inHoldingWindow = lot.startDate <= dividendDate && (!lot.endDate || dividendDate < lot.endDate)

    return inHoldingWindow ? sum + lot.quantity : sum
  }, 0)
}

function buildPortfolioMarketPoints(assets: Asset[], marketHistory: Record<string, MarketPricePoint[]>) {
  const dates = Array.from(new Set(Object.values(marketHistory).flatMap(points => points.map(point => point.date)))).sort()
  if (dates.length === 0) return []

  const pricedAssets = assets.map(asset => {
    const symbol = asset.symbol || ''
    const points = symbol ? marketHistory[symbol] || [] : []
    const priceByDate = new Map(points.map(point => [point.date, point.close]))
    const latestClose = points[points.length - 1]?.close
    const units = latestClose > 0 ? asset.currentValue / latestClose : 0

    return {
      asset,
      priceByDate,
      units,
      lastClose: undefined as number | undefined,
    }
  })

  return dates.map(date => {
    const value = pricedAssets.reduce((sum, item) => {
      const close = item.priceByDate.get(date)
      if (typeof close === 'number') item.lastClose = close

      if (item.units > 0 && typeof item.lastClose === 'number') {
        return sum + item.units * item.lastClose
      }

      return sum + item.asset.currentValue
    }, 0)

    return { date, value }
  })
}

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [txForm, setTxForm] = useState(emptyTransactionForm)
  const [dividendForm, setDividendForm] = useState(emptyDividendForm)
  const [showTxModal, setShowTxModal] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [activeTransactionPanel, setActiveTransactionPanel] = useState<TransactionPanel>('trades')
  const [showDividendModal, setShowDividendModal] = useState(false)
  const [showSymbolSearch, setShowSymbolSearch] = useState(false)
  const [activeHoldingMenu, setActiveHoldingMenu] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [symbolFilter, setSymbolFilter] = useState<SearchCategory>('Stock')
  const [symbolResults, setSymbolResults] = useState<SearchResult[]>([])
  const [symbolSearchBusy, setSymbolSearchBusy] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({})
  const [marketHistory, setMarketHistory] = useState<Record<string, MarketPricePoint[]>>({})
  const [marketHistoryErrors, setMarketHistoryErrors] = useState<Record<string, string>>({})
  const [dividendHistory, setDividendHistory] = useState<Record<string, DividendEvent[]>>({})
  const [dividendErrors, setDividendErrors] = useState<Record<string, string>>({})
  const [benchmarks, setBenchmarks] = useState<BenchmarkSeries[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month')
  const [activeDistributionPanel, setActiveDistributionPanel] = useState<DistributionPanel>('asset')
  const [hoveredDistributionKey, setHoveredDistributionKey] = useState<string | null>(null)
  const [showSoldHoldings, setShowSoldHoldings] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [calendarMonth, setCalendarMonth] = useState<Date | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<PerformancePanel | null>(null)
  const [assetTrendHover, setAssetTrendHover] = useState<ChartHoverState | null>(null)

  function showToast(message: string) {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(''), 2800)
  }

  async function refreshPortfolioData() {
    const [nextAssets, nextTxs] = await Promise.all([
      fetch('/api/investments', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/transactions', { credentials: 'include' }).then(r => r.json()),
    ])
    setAssets(Array.isArray(nextAssets) ? nextAssets : [])
    setTxs(Array.isArray(nextTxs) ? nextTxs : [])
  }

  useEffect(() => {
    fetch('/api/investments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAssets(Array.isArray(d) ? d : []))
    fetch('/api/transactions', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTxs(Array.isArray(d) ? d : []))
  }, [])

  async function addTransaction(event: React.FormEvent) {
    event.preventDefault()
    const total = Number(txForm.price || 0) * Number(txForm.quantity || 0) + Number(txForm.commission || 0)

    const res = await fetch('/api/transactions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...txForm, amount: total }),
    })

    if (!res.ok) return

    await res.json()

    await refreshPortfolioData()
    setTxForm(emptyTransactionForm())
    setShowTxModal(false)
    showToast('Transaction successfully added')
  }

  async function addDividend(event: React.FormEvent) {
    event.preventDefault()

    const res = await fetch('/api/transactions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'dividend',
        asset: dividendForm.asset,
        symbol: dividendForm.symbol,
        assetCategory: dividendForm.assetCategory,
        amount: Number(dividendForm.amount || 0),
        date: dividendForm.date,
        notes: dividendForm.notes,
      }),
    })

    if (!res.ok) return

    await refreshPortfolioData()
    setDividendForm(emptyDividendForm())
    setShowDividendModal(false)
    showToast('Dividend successfully added')
  }

  function changeAssetCategory(assetCategory: AssetCategory) {
    setTxForm(prev => ({
      ...prev,
      assetCategory,
      asset: '',
      symbol: '',
      price: '',
      bondReturn: '',
    }))

    if (assetCategory !== 'Bond') setSymbolFilter(assetCategory)
  }

  function openSymbolSearch() {
    if (txForm.assetCategory === 'Bond') return
    setSymbolFilter(txForm.assetCategory)
    setShowSymbolSearch(true)
  }

  async function selectSymbol(result: SearchResult) {
    let price = ''

    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(result.symbol)}`, { credentials: 'include' })
      const data = await res.json()
      const quotePrice = data?.quotes?.[result.symbol]?.price
      if (typeof quotePrice === 'number') price = String(quotePrice)
    } catch {
      price = ''
    }

    setTxForm(prev => ({
      ...prev,
      assetCategory: result.type,
      asset: result.name,
      symbol: result.symbol,
      price,
    }))
    setShowSymbolSearch(false)
  }

  function openHoldingTransaction(row: { asset: Asset; currentPrice: number }) {
    setTxForm({
      ...emptyTransactionForm(),
      assetCategory: row.asset.type as AssetCategory,
      asset: row.asset.name,
      symbol: row.asset.symbol || '',
      type: 'buy',
      price: row.currentPrice > 0 ? row.currentPrice.toFixed(2) : '',
      quantity: '1',
    })
    setActiveHoldingMenu(null)
    setShowTxModal(true)
  }

  function openHoldingDividend(row: { asset: Asset }) {
    setDividendForm({
      ...emptyDividendForm(),
      assetCategory: row.asset.type as AssetCategory,
      asset: row.asset.name,
      symbol: row.asset.symbol || '',
    })
    setActiveHoldingMenu(null)
    setShowDividendModal(true)
  }

  async function removeHolding(asset: Asset) {
    setActiveHoldingMenu(null)
    const confirmed = window.confirm(`Remove ${asset.name} from holdings?`)
    if (!confirmed) return

    const res = await fetch(`/api/investments?id=${encodeURIComponent(asset.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!res.ok) return

    await refreshPortfolioData()
    showToast('Holding removed')
  }

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!currentTime || calendarMonth) return
    setCalendarMonth(new Date(currentTime.getFullYear(), currentTime.getMonth(), 1))
  }, [calendarMonth, currentTime])

  useEffect(() => {
    const symbols = (Array.isArray(assets) ? assets : []).map(a => a.symbol).filter(Boolean) as string[]
    if (symbols.length === 0) return
    fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setQuotes(d.quotes || {})
        setQuoteErrors(d.errors || {})
      })
  }, [assets])

  useEffect(() => {
    fetch(`/api/market/benchmarks?period=${selectedPeriod}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBenchmarks(Array.isArray(d.series) ? d.series : []))
  }, [selectedPeriod])

  useEffect(() => {
    if (!showSymbolSearch || symbolQuery.trim().length === 0) {
      setSymbolResults([])
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSymbolSearchBusy(true)
      fetch(`/api/market/search?q=${encodeURIComponent(symbolQuery)}`, {
        credentials: 'include',
        signal: controller.signal,
      })
        .then(r => r.json())
        .then(d => setSymbolResults(d.results || []))
        .catch(() => null)
        .finally(() => setSymbolSearchBusy(false))
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [showSymbolSearch, symbolQuery])

  useEffect(() => {
    const symbols = (Array.isArray(assets) ? assets : []).map(a => a.symbol).filter(Boolean) as string[]

    if (symbols.length === 0) {
      setMarketHistory({})
      setMarketHistoryErrors({})
      return
    }

    fetch(`/api/market/history?symbols=${encodeURIComponent(symbols.join(','))}&period=${selectedPeriod}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setMarketHistory(d.series || {})
        setMarketHistoryErrors(d.errors || {})
      })
  }, [assets, selectedPeriod])

  useEffect(() => {
    const symbols = (Array.isArray(assets) ? assets : []).map(a => a.symbol).filter(Boolean) as string[]

    if (symbols.length === 0) {
      setDividendHistory({})
      setDividendErrors({})
      return
    }

    const datedTxs = (Array.isArray(txs) ? txs : []).map(tx => tx.date).filter(Boolean).sort()
    const start = datedTxs[0] || new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().slice(0, 10)

    fetch(`/api/market/dividends?symbols=${encodeURIComponent(symbols.join(','))}&start=${encodeURIComponent(start)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setDividendHistory(d.dividends || {})
        setDividendErrors(d.errors || {})
      })
  }, [assets, txs])

  const safeAssets = Array.isArray(assets) ? assets : []
  const safeTxs = Array.isArray(txs) ? txs : []
  const safeBenchmarks = Array.isArray(benchmarks) ? benchmarks : []
  const now = currentTime ?? new Date()
  const transactionTotal = Number(txForm.price || 0) * Number(txForm.quantity || 0) + Number(txForm.commission || 0)
  const symbolTypeCounts = symbolResults.reduce(
    (counts, result) => {
      counts[result.type] += 1
      return counts
    },
    { Stock: 0, 'Mutual Fund': 0, 'ETF/Fund': 0 } as Record<SearchCategory, number>,
  )
  const filteredSymbolResults = symbolResults.filter(result => result.type === symbolFilter)
  const holdingBaseRows = useMemo(
    () =>
      safeAssets.map(asset => {
        const quote = asset.symbol ? quotes[asset.symbol] : undefined
        const livePrice = typeof quote?.price === 'number' ? quote.price : null
        const storedQuantity = Number(asset.quantity)
        const netTransactionQuantity = safeTxs.reduce((sum, tx) => {
          if (!assetMatchesTransaction(asset, tx)) return sum

          const quantity = transactionQuantity(tx)
          if (quantity <= 0) return sum

          if (isBuyTx(tx)) return sum + quantity
          if (isSellTx(tx)) return sum - quantity
          return sum
        }, 0)
        const fallbackQuantity = livePrice && livePrice > 0 ? asset.currentValue / livePrice : 1
        const quantity = Number.isFinite(storedQuantity) && storedQuantity > 0 ? storedQuantity : netTransactionQuantity > 0 ? netTransactionQuantity : fallbackQuantity
        const currentPrice = livePrice ?? (quantity > 0 ? asset.currentValue / quantity : asset.currentValue)
        const currentValue = currentPrice && quantity > 0 ? currentPrice * quantity : asset.currentValue
        const invested = asset.purchasePrice
        const avgPrice = quantity > 0 ? invested / quantity : invested
        const unrealizedGain = currentValue - invested
        const dailyGain = typeof quote?.change === 'number' && quantity > 0 ? quote.change * quantity : 0
        const dividendEvents = asset.symbol ? dividendHistory[asset.symbol] || [] : []
        const totalDividend = calculateTotalDividend(asset, safeTxs, dividendEvents, quantity)
        const realizedGain = calculateRealizedGain(asset, safeTxs)
        const totalGain = unrealizedGain + realizedGain + totalDividend

        return {
          asset,
          quantity,
          avgPrice,
          currentPrice,
          invested,
          currentValue,
          unrealizedGain,
          realizedGain,
          dailyGain,
          totalDividend,
          totalGain,
        }
      }),
    [dividendHistory, quotes, safeAssets, safeTxs],
  )
  const holdingPortfolioValue = useMemo(() => holdingBaseRows.reduce((sum, row) => sum + row.currentValue, 0), [holdingBaseRows])
  const holdingInvested = useMemo(() => holdingBaseRows.reduce((sum, row) => sum + row.invested, 0), [holdingBaseRows])
  const holdingUnrealizedGain = useMemo(() => holdingBaseRows.reduce((sum, row) => sum + row.unrealizedGain, 0), [holdingBaseRows])
  const holdingRealizedGain = useMemo(() => holdingBaseRows.reduce((sum, row) => sum + row.realizedGain, 0), [holdingBaseRows])
  const holdingTotalDividend = useMemo(() => holdingBaseRows.reduce((sum, row) => sum + row.totalDividend, 0), [holdingBaseRows])
  const holdingRows = useMemo(
    () =>
      holdingBaseRows.map(row => ({
        ...row,
        allocation: holdingPortfolioValue > 0 ? (row.currentValue / holdingPortfolioValue) * 100 : 0,
      })),
    [holdingBaseRows, holdingPortfolioValue],
  )
  const displayedHoldingRows = useMemo(
    () => (showSoldHoldings ? holdingRows : holdingRows.filter(row => row.quantity > 0 || row.currentValue > 0)),
    [holdingRows, showSoldHoldings],
  )
  const distributionRows = useMemo<DistributionRow[]>(() => {
    const sourceRows =
      activeDistributionPanel === 'asset'
        ? displayedHoldingRows.map(row => ({
            key: row.asset.id,
            label: row.asset.symbol || row.asset.name,
            detail: row.asset.symbol ? row.asset.name : row.asset.type,
            value: row.currentValue,
          }))
        : Array.from(
            displayedHoldingRows.reduce((groups, row) => {
              const current = groups.get(row.asset.type) || { key: row.asset.type, label: row.asset.type, detail: 'Asset type', value: 0 }
              current.value += row.currentValue
              groups.set(row.asset.type, current)
              return groups
            }, new Map<string, { key: string; label: string; detail: string; value: number }>()),
          ).map(([, row]) => row)

    const total = sourceRows.reduce((sum, row) => sum + row.value, 0)

    return sourceRows
      .filter(row => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((row, index) => ({
        ...row,
        color: distributionColors[index % distributionColors.length],
        percent: total > 0 ? (row.value / total) * 100 : 0,
      }))
  }, [activeDistributionPanel, displayedHoldingRows])
  const distributionSegments = useMemo<DistributionSegment[]>(() => {
    let startAngle = 0

    return distributionRows.map(row => {
      const endAngle = startAngle + (row.percent / 100) * 360
      const segment = { ...row, startAngle, endAngle }
      startAngle = endAngle

      return segment
    })
  }, [distributionRows])
  const hoveredDistribution = distributionRows.find(row => row.key === hoveredDistributionKey) || null
  const tradeRows = useMemo(
    () => safeTxs.filter(tx => isBuyTx(tx) || isSellTx(tx)),
    [safeTxs],
  )
  const dividendRows = useMemo(() => {
    const manualRows = safeTxs.filter(isDividendTx).map(tx => ({
      id: tx.id,
      asset: tx.asset,
      symbol: tx.symbol || '',
      date: tx.date,
      amount: tx.amount,
      notes: tx.notes || '',
    }))
    const autoRows = holdingBaseRows.flatMap(row => {
      const symbol = row.asset.symbol || ''
      const events = symbol ? dividendHistory[symbol] || [] : []

      return events.map(event => {
        const shares = dividendSharesForDate(row.asset, safeTxs, event.date, row.quantity)
        const amount = shares * event.amount

        return {
          id: `auto-${row.asset.id}-${event.date}-${event.amount}`,
          asset: row.asset.name,
          symbol,
          date: event.date,
          amount,
          notes: '',
        }
      }).filter(row => row.amount > 0)
    })

    return [...manualRows, ...autoRows].sort((a, b) => b.date.localeCompare(a.date))
  }, [dividendHistory, holdingBaseRows, safeTxs])
  const activeTransactionRows = activeTransactionPanel === 'trades' ? tradeRows : dividendRows
  const displayedTradeRows = showAllTransactions ? tradeRows : tradeRows.slice(0, 5)
  const displayedDividendRows = showAllTransactions ? dividendRows : dividendRows.slice(0, 5)
  const total = holdingPortfolioValue
  const marketAssetPoints = useMemo(() => buildPortfolioMarketPoints(assets, marketHistory), [assets, marketHistory])
  const periodAssetPoints = useMemo(() => {
    if (marketAssetPoints.length > 0) return marketAssetPoints
    if (total > 0) return [{ date: dateKey(now), value: total }]
    return []
  }, [marketAssetPoints, now, total])
  const latestMarketTotal = periodAssetPoints[periodAssetPoints.length - 1]?.value ?? total
  const dayEarnPoints = useMemo(() => toDailyEarnPoints(periodAssetPoints), [periodAssetPoints])
  const todayChange = dayEarnPoints[dayEarnPoints.length - 1]?.value ?? 0
  const todayChangePercent = holdingPortfolioValue ? (todayChange / holdingPortfolioValue) * 100 : 0
  const cost = holdingInvested
  const gain = holdingUnrealizedGain
  const realizedGain = holdingRealizedGain + holdingTotalDividend
  const totalGain = gain + realizedGain
  const totalGainPercent = cost > 0 ? (totalGain / cost) * 100 : 0
  const todayTrend = todayChange >= 0 ? 'up' : 'down'
  const portfolioPeriodReturnPoints = useMemo(() => toPeriodReturnPoints(periodAssetPoints), [periodAssetPoints])
  const portfolioPeriodReturn = portfolioPeriodReturnPoints[portfolioPeriodReturnPoints.length - 1]?.value ?? 0
  const returnComparisonSeries = useMemo(
    () => [
      { label: 'Portfolio', color: '#f97316', points: portfolioPeriodReturnPoints },
      ...safeBenchmarks.map(benchmark => ({
        label: benchmark.label,
        color: benchmark.color,
        points: benchmark.points,
      })),
    ],
    [portfolioPeriodReturnPoints, safeBenchmarks],
  )
  const assetValueSeries = useMemo(
    () => [{ label: 'Portfolio Value', color: '#f97316', points: periodAssetPoints }],
    [periodAssetPoints],
  )
  const assetTrendActiveDate = assetTrendHover?.date ?? periodAssetPoints[periodAssetPoints.length - 1]?.date ?? dateKey(now)
  const assetTrendActiveIndex = Math.max(
    0,
    periodAssetPoints.findIndex(point => point.date === assetTrendActiveDate),
  )
  const assetTrendActivePoint = periodAssetPoints[assetTrendActiveIndex] ?? periodAssetPoints[periodAssetPoints.length - 1]
  const assetTrendActiveValue = assetTrendActivePoint?.value ?? latestMarketTotal
  const assetTrendPreviousValue = assetTrendActiveIndex > 0 ? periodAssetPoints[assetTrendActiveIndex - 1]?.value : undefined
  const assetTrendDailyChange = typeof assetTrendPreviousValue === 'number' ? assetTrendActiveValue - assetTrendPreviousValue : 0
  const assetTrendDailyChangePercent = assetTrendPreviousValue ? (assetTrendDailyChange / assetTrendPreviousValue) * 100 : 0
  const totalAssetMove =
    periodAssetPoints.length > 1 ? periodAssetPoints[periodAssetPoints.length - 1].value - periodAssetPoints[periodAssetPoints.length - 2].value : 0
  const returnTrend = portfolioPeriodReturn >= 0 ? 'up' : 'down'
  const assetTrend = assetTrendDailyChange >= 0 ? 'up' : 'down'
  const currentTimeLabel = currentTime
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(currentTime)
    : 'Loading time'
  const displayedCalendarMonth = calendarMonth ?? new Date(now.getFullYear(), now.getMonth(), 1)
  const calendarCells = useMemo(
    () => buildCalendarCells(displayedCalendarMonth, dayEarnPoints, holdingPortfolioValue),
    [dayEarnPoints, displayedCalendarMonth, holdingPortfolioValue],
  )
  const calendarMonthEarn = calendarCells
    .filter(cell => cell.inMonth)
    .reduce((sum, cell) => sum + (cell.earn ?? 0), 0)
  const calendarMonthReturn = holdingPortfolioValue ? (calendarMonthEarn / holdingPortfolioValue) * 100 : 0

  return (
    <div>
      {toastMessage ? <div className="toast-message">{toastMessage}</div> : null}

      <section className="portfolio-top">
        <div className="portfolio-title-row">
          <div>
            <h1>
              My portfolio
            </h1>
          </div>
          <div className="top-actions">
            <button type="button" className="add-transaction-btn" onClick={() => setShowTxModal(true)}>
              Add transaction
            </button>
          </div>
        </div>

        <div className="portfolio-metrics">
          <div className="portfolio-metric-card">
            <span>Portfolio value</span>
            <strong>{holdingPortfolioValue.toFixed(2)}<small>USD</small></strong>
          </div>
          <div className="portfolio-metric-card">
            <span>Unrealized gain</span>
            <strong className={gain >= 0 ? 'up' : 'down'}>{formatCalendarMoney(gain)}<small>USD</small></strong>
            <p>Last day <b className={todayChange >= 0 ? 'up' : 'down'}>{formatCalendarMoney(todayChange)}</b> <b className={todayChange >= 0 ? 'up' : 'down'}>{formatSignedPercent(todayChangePercent)}</b></p>
          </div>
          <div className="portfolio-metric-card">
            <span>Realized gain</span>
            <strong className={realizedGain >= 0 ? 'up' : 'down'}>{formatCalendarMoney(realizedGain)}<small>USD</small></strong>
            <p>Total dividends {holdingTotalDividend.toFixed(2)} USD</p>
          </div>
          <div className="portfolio-metric-card">
            <span>Total gain</span>
            <strong className={totalGain >= 0 ? 'up' : 'down'}>{formatCalendarMoney(totalGain)}<small>USD</small></strong>
            <p>Return <b className={totalGain >= 0 ? 'up' : 'down'}>{formatSignedPercent(totalGainPercent)}</b></p>
          </div>
        </div>
      </section>

      {showTxModal ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowTxModal(false)}>
          <form className="transaction-modal" onSubmit={addTransaction} onMouseDown={event => event.stopPropagation()}>
            <div className="modal-title-row">
              <h2>Add transaction</h2>
              <button type="button" className="modal-close" onClick={() => setShowTxModal(false)} aria-label="Close transaction form">
                x
              </button>
            </div>
            <div className="modal-body">
              <label>Side</label>
              <div className="side-control">
                <button
                  type="button"
                  className={txForm.type === 'sell' ? 'active sell' : ''}
                  onClick={() => setTxForm({ ...txForm, type: 'sell' })}
                >
                  Sell
                </button>
                <button
                  type="button"
                  className={txForm.type === 'buy' ? 'active buy' : ''}
                  onClick={() => setTxForm({ ...txForm, type: 'buy' })}
                >
                  Buy
                </button>
              </div>

              <label>Asset category</label>
              <select className="category-select" value={txForm.assetCategory} onChange={e => changeAssetCategory(e.target.value as AssetCategory)}>
                <option value="Bond">Bond</option>
                <option value="Stock">Stock</option>
                <option value="Mutual Fund">Mutual fund</option>
                <option value="ETF/Fund">ETFs/Fund</option>
              </select>

              {txForm.assetCategory === 'Bond' ? (
                <div className="bond-fields">
                  <div>
                    <label>Bond name</label>
                    <input value={txForm.asset} onChange={e => setTxForm({ ...txForm, asset: e.target.value })} placeholder="Enter bond name" required />
                  </div>
                  <div>
                    <label>Bond return (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={txForm.bondReturn}
                      onChange={e => setTxForm({ ...txForm, bondReturn: e.target.value })}
                      placeholder="e.g. 4.5"
                      required
                    />
                  </div>
                </div>
              ) : (
                <>
                  <label>Symbol</label>
                  <button type="button" className="symbol-select" onClick={openSymbolSearch}>
                    <span>{txForm.symbol ? `${txForm.symbol} - ${txForm.asset}` : `Choose ${searchCategoryLabel(txForm.assetCategory).toLowerCase()}`}</span>
                    <b>v</b>
                  </button>
                </>
              )}

              <div className="transaction-form-grid">
                <div>
                  <label>Date</label>
                  <input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} required />
                </div>
                <div>
                  <label>Price</label>
                  <input type="number" min="0" step="0.01" value={txForm.price} onChange={e => setTxForm({ ...txForm, price: e.target.value })} required />
                </div>
                <div>
                  <label>Quantity</label>
                  <input type="number" min="0" step="0.0001" value={txForm.quantity} onChange={e => setTxForm({ ...txForm, quantity: e.target.value })} required />
                </div>
                <div>
                  <label>Commission</label>
                  <input type="number" min="0" step="0.01" value={txForm.commission} onChange={e => setTxForm({ ...txForm, commission: e.target.value })} />
                </div>
              </div>

              <div className="notes-row">
                <label>Notes</label>
                <span>{txForm.notes.length}/128</span>
              </div>
              <textarea
                maxLength={128}
                value={txForm.notes}
                onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                placeholder="Some comments"
              />

              <div className="transaction-total">
                <span>Total</span>
                <strong>{transactionTotal.toFixed(2)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowTxModal(false)}>Cancel</button>
              <button
                type="submit"
                disabled={
                  txForm.assetCategory === 'Bond'
                    ? !txForm.asset || !txForm.bondReturn || !txForm.price || !txForm.quantity
                    : !txForm.symbol || !txForm.price || !txForm.quantity
                }
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showDividendModal ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowDividendModal(false)}>
          <form className="transaction-modal" onSubmit={addDividend} onMouseDown={event => event.stopPropagation()}>
            <div className="modal-title-row">
              <h2>Add dividends</h2>
              <button type="button" className="modal-close" onClick={() => setShowDividendModal(false)} aria-label="Close dividend form">
                x
              </button>
            </div>
            <div className="modal-body">
              <label>Symbol</label>
              <div className="symbol-select paired-symbol">
                <span>{dividendForm.symbol ? `${dividendForm.symbol} - ${dividendForm.asset}` : dividendForm.asset}</span>
              </div>

              <div className="transaction-form-grid">
                <div>
                  <label>Date</label>
                  <input type="date" value={dividendForm.date} onChange={e => setDividendForm({ ...dividendForm, date: e.target.value })} required />
                </div>
                <div>
                  <label>Total dividend</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dividendForm.amount}
                    onChange={e => setDividendForm({ ...dividendForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="notes-row">
                <label>Notes</label>
                <span>{dividendForm.notes.length}/128</span>
              </div>
              <textarea
                maxLength={128}
                value={dividendForm.notes}
                onChange={e => setDividendForm({ ...dividendForm, notes: e.target.value })}
                placeholder="Some comments"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowDividendModal(false)}>Cancel</button>
              <button type="submit" disabled={!dividendForm.asset || !dividendForm.date || !dividendForm.amount}>Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {showSymbolSearch ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSymbolSearch(false)}>
          <div className="symbol-search-modal" onMouseDown={event => event.stopPropagation()}>
            <div className="modal-title-row">
              <h2>Symbol search</h2>
              <button type="button" className="modal-close" onClick={() => setShowSymbolSearch(false)} aria-label="Close symbol search">
                x
              </button>
            </div>
            <div className="symbol-search-input">
              <input value={symbolQuery} onChange={e => setSymbolQuery(e.target.value)} placeholder="Symbol, ISIN, or CUSIP" autoFocus />
            </div>
            <div className="symbol-filter-tabs">
              {(['Stock', 'Mutual Fund', 'ETF/Fund'] as const).map(filter => (
                <button
                  type="button"
                  key={filter}
                  className={symbolFilter === filter ? 'active' : ''}
                  onClick={() => setSymbolFilter(filter)}
                >
                  {searchCategoryLabel(filter)}
                  <span>{symbolTypeCounts[filter]}</span>
                </button>
              ))}
            </div>
            <div className="symbol-source-row">
              <span>Yahoo Finance</span>
              <span>Showing {searchCategoryLabel(symbolFilter).toLowerCase()} only</span>
            </div>
            <div className="symbol-results">
              {symbolSearchBusy ? <p>Searching...</p> : null}
              {!symbolSearchBusy && symbolQuery && filteredSymbolResults.length === 0 ? (
                <p>
                  {symbolResults.length > 0
                    ? `Yahoo returned ${symbolResults.length} supported result${symbolResults.length === 1 ? '' : 's'}, but none in ${searchCategoryLabel(symbolFilter)}.`
                    : `No matching ${searchCategoryLabel(symbolFilter).toLowerCase()} from Yahoo Finance.`}
                </p>
              ) : null}
              {filteredSymbolResults.map(result => (
                <button type="button" key={`${result.symbol}-${result.type}`} className="symbol-result-row" onClick={() => selectSymbol(result)}>
                  <span className="symbol-badge">{result.type[0]}</span>
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                  <small>{result.type}</small>
                  <em>{result.exchange || 'Yahoo'}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="portfolio-distribution-section">
        <div className="distribution-title-row">
          <h2>Portfolio distribution</h2>
        </div>
        <div className="distribution-tabs" aria-label="Portfolio distribution views">
          <button
            type="button"
            className={activeDistributionPanel === 'asset' ? 'active' : ''}
            onClick={() => setActiveDistributionPanel('asset')}
          >
            Assets
          </button>
          <button
            type="button"
            className={activeDistributionPanel === 'type' ? 'active' : ''}
            onClick={() => setActiveDistributionPanel('type')}
          >
            Asset types
          </button>
        </div>
        <div className="distribution-content">
          <div
            className="distribution-chart-wrap"
            onMouseLeave={() => setHoveredDistributionKey(null)}
          >
            <div className="distribution-chart" aria-label="Portfolio distribution donut chart">
              {distributionSegments.length > 0 ? (
                <svg viewBox="0 0 280 280" role="img" aria-label="Portfolio distribution">
                  {distributionSegments.map(segment => (
                    <path
                      key={segment.key}
                      d={donutSegmentPath(segment.startAngle, segment.endAngle)}
                      fill={segment.color}
                      tabIndex={0}
                      className={hoveredDistributionKey === segment.key ? 'active' : ''}
                      onMouseEnter={() => setHoveredDistributionKey(segment.key)}
                      onMouseLeave={() => setHoveredDistributionKey(null)}
                      onFocus={() => setHoveredDistributionKey(segment.key)}
                      onBlur={() => setHoveredDistributionKey(null)}
                    >
                      <title>{`${segment.label}: ${segment.percent.toFixed(2)}%, ${compactUsd(segment.value)}`}</title>
                    </path>
                  ))}
                </svg>
              ) : null}
              <div className="distribution-chart-hole">
                <strong>{distributionSegments.length}</strong>
                <span>{activeDistributionPanel === 'asset' ? 'Total assets' : 'Asset types'}</span>
              </div>
            </div>
            {hoveredDistribution ? (
              <div className="distribution-hover-card">
                <span className="distribution-color" style={{ background: hoveredDistribution.color }} aria-hidden="true" />
                <div>
                  <strong>{hoveredDistribution.label}</strong>
                  <small>{hoveredDistribution.detail}</small>
                </div>
                <b>{hoveredDistribution.percent.toFixed(2)}%</b>
                <em>{compactUsd(hoveredDistribution.value)}</em>
              </div>
            ) : null}
            {distributionSegments.length === 0 ? <p className="distribution-empty">No holding data yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="holdings-section">
        <div className="holdings-title-row">
          <h2>Total holdings</h2>
        </div>
        <div className="holdings-toolbar">
          <div className="holdings-actions">
            <label className="sold-toggle">
              <span>Display sold</span>
              <input
                type="checkbox"
                checked={showSoldHoldings}
                onChange={event => setShowSoldHoldings(event.target.checked)}
                aria-label="Display sold holdings"
              />
              <i aria-hidden="true" />
            </label>
          </div>
        </div>
        <div className="holdings-table-wrap">
          <table className="holdings-table">
            <thead>
              <tr>
                <th align="left" className="holding-symbol-head">
                  <div className="holding-symbol-head-content">
                    <span>
                      Symbol
                      <small>{displayedHoldingRows.length} holding{displayedHoldingRows.length === 1 ? '' : 's'}</small>
                    </span>
                  </div>
                </th>
                <th align="right">Allocation</th>
                <th align="right">Qty</th>
                <th align="right">Avg price</th>
                <th align="right">Current price</th>
                <th align="right">Invested</th>
                <th align="right">Current value</th>
                <th align="right">Unrealized gain</th>
                <th align="right">Daily gain</th>
                <th align="right">Total dividend</th>
                <th align="right">Total gain</th>
                <th align="right" aria-label="Holding actions" />
              </tr>
            </thead>
            <tbody>
              {displayedHoldingRows.map(row => (
                <tr key={row.asset.id}>
                  <td>
                    <div className="holding-name-cell">
                      <span className="symbol-pill">{row.asset.symbol || row.asset.type.slice(0, 3).toUpperCase()}</span>
                      <strong>{row.asset.name}</strong>
                    </div>
                  </td>
                  <td align="right">{row.allocation.toFixed(2)}%</td>
                  <td align="right">{row.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td align="right">{compactUsd(row.avgPrice)}</td>
                  <td align="right">{compactUsd(row.currentPrice)}</td>
                  <td align="right">{compactUsd(row.invested)}</td>
                  <td align="right">{compactUsd(row.currentValue)}</td>
                  <td align="right" className={row.unrealizedGain >= 0 ? 'gain-up' : 'gain-down'}>
                    {compactUsd(row.unrealizedGain)}
                  </td>
                  <td align="right" className={row.dailyGain >= 0 ? 'gain-up' : 'gain-down'}>
                    {compactUsd(row.dailyGain)}
                  </td>
                  <td align="right" title={row.asset.symbol && dividendErrors[row.asset.symbol] ? dividendErrors[row.asset.symbol] : undefined}>
                    {compactUsd(row.totalDividend)}
                  </td>
                  <td align="right" className={row.totalGain >= 0 ? 'gain-up' : 'gain-down'}>
                    {compactUsd(row.totalGain)}
                  </td>
                  <td align="right" className="holding-action-cell">
                    <div className="holding-action-menu-wrap">
                      <button
                        type="button"
                        className="holding-action-button"
                        aria-label={`Open actions for ${row.asset.name}`}
                        onClick={() => setActiveHoldingMenu(activeHoldingMenu === row.asset.id ? null : row.asset.id)}
                      >
                        ...
                      </button>
                      {activeHoldingMenu === row.asset.id ? (
                        <div className="holding-action-menu">
                          <button type="button" onClick={() => openHoldingTransaction(row)}>
                            <span aria-hidden="true">+</span>
                            Add transaction...
                          </button>
                          <button type="button" onClick={() => openHoldingDividend(row)}>
                            <span aria-hidden="true">$</span>
                            Add dividends...
                          </button>
                          <button type="button" className="remove" onClick={() => removeHolding(row.asset)}>
                            <span aria-hidden="true">x</span>
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="performance-toolbar">
        <div>
          <h2>Portfolio Performance</h2>
          <p>{currentTimeLabel}</p>
        </div>
        <div className="period-control" aria-label="Select chart time period">
          {periodOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={selectedPeriod === option.value ? 'active' : ''}
              onClick={() => setSelectedPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="performance-grid">
        <div
          className={panelClass(expandedPanel, 'return')}
          onClick={() => setExpandedPanel('return')}
          style={{ animationDelay: '0.18s' }}
        >
          <div className="performance-header">
            <div>
              <h3>Return Rate Trend</h3>
              <p>Daily return from market close prices</p>
            </div>
            <span className={`trend-indicator ${returnTrend}`}>
              <span className="trend-triangle" aria-hidden="true" />
              {formatSignedPercent(portfolioPeriodReturn)}
            </span>
          </div>
          <PortfolioChart
            series={returnComparisonSeries}
            ariaLabel="Portfolio return rate trend"
            color="#0ea5a4"
            fillColor="rgba(14,165,164,0.1)"
          />
          <div className="chart-legend">
            {returnComparisonSeries.map(seriesItem => {
              const last = seriesItem.points[seriesItem.points.length - 1]?.value ?? 0

              return (
                <span key={seriesItem.label}>
                  <i style={{ background: seriesItem.color }} />
                  {seriesItem.label}
                  <b className={last >= 0 ? 'up' : 'down'}>{formatSignedPercent(last)}</b>
                </span>
              )
            })}
          </div>
        </div>

        <div
          className={panelClass(expandedPanel, 'asset', 'market-trend-card')}
          onClick={() => setExpandedPanel('asset')}
          style={{ animationDelay: '0.22s' }}
        >
          <div className="market-trend-top">
            <div>
              <span>{formatTrendDate(assetTrendActiveDate)} - Total Asset Value USD</span>
              <strong>{formatMoney(assetTrendActiveValue)}</strong>
            </div>
            <div>
              <span>
                <i aria-hidden="true" />
                Daily Change
              </span>
              <strong className={assetTrend}>
                {formatSignedUsd(assetTrendDailyChange)} ({formatSignedPercent(assetTrendDailyChangePercent)})
              </strong>
            </div>
          </div>
          <PortfolioChart
            series={assetValueSeries}
            ariaLabel="Total asset trend"
            showTooltip={false}
            showAxisLabels
            showDateRangeLabels
            includeZero={false}
            formatValue={formatAxisUsd}
            onHoverChange={setAssetTrendHover}
          />
          <div className="chart-legend market-trend-legend">
            {assetValueSeries.map(seriesItem => {
              const active = assetTrendHover?.points.find(point => point.label === seriesItem.label)?.value
              const last = seriesItem.points[seriesItem.points.length - 1]?.value ?? 0
              const value = active ?? last

              return (
                <span key={seriesItem.label}>
                  <i style={{ background: seriesItem.color }} />
                  {seriesItem.label}
                  <b>{formatMoney(value)}</b>
                </span>
              )
            })}
          </div>
        </div>

        <div
          className={panelClass(expandedPanel, 'earn', 'day-earn-calendar-card')}
          onClick={() => setExpandedPanel('earn')}
          style={{ animationDelay: '0.26s' }}
        >
          <div className="performance-header">
            <div>
              <h3>Day Earn</h3>
              <p>Difference between consecutive market days</p>
            </div>
            <span className={`trend-indicator ${todayTrend}`}>
              <span className="trend-triangle" aria-hidden="true" />
              {formatSignedUsd(todayChange)}
            </span>
          </div>
          <div className="calendar-toolbar" onClick={event => event.stopPropagation()}>
            <div className="calendar-month-control">
              <button type="button" onClick={() => setCalendarMonth(addMonths(displayedCalendarMonth, -1))}>
                Prev
              </button>
              <strong>
                {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(displayedCalendarMonth)}
              </strong>
              <button type="button" onClick={() => setCalendarMonth(addMonths(displayedCalendarMonth, 1))}>
                Next
              </button>
            </div>
            <div className="calendar-summary">
              <span>
                Month Earn <b className={calendarMonthEarn >= 0 ? 'up' : 'down'}>{formatSignedUsd(calendarMonthEarn)}</b>
              </span>
              <span>
                Return Rate <b className={calendarMonthReturn >= 0 ? 'up' : 'down'}>{formatSignedPercent(calendarMonthReturn)}</b>
              </span>
            </div>
          </div>
          <div className="calendar-scroll">
            <div className="earn-calendar">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
              {calendarCells.map(cell => (
                <div className={`calendar-cell ${cell.inMonth ? '' : 'muted'}`} key={cell.key}>
                  <span className="calendar-day">{cell.day}</span>
                  {cell.earn !== undefined && Math.abs(cell.earn) > 0.005 ? (
                    <span className={`calendar-earn ${cell.earn >= 0 ? 'up' : 'down'}`}>
                      {formatCalendarMoney(cell.earn)}
                      <small>{formatSignedPercent(cell.returnRate ?? 0)}</small>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="transaction-table-card">
        <div className="transaction-table-title">
          <h2>Transactions</h2>
        </div>
        <div className="transaction-toolbar">
          <div className="transaction-tabs" aria-label="Transaction views">
            <button
              type="button"
              className={activeTransactionPanel === 'trades' ? 'active' : ''}
              onClick={() => {
                setActiveTransactionPanel('trades')
                setShowAllTransactions(false)
              }}
            >
              Trades
            </button>
            <button
              type="button"
              className={activeTransactionPanel === 'dividends' ? 'active' : ''}
              onClick={() => {
                setActiveTransactionPanel('dividends')
                setShowAllTransactions(false)
              }}
            >
              Dividends
            </button>
          </div>
          {activeTransactionRows.length > 5 ? (
            <button type="button" className="transaction-more-button" onClick={() => setShowAllTransactions(prev => !prev)}>
              {showAllTransactions ? 'Show recent' : `More (${activeTransactionRows.length})`}
            </button>
          ) : null}
        </div>
        <table className="transactions-table">
          <thead>
            {activeTransactionPanel === 'trades' ? (
              <tr>
                <th align="left" className="transaction-symbol-head">
                  <div className="holding-symbol-head-content">
                    <span>
                      Symbol
                      <small>{activeTransactionRows.length} transaction{activeTransactionRows.length === 1 ? '' : 's'}</small>
                    </span>
                  </div>
                </th>
                <th align="left">Side</th>
                <th align="left">Date</th>
                <th align="right">Qty</th>
                <th align="right">Price</th>
                <th align="right">Commission</th>
                <th align="right">Total</th>
                <th align="left">Notes</th>
              </tr>
            ) : (
              <tr>
                <th align="left" className="transaction-symbol-head">
                  <div className="holding-symbol-head-content">
                    <span>
                      Symbol
                      <small>{activeTransactionRows.length} dividend{activeTransactionRows.length === 1 ? '' : 's'}</small>
                    </span>
                  </div>
                </th>
                <th align="left">Date</th>
                <th align="right">Total dividend</th>
                <th align="left">Notes</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTransactionPanel === 'trades'
              ? displayedTradeRows.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <div className="holding-name-cell">
                        <span className="symbol-pill">{tx.symbol || (tx.assetCategory || 'TX').slice(0, 3).toUpperCase()}</span>
                        <strong>{tx.asset}</strong>
                      </div>
                    </td>
                    <td className={isBuyTx(tx) ? 'gain-up' : 'gain-down'}>
                      {isBuyTx(tx) ? 'Buy' : 'Sell'}
                    </td>
                    <td>{formatTransactionDate(tx.date)}</td>
                    <td align="right">{tx.quantity ? tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-'}</td>
                    <td align="right">{typeof tx.price === 'number' && tx.price > 0 ? compactUsd(tx.price) : '-'}</td>
                    <td align="right">{compactUsd(tx.commission || 0)}</td>
                    <td align="right">{compactUsd(tx.amount)}</td>
                    <td>{tx.notes || '-'}</td>
                  </tr>
                ))
              : displayedDividendRows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div className="holding-name-cell">
                        <span className="symbol-pill">{row.symbol || 'DIV'}</span>
                        <strong>{row.asset}</strong>
                      </div>
                    </td>
                    <td>{formatTransactionDate(row.date)}</td>
                    <td align="right">{compactUsd(row.amount)}</td>
                    <td>{row.notes || '-'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </section>

    </div>
  )
}
