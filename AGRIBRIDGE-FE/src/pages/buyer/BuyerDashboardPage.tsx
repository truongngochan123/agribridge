import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  LineChart,
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
  if (value === null || value === undefined || value === '') return 'Chưa có SL'
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
  const unresolvedIncidentCount = dashboard.alerts.filter((alert) => /incident|dispute|claim/i.test(`${alert.id} ${alert.title}`)).length
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

        <HeroOperationsPanel
          branchContext={branchContext}
          activeBranch={activeBranch}
          totalBranches={branches.length}
          delayedCount={delayedCount}
          expiringRfqCount={expiringRfqCount}
          noQuoteRfqCount={noQuoteRfqCount}
          unresolvedIncidentCount={unresolvedIncidentCount}
        />

        <OperationalAlertStrip alerts={dashboard.alerts} attentionItems={attentionItems} branchContext={branchContext} />

        <QuickActionCenter branchContext={branchContext} />

        <KpiGrid
          items={branchScopedDashboard.kpis}
          branchContext={branchContext}
          delayedCount={delayedCount}
          expiringRfqCount={expiringRfqCount}
          noQuoteRfqCount={noQuoteRfqCount}
          branchHealth={activeBranch}
        />

        <div className="grid gap-4 2xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <AttentionCenter items={attentionItems} branchContext={branchContext} />
            <ShipmentSection rows={branchScopedDashboard.deliveryOrders as FlexibleDeliveryOrder[]} branchContext={branchContext} />
            <RfqSection rows={branchScopedDashboard.pendingRfqs as FlexiblePendingRfq[]} branchContext={branchContext} />
          </div>
          <div className="space-y-4">
            <SupplierIntelligence deliveryOrders={branchScopedDashboard.deliveryOrders as FlexibleDeliveryOrder[]} rfqs={branchScopedDashboard.pendingRfqs as FlexiblePendingRfq[]} branchContext={branchContext} />
            <MarketIntelligence rfqs={branchScopedDashboard.pendingRfqs} branchContext={branchContext} />
            <IncidentCenter alerts={dashboard.alerts} delayedCount={delayedCount} branchContext={branchContext} />
            <ActivityTimeline dashboard={branchScopedDashboard} branchContext={branchContext} />
          </div>
        </div>
      </div>
    </BuyerShell>
  )
}

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
    <div className="flex flex-wrap items-center justify-between gap-3">
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
          className="h-9 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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

function LoadingStrip() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Đang cập nhật mua hàng, RFQ, công nợ và giao hàng...
      <div className="ml-auto hidden gap-2 sm:flex">
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

