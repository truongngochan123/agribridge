import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Download,
  Package,
  RefreshCw,
  ShoppingCart,
  Star,
  Truck,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import XLSXStyle from 'xlsx-js-style'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { SearchInput, FilterTabBar, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { usePageTitle } from '../../hooks/usePageTitle'
import type { MonthlyRevenueBar } from '../../types/supplierDashboard'
import { ReportsSkeletonLoader } from '../../components/supplier/SupplierSkeletons'

// ─── Types & Helpers ──────────────────────────────────────────────────────────

type ReportTab = 'revenue' | 'debt' | 'delivery' | 'products'
type PeriodKey = '7d' | '30d' | '3m' | '12m'

const REPORT_TABS = [
  { key: 'revenue' as ReportTab, label: 'Doanh thu' },
  { key: 'debt' as ReportTab, label: 'Công nợ' },
  { key: 'delivery' as ReportTab, label: 'Giao hàng' },
  { key: 'products' as ReportTab, label: 'Sản phẩm' },
]

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

function chartNumber(value: unknown): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0)
  return Number(value ?? 0)
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

// ─── Excel Export ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WS = any

function mkStyle(
  bg: string,
  color = '1E293B',
  bold = false,
  align = 'left',
  fontSize = 10,
  border = false,
) {
  return {
    font: { bold, sz: fontSize, color: { rgb: color }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center' },
    ...(border
      ? {
          border: {
            bottom: { style: 'hair', color: { rgb: 'CBD5E1' } },
            left: { style: 'hair', color: { rgb: 'CBD5E1' } },
            right: { style: 'hair', color: { rgb: 'CBD5E1' } },
          },
        }
      : {}),
  }
}

function applyStyle(ws: WS, addr: string, style: object, numFmt?: string) {
  if (!ws[addr]) ws[addr] = { t: 's', v: '' }
  ws[addr].s = style
  if (numFmt) ws[addr].z = numFmt
}

function styleSheetHeader(ws: WS, title: string, subtitle: string, cols: number, bg: string, hdrBg: string) {
  const colLetters = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i))
  colLetters.forEach((c) => {
    applyStyle(ws, `${c}1`, mkStyle(bg, 'FFFFFF', true, 'center', 14))
    applyStyle(ws, `${c}2`, mkStyle('F8FAFC', '64748B', false, 'center', 9))
    applyStyle(ws, `${c}4`, mkStyle(hdrBg, 'FFFFFF', true, 'center', 10))
  })
  ws['A1'].v = title
  ws['A2'].v = subtitle
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
  ]
}

