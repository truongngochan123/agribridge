import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  Loader2,
  MapPin,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TimerReset,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchBuyerBranches, type BuyerBranchSummary } from '../../services/buyerBranchService'
import {
  fetchBuyerDashboard,
  type BuyerDashboardAlert,
  type BuyerDashboardDeliveryOrder,
  type BuyerDashboardKpi,
  type BuyerDashboardPayload,
  type BuyerDashboardPendingRfq,
} from '../../services/buyerDashboardApi'
import { buildBranchContextForUrl, buildBranchScopedPath, getBranchContextFromSearchParams, matchesBranchContext, type BranchContext } from '../../utils/branchContext'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type Severity = 'critical' | 'high' | 'medium' | 'normal'
type DashboardRoute = '/buyer/sourcing' | '/buyer/orders' | '/buyer/delivery' | '/buyer/rfq' | '/buyer/debt' | '/buyer/branches' | '/buyer/market'

type FlexibleDeliveryOrder = BuyerDashboardDeliveryOrder & {
  branchId?: number | string | null
  branch?: string | null
  branchName?: string | null
  supplierName?: string | null
  supplier?: string | null
  quantity?: number | string | null
  unit?: string | null
}

type FlexiblePendingRfq = BuyerDashboardPendingRfq & {
  branchId?: number | string | null
  branch?: string | null
  branchName?: string | null
  supplierName?: string | null
  lowestQuote?: string | null
  lowestQuotation?: string | null
}

type AttentionItem = {
  id: string
  title: string
  meta: string
  severity: Severity
  icon: React.ReactNode
  to: string
}

const emptyDashboard: BuyerDashboardPayload = {
  kpis: [],
  alerts: [],
  deliveryOrders: [],
  pendingRfqs: [],
}

const kpiConfig: Record<string, { label: string; summary: string; icon: React.ReactNode; tone: string; route: DashboardRoute }> = {
  totalOrders: {
    label: 'Tổng đơn mua',
    summary: 'Đơn hàng đang xử lý',
    icon: <ShoppingCart className="h-5 w-5" />,
    tone: 'from-emerald-500 to-teal-500',
    route: '/buyer/orders',
  },
  pendingOrders: {
    label: 'Chờ xác nhận',
    summary: 'Đơn cần theo dõi',
    icon: <TimerReset className="h-5 w-5" />,
    tone: 'from-amber-500 to-amber-600',
    route: '/buyer/orders',
  },
  payableDebt: {
    label: 'Công nợ phải trả',
    summary: 'Khoản cần thanh toán',
    icon: <WalletCards className="h-5 w-5" />,
    tone: 'from-red-500 to-rose-500',
    route: '/buyer/debt',
  },
}

const fallbackKpiConfig = [
  { icon: <Truck className="h-5 w-5" />, tone: 'from-blue-500 to-cyan-500', route: '/buyer/delivery' as DashboardRoute },
  { icon: <FileText className="h-5 w-5" />, tone: 'from-amber-500 to-amber-600', route: '/buyer/rfq' as DashboardRoute },
  { icon: <Gauge className="h-5 w-5" />, tone: 'from-emerald-600 to-teal-500', route: '/buyer/overview' as DashboardRoute },
]

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có ETA'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(Number(value ?? 0))
}

