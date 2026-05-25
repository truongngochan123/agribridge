import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import XLSXStyle from 'xlsx-js-style'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'
import type { MonthlyRevenueBar } from '../../types/supplierDashboard'
import { OverviewSkeletonLoader } from '../../components/supplier/SupplierSkeletons'

// ─── Types & Helpers ──────────────────────────────────────────────────────────

type PeriodKey = '7d' | '30d' | '3m' | '12m'

const PERIOD_OPTIONS: { key: PeriodKey; label: string; sliceMonths: number }[] = [
  { key: '7d', label: '7 ngày', sliceMonths: 1 },
  { key: '30d', label: '30 ngày', sliceMonths: 2 },
  { key: '3m', label: '3 tháng', sliceMonths: 3 },
  { key: '12m', label: '12 tháng', sliceMonths: 12 },
]

function formatVND(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
  return value.toLocaleString('vi-VN')
}

function filterRevenue(revenues: MonthlyRevenueBar[], period: PeriodKey): MonthlyRevenueBar[] {
  const opt = PERIOD_OPTIONS.find((p) => p.key === period)
  return revenues.slice(-Math.max(opt?.sliceMonths ?? 12, 1))
}

function calcTrend(revenues: MonthlyRevenueBar[]) {
  if (revenues.length < 2) return { pct: 0, up: true }
  const cur = revenues[revenues.length - 1]?.value ?? 0
  const prev = revenues[revenues.length - 2]?.value ?? 0
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, up: true }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct: Math.abs(pct), up: pct >= 0 }
}

// ─── Excel Export (xlsx-js-style) ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WS = any

