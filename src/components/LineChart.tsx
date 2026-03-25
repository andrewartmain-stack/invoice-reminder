'use client'

import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

type SeriesData = {
  label: string
  data: number[]
  color: string
}

type LineChartProps = {
  series: SeriesData[]
  labels: string[]
  currencySymbol?: string
  formatValue?: (v: number) => string
}

const PERIODS = [3, 6, 12] as const

const fadeCSS = `
@keyframes _fadeUp {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
._fade-up { animation: _fadeUp 0.2s ease both; }
`

export function LineChart({ series, labels, currencySymbol = '$', formatValue }: LineChartProps) {
  const [activeSeries, setActiveSeries] = useState<string | 'all'>('all')
  const [periods, setPeriods] = useState<number>(6)
  const [animKey, setAnimKey] = useState(0)

  const trigger = (fn: () => void) => { fn(); setAnimKey(k => k + 1) }

  const fmt = formatValue ?? ((v: number) => `${currencySymbol}${v.toLocaleString()}`)

  const filtered = activeSeries === 'all' ? series : series.filter(s => s.label === activeSeries)
  const sliced = filtered.map(s => ({ ...s, slicedData: s.data.slice(-periods) }))
  const slicedLabels = labels.slice(-periods)

  const total = sliced.reduce((sum, s) => sum + s.slicedData.reduce((a, b) => a + b, 0), 0)

  const datasets = sliced.map(s => ({
    label: s.label,
    data: s.slicedData,
    borderColor: s.color,
    backgroundColor: (ctx: any) => {
      if (!ctx.chart.chartArea) return `${s.color}15`
      const { top, bottom } = ctx.chart.chartArea
      const g = ctx.chart.ctx.createLinearGradient(0, top, 0, bottom)
      g.addColorStop(0, `${s.color}25`)
      g.addColorStop(1, `${s.color}00`)
      return g
    },
    borderWidth: 1.5,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill: true,
  }))

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300, easing: 'easeInOutQuart' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#999',
        bodyColor: '#111',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        usePointStyle: true,
        boxPadding: 4,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
        },
      },
    },
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#bbb', font: { size: 10 }, maxRotation: 0 },
      },
      y: { display: false },
    },
  }

  return (
    <>
      <style>{fadeCSS}</style>
      <div>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <select
            value={activeSeries}
            onChange={e => trigger(() => setActiveSeries(e.target.value))}
            style={{
              padding: '4px 28px 4px 10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fafafa',
              color: '#555',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              fontFamily: 'inherit',
            }}
          >
            <option value="all">All</option>
            {series.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 1 }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => trigger(() => setPeriods(p))} style={{
                padding: '3px 9px',
                border: 'none',
                background: periods === p ? '#f3f4f6' : 'transparent',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: periods === p ? 600 : 400,
                color: periods === p ? '#111' : '#bbb',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}>
                {p}M
              </button>
            ))}
          </div>
        </div>

        {/* Total stat */}
        <div key={animKey} className="_fade-up" style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: '#111', fontFamily: 'inherit' }}>
            {fmt(total)}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {series.map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#999', fontFamily: 'inherit' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ height: 130 }}>
          <Line data={{ labels: slicedLabels, datasets }} options={options} />
        </div>
      </div>
    </>
  )
}