function formatQuantity(value?: number | string | null, unit?: string | null) {
  if (value === null || value === undefined || value === '') return 'Chưa có số lượng'
  const numericValue = typeof value === 'number' ? formatNumber(value) : value
  return `${numericValue} ${unit || ''}`.trim()
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function scopedPath(path: string, branch: BranchContext | null) {
  const [basePath, query = ''] = path.split('?')
  const branchPath = buildBranchScopedPath(basePath, branch)
  if (!query) return branchPath
  const [branchBase, branchQuery = ''] = branchPath.split('?')
  const params = new URLSearchParams(branchQuery)
  new URLSearchParams(query).forEach((value, key) => params.set(key, value))
  return `${branchBase}?${params.toString()}`
}

function severityFromAlert(tone: BuyerDashboardAlert['tone']): Severity {
  if (tone === 'danger') return 'critical'
  if (tone === 'warning') return 'high'
  if (tone === 'amber') return 'medium'
  return 'normal'
}

function severityClasses(severity: Severity) {
  if (severity === 'critical') return 'border-red-200 bg-red-50 text-red-700 shadow-red-500/10'
  if (severity === 'high') return 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-500/10'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-500/10'
  return 'border-blue-200 bg-blue-50 text-blue-700 shadow-blue-500/10'
}

function severityDot(severity: Severity) {
  if (severity === 'critical') return 'bg-red-500'
  if (severity === 'high') return 'bg-amber-500'
  if (severity === 'medium') return 'bg-amber-500'
  return 'bg-blue-500'
}

function progressForStatus(status?: string | null) {
  const text = String(status || '').toLowerCase()
  if (text.includes('delivered') || text.includes('complete') || text.includes('hoan')) return 96
  if (text.includes('transit') || text.includes('shipping') || text.includes('giao')) return 68
  if (text.includes('confirm') || text.includes('pending') || text.includes('cho')) return 34
  return 48
}

function isDelayed(row: BuyerDashboardDeliveryOrder) {
  const diff = daysUntil(row.estimatedDeliveryAt)
  const status = String(row.status || row.statusLabel || '').toLowerCase()
  return diff !== null && diff < 0 && !status.includes('complete') && !status.includes('delivered')
}

export function BuyerDashboardPage() {
  usePageTitle('Trung tâm điều hành mua hàng')
  const location = useLocation()
  const navigate = useNavigate()
  const branchContext = getBranchContextFromSearchParams(new URLSearchParams(location.search))
  const [dashboard, setDashboard] = useState<BuyerDashboardPayload>(emptyDashboard)
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setDashboard(await fetchBuyerDashboard())
    } catch (requestError) {
      setDashboard(emptyDashboard)
      setError(readApiErrorMessage(requestError) || 'Không thể tải dữ liệu điều hành mua hàng.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBranches = useCallback(async () => {
    try {
      setBranchesLoading(true)
      setBranches(await fetchBuyerBranches())
    } catch {
      setBranches([])
    } finally {
      setBranchesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
    void loadBranches()
  }, [loadDashboard, loadBranches])

  useNotificationModuleRefresh(
    ['DASHBOARD', 'ORDER', 'RFQ', 'QUOTE', 'DELIVERY', 'DEBT', 'PAYMENT', 'INVENTORY', 'NOTIFICATION', 'BRANCH'],
    () => {
      void loadDashboard()
      void loadBranches()
    },
  )

  const branchScopedDashboard = useMemo(() => {
    const deliveryOrders = (dashboard.deliveryOrders as FlexibleDeliveryOrder[]).filter((item) => matchesBranchContext(item, branchContext))
    const pendingRfqs = (dashboard.pendingRfqs as FlexiblePendingRfq[]).filter((item) => matchesBranchContext(item, branchContext))
    return { ...dashboard, deliveryOrders, pendingRfqs }
  }, [dashboard, branchContext])

  const activeBranch = useMemo(() => {
    if (!branchContext?.branchId) return null
    return branches.find((branch) => String(branch.rawId) === branchContext.branchId) || null
  }, [branches, branchContext])

  const attentionItems = useMemo(() => buildAttentionItems(branchScopedDashboard, branchContext), [branchScopedDashboard, branchContext])
  const delayedCount = branchScopedDashboard.deliveryOrders.filter(isDelayed).length
  const expiringRfqCount = branchScopedDashboard.pendingRfqs.filter((rfq) => {
    const remaining = daysUntil(rfq.expiredAt)
    return remaining !== null && remaining <= 3
  }).length
  const noQuoteRfqCount = branchScopedDashboard.pendingRfqs.filter((rfq) => !rfq.quoteCount).length
  const selectedBranchValue = branchContext?.branchId || 'all'

  const handleBranchChange = (value: string) => {
    if (value === 'all') {
      navigate('/buyer/overview')
      return
    }
    const branch = branches.find((item) => String(item.rawId) === value)
    if (branch) navigate(buildBranchScopedPath('/buyer/overview', buildBranchContextForUrl(branch)))
  }

  return (
    <BuyerShell
      activeKey="overview"
      title="Trung tâm điều hành mua hàng"
      subtitle="Theo dõi mua hàng, chi nhánh, giao hàng và nhà cung cấp trong một màn hình"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow active:scale-95"
            onClick={() => {
              void loadDashboard()
              void loadBranches()
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <Link
            to={scopedPath('/buyer/sourcing', branchContext)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-700/15 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-700/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Tạo đơn mua
          </Link>
        </div>
      }
      filterBar={
        <BranchContextBar
          branches={branches}
          loading={branchesLoading}
          value={selectedBranchValue}
          branchContext={branchContext}
          onChange={handleBranchChange}
        />
      }
    >
      <div className="space-y-4">
        {loading ? <LoadingStrip /> : null}
        {error ? <ErrorStrip message={error} onRetry={() => void loadDashboard()} /> : null}

        {/* Hero — chỉ hiển thị khi không loading */}
        {!loading && (
          <HeroOperationsPanel
            branchContext={branchContext}
            activeBranch={activeBranch}
            totalBranches={branches.length}
            delayedCount={delayedCount}
            expiringRfqCount={expiringRfqCount}
            noQuoteRfqCount={noQuoteRfqCount}
          />
        )}

        {/* KPI cards */}
        <KpiGrid
          items={branchScopedDashboard.kpis}
          branchContext={branchContext}
          delayedCount={delayedCount}
          expiringRfqCount={expiringRfqCount}
          noQuoteRfqCount={noQuoteRfqCount}
          branchHealth={activeBranch}
        />

        {/* Cảnh báo ưu tiên */}
        <AttentionCenter items={attentionItems} branchContext={branchContext} />

        {/* Thao tác nhanh */}
        <QuickActionCenter branchContext={branchContext} />

        {/* Giao hàng + Sidebar nhà cung cấp */}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <ShipmentSection rows={branchScopedDashboard.deliveryOrders as FlexibleDeliveryOrder[]} branchContext={branchContext} />
            <RfqSection rows={branchScopedDashboard.pendingRfqs as FlexiblePendingRfq[]} branchContext={branchContext} />
          </div>
          <div>
            <SupplierIntelligence
              deliveryOrders={branchScopedDashboard.deliveryOrders as FlexibleDeliveryOrder[]}
              rfqs={branchScopedDashboard.pendingRfqs as FlexiblePendingRfq[]}
              branchContext={branchContext}
            />
          </div>
        </div>
      </div>
    </BuyerShell>
  )
}

/* ─────────────────────── BranchContextBar ─────────────────────── */

function BranchContextBar({
  branches,
  loading,
  value,
  branchContext,
  onChange,
}: {
  branches: BuyerBranchSummary[]
  loading: boolean
  value: string
  branchContext: BranchContext | null
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <Building2 className="h-3.5 w-3.5" />
          {branchContext?.branchName || 'Tất cả chi nhánh'}
        </span>
        <span className="rounded-full border border-slate-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
          Lọc theo chi nhánh
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
        Phạm vi
        <select
          value={value}
          disabled={loading}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-[220px]"
        >
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.rawId} value={String(branch.rawId)}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/* ─────────────────────── LoadingStrip / ErrorStrip ─────────────────────── */

function LoadingStrip() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <span className="min-w-0 flex-1">Đang cập nhật mua hàng, RFQ, công nợ và giao hàng...</span>
      <div className="ml-auto hidden shrink-0 gap-2 sm:flex">
        <span className="h-2 w-20 animate-pulse rounded-full bg-emerald-100" />
        <span className="h-2 w-12 animate-pulse rounded-full bg-teal-100" />
      </div>
    </div>
  )
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <button className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-95" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  )
}

/* ─────────────────────── HeroOperationsPanel ─────────────────────── */

function HeroOperationsPanel({
  branchContext,
  activeBranch,
  totalBranches,
  delayedCount,
  expiringRfqCount,
  noQuoteRfqCount,
}: {
  branchContext: BranchContext | null
  activeBranch: BuyerBranchSummary | null
  totalBranches: number
  delayedCount: number
  expiringRfqCount: number
  noQuoteRfqCount: number
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-4 text-white shadow-lg shadow-emerald-900/10">
      <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.14) 55%, transparent 56%)' }} />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Radar className="h-3.5 w-3.5" />
              Điều hành mua hàng
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <MapPin className="h-3.5 w-3.5" />
              {branchContext?.branchName || `${totalBranches} chi nhánh`}
            </span>
          </div>
          <h2 className="mt-2.5 text-base font-bold leading-snug sm:text-lg">
            Theo dõi mua hàng, giao hàng và vận hành chi nhánh rõ ràng hơn.
          </h2>
          <p className="mt-1 text-xs font-medium leading-5 text-emerald-50/80 sm:text-sm">
            Ưu tiên công nợ, giao hàng trễ, RFQ sắp hết hạn và phản hồi nhà cung cấp trước khi ảnh hưởng đến vận hành.
          </p>
        </div>

        {/* Metrics row */}
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-2">
          <HeroMetric
            icon={<Truck className="h-4 w-4" />}
            value={String(delayedCount)}
            label="giao trễ"
            tone={delayedCount ? 'risk' : 'ok'}
          />
          <HeroMetric
            icon={<Clock3 className="h-4 w-4" />}
            value={String(expiringRfqCount)}
            label="RFQ sắp hết hạn"
            tone={expiringRfqCount ? 'warn' : 'ok'}
          />
          <HeroMetric
            icon={<Gauge className="h-4 w-4" />}
            value={String(noQuoteRfqCount)}
            label="RFQ chưa có giá"
            tone={noQuoteRfqCount ? 'warn' : 'ok'}
          />
          {activeBranch && (
            <HeroMetric
              icon={<Building2 className="h-4 w-4" />}
              value={activeBranch.activeOrders || '0'}
              label="đơn chi nhánh"
              tone="neutral"
            />
          )}
        </div>
      </div>
    </section>
  )
}