function downloadReportExcel(params: {
  revenues: { month: string; value: number }[]
  totalRevenue: number
  periodLabel: string
  orders: { id: string; customer: string; value: string; status: string; orderDate: string }[]
  shipments: { id: string; route: string; status: string; cargo: string; progress: number; driver: string; orderRef: string }[]
  debtCustomers: { customer: string; cycle: string; terms: string; totalDebt: string; overdueDebt: string; status: string }[]
  productLots: { name: string; lotCode: string; grade: string; stock: string; price: string; status: string }[]
}) {
  const wb = XLSXStyle.utils.book_new()
  const dateStr = new Date().toLocaleDateString('vi-VN')
  const subtitle = `Kỳ báo cáo: ${params.periodLabel}   ·   Xuất ngày: ${dateStr}   ·   AgriBridge`

  // ── Sheet 1: Tổng kết (Summary) ──────────────────────────────────────────────
  const totalRevNum = params.revenues.reduce((s, r) => s + r.value, 0)
  const completedOrders = params.orders.filter((o) => o.status === 'Hoàn thành').length
  const overdueCount = params.debtCustomers.filter((c) => c.status === 'Quá hạn').length
  const deliveredCount = params.shipments.filter((s) => s.status === 'Đã giao').length

  const summaryRows: unknown[][] = [
    ['TỔNG KẾT BÁO CÁO - AGRIBRIDGE', ''],
    [subtitle, ''],
    [''],
    ['CHỈ SỐ', 'GIÁ TRỊ'],
    ['Kỳ báo cáo', params.periodLabel],
    ['Ngày xuất', dateStr],
    ['Tổng doanh thu (VNĐ)', totalRevNum],
    ['Số tháng báo cáo', params.revenues.length],
    ['Tổng đơn hàng', params.orders.length],
    ['Đơn hoàn thành', completedOrders],
    ['Tổng lô giao hàng', params.shipments.length],
    ['Đã giao thành công', deliveredCount],
    ['Khách hàng công nợ', params.debtCustomers.length],
    ['Khách hàng quá hạn', overdueCount],
    ['Tổng sản phẩm / lô', params.productLots.length],
  ]
  const wsSum = XLSXStyle.utils.aoa_to_sheet(summaryRows)
  wsSum['!cols'] = [{ wch: 32 }, { wch: 28 }]
  styleSheetHeader(wsSum, 'TỔNG KẾT BÁO CÁO - AGRIBRIDGE', subtitle, 2, '064E3B', '047857')
  wsSum['A4'].s = mkStyle('047857', 'FFFFFF', true, 'center')
  wsSum['B4'].s = mkStyle('047857', 'FFFFFF', true, 'center')
  for (let i = 0; i < 11; i++) {
    const row = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'F0FDF4'
    applyStyle(wsSum, `A${row}`, mkStyle(bg, '1E293B', true, 'left', 10, true))
    applyStyle(wsSum, `B${row}`, mkStyle(bg, '065F46', false, 'right', 10, true), i === 2 ? '#,##0' : undefined)
  }
  XLSXStyle.utils.book_append_sheet(wb, wsSum, 'Tổng kết')

  // ── Sheet 2: Doanh thu ───────────────────────────────────────────────────────
  const revRows: unknown[][] = [
    ['DOANH THU THEO THÁNG', ''],
    [subtitle, ''],
    [''],
    ['THÁNG', 'DOANH THU (VNĐ)'],
    ...params.revenues.map((r) => [r.month, r.value]),
    [''],
    ['TỔNG CỘNG', params.totalRevenue],
  ]
  const wsRev = XLSXStyle.utils.aoa_to_sheet(revRows)
  wsRev['!cols'] = [{ wch: 18 }, { wch: 28 }]
  wsRev['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...params.revenues.map(() => ({ hpt: 18 })), { hpt: 6 }, { hpt: 22 }]
  styleSheetHeader(wsRev, 'DOANH THU THEO THÁNG', subtitle, 2, '065F46', '059669')
  params.revenues.forEach((_, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'ECFDF5'
    applyStyle(wsRev, `A${r}`, mkStyle(bg, '1E293B', false, 'center', 10, true))
    applyStyle(wsRev, `B${r}`, mkStyle(bg, '065F46', false, 'right', 10, true), '#,##0')
  })
  const trRow = 5 + params.revenues.length + 1
  applyStyle(wsRev, `A${trRow}`, mkStyle('D1FAE5', '065F46', true, 'left'))
  applyStyle(wsRev, `B${trRow}`, mkStyle('D1FAE5', '065F46', true, 'right'), '#,##0')
  XLSXStyle.utils.book_append_sheet(wb, wsRev, 'Doanh thu')

  // ── Sheet 3: Đơn hàng ────────────────────────────────────────────────────────
  const ordRows: unknown[][] = [
    ['ĐƠN HÀNG', '', '', '', ''],
    [subtitle, '', '', '', ''],
    [''],
    ['MÃ ĐH', 'KHÁCH HÀNG', 'GIÁ TRỊ', 'TRẠNG THÁI', 'NGÀY ĐẶT'],
    ...params.orders.map((o) => [o.id, o.customer, o.value, o.status, o.orderDate]),
  ]
  const wsOrd = XLSXStyle.utils.aoa_to_sheet(ordRows)
  wsOrd['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 14 }]
  wsOrd['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...params.orders.map(() => ({ hpt: 18 }))]
  styleSheetHeader(wsOrd, 'ĐƠN HÀNG', subtitle, 5, '1E3A8A', '1D4ED8')
  params.orders.forEach((o, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'EFF6FF'
    const isCompleted = o.status === 'Hoàn thành'
    const isPending = o.status.includes('Chờ')
    const statusColor = isCompleted ? '065F46' : isPending ? '92400E' : '1E293B'
    applyStyle(wsOrd, `A${r}`, mkStyle(bg, '1E293B', true, 'left', 10, true))
    applyStyle(wsOrd, `B${r}`, mkStyle(bg, '1E293B', false, 'left', 10, true))
    applyStyle(wsOrd, `C${r}`, mkStyle(bg, '065F46', true, 'right', 10, true))
    applyStyle(wsOrd, `D${r}`, mkStyle(bg, statusColor, true, 'center', 10, true))
    applyStyle(wsOrd, `E${r}`, mkStyle(bg, '64748B', false, 'center', 10, true))
  })
  XLSXStyle.utils.book_append_sheet(wb, wsOrd, 'Đơn hàng')

  // ── Sheet 4: Công nợ ─────────────────────────────────────────────────────────
  const debtRows: unknown[][] = [
    ['CÔNG NỢ KHÁCH HÀNG', '', '', '', '', ''],
    [subtitle, '', '', '', '', ''],
    [''],
    ['KHÁCH HÀNG', 'CHU KỲ', 'ĐIỀU KHOẢN', 'TỔNG CÔNG NỢ', 'QUÁ HẠN', 'TÌNH TRẠNG'],
    ...params.debtCustomers.map((c) => [c.customer, c.cycle, c.terms, c.totalDebt, c.overdueDebt, c.status]),
  ]
  const wsDebt = XLSXStyle.utils.aoa_to_sheet(debtRows)
  wsDebt['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }]
  wsDebt['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...params.debtCustomers.map(() => ({ hpt: 18 }))]
  styleSheetHeader(wsDebt, 'CÔNG NỢ KHÁCH HÀNG', subtitle, 6, '4C1D95', '7C3AED')
  params.debtCustomers.forEach((c, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'F5F3FF'
    const statusColor = c.status === 'Quá hạn' ? 'B91C1C' : c.status === 'Cảnh báo' ? '92400E' : '065F46'
    applyStyle(wsDebt, `A${r}`, mkStyle(bg, '1E293B', true, 'left', 10, true))
    applyStyle(wsDebt, `B${r}`, mkStyle(bg, '475569', false, 'center', 10, true))
    applyStyle(wsDebt, `C${r}`, mkStyle(bg, '475569', false, 'center', 10, true))
    applyStyle(wsDebt, `D${r}`, mkStyle(bg, '6D28D9', true, 'right', 10, true))
    applyStyle(wsDebt, `E${r}`, mkStyle(bg, 'B91C1C', true, 'right', 10, true))
    applyStyle(wsDebt, `F${r}`, mkStyle(bg, statusColor, true, 'center', 10, true))
  })
  XLSXStyle.utils.book_append_sheet(wb, wsDebt, 'Công nợ')

  // ── Sheet 5: Giao hàng ───────────────────────────────────────────────────────
  const shipRows: unknown[][] = [
    ['GIAO HÀNG', '', '', '', '', ''],
    [subtitle, '', '', '', '', ''],
    [''],
    ['MÃ LÔ', 'MÃ ĐƠN', 'TUYẾN ĐƯỜNG', 'TÀI XẾ', 'HÀNG HÓA', 'TIẾN ĐỘ (%)', 'TRẠNG THÁI'],
    ...params.shipments.map((s) => [s.id, s.orderRef, s.route, s.driver, s.cargo, s.progress, s.status]),
  ]
  const wsShip = XLSXStyle.utils.aoa_to_sheet(shipRows)
  wsShip['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 36 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 20 }]
  wsShip['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...params.shipments.map(() => ({ hpt: 18 }))]
  styleSheetHeader(wsShip, 'GIAO HÀNG', subtitle, 7, '0C4A6E', '0369A1')
  params.shipments.forEach((s, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'F0F9FF'
    const statusColor = s.status === 'Đã giao' ? '065F46' : s.status === 'Sự cố' ? 'B91C1C' : '1E293B'
    ;['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col, ci) => {
      const color = ci === 6 ? statusColor : ci === 4 ? '065F46' : '1E293B'
      const bold = ci === 0 || ci === 4 || ci === 6
      applyStyle(wsShip, `${col}${r}`, mkStyle(bg, color, bold, ci === 4 ? 'right' : ci === 5 ? 'center' : 'left', 10, true))
    })
  })
  XLSXStyle.utils.book_append_sheet(wb, wsShip, 'Giao hàng')

  // ── Sheet 6: Sản phẩm ────────────────────────────────────────────────────────
  const prodRows: unknown[][] = [
    ['SẢN PHẨM & LÔ HÀNG', '', '', '', '', ''],
    [subtitle, '', '', '', '', ''],
    [''],
    ['TÊN SẢN PHẨM', 'MÃ LÔ', 'HẠNG', 'TỒN KHO', 'ĐƠN GIÁ', 'TRẠNG THÁI'],
    ...params.productLots.map((p) => [p.name, p.lotCode, p.grade, p.stock, p.price, p.status]),
  ]
  const wsProd = XLSXStyle.utils.aoa_to_sheet(prodRows)
  wsProd['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }]
  wsProd['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...params.productLots.map(() => ({ hpt: 18 }))]
  styleSheetHeader(wsProd, 'SẢN PHẨM & LÔ HÀNG', subtitle, 6, '134E4A', '0F766E')
  params.productLots.forEach((p, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'F0FDFA'
    const statusColor = p.status === 'Con hàng' ? '065F46' : p.status === 'Sắp hết' ? '92400E' : 'B91C1C'
    applyStyle(wsProd, `A${r}`, mkStyle(bg, '1E293B', true, 'left', 10, true))
    applyStyle(wsProd, `B${r}`, mkStyle(bg, '475569', false, 'left', 10, true))
    applyStyle(wsProd, `C${r}`, mkStyle(bg, '0F766E', true, 'center', 10, true))
    applyStyle(wsProd, `D${r}`, mkStyle(bg, '1E293B', false, 'center', 10, true))
    applyStyle(wsProd, `E${r}`, mkStyle(bg, '065F46', true, 'right', 10, true))
    applyStyle(wsProd, `F${r}`, mkStyle(bg, statusColor, true, 'center', 10, true))
  })
  XLSXStyle.utils.book_append_sheet(wb, wsProd, 'Sản phẩm')

  XLSXStyle.writeFile(wb, `agribridge-baocao-${params.periodLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
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
  trend?: number
  trendUp?: boolean
  accentColor: string
  accentBg: string
  delay?: number
}

function KpiCard({ icon, label, value, sub, trend, trendUp = true, accentColor, accentBg, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentBg}`}>
          <span className={accentColor}>{icon}</span>
        </div>
        {trend !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {trendUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {trend}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-extrabold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
      </div>
    </motion.div>
  )
}

// ─── Section container ────────────────────────────────────────────────────────

function Section({ title, subtitle, children, delay = 0 }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message = 'Chưa có dữ liệu.' }: { message?: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
      {message}
    </div>
  )
}

// ─── Tab: Doanh thu ───────────────────────────────────────────────────────────

function RevenueTab({
  revenues,
  loading,
  period,
  orders,
}: {
  revenues: MonthlyRevenueBar[]
  loading: boolean
  period: PeriodKey
  orders: { id: string; customer: string; value: string; status: string; orderDate: string }[]
}) {
  const filtered = useMemo(() => filterRevenue(revenues, period), [revenues, period])
  const trend = useMemo(() => calcTrend(filtered), [filtered])
  const totalRevenue = filtered.reduce((sum, r) => sum + r.value, 0)
  const maxMonth = filtered.reduce((a, b) => (b.value > a.value ? b : a), filtered[0] ?? { month: '—', value: 0 })
  const completedOrders = orders.filter((o) => o.status === 'Hoàn thành').length
  const pendingOrders = orders.filter((o) => o.status === 'Chờ xác nhận' || o.status === 'Chờ nhà cung cấp xác nhận').length

  const kpis: KpiCardProps[] = [
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Tổng doanh thu',
      value: formatVND(totalRevenue) + 'đ',
      sub: PERIOD_OPTIONS.find((p) => p.key === period)?.label,
      trend: trend.pct,
      trendUp: trend.up,
      accentColor: 'text-emerald-600',
      accentBg: 'bg-emerald-50',
      delay: 0,
    },
    {
      icon: <ShoppingCart className="h-4 w-4" />,
      label: 'Tổng đơn hàng',
      value: String(orders.length),
      sub: `${completedOrders} hoàn thành · ${pendingOrders} chờ`,
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50',
      delay: 0.06,
    },
    {
      icon: <BarChart2 className="h-4 w-4" />,
      label: 'Tháng cao nhất',
      value: maxMonth.month || '—',
      sub: maxMonth.value > 0 ? formatVND(maxMonth.value) + 'đ' : undefined,
      accentColor: 'text-violet-600',
      accentBg: 'bg-violet-50',
      delay: 0.12,
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Tỷ lệ hoàn thành',
      value: orders.length > 0 ? `${Math.round((completedOrders / orders.length) * 100)}%` : '—',
      sub: `${completedOrders} / ${orders.length} đơn`,
      accentColor: 'text-teal-600',
      accentBg: 'bg-teal-50',
      delay: 0.18,
    },
  ]

  // Status distribution for pie
  const statusGroups = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(statusGroups).map(([name, value]) => ({ name, value }))
  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#f43f5e', '#94a3b8']

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Area chart + Pie */}
      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Section title="Doanh thu theo tháng" subtitle={`${filtered.length} kỳ gần nhất`}>
          {loading ? (
            <div className="flex h-44 items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Đang tải...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={filtered} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
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
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number | undefined) => formatVND(v ?? 0)}
                  width={50}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 3' }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Phân bố đơn hàng" subtitle="Theo trạng thái">
          {orders.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${chartNumber(v)} đơn`, 'Số lượng']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Orders table */}
      <Section title="Đơn hàng gần đây" subtitle={`${orders.length} đơn`} delay={0.2}>
        {orders.length === 0 ? (
          <EmptyState message="Chưa có đơn hàng nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Mã ĐH', 'Khách hàng', 'Sản phẩm', 'Giá trị', 'Ngày đặt', 'Trạng thái'].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((o, i) => (
                  <tr key={o.id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    <td className="py-2 pr-4 font-semibold text-slate-800">{o.id}</td>
                    <td className="py-2 pr-4 text-slate-600">{o.customer}</td>
                    <td className="py-2 pr-4 text-slate-500">—</td>
                    <td className="py-2 pr-4 font-bold text-emerald-700">{o.value}</td>
                    <td className="py-2 pr-4 text-slate-400">{o.orderDate}</td>
                    <td className="py-2"><SupplierStatusPill label={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── Tab: Công nợ ─────────────────────────────────────────────────────────────

// Status config for debt customers
const DEBT_STATUS_CFG = {
  'Tốt': {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Tốt',
  },
  'Cảnh báo': {
    bar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-400',
    label: 'Cảnh báo',
  },
  'Quá hạn': {
    bar: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
    label: 'Quá hạn',
  },
} as const

function getDebtStatusCfg(status: string) {
  return DEBT_STATUS_CFG[status as keyof typeof DEBT_STATUS_CFG] ?? {
    bar: 'bg-slate-300',
    badge: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-400',
    label: status,
  }
}

function DebtTab({
  debtCards,
  debtCustomers,
  loading,
}: {
  debtCards: { label: string; value: string; subLabel?: string }[]
  debtCustomers: { customer: string; cycle: string; totalDebt: string; overdueDebt: string; status: string; terms: string }[]
  loading: boolean
}) {
  const totalDebt = debtCards.find((c) => c.label.toLowerCase().includes('tổng'))?.value ?? '—'
  const overdueCard = debtCards.find((c) => c.label.toLowerCase().includes('quá hạn'))?.value ?? '—'
  const overdueCount = debtCustomers.filter((c) => c.status === 'Quá hạn').length
  const warnCount = debtCustomers.filter((c) => c.status === 'Cảnh báo').length
  const goodCount = debtCustomers.filter((c) => c.status === 'Tốt').length
  const total = debtCustomers.length || 1

  // Health score 0–100
  const healthScore = Math.round((goodCount / total) * 100)

  // Donut data
  const donutData = [
    { name: 'Tốt', value: goodCount, fill: '#10b981' },
    { name: 'Cảnh báo', value: warnCount, fill: '#f59e0b' },
    { name: 'Quá hạn', value: overdueCount, fill: '#f43f5e' },
  ].filter((d) => d.value > 0)

  const barData = debtCustomers.slice(0, 8).map((c) => ({
    name: c.customer.split(' ').slice(-1)[0] ?? c.customer,
    totalDebt: parseFloat(c.totalDebt.replace(/[^\d.]/g, '')) || 0,
    overdueDebt: parseFloat(c.overdueDebt.replace(/[^\d.]/g, '')) || 0,
  }))

  return (
    <div className="space-y-4">
      {/* ── KPI row ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: <Wallet className="h-4 w-4" />,
            label: 'Tổng công nợ',
            value: totalDebt,
            accentColor: 'text-violet-600',
            accentBg: 'bg-violet-50',
            delay: 0,
          },
          {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: 'Công nợ quá hạn',
            value: overdueCard,
            sub: `${overdueCount} khách hàng`,
            accentColor: 'text-rose-600',
            accentBg: 'bg-rose-50',
            delay: 0.06,
          },
          {
            icon: <XCircle className="h-4 w-4" />,
            label: 'Cần theo dõi',
            value: String(warnCount + overdueCount),
            sub: `${warnCount} cảnh báo · ${overdueCount} quá hạn`,
            accentColor: 'text-amber-600',
            accentBg: 'bg-amber-50',
            delay: 0.12,
          },
          {
            icon: <CheckCircle2 className="h-4 w-4" />,
            label: 'Tình trạng tốt',
            value: String(goodCount),
            sub: `${total} tổng khách hàng`,
            accentColor: 'text-emerald-600',
            accentBg: 'bg-emerald-50',
            delay: 0.18,
          },
        ].map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Health summary + Donut ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        {/* Bar chart */}
        <Section title="Công nợ theo khách hàng" subtitle="Tổng công nợ vs quá hạn" delay={0.1}>
          {loading || debtCustomers.length === 0 ? (
            <EmptyState message={loading ? 'Đang tải...' : 'Chưa có dữ liệu công nợ.'} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatVND(v)} width={48} />
                <Tooltip formatter={(v) => [`${formatVND(chartNumber(v))}đ`, '']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="totalDebt" name="Tổng công nợ" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="overdueDebt" name="Quá hạn" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Health Score + Donut */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col gap-4"
        >
          {/* Score */}
          <div>
            <p className="text-sm font-bold text-slate-900">Sức khỏe công nợ</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Tỷ lệ khách hàng đang tốt</p>
            <div className="mt-3 flex items-end gap-2">
              <p className={`text-4xl font-black leading-none ${healthScore >= 70 ? 'text-emerald-600' : healthScore >= 40 ? 'text-amber-500' : 'text-rose-600'}`}>
                {healthScore}
              </p>
              <p className="mb-1 text-lg font-bold text-slate-400">/100</p>
            </div>
            {/* Score bar */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${healthScore}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                className={`h-full rounded-full ${healthScore >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : healthScore >= 40 ? 'bg-gradient-to-r from-amber-300 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-600'}`}
              />
            </div>
          </div>

          {/* Donut */}
          {donutData.length > 0 && (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${chartNumber(v)} KH`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
                {[
                  { label: 'Tốt', color: 'bg-emerald-500', count: goodCount },
                  { label: 'Cảnh báo', color: 'bg-amber-400', count: warnCount },
                  { label: 'Quá hạn', color: 'bg-rose-500', count: overdueCount },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="text-[10px] text-slate-500">{item.label} <span className="font-bold text-slate-700">({item.count})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Customer Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div>
            <p className="text-sm font-bold text-slate-900">Chi tiết công nợ khách hàng</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{debtCustomers.length} khách hàng</p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {[
              { dot: 'bg-emerald-500', label: 'Tốt' },
              { dot: 'bg-amber-400', label: 'Cảnh báo' },
              { dot: 'bg-rose-500', label: 'Quá hạn' },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1 text-slate-500">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {debtCustomers.length === 0 ? (
          <div className="p-5"><EmptyState message="Chưa có dữ liệu công nợ." /></div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {debtCustomers.map((c, i) => {
              const cfg = getDebtStatusCfg(c.status)
              // calculate overdue ratio for progress bar (raw numbers)
              const totalNum = parseFloat(c.totalDebt.replace(/[^\d.]/g, '')) || 0
              const overdueNum = parseFloat(c.overdueDebt.replace(/[^\d.]/g, '')) || 0
              const overdueRatio = totalNum > 0 ? Math.min((overdueNum / totalNum) * 100, 100) : 0

              return (
                <motion.li
                  key={c.customer + i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Status dot */}
                  <div className={`shrink-0 h-2.5 w-2.5 rounded-full ${cfg.dot}`} />

                  {/* Customer info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-800 truncate">{c.customer}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      {c.cycle && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          🔄 {c.cycle}
                        </span>
                      )}
                      {c.terms && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          📋 {c.terms}
                        </span>
                      )}
                    </div>
                    {/* Overdue progress bar */}
                    {totalNum > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overdueRatio}%` }}
                            transition={{ duration: 0.6, delay: 0.3 + i * 0.04, ease: 'easeOut' }}
                            className={`h-full rounded-full ${overdueRatio > 50 ? 'bg-rose-400' : overdueRatio > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-400">{Math.round(overdueRatio)}% quá hạn</span>
                      </div>
                    )}
                  </div>

                  {/* Debt figures */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-extrabold text-violet-700">{c.totalDebt}</p>
                    {overdueNum > 0 ? (
                      <p className="text-[10px] font-semibold text-rose-500">{c.overdueDebt} quá hạn</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">Không quá hạn</p>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </motion.div>
    </div>
  )
}

// ─── Tab: Giao hàng ───────────────────────────────────────────────────────────

function DeliveryTab({
  shipments,
  loading,
}: {
  shipments: { id: string; orderRef: string; route: string; driver: string; status: string; cargo: string; progress: number }[]
  loading: boolean
}) {
  const delivered = shipments.filter((s) => s.status === 'Đã giao').length
  const inTransit = shipments.filter((s) => s.status === 'Đang vận chuyển').length
  const incident = shipments.filter((s) => s.status === 'Sự cố').length
  const avgProgress =
    shipments.length > 0 ? Math.round(shipments.reduce((a, s) => a + s.progress, 0) / shipments.length) : 0

  const statusGroups = shipments.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(statusGroups).map(([name, value]) => ({ name, value }))
  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#94a3b8', '#6366f1']

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: <Truck className="h-4 w-4" />,
            label: 'Tổng lô hàng',
            value: String(shipments.length),
            sub: `${inTransit} đang vận chuyển`,
            accentColor: 'text-blue-600',
            accentBg: 'bg-blue-50',
            delay: 0,
          },
          {
            icon: <CheckCircle2 className="h-4 w-4" />,
            label: 'Đã giao thành công',
            value: String(delivered),
            sub: shipments.length > 0 ? `${Math.round((delivered / shipments.length) * 100)}% tổng lô` : undefined,
            accentColor: 'text-emerald-600',
            accentBg: 'bg-emerald-50',
            delay: 0.06,
          },
          {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: 'Sự cố giao hàng',
            value: String(incident),
            sub: incident > 0 ? 'Cần xử lý' : 'Không có sự cố',
            accentColor: 'text-rose-600',
            accentBg: 'bg-rose-50',
            delay: 0.12,
          },
          {
            icon: <Clock className="h-4 w-4" />,
            label: 'Tiến độ trung bình',
            value: `${avgProgress}%`,
            sub: 'Tất cả lô hàng',
            accentColor: 'text-amber-600',
            accentBg: 'bg-amber-50',
            delay: 0.18,
          },
        ].map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Section title="Danh sách lô hàng" subtitle={`${shipments.length} lô`} delay={0.1}>
          {loading || shipments.length === 0 ? (
            <EmptyState message={loading ? 'Đang tải...' : 'Chưa có lô hàng nào.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Mã lô', 'Đơn hàng', 'Tuyến đường', 'Tài xế', 'Hàng hóa', 'Tiến độ', 'Trạng thái'].map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shipments.slice(0, 8).map((s, i) => (
                    <tr key={s.id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-2 pr-3 font-semibold text-slate-800">{s.id}</td>
                      <td className="py-2 pr-3 text-slate-500">{s.orderRef}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[120px] truncate">{s.route}</td>
                      <td className="py-2 pr-3 text-slate-500">{s.driver || '—'}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[100px] truncate">{s.cargo}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2"><SupplierStatusPill label={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Phân bố trạng thái" delay={0.15}>
          {shipments.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${chartNumber(v)} lô`, 'Số lượng']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
    </div>
  )
}

// ─── Tab: Sản phẩm ────────────────────────────────────────────────────────────

function ProductsTab({
  productLots,
  rfqItems,
  loading,
  search,
}: {
  productLots: { id: string; name: string; lotCode: string; grade: string; stock: string; price: string; status: string }[]
  rfqItems: { id: string; product: string; status: string; targetPrice: string; quantity: string }[]
  loading: boolean
  search: string
}) {
  const filtered = productLots.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.lotCode.toLowerCase().includes(search.toLowerCase()),
  )

  const inStock = productLots.filter((p) => p.status === 'Con hàng').length
  const lowStock = productLots.filter((p) => p.status === 'Sắp hết').length
  const outOfStock = productLots.filter((p) => p.status === 'Hết hàng').length

  const rfqPending = rfqItems.filter((r) => r.status === 'Chờ báo giá').length
  const rfqAccepted = rfqItems.filter((r) => r.status === 'Chấp nhận').length

  // Grade distribution
  const gradeGroups = productLots.reduce<Record<string, number>>((acc, p) => {
    const g = p.grade || 'Khác'
    acc[g] = (acc[g] ?? 0) + 1
    return acc
  }, {})
  const gradeData = Object.entries(gradeGroups).map(([name, value]) => ({ name, value }))
  const GRADE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#94a3b8']

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: <Package className="h-4 w-4" />,
            label: 'Tổng sản phẩm',
            value: String(productLots.length),
            sub: `${inStock} còn hàng`,
            accentColor: 'text-emerald-600',
            accentBg: 'bg-emerald-50',
            delay: 0,
          },
          {
            icon: <AlertTriangle className="h-4 w-4" />,
            label: 'Sắp hết hàng',
            value: String(lowStock),
            sub: `${outOfStock} đã hết hàng`,
            accentColor: 'text-amber-600',
            accentBg: 'bg-amber-50',
            delay: 0.06,
          },
          {
            icon: <Star className="h-4 w-4" />,
            label: 'RFQ nhận được',
            value: String(rfqItems.length),
            sub: `${rfqPending} chờ báo giá · ${rfqAccepted} chấp nhận`,
            accentColor: 'text-blue-600',
            accentBg: 'bg-blue-50',
            delay: 0.12,
          },
          {
            icon: <CheckCircle2 className="h-4 w-4" />,
            label: 'Tỷ lệ chấp nhận RFQ',
            value: rfqItems.length > 0 ? `${Math.round((rfqAccepted / rfqItems.length) * 100)}%` : '—',
            sub: `${rfqAccepted} / ${rfqItems.length} RFQ`,
            accentColor: 'text-teal-600',
            accentBg: 'bg-teal-50',
            delay: 0.18,
          },
        ].map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <Section title="Danh sách sản phẩm & lô hàng" subtitle={`${filtered.length} sản phẩm`} delay={0.1}>
          {loading || productLots.length === 0 ? (
            <EmptyState message={loading ? 'Đang tải...' : 'Chưa có sản phẩm nào.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Tên sản phẩm', 'Mã lô', 'Hạng', 'Tồn kho', 'Đơn giá', 'Trạng thái'].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 10).map((p, i) => (
                    <tr key={p.id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-2 pr-4 font-semibold text-slate-800 max-w-[160px] truncate">{p.name}</td>
                      <td className="py-2 pr-4 font-mono text-slate-500">{p.lotCode}</td>
                      <td className="py-2 pr-4 text-slate-500">{p.grade}</td>
                      <td className="py-2 pr-4 font-semibold text-slate-700">{p.stock}</td>
                      <td className="py-2 pr-4 font-bold text-emerald-700">{p.price}</td>
                      <td className="py-2"><SupplierStatusPill label={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Phân bố hạng sản phẩm" delay={0.15}>
          {productLots.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={gradeData} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                  {gradeData.map((_, i) => (
                    <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${chartNumber(v)} sản phẩm`, 'Số lượng']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SupplierReportsPage() {
  usePageTitle('Báo cáo')
  const { data, loading, error, reload } = useSupplierDashboardData()

  const [activeTab, setActiveTab] = useState<ReportTab>('revenue')
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const revenues = data?.monthlyRevenue ?? []
  const orders = data?.orders ?? []
  const shipments = data?.shipments ?? []
  const productLots = data?.productLots ?? []
  const rfqItems = data?.rfqItems ?? []
  const debtCards = data?.debtSummaryCards ?? []
  const debtCustomers = data?.debtCustomers ?? []

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    await new Promise((r) => setTimeout(r, 200))
    try {
      const filteredRevenues = filterRevenue(revenues, period)
      const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? period
      downloadReportExcel({
        revenues: filteredRevenues,
        totalRevenue: filteredRevenues.reduce((s, r) => s + r.value, 0),
        periodLabel,
        orders: orders.map((o) => ({
          id: o.id,
          customer: o.customer,
          value: o.value,
          status: o.status,
          orderDate: o.orderDate,
        })),
        shipments: shipments.map((s) => ({
          id: s.id,
          orderRef: s.orderRef ?? '',
          route: s.route ?? '',
          driver: s.driver ?? '',
          cargo: s.cargo ?? '',
          progress: s.progress ?? 0,
          status: s.status,
        })),
        debtCustomers: debtCustomers.map((c) => ({
          customer: c.customer ?? '',
          cycle: c.cycle ?? '',
          terms: c.terms ?? '',
          totalDebt: c.totalDebt ?? '0đ',
          overdueDebt: c.overdueDebt ?? '0đ',
          status: c.status ?? '',
        })),
        productLots: productLots.map((p) => ({
          name: p.name ?? '',
          lotCode: p.lotCode ?? '',
          grade: p.grade ?? '',
          stock: p.stock ?? '',
          price: p.price ?? '',
          status: p.status ?? '',
        })),
      })
    } catch (err) {
      console.error('[Export] Lỗi xuất báo cáo:', err)
      setExportError(
        err instanceof Error ? err.message : 'Xuất báo cáo thất bại. Vui lòng thử lại.'
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <SupplierShell
      activeKey="reports"
      title="Báo cáo"
      subtitle="Phân tích doanh thu, công nợ và chất lượng"
      filterBar={
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <SearchInput
            value={searchKeyword}
            onChange={setSearchKeyword}
            placeholder="Tìm theo sản phẩm, khách hàng..."
            className="min-w-[200px] max-w-xs"
          />

          {/* Report tabs */}
          <FilterTabBar
            tabs={REPORT_TABS}
            activeKey={activeTab}
            onChange={setActiveTab}
          />

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
            disabled={exporting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {exporting ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? 'Đang xuất...' : 'Xuất báo cáo'}
          </button>
        </div>
      }
    >
      {/* Alerts */}
      {loading && <ReportsSkeletonLoader />}
      {!loading && error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {exportError && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Xuất báo cáo thất bại: {exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold hover:bg-orange-100 transition-colors"
          >
            ✕ Đóng
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="mt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'revenue' && (
            <motion.div
              key="revenue"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <RevenueTab revenues={revenues} loading={loading} period={period} orders={orders} />
            </motion.div>
          )}
          {activeTab === 'debt' && (
            <motion.div
              key="debt"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <DebtTab debtCards={debtCards} debtCustomers={debtCustomers} loading={loading} />
            </motion.div>
          )}
          {activeTab === 'delivery' && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <DeliveryTab shipments={shipments} loading={loading} />
            </motion.div>
          )}
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <ProductsTab
                productLots={productLots}
                rfqItems={rfqItems}
                loading={loading}
                search={searchKeyword}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SupplierShell>
  )
}