function mkTitleStyle(bg: string) {
  return { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' }, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' } }
}
function mkSubStyle(bg: string) {
  return { font: { italic: true, sz: 9, color: { rgb: '64748B' }, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' } }
}
function mkHeaderStyle(bg: string) {
  return {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'medium', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } },
  }
}
function mkDataStyle(bg: string, align = 'left', bold = false, color = '1E293B') {
  return {
    font: { sz: 10, bold, color: { rgb: color }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center' },
    border: { bottom: { style: 'hair', color: { rgb: 'E2E8F0' } }, left: { style: 'hair', color: { rgb: 'E2E8F0' } }, right: { style: 'hair', color: { rgb: 'E2E8F0' } } },
  }
}
function mkTotalStyle(bg: string, color: string, align = 'center') {
  return {
    font: { bold: true, sz: 10, color: { rgb: color }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center' },
    border: { top: { style: 'medium', color: { rgb: color } }, bottom: { style: 'medium', color: { rgb: color } }, left: { style: 'thin', color: { rgb: color } }, right: { style: 'thin', color: { rgb: color } } },
  }
}

function applyStyle(ws: WS, addr: string, style: object, numFmt?: string) {
  if (!ws[addr]) ws[addr] = { t: 's', v: '' }
  ws[addr].s = style
  if (numFmt) ws[addr].z = numFmt
}

function downloadExcel(
  params: {
    revenues: { month: string; value: number }[]
    activities: { title: string; time: string }[]
    totalRevenue: number
    pendingOrders: number
    pendingRfqs: number
    periodLabel: string
  },
  filename: string,
) {
  const wb = XLSXStyle.utils.book_new()
  const dateStr = new Date().toLocaleDateString('vi-VN')
  const subtitleText = `Kỳ báo cáo: ${params.periodLabel}   ·   Ngày xuất: ${dateStr}   ·   AgriBridge`

  // ── Sheet 1: Doanh thu (xanh lá) ──────────────────────────────────────────
  const revRows: unknown[][] = [
    ['DOANH THU THEO THÁNG', ''],
    [subtitleText, ''],
    ['', ''],
    ['THÁNG', 'DOANH THU (VNĐ)'],
    ...params.revenues.map((r) => [r.month, r.value]),
    ['', ''],
    ['TỔNG CỘNG', params.totalRevenue],
  ]
  const wsRev = XLSXStyle.utils.aoa_to_sheet(revRows)
  wsRev['!cols'] = [{ wch: 18 }, { wch: 26 }]
  wsRev['!rows'] = [{ hpt: 32 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }, ...params.revenues.map(() => ({ hpt: 18 })), { hpt: 6 }, { hpt: 22 }]
  wsRev['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]
  applyStyle(wsRev, 'A1', mkTitleStyle('064E3B')); applyStyle(wsRev, 'B1', mkTitleStyle('064E3B'))
  applyStyle(wsRev, 'A2', mkSubStyle('F0FDF4')); applyStyle(wsRev, 'B2', mkSubStyle('F0FDF4'))
  applyStyle(wsRev, 'A4', mkHeaderStyle('059669')); applyStyle(wsRev, 'B4', mkHeaderStyle('059669'))
  params.revenues.forEach((_, i) => {
    const r = 5 + i; const bg = i % 2 === 0 ? 'FFFFFF' : 'ECFDF5'
    applyStyle(wsRev, `A${r}`, mkDataStyle(bg, 'center'))
    applyStyle(wsRev, `B${r}`, mkDataStyle(bg, 'right'), '#,##0')
  })
  const trRow = 5 + params.revenues.length + 1
  applyStyle(wsRev, `A${trRow}`, mkTotalStyle('D1FAE5', '065F46'))
  applyStyle(wsRev, `B${trRow}`, mkTotalStyle('D1FAE5', '065F46', 'right'), '#,##0')
  XLSXStyle.utils.book_append_sheet(wb, wsRev, 'Doanh thu')

  // ── Sheet 2: Tổng kết (vàng cam) ──────────────────────────────────────────
  const kpis: [string, string | number][] = [
    ['Kỳ báo cáo', params.periodLabel],
    ['Ngày xuất báo cáo', dateStr],
    ['Tổng doanh thu kỳ (VNĐ)', params.totalRevenue],
    ['Số tháng trong báo cáo', params.revenues.length],
    ['Đơn hàng chờ xác nhận', params.pendingOrders],
    ['RFQ chờ báo giá', params.pendingRfqs],
  ]
  const sumRows: unknown[][] = [
    ['TỔNG KẾT KỲ BÁO CÁO', ''], [subtitleText, ''], ['', ''], ['CHỈ SỐ', 'GIÁ TRỊ'],
    ...kpis.map(([k, v]) => [k, v]),
  ]
  const wsSum = XLSXStyle.utils.aoa_to_sheet(sumRows)
  wsSum['!cols'] = [{ wch: 30 }, { wch: 26 }]
  wsSum['!rows'] = [{ hpt: 32 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }, ...kpis.map(() => ({ hpt: 20 }))]
  wsSum['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]
  applyStyle(wsSum, 'A1', mkTitleStyle('78350F')); applyStyle(wsSum, 'B1', mkTitleStyle('78350F'))
  applyStyle(wsSum, 'A2', mkSubStyle('FFFBEB')); applyStyle(wsSum, 'B2', mkSubStyle('FFFBEB'))
  applyStyle(wsSum, 'A4', mkHeaderStyle('B45309')); applyStyle(wsSum, 'B4', mkHeaderStyle('B45309'))
  kpis.forEach(([, v], i) => {
    const r = 5 + i; const bg = i % 2 === 0 ? 'FFFFFF' : 'FEF3C7'; const isNum = typeof v === 'number'
    applyStyle(wsSum, `A${r}`, mkDataStyle(bg, 'left', true))
    applyStyle(wsSum, `B${r}`, mkDataStyle(bg, isNum ? 'right' : 'left', false, isNum ? 'B45309' : '1E293B'), i === 2 ? '#,##0' : undefined)
  })
  XLSXStyle.utils.book_append_sheet(wb, wsSum, 'Tổng kết')

  // ── Sheet 3: Hoạt động (xanh dương) ───────────────────────────────────────
  const actRows: unknown[][] = [
    ['HOẠT ĐỘNG GẦN ĐÂY', ''],
    [`Tổng: ${params.activities.length} hoạt động   ·   ${dateStr}`, ''],
    ['', ''], ['HOẠT ĐỘNG', 'THỜI GIAN'],
    ...params.activities.map((a) => [a.title, a.time]),
  ]
  const wsAct = XLSXStyle.utils.aoa_to_sheet(actRows)
  wsAct['!cols'] = [{ wch: 56 }, { wch: 22 }]
  wsAct['!rows'] = [{ hpt: 32 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }, ...params.activities.map(() => ({ hpt: 18 }))]
  wsAct['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]
  applyStyle(wsAct, 'A1', mkTitleStyle('1E3A8A')); applyStyle(wsAct, 'B1', mkTitleStyle('1E3A8A'))
  applyStyle(wsAct, 'A2', mkSubStyle('EFF6FF')); applyStyle(wsAct, 'B2', mkSubStyle('EFF6FF'))
  applyStyle(wsAct, 'A4', mkHeaderStyle('1D4ED8')); applyStyle(wsAct, 'B4', mkHeaderStyle('1D4ED8'))
  params.activities.forEach((_, i) => {
    const r = 5 + i; const bg = i % 2 === 0 ? 'FFFFFF' : 'DBEAFE'
    applyStyle(wsAct, `A${r}`, mkDataStyle(bg))
    applyStyle(wsAct, `B${r}`, mkDataStyle(bg, 'center'))
  })
  XLSXStyle.utils.book_append_sheet(wb, wsAct, 'Hoạt động')

  XLSXStyle.writeFile(wb, filename)
}


// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-extrabold text-emerald-700">{formatVND(payload[0].value)}đ</p>
      <p className="text-slate-400">{label}</p>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  trend?: string
  trendUp?: boolean
  accentColor: string
  accentBg: string
  delay?: number
}

function KpiCard({ icon, label, value, sub, trend, trendUp = true, accentColor, accentBg, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentBg}`}>
          <span className={accentColor}>{icon}</span>
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {trendUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {trend}
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-extrabold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SupplierOverviewPage() {
  usePageTitle('Tổng quan')
  const { data, loading, error, reload } = useSupplierDashboardData()
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [exporting, setExporting] = useState(false)

  const allRevenues = data?.monthlyRevenue ?? []
  const cards = data?.overviewCards ?? []
  const activities = data?.recentActivities ?? []
  const orders = data?.orders ?? []
  const rfqItems = data?.rfqItems ?? []

  const filteredRevenues = useMemo(() => filterRevenue(allRevenues, period), [allRevenues, period])
  const trend = useMemo(() => calcTrend(filteredRevenues), [filteredRevenues])
  const totalRevenue = filteredRevenues.reduce((sum, r) => sum + r.value, 0)

  const receivableCard = cards.find((c) => c.label.includes('Công nợ'))
  const orderCard = cards.find((c) => c.label.includes('Đơn'))
  const productCard = cards.find((c) => c.label.includes('Sản phẩm'))

  const pendingOrders = orders.filter((o) => o.status === 'Chờ xác nhận').length
  const pendingRfqs = rfqItems.filter((r) => r.status === 'Chờ báo giá').length

  const chartData = filteredRevenues.map((r) => ({ month: r.month, value: r.value }))

  const handleExport = async () => {
    setExporting(true)
    await new Promise((r) => setTimeout(r, 250))
    try {
      const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? period
      downloadExcel(
        {
          revenues: filteredRevenues,
          activities,
          totalRevenue,
          pendingOrders,
          pendingRfqs,
          periodLabel,
        },
        `agribridge-overview-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <SupplierShell
      activeKey="overview"
      title="Tổng quan"
      subtitle="Theo dõi hoạt động kinh doanh theo thời gian thực"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                  period === opt.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={reload}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50"
            title="Làm mới"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export */}
          <button
            onClick={() => void handleExport()}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      }
    >
      {/* Error */}
      {!loading && error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && <OverviewSkeletonLoader />}

      {/* ── KPI Cards (compact) ── */}
      {!loading && (<>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Doanh thu kỳ này"
          value={formatVND(totalRevenue)}
          sub={PERIOD_OPTIONS.find((p) => p.key === period)?.label}
          trend={`${trend.pct}%`}
          trendUp={trend.up}
          accentColor="text-emerald-600"
          accentBg="bg-emerald-50"
          delay={0}
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Đơn hàng"
          value={orderCard?.value ?? String(orders.length)}
          sub={pendingOrders > 0 ? `${pendingOrders} chờ xác nhận` : 'Không có đơn chờ'}
          accentColor="text-blue-600"
          accentBg="bg-blue-50"
          delay={0.05}
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="RFQ & Báo giá"
          value={String(rfqItems.length)}
          sub={pendingRfqs > 0 ? `${pendingRfqs} chờ báo giá` : 'Đã xử lý hết'}
          accentColor="text-amber-600"
          accentBg="bg-amber-50"
          delay={0.1}
        />
        <KpiCard
          icon={<Truck className="h-4 w-4" />}
          label="Công nợ phải thu"
          value={receivableCard?.value ?? '0đ'}
          sub={productCard?.value ? `${productCard.value} sản phẩm` : undefined}
          accentColor="text-violet-600"
          accentBg="bg-violet-50"
          delay={0.15}
        />
      </div>

      {/* ── Chart + Activity (compact heights) ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">

        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Doanh thu theo tháng</p>
              <p className="text-[10px] text-slate-400">{filteredRevenues.length} tháng gần nhất</p>
            </div>
            <div className="text-right">
              <p className="text-base font-extrabold text-emerald-700">{formatVND(totalRevenue)}</p>
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${trend.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                {trend.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {trend.pct}% so tháng trước
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Đang tải...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-xs text-slate-400">Chưa có dữ liệu.</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatVND(v)}
                  width={48}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 3' }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Bottom summary */}
          {filteredRevenues.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
              {[
                { label: 'Tháng này', value: formatVND(filteredRevenues[filteredRevenues.length - 1]?.value ?? 0) },
                { label: 'Tháng trước', value: formatVND(filteredRevenues[filteredRevenues.length - 2]?.value ?? 0) },
                { label: 'Công nợ', value: receivableCard?.value ?? '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 py-2 text-center">
                  <p className="text-sm font-extrabold text-slate-900">{item.value}</p>
                  <p className="text-[10px] font-semibold text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Activity feed (compact) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <p className="mb-2.5 text-sm font-bold text-slate-900">Hoạt động gần đây</p>
          {loading ? (
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              Chưa có hoạt động.
            </p>
          ) : (
            <ul className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 260 }}>
              {activities.map((item, idx) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.04 }}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <p className="text-[11px] font-semibold text-slate-800 line-clamp-2">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{item.time}</p>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      {/* ── Orders + RFQ quick table ── */}
      {!loading && (orders.length > 0 || rfqItems.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Recent orders */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Đơn hàng gần đây</p>
              <a href="/supplier/orders" className="text-[11px] font-semibold text-emerald-600 hover:underline">Xem tất cả →</a>
            </div>
            {orders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-2 border-t border-slate-50 py-2 text-xs first:border-0">
                <div>
                  <p className="font-semibold text-slate-800">{order.id}</p>
                  <p className="text-[10px] text-slate-400">{order.customer}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">{order.value}</p>
                  <span className={`text-[10px] font-semibold ${
                    order.status === 'Chờ xác nhận' ? 'text-amber-600'
                      : order.status === 'Hoàn thành' ? 'text-emerald-600' : 'text-slate-500'
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Recent RFQs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">RFQ gần đây</p>
              <a href="/supplier/rfq" className="text-[11px] font-semibold text-emerald-600 hover:underline">Xem tất cả →</a>
            </div>
            {rfqItems.slice(0, 4).map((rfq) => (
              <div key={rfq.id} className="flex items-center justify-between gap-2 border-t border-slate-50 py-2 text-xs first:border-0">
                <div>
                  <p className="font-semibold text-slate-800">{rfq.id}</p>
                  <p className="text-[10px] text-slate-400">{rfq.product}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  rfq.status === 'Chờ báo giá' ? 'bg-amber-100 text-amber-700'
                    : rfq.status === 'Chấp nhận' ? 'bg-emerald-100 text-emerald-700'
                    : rfq.status === 'Từ chối' ? 'bg-rose-100 text-rose-600'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {rfq.status}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      )}
      </>
      )}
    </SupplierShell>
  )
}