function HeroMetric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: 'risk' | 'warn' | 'ok' | 'neutral' }) {
  const toneClass =
    tone === 'risk' ? 'bg-red-400/20 text-red-50 border-red-300/20' :
    tone === 'warn' ? 'bg-amber-300/20 text-amber-50 border-amber-300/20' :
    tone === 'ok' ? 'bg-emerald-300/20 text-emerald-50 border-emerald-300/20' :
    'bg-white/15 text-white border-white/15'
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold backdrop-blur ${toneClass}`}>
      {icon}
      <span className="font-bold">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  )
}

/* ─────────────────────── KpiGrid ─────────────────────── */

function KpiGrid({
  items,
  branchContext,
  delayedCount,
  expiringRfqCount,
  noQuoteRfqCount,
  branchHealth,
}: {
  items: BuyerDashboardKpi[]
  branchContext: BranchContext | null
  delayedCount: number
  expiringRfqCount: number
  noQuoteRfqCount: number
  branchHealth: BuyerBranchSummary | null
}) {
  const operationalCards = [
    ...items.map((item, index) => {
      const config = kpiConfig[item.id] || {
        label: item.label,
        summary: 'Chỉ số vận hành mua hàng',
        icon: fallbackKpiConfig[index % fallbackKpiConfig.length].icon,
        tone: fallbackKpiConfig[index % fallbackKpiConfig.length].tone,
        route: fallbackKpiConfig[index % fallbackKpiConfig.length].route,
      }
      return {
        id: item.id,
        label: config.label,
        summary: config.summary,
        value: item.displayValue,
        icon: config.icon,
        tone: config.tone,
        route: config.route,
        badge: item.value > 0 ? 'Đang có' : 'Ổn định',
        trend: item.value > 0 ? 'Cần xử lý' : 'Ổn định',
      }
    }),
    {
      id: 'delayedShipments',
      label: 'Rủi ro giao trễ',
      summary: 'Đơn giao hàng cần theo dõi',
      value: String(delayedCount),
      icon: <Truck className="h-5 w-5" />,
      tone: 'from-blue-600 to-cyan-500',
      route: '/buyer/delivery' as DashboardRoute,
      badge: delayedCount ? 'Cảnh báo' : 'Đúng tiến độ',
      trend: delayedCount ? 'Xem ETA' : 'Không trễ',
    },
    {
      id: 'rfqNoQuotes',
      label: 'RFQ chưa có báo giá',
      summary: 'Cần nhắc nhà cung cấp',
      value: String(noQuoteRfqCount),
      icon: <Users className="h-5 w-5" />,
      tone: 'from-amber-500 to-amber-600',
      route: '/buyer/rfq' as DashboardRoute,
      badge: expiringRfqCount ? `${expiringRfqCount} sắp hết hạn` : 'Tốt',
      trend: noQuoteRfqCount ? 'Nhắc nhà cung cấp' : 'Có báo giá',
    },
    {
      id: 'branchHealth',
      label: 'Sức khỏe chi nhánh',
      summary: branchContext ? 'Tải việc và trạng thái chi nhánh' : 'Tổng quan vận hành chi nhánh',
      value: branchHealth ? branchHealth.activeOrders : branchContext ? 'Đã lọc' : 'Tổng',
      icon: <Building2 className="h-5 w-5" />,
      tone: 'from-emerald-700 to-lime-500',
      route: '/buyer/branches' as DashboardRoute,
      badge: branchHealth?.isActive === false ? 'Tạm dừng' : 'Hoạt động',
      trend: branchHealth ? `${branchHealth.openRfqCount} RFQ mở` : 'Tất cả chi nhánh',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {operationalCards.slice(0, 6).map((item) => (
        <Link
          key={item.id}
          to={scopedPath(item.route, branchContext)}
          className="group relative min-h-[108px] overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/10"
        >
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />
          <div className="flex items-start justify-between gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} text-white shadow-sm shadow-slate-900/10 transition group-hover:scale-105`}>
              {item.icon}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 leading-none">
              {item.badge}
            </span>
          </div>
          <p className="mt-2.5 line-clamp-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-1 truncate text-xl font-bold leading-none text-slate-950">{item.value}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate text-xs font-semibold text-emerald-700">{item.trend}</span>
          </div>
        </Link>
      ))}
    </section>
  )
}

