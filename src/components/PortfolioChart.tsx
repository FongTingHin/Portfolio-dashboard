'use client'

import React, { useMemo, useState } from 'react'

type Point = { date: string; value: number }
type ChartSeries = { label: string; points: Point[]; color: string }
type HoverPoint = { label: string; value: number; color: string }
export type ChartHoverState = { date: string; x: number; points: HoverPoint[] }

function getRange(points: Point[], includeZero = true) {
  const values = points.map(p => p.value)
  const min = includeZero ? Math.min(...values, 0) : Math.min(...values)
  const max = includeZero ? Math.max(...values, 1) : Math.max(...values)
  const range = Math.max(max - min, 1)

  return { min, max, range }
}

function toPath(points: Point[], width: number, height: number, min: number, range: number) {
  if (points.length === 0) return ''

  return points
    .map((p, i) => {
      const x = points.length === 1 ? width : (i / (points.length - 1)) * width
      const y = height - ((p.value - min) / range) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function getSeriesDates(series: ChartSeries[]) {
  return Array.from(new Set(series.flatMap(item => item.points.map(point => point.date)))).sort()
}

function xForIndex(index: number, count: number, width: number) {
  return count <= 1 ? width : (index / (count - 1)) * width
}

function yForValue(value: number, height: number, min: number, range: number) {
  return height - ((value - min) / range) * height
}

function toSeriesPath(item: ChartSeries, dates: string[], width: number, height: number, min: number, range: number) {
  const pointsByDate = new Map(item.points.map(point => [point.date, point.value]))
  const commands = dates
    .map((date, index) => {
      const value = pointsByDate.get(date)
      if (typeof value !== 'number') return null

      const x = xForIndex(index, dates.length, width)
      const y = yForValue(value, height, min, range)
      return { x, y }
    })
    .filter((point): point is { x: number; y: number } => point !== null)

  return commands.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

function bars(points: Point[], width: number, height: number, color: string) {
  if (points.length === 0) return null
  const { min, range } = getRange(points)
  const barWidth = Math.max(width / points.length - 8, 8)
  const zeroY = height - ((0 - min) / range) * height

  return points.map((p, i) => {
    const x = (i / points.length) * width + 4
    const y = height - ((p.value - min) / range) * height
    const rectY = Math.min(y, zeroY)
    const rectHeight = Math.max(Math.abs(zeroY - y), 2)

    return (
      <rect
        key={`${p.date}-${i}`}
        x={x}
        y={rectY}
        width={barWidth}
        height={rectHeight}
        rx="4"
        fill={p.value >= 0 ? color : '#dc2626'}
      />
    )
  })
}

function formatTooltipValue(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatTooltipDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

type PortfolioChartProps = {
  points?: Point[]
  series?: ChartSeries[]
  ariaLabel?: string
  color?: string
  fillColor?: string
  variant?: 'line' | 'bar'
  showTooltip?: boolean
  showAxisLabels?: boolean
  showDateRangeLabels?: boolean
  includeZero?: boolean
  formatValue?: (value: number) => string
  onHoverChange?: (hover: ChartHoverState | null) => void
}

export default function PortfolioChart({
  points = [],
  series,
  ariaLabel = 'Portfolio history',
  color = '#0ea5a4',
  fillColor = 'rgba(14,165,164,0.08)',
  variant = 'line',
  showTooltip = true,
  showAxisLabels = false,
  showDateRangeLabels = false,
  includeZero = true,
  formatValue = formatTooltipValue,
  onHoverChange,
}: PortfolioChartProps) {
  const width = 520
  const height = 160
  const [hover, setHover] = useState<ChartHoverState | null>(null)
  const allPoints = series?.flatMap(item => item.points) ?? points
  const seriesDates = useMemo(() => (series ? getSeriesDates(series) : []), [series])
  const { min, max, range } = getRange(allPoints, includeZero)
  const path = toPath(points, width, height, min, range)
  const firstDate = series ? seriesDates[0] : points[0]?.date
  const lastDate = series ? seriesDates[seriesDates.length - 1] : points[points.length - 1]?.date

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!series || seriesDates.length === 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - rect.left) / rect.width) * width
    const index = Math.min(seriesDates.length - 1, Math.max(0, Math.round((pointerX / width) * (seriesDates.length - 1))))
    const date = seriesDates[index]
    const pointsForDate = series
      .map(item => {
        const value = item.points.find(point => point.date === date)?.value
        return typeof value === 'number' ? { label: item.label, value, color: item.color } : null
      })
      .filter((item): item is HoverPoint => item !== null)

    const nextHover = {
      date,
      x: xForIndex(index, seriesDates.length, width),
      points: pointsForDate,
    }

    setHover(nextHover)
    onHoverChange?.(nextHover)
  }

  function handlePointerLeave() {
    setHover(null)
    onHoverChange?.(null)
  }

  if (allPoints.length === 0) {
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <line x1="0" y1={height} x2={width} y2={height} stroke="#e4e2df" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <div className="chart-shell">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id={`line-${color.replace('#', '')}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {series ? (
          <>
            <line
              x1="0"
              y1={height - ((0 - min) / range) * height}
              x2={width}
              y2={height - ((0 - min) / range) * height}
              stroke="#d7d2ca"
              strokeWidth="1"
            />
            {showAxisLabels ? (
              <>
                <text x={width} y="8" textAnchor="end" className="chart-axis-label">
                  {formatValue(max)}
                </text>
                <text x={width} y={height - 3} textAnchor="end" className="chart-axis-label">
                  {formatValue(min)}
                </text>
              </>
            ) : null}
            {series.map(item => (
              <path
                key={item.label}
                d={toSeriesPath(item, seriesDates, width, height, min, range)}
                fill="none"
                stroke={item.color}
                strokeWidth={item.label.includes('Portfolio') ? '4' : '2'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {hover ? (
              <>
                <line x1={hover.x} y1="0" x2={hover.x} y2={height} stroke="#8b8580" strokeDasharray="4 4" strokeWidth="1" />
                {hover.points.map(item => (
                  <circle
                    key={item.label}
                    cx={hover.x}
                    cy={yForValue(item.value, height, min, range)}
                    r={item.label === 'Portfolio' ? '4' : '3'}
                    fill={item.color}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                ))}
              </>
            ) : null}
            <rect x="0" y="0" width={width} height={height} fill="transparent" />
          </>
        ) : variant === 'bar' ? (
          bars(points, width, height, color)
        ) : (
          <>
            <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={fillColor} />
            <path d={path} fill="none" stroke={`url(#line-${color.replace('#', '')})`} strokeWidth="4" />
          </>
        )}
      </svg>
      {showDateRangeLabels && firstDate && lastDate ? (
        <div className="chart-date-range">
          <span>{firstDate}</span>
          <span>{lastDate}</span>
        </div>
      ) : null}
      {showTooltip && hover ? (
        <div className={`chart-tooltip ${hover.x > width * 0.62 ? 'left' : ''}`} style={{ left: `${(hover.x / width) * 100}%` }}>
          <strong>{formatTooltipDate(hover.date)}</strong>
          {hover.points.map(item => (
            <span key={item.label}>
              <i style={{ background: item.color }} />
              {item.label}
              <b className={item.value >= 0 ? 'up' : 'down'}>{formatValue(item.value)}</b>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