function HeroOperationsPanel({
  branchContext,
  activeBranch,
  totalBranches,
  delayedCount,
  expiringRfqCount,
  noQuoteRfqCount,
  unresolvedIncidentCount,
}: {
  branchContext: BranchContext | null
  activeBranch: BuyerBranchSummary | null
  totalBranches: number
  delayedCount: number
  expiringRfqCount: number
  noQuoteRfqCount: number
  unresolvedIncidentCount: number
}) {
  const healthScore = Math.max(42, 96 - delayedCount * 12 - expiringRfqCount * 7 - unresolvedIncidentCount * 14)
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-3.5 text-white shadow-lg shadow-emerald-900/10">
      <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.14) 55%, transparent 56%)' }} />
      <div className="relative grid gap-3.5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <Radar className="h-3.5 w-3.5" />
              Điều hành mua hàng
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <MapPin className="h-3.5 w-3.5" />
              {branchContext?.branchName || `${totalBranches} chi nhánh`}
            </span>
          </div>
          <h2 className="mt-3 max-w-3xl text-xl font-bold leading-tight tracking-normal md:text-2xl">
            Theo dõi mua hàng, giao hàng và vận hành chi nhánh rõ ràng hơn.
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm font-medium leading-5 text-emerald-50/85">
            Ưu tiên công nợ, giao hàng trễ, RFQ sắp hết hạn và phản hồi nhà cung cấp trước khi ảnh hưởng đến vận hành.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <HeroMetric icon={<Truck className="h-4 w-4" />} value={String(delayedCount)} label="giao trễ" tone={delayedCount ? 'risk' : 'ok'} />
            <HeroMetric icon={<Clock3 className="h-4 w-4" />} value={String(expiringRfqCount)} label="RFQ sắp hết hạn" tone={expiringRfqCount ? 'warn' : 'ok'} />
            <HeroMetric icon={<ShieldAlert className="h-4 w-4" />} value={String(unresolvedIncidentCount)} label="sự cố mở" tone={unresolvedIncidentCount ? 'risk' : 'ok'} />
            <HeroMetric icon={<Building2 className="h-4 w-4" />} value={activeBranch?.activeOrders || 'Tất cả'} label="phạm vi" tone="neutral" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-md backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Sức khỏe vận hành</p>
              <p className="mt-1 text-2xl font-bold">{healthScore}%</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Gauge className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.7)] transition-all duration-500" style={{ width: `${healthScore}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <HealthTile label="RFQ chưa có giá" value={String(noQuoteRfqCount)} />
            <HealthTile label="Rủi ro giao hàng" value={delayedCount ? 'Cần xem' : 'Ổn định'} />
            <HealthTile label="Phản hồi NCC" value={expiringRfqCount ? 'Cần nhắc' : 'Tốt'} />
            <HealthTile label="Phạm vi" value={branchContext ? 'Chi nhánh' : 'Toàn hệ thống'} />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroMetric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: 'risk' | 'warn' | 'ok' | 'neutral' }) {
  const toneClass = tone === 'risk' ? 'bg-red-400/20 text-red-50' : tone === 'warn' ? 'bg-amber-300/20 text-amber-50' : tone === 'ok' ? 'bg-emerald-300/20 text-emerald-50' : 'bg-white/15 text-white'
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border border-white/15 px-2.5 py-1.5 text-xs font-semibold backdrop-blur ${toneClass}`}>
      {icon}
      <span>{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  )
}

function HealthTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function OperationalAlertStrip({ alerts, attentionItems, branchContext }: { alerts: BuyerDashboardAlert[]; attentionItems: AttentionItem[]; branchContext: BranchContext | null }) {
  const synthesized = [
    ...alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      value: alert.value,
      severity: severityFromAlert(alert.tone),
      to: scopedPath(alert.targetPath || '/buyer/overview', branchContext),
    })),
    ...attentionItems.slice(0, Math.max(0, 6 - alerts.length)).map((item) => ({
      id: item.id,
      title: item.title,
      value: item.meta,
      severity: item.severity,
      to: item.to,
    })),
  ].slice(0, 6)

  if (!synthesized.length) {
    return (
      <Link to={scopedPath('/buyer/delivery', branchContext)} className="group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Chưa có cảnh báo khẩn</p>
          <p className="text-xs font-medium text-slate-500">Mở giao hàng để tiếp tục theo dõi tiến độ chi nhánh.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
      </Link>
    )
  }

  return (
    <section className="grid gap-3 xl:grid-cols-6">
      {synthesized.map((alert) => (
        <Link
          key={alert.id}
          to={alert.to}
          className={`group rounded-2xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${severityClasses(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot(alert.severity)} ${alert.severity === 'critical' ? 'animate-pulse' : ''}`} />
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-55 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-semibold uppercase tracking-wide">{alert.title}</p>
          <p className="mt-1 truncate text-lg font-bold">{alert.value}</p>
        </Link>
      ))}
    </section>
  )
}

function QuickActionCenter({ branchContext }: { branchContext: BranchContext | null }) {
  const actions: Array<{ label: string; to: string; icon: React.ReactNode; tone: string }> = [
    { label: 'Tạo RFQ', to: '/buyer/rfq', icon: <FileText className="h-4 w-4" />, tone: 'from-amber-500 to-amber-600' },
    { label: 'Tạo đơn mua', to: '/buyer/sourcing', icon: <ShoppingCart className="h-4 w-4" />, tone: 'from-emerald-600 to-teal-500' },
    { label: 'Theo dõi giao', to: '/buyer/delivery', icon: <Truck className="h-4 w-4" />, tone: 'from-blue-600 to-blue-500' },
    { label: 'Xử lý sự cố', to: '/buyer/delivery?status=incident', icon: <ShieldAlert className="h-4 w-4" />, tone: 'from-red-600 to-red-500' },
    { label: 'Thanh toán nợ', to: '/buyer/debt', icon: <CircleDollarSign className="h-4 w-4" />, tone: 'from-emerald-700 to-teal-600' },
    { label: 'Tìm nhà cung cấp', to: '/buyer/sourcing', icon: <Search className="h-4 w-4" />, tone: 'from-blue-600 to-teal-500' },
    { label: 'Xem chi nhánh', to: '/buyer/branches', icon: <Store className="h-4 w-4" />, tone: 'from-teal-600 to-emerald-500' },
  ]

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Thao tác nhanh</p>
          <p className="text-xs font-medium text-slate-500">Các việc thường dùng trong mua hàng và giao nhận.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          {branchContext?.branchName || 'Toàn hệ thống'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={scopedPath(action.to, branchContext)}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md hover:shadow-emerald-900/10"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.tone} text-white shadow-lg transition group-hover:scale-105`}>
              {action.icon}
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{action.label}</p>
            <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
          </Link>
        ))}
      </div>
    </section>
  )
}

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
        badge: item.value > 0 ? 'Đang có' : 'Ổn',
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
      trend: noQuoteRfqCount ? 'Nhắc NCC' : 'Có báo giá',
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
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {operationalCards.slice(0, 6).map((item) => (
        <Link
          key={item.id}
          to={scopedPath(item.route, branchContext)}
          className="group relative min-h-[112px] overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/10"
        >
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />
          <div className="flex items-start justify-between gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} text-white shadow-sm shadow-slate-900/10 transition group-hover:scale-105`}>
              {item.icon}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {item.badge}
            </span>
          </div>
          <p className="mt-2.5 line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-1 truncate text-xl font-bold leading-none text-slate-950">{item.value}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              {item.trend}
            </span>
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-500" />
          </div>
        </Link>
      ))}
    </section>
  )
}

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
      severity: 'critical',
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
      severity: row.quoteCount ? 'medium' : 'high',
      icon: <FileText className="h-4 w-4" />,
      to: scopedPath(`/buyer/rfq?rfqId=${row.rfqId}`, branchContext),
    }))

  return [...alertItems, ...shipmentItems, ...rfqItems].sort((a, b) => {
    const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, normal: 3 }
    return rank[a.severity] - rank[b.severity]
  })
}