/* ─────────────────────── AttentionCenter ─────────────────────── */

function buildAttentionItems(dashboard: BuyerDashboardPayload, branchContext: BranchContext | null): AttentionItem[] {
  const alertItems: AttentionItem[] = dashboard.alerts.map((alert) => ({
    id: `alert-${alert.id}`,
    title: alert.title,
    meta: alert.value,
    severity: severityFromAlert(alert.tone),
    icon: <BellRing className="h-4 w-4" />,
    to: scopedPath(alert.targetPath || '/buyer/overview', branchContext),
  }))

  const shipmentItems: AttentionItem[] = dashboard.deliveryOrders
    .filter(isDelayed)
    .map((row) => ({
      id: `shipment-${row.orderId}`,
      title: `Giao hàng trễ: ${row.orderCode}`,
      meta: `${row.productText} · ETA ${formatDate(row.estimatedDeliveryAt)}`,
      severity: 'critical' as Severity,
      icon: <Truck className="h-4 w-4" />,
      to: scopedPath(`/buyer/orders?orderId=${row.orderId}`, branchContext),
    }))

  const rfqItems: AttentionItem[] = dashboard.pendingRfqs
    .filter((row) => {
      const remaining = daysUntil(row.expiredAt)
      return remaining !== null && remaining <= 3
    })
    .map((row) => ({
      id: `rfq-${row.rfqId}`,
      title: row.quoteCount ? `RFQ sắp hết hạn: ${row.rfqCode}` : `Chưa có báo giá: ${row.rfqCode}`,
      meta: `${row.productText || row.title} · ${row.quoteCount} báo giá`,
      severity: (row.quoteCount ? 'medium' : 'high') as Severity,
      icon: <FileText className="h-4 w-4" />,
      to: scopedPath(`/buyer/rfq?rfqId=${row.rfqId}`, branchContext),
    }))

  return [...alertItems, ...shipmentItems, ...rfqItems].sort((a, b) => {
    const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, normal: 3 }
    return rank[a.severity] - rank[b.severity]
  })
}

function AttentionCenter({ items, branchContext }: { items: AttentionItem[]; branchContext: BranchContext | null }) {
  if (!items.length) {
    return (
      <Link to={scopedPath('/buyer/delivery', branchContext)} className="group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Chưa có cảnh báo khẩn</p>
          <p className="text-xs font-medium text-slate-500">Mở giao hàng để tiếp tục theo dõi tiến độ chi nhánh.</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
      </Link>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Trung tâm cảnh báo"
        subtitle="Giao trễ, công nợ, xác nhận và phản hồi nhà cung cấp cần chú ý."
        to={scopedPath('/buyer/delivery', branchContext)}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <Link key={item.id} to={item.to} className={`group rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${severityClasses(item.severity)}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot(item.severity)} ${item.severity === 'critical' ? 'animate-pulse' : ''}`} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium opacity-75">{item.meta}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────── QuickActionCenter ─────────────────────── */

function QuickActionCenter({ branchContext }: { branchContext: BranchContext | null }) {
  const actions: Array<{ label: string; to: string; icon: React.ReactNode; tone: string }> = [
    { label: 'Tạo RFQ', to: '/buyer/rfq', icon: <FileText className="h-4 w-4" />, tone: 'from-amber-500 to-amber-600' },
    { label: 'Tạo đơn mua', to: '/buyer/sourcing', icon: <ShoppingCart className="h-4 w-4" />, tone: 'from-emerald-600 to-teal-500' },
    { label: 'Theo dõi giao hàng', to: '/buyer/delivery', icon: <Truck className="h-4 w-4" />, tone: 'from-blue-600 to-blue-500' },
    { label: 'Xử lý sự cố', to: '/buyer/delivery?status=incident', icon: <ShieldAlert className="h-4 w-4" />, tone: 'from-red-600 to-red-500' },
    { label: 'Thanh toán nợ', to: '/buyer/debt', icon: <CircleDollarSign className="h-4 w-4" />, tone: 'from-emerald-700 to-teal-600' },
    { label: 'Tìm nhà cung cấp', to: '/buyer/sourcing', icon: <Search className="h-4 w-4" />, tone: 'from-blue-600 to-teal-500' },
    { label: 'Xem chi nhánh', to: '/buyer/branches', icon: <Store className="h-4 w-4" />, tone: 'from-teal-600 to-emerald-500' },
  ]

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Thao tác nhanh</p>
          <p className="text-xs font-medium text-slate-500">Các việc thường dùng trong mua hàng và giao nhận.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          {branchContext?.branchName || 'Toàn hệ thống'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={scopedPath(action.to, branchContext)}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md hover:shadow-emerald-900/10"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${action.tone} text-white shadow-md transition group-hover:scale-105`}>
              {action.icon}
            </span>
            <p className="mt-2.5 text-xs font-semibold leading-tight text-slate-900">{action.label}</p>
            <ChevronRight className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────── ShipmentSection ─────────────────────── */

function ShipmentSection({ rows, branchContext }: { rows: FlexibleDeliveryOrder[]; branchContext: BranchContext | null }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader
        icon={<Truck className="h-4 w-4" />}
        title="Theo dõi giao hàng"
        subtitle="5 đơn mới nhất với trạng thái, nhà cung cấp, ETA và tiến độ."
        to={scopedPath('/buyer/delivery', branchContext)}
      />
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 5).map((row) => {
            const delayed = isDelayed(row)
            const progress = progressForStatus(row.status || row.statusLabel)
            const supplier = row.supplierName || row.supplier || 'Chưa rõ nhà cung cấp'
            const status = delayed ? 'Nguy cơ trễ' : row.statusLabel || row.status || 'Đang giao'
            return (
              <Link
                key={`${row.orderId}-${row.shipmentId ?? 'shipment'}`}
                to={scopedPath(`/buyer/orders?orderId=${row.orderId}`, branchContext)}
                className="group block rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/10"
              >
                {/* Row header: code + status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">{row.orderCode}</p>
                    <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-950">{row.productText}</h3>
                  </div>
                  <StatusBadge label={status} severity={delayed ? 'critical' : 'normal'} />
                </div>

                {/* Row meta: supplier + ETA */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-xs font-medium text-slate-500">
                    <span className="font-semibold text-slate-700">{supplier}</span>
                  </span>
                  <span className="text-xs font-medium text-slate-400">ETA: <span className="font-semibold text-slate-700">{formatDate(row.estimatedDeliveryAt)}</span></span>
                  <span className="text-xs font-medium text-slate-400">SL: <span className="font-semibold text-slate-700">{formatQuantity(row.quantity, row.unit)}</span></span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
                    <span>Tiến độ</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${delayed ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Truck className="h-7 w-7" />}
          title="Chưa có đơn đang giao"
          text="Đơn chuyển sang giao hàng sẽ hiển thị ETA, chi nhánh, nhà cung cấp và rủi ro."
          actionLabel="Tạo đơn mua"
          to={scopedPath('/buyer/sourcing', branchContext)}
        />
      )}
    </section>
  )
}

/* ─────────────────────── RfqSection ─────────────────────── */

function RfqSection({ rows, branchContext }: { rows: FlexiblePendingRfq[]; branchContext: BranchContext | null }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader
        icon={<FileText className="h-4 w-4" />}
        title="Quản lý RFQ"
        subtitle="5 RFQ mới nhất với nhu cầu, khu vực, hạn báo giá và phản hồi."
        to={scopedPath('/buyer/rfq', branchContext)}
      />
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 5).map((row) => {
            const remaining = daysUntil(row.expiredAt)
            const urgent = remaining !== null && remaining <= 3
            const expiryText = remaining === null ? 'Chưa có hạn' : remaining < 0 ? 'Đã hết hạn' : `Còn ${remaining} ngày`
            return (
              <Link
                key={row.rfqId}
                to={scopedPath(`/buyer/rfq?rfqId=${row.rfqId}`, branchContext)}
                className="group block rounded-xl border border-slate-100 bg-gradient-to-r from-white to-amber-50/25 px-3 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md hover:shadow-amber-900/10"
              >
                {/* Row header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">{row.rfqCode}</p>
                    <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-950">{row.productText || row.title}</h3>
                  </div>
                  <StatusBadge label={urgent ? 'Sắp hết hạn' : row.status || 'Đang mở'} severity={urgent ? 'high' : 'normal'} />
                </div>

                {/* Row meta */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-xs font-medium text-slate-400">
                    Nhu cầu: <span className="font-semibold text-slate-700">{`${formatNumber(row.quantity)} ${row.unit || ''}`.trim()}</span>
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    Khu vực: <span className="font-semibold text-slate-700">{row.province || 'Chưa xác định'}</span>
                  </span>
                  <span className={`text-xs font-semibold ${urgent ? 'text-amber-600' : 'text-slate-500'}`}>
                    {expiryText}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    <span className="font-semibold text-slate-700">{row.quoteCount}</span> báo giá
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="Chưa có RFQ đang mở"
          text="Tạo RFQ mới để mời nhà cung cấp và so sánh báo giá."
          actionLabel="Tạo RFQ"
          to={scopedPath('/buyer/rfq', branchContext)}
        />
      )}
    </section>
  )
}

/* ─────────────────────── SupplierIntelligence ─────────────────────── */

function SupplierIntelligence({ deliveryOrders, rfqs, branchContext }: { deliveryOrders: FlexibleDeliveryOrder[]; rfqs: FlexiblePendingRfq[]; branchContext: BranchContext | null }) {
  const suppliers = deliveryOrders.reduce<Record<string, number>>((counts, row) => {
    const name = row.supplierName || row.supplier
    if (!name) return counts
    counts[name] = (counts[name] || 0) + 1
    return counts
  }, {})
  const topSuppliers = Object.entries(suppliers).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const quoteActivity = rfqs.reduce((sum, row) => sum + (row.quoteCount || 0), 0)
  const reliability = deliveryOrders.length ? Math.max(70, 100 - deliveryOrders.filter(isDelayed).length * 12) : 92

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Users className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-950">Hiệu suất nhà cung cấp</h2>
        </div>
        <Link to={scopedPath('/buyer/sourcing', branchContext)} className="text-slate-400 transition hover:text-emerald-600">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-2">
        <MetricLine label="Độ tin cậy" value={`${reliability}%`} tone={reliability >= 85 ? 'emerald' : 'amber'} />
        <MetricLine label="Giao đúng hạn" value={`${Math.min(99, reliability + 3)}%`} tone="emerald" />
        <MetricLine label="Báo giá nhận được" value={String(quoteActivity)} tone={quoteActivity ? 'blue' : 'amber'} />
      </div>

      {topSuppliers.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nhà cung cấp hoạt động nhiều</p>
          {topSuppliers.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="truncate text-xs font-semibold text-slate-700">{name}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">{count} đơn</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
          <p className="text-xs font-medium text-slate-400">Chưa có dữ liệu nhà cung cấp</p>
          <Link to={scopedPath('/buyer/sourcing', branchContext)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
            Tìm nhà cung cấp <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────── Shared UI ─────────────────────── */

function SectionHeader({ icon, title, subtitle, to }: { icon: React.ReactNode; title: string; subtitle: string; to: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
      <Link to={to} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700">
        Xem thêm
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function MetricLine({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'red' | 'blue' }) {
  const toneClass =
    tone === 'red' ? 'text-red-700 bg-red-50' :
    tone === 'amber' ? 'text-amber-700 bg-amber-50' :
    tone === 'blue' ? 'text-blue-700 bg-blue-50' :
    'text-emerald-700 bg-emerald-50'
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ label, severity }: { label: string; severity: Severity }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(severity)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${severityDot(severity)}`} />
      {label}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  to,
}: {
  icon: React.ReactNode
  title: string
  text: string
  actionLabel: string
  to: string
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-md shadow-emerald-900/10">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs font-medium leading-5 text-slate-500">{text}</p>
      <Link
        to={to}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-700/15 transition hover:-translate-y-0.5 active:scale-95"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {actionLabel}
      </Link>
    </div>
  )
}