function AttentionCenter({ items, branchContext }: { items: AttentionItem[]; branchContext: BranchContext | null }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Trung tâm cảnh báo"
        subtitle="Giao trễ, công nợ, xác nhận và phản hồi nhà cung cấp cần chú ý."
        to={scopedPath('/buyer/delivery', branchContext)}
      />
      {items.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-7 w-7" />}
          title="Chưa có việc khẩn cần xử lý"
          text="Tạo RFQ mới hoặc theo dõi giao hàng để giữ nhịp mua hàng ổn định."
          actionLabel="Theo dõi giao hàng"
          to={scopedPath('/buyer/delivery', branchContext)}
        />
      )}
    </section>
  )
}

function ShipmentSection({ rows, branchContext }: { rows: FlexibleDeliveryOrder[]; branchContext: BranchContext | null }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
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
            const supplier = row.supplierName || row.supplier || 'Chưa có nhà cung cấp'
            const status = delayed ? 'Nguy cơ trễ' : row.statusLabel || row.status || 'Đang giao'
            return (
              <Link
                key={`${row.orderId}-${row.shipmentId ?? 'shipment'}`}
                to={scopedPath(`/buyer/orders?orderId=${row.orderId}`, branchContext)}
                className="group relative block rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3 py-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/10"
              >
                <div className="absolute right-3 top-2">
                  <StatusBadge label={status} severity={delayed ? 'critical' : 'normal'} />
                </div>
                <div className="grid items-center gap-3 lg:grid-cols-[minmax(180px,1.25fr)_minmax(130px,0.8fr)_minmax(140px,0.8fr)_minmax(110px,0.7fr)_120px]">
                  <div className="min-w-0 pr-28 lg:pr-2">
                    <div className="flex items-center gap-2">
                      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">{row.orderCode}</p>
                    </div>
                    <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-950">{row.productText}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs lg:block">
                    <CompactMeta label="SL" value={formatQuantity(row.quantity, row.unit)} />
                    <CompactMeta label="Tổng tiền" value={row.displayAmount} strong />
                  </div>

                  <div className="min-w-0">
                    <CompactMeta label="Nhà cung cấp" value={supplier} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs lg:block">
                    <CompactMeta label="ETA" value={formatDate(row.estimatedDeliveryAt)} />
                    <div className="mt-1 lg:mt-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>Tiến độ</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${delayed ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-start lg:justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                      Xem giao hàng
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
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

function RfqSection({ rows, branchContext }: { rows: FlexiblePendingRfq[]; branchContext: BranchContext | null }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
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
                className="group relative block rounded-xl border border-slate-100 bg-gradient-to-r from-white to-amber-50/25 px-3 py-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md hover:shadow-amber-900/10"
              >
                <div className="absolute right-3 top-2">
                  <StatusBadge label={urgent ? 'Sắp hết hạn' : row.status || 'Đang mở'} severity={urgent ? 'high' : 'normal'} />
                </div>
                <div className="grid items-center gap-3 lg:grid-cols-[minmax(180px,1.2fr)_minmax(110px,0.65fr)_minmax(120px,0.7fr)_minmax(150px,0.85fr)_130px]">
                  <div className="min-w-0 pr-28 lg:pr-2">
                    <div className="flex items-center gap-2">
                      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-amber-600">{row.rfqCode}</p>
                    </div>
                    <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-950">{row.productText || row.title}</h3>
                  </div>

                  <CompactMeta label="Nhu cầu" value={`${formatNumber(row.quantity)} ${row.unit || ''}`.trim()} strong />
                  <CompactMeta label="Khu vực" value={row.province || 'Chưa có tỉnh'} />

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:block">
                    <CompactMeta label="Hết hạn" value={formatDate(row.expiredAt)} />
                    <CompactMeta label="Trạng thái" value={expiryText} strong={urgent} />
                    <CompactMeta label="Phản hồi" value={`${row.quoteCount} báo giá`} />
                  </div>

                  <div className="flex items-center justify-start lg:justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
                      Xem RFQ
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
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

function SupplierIntelligence({ deliveryOrders, rfqs, branchContext }: { deliveryOrders: FlexibleDeliveryOrder[]; rfqs: FlexiblePendingRfq[]; branchContext: BranchContext | null }) {
  const suppliers = deliveryOrders.reduce<Record<string, number>>((counts, row) => {
    const name = row.supplierName || row.supplier || 'Chưa có nhà cung cấp'
    counts[name] = (counts[name] || 0) + 1
    return counts
  }, {})
  const topSuppliers = Object.entries(suppliers).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const quoteActivity = rfqs.reduce((sum, row) => sum + (row.quoteCount || 0), 0)
  const reliability = deliveryOrders.length ? Math.max(70, 100 - deliveryOrders.filter(isDelayed).length * 12) : 92

  return (
    <SidePanel icon={<Users className="h-4 w-4" />} title="Hiệu suất nhà cung cấp" to={scopedPath('/buyer/sourcing', branchContext)}>
      <MetricLine label="Độ tin cậy" value={`${reliability}%`} tone={reliability >= 85 ? 'emerald' : 'amber'} />
      <MetricLine label="Giao đúng hạn" value={`${Math.min(99, reliability + 3)}%`} tone="emerald" />
      <MetricLine label="Báo giá nhận được" value={`${quoteActivity}`} tone={quoteActivity ? 'blue' : 'amber'} />
      <div className="mt-3 space-y-2">
        {(topSuppliers.length ? topSuppliers : [['Nhà cung cấp mua nhiều', 0]]).map(([name, count]) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="truncate text-xs font-semibold text-slate-700">{name}</span>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">{count ? `${count} đơn` : 'Theo dõi'}</span>
          </div>
        ))}
      </div>
    </SidePanel>
  )
}

function MarketIntelligence({ rfqs, branchContext }: { rfqs: BuyerDashboardPendingRfq[]; branchContext: BranchContext | null }) {
  const categories = rfqs.slice(0, 3).map((rfq) => rfq.productText || rfq.title).filter(Boolean)
  return (
    <SidePanel icon={<LineChart className="h-4 w-4" />} title="Biến động thị trường" to={scopedPath('/buyer/market', branchContext)}>
      <MetricLine label="Cảnh báo tăng giá" value={rfqs.length ? String(Math.min(3, rfqs.length)) : '0'} tone={rfqs.length ? 'amber' : 'emerald'} />
      <MetricLine label="Khu vực biến động" value={rfqs[0]?.province || 'Tất cả khu vực'} tone="blue" />
      <MetricLine label="Mặt hàng nổi bật" value={String(categories.length || 1)} tone="emerald" />
      <div className="mt-3 flex flex-wrap gap-2">
        {(categories.length ? categories : ['Nông sản tươi', 'Nguồn hàng khu vực']).map((item) => (
          <span key={item} className="line-clamp-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            {item}
          </span>
        ))}
      </div>
    </SidePanel>
  )
}

function IncidentCenter({ alerts, delayedCount, branchContext }: { alerts: BuyerDashboardAlert[]; delayedCount: number; branchContext: BranchContext | null }) {
  const incidents = alerts.filter((alert) => /incident|dispute|claim|delay|shipment/i.test(`${alert.id} ${alert.title}`))
  return (
    <SidePanel icon={<ShieldAlert className="h-4 w-4" />} title="Quản lý sự cố" to={scopedPath('/buyer/delivery?status=incident', branchContext)}>
      <MetricLine label="Sự cố đang mở" value={String(incidents.length + delayedCount)} tone={incidents.length || delayedCount ? 'red' : 'emerald'} />
      <MetricLine label="Khiếu nại chưa xử lý" value={String(incidents.length)} tone={incidents.length ? 'amber' : 'emerald'} />
      <MetricLine label="Chờ phản hồi NCC" value={String(Math.max(0, incidents.length - 1))} tone={incidents.length > 1 ? 'amber' : 'emerald'} />
      <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-500">
        Ưu tiên sự cố giao hàng và rủi ro trễ để đội vận hành xử lý trước khi ảnh hưởng đến quan hệ nhà cung cấp.
      </p>
    </SidePanel>
  )
}

function ActivityTimeline({ dashboard, branchContext }: { dashboard: BuyerDashboardPayload; branchContext: BranchContext | null }) {
  const events = [
    ...dashboard.deliveryOrders.slice(0, 3).map((row) => ({
      id: `delivery-${row.orderId}`,
      title: isDelayed(row) ? 'Giao hàng bị trễ' : 'Nhà cung cấp xác nhận giao',
      meta: `${row.orderCode} · ${formatDate(row.estimatedDeliveryAt)}`,
      icon: <Truck className="h-3.5 w-3.5" />,
      to: scopedPath(`/buyer/orders?orderId=${row.orderId}`, branchContext),
    })),
    ...dashboard.pendingRfqs.slice(0, 3).map((row) => ({
      id: `rfq-${row.rfqId}`,
      title: row.quoteCount ? 'RFQ đã có báo giá' : 'RFQ chờ nhà cung cấp',
      meta: `${row.rfqCode} · ${row.quoteCount} báo giá`,
      icon: <FileText className="h-3.5 w-3.5" />,
      to: scopedPath(`/buyer/rfq?rfqId=${row.rfqId}`, branchContext),
    })),
  ].slice(0, 5)

  return (
    <SidePanel icon={<Activity className="h-4 w-4" />} title="Hoạt động gần đây" to={scopedPath('/buyer/orders', branchContext)}>
      {events.length ? (
        <div className="space-y-3">
          {events.map((event, index) => (
            <Link key={event.id} to={event.to} className="group flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                  {event.icon}
                </span>
                {index < events.length - 1 ? <span className="mt-1 h-6 w-px bg-slate-200" /> : null}
              </div>
              <div className="min-w-0 pb-2">
                <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{event.meta}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Activity className="h-7 w-7" />} title="Chưa có hoạt động mới" text="Đơn hàng, RFQ, thanh toán và giao hàng sẽ hiển thị tại đây." actionLabel="Tạo RFQ" to={scopedPath('/buyer/rfq', branchContext)} compact />
      )}
    </SidePanel>
  )
}

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

function SidePanel({ icon, title, to, children }: { icon: React.ReactNode; title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        <Link to={to} className="text-slate-400 transition hover:text-emerald-600">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  )
}

function MetricLine({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'red' | 'blue' }) {
  const toneClass = tone === 'red' ? 'text-red-700 bg-red-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : tone === 'blue' ? 'text-blue-700 bg-blue-50' : 'text-emerald-700 bg-emerald-50'
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}

function CompactMeta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-xs ${strong ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>{value}</p>
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
  compact,
}: {
  icon: React.ReactNode
  title: string
  text: string
  actionLabel: string
  to: string
  compact?: boolean
}) {
  return (
    <div className={`mt-4 rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-center ${compact ? 'p-4' : 'p-8'}`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-md shadow-emerald-900/10">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-5 text-slate-500">{text}</p>
      <Link to={to} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-700/15 transition hover:-translate-y-0.5 active:scale-95">
        <Sparkles className="h-3.5 w-3.5" />
        {actionLabel}
      </Link>
    </div>
  )
}
