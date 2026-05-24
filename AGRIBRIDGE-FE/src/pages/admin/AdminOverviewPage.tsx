import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingUp,
  TrendingDown,
  User,
  UserPlus,
  X,
  Activity,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { usePageTitle } from '../../hooks/usePageTitle'
import { AdminShell } from '../../components/admin/AdminShell'
import { adminTimeFilters } from '../../data/adminDashboardData'
import {
  createAdminOverviewActivity,
  createAdminQuickStat,
  deleteAdminOverviewActivity,
  deleteAdminQuickStat,
  fetchAdminOverview,
  updateAdminOverviewActivity,
  updateAdminQuickStat,
} from '../../services/adminService'
import type {
  AdminActivityItem,
  AdminActivityUpsertRequest,
  AdminOverviewPayload,
  AdminQuickStat,
  AdminQuickStatUpsertRequest,
  AdminTimeFilter,
} from '../../types/admin'

/* ─── color maps ─────────────────────────────────────────── */
const statIconByColor = {
  emerald: DollarSign,
  blue: ShoppingCart,
  violet: UserPlus,
  amber: AlertTriangle,
}

const statGradientByColor = {
  emerald: 'from-emerald-500 to-teal-600',
  blue: 'from-blue-500 to-indigo-600',
  violet: 'from-violet-500 to-purple-600',
  amber: 'from-amber-500 to-orange-500',
}

const statBgByColor = {
  emerald: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60',
  blue: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60',
  violet: 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200/60',
  amber: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60',
}

const statTextByColor = {
  emerald: 'text-emerald-700',
  blue: 'text-blue-700',
  violet: 'text-violet-700',
  amber: 'text-amber-700',
}

const activityIconByColor = {
  emerald: User,
  blue: Boxes,
  red: AlertTriangle,
  violet: Package,
}

const activityGradientByColor = {
  emerald: 'from-emerald-500 to-teal-500',
  blue: 'from-blue-500 to-indigo-500',
  red: 'from-red-500 to-rose-500',
  violet: 'from-violet-500 to-purple-500',
}

const quickStatGradientByColor = {
  emerald: 'from-emerald-500 to-teal-600',
  blue: 'from-blue-500 to-indigo-600',
  violet: 'from-violet-500 to-purple-600',
  amber: 'from-amber-500 to-orange-500',
}

/* ─── form state types ───────────────────────────────────── */
type ActivityFormState = {
  title: string
  description: string
  time: string
  color: AdminActivityItem['color']
}

type QuickStatFormState = {
  label: string
  subLabel: string
  value: string
  color: AdminQuickStat['color']
}

function createInitialActivityForm(item?: AdminActivityItem | null): ActivityFormState {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    time: item?.time ?? '',
    color: item?.color ?? 'emerald',
  }
}

function createInitialQuickStatForm(item?: AdminQuickStat | null): QuickStatFormState {
  return {
    label: item?.label ?? '',
    subLabel: item?.subLabel ?? '',
    value: item?.value ?? '',
    color: item?.color ?? 'emerald',
  }
}

/* ─── skeleton components ────────────────────────────────── */
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-200 ${className ?? ''}`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
        }}
      />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <AdminShell
      activeKey="overview"
      title="Tổng quan hệ thống"
      subtitle="Đang tải dữ liệu dashboard..."
    >
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes floatDot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes drawLine {
          from { stroke-dashoffset: 300; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Loading banner */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3.5">
        <span className="relative flex h-8 w-8 items-center justify-center">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"
            style={{ animation: 'pulse-ring 1.4s ease-in-out infinite' }}
          />
          <Activity className="relative h-4 w-4 text-emerald-600" />
        </span>
        <div>
          <p className="text-sm font-bold text-emerald-800">Đang tải dữ liệu…</p>
          <p className="text-xs text-emerald-600">Xin chờ một chút, hệ thống đang kết nối</p>
        </div>
        {/* animated dots */}
        <div className="ml-auto flex items-end gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-full bg-emerald-400"
              style={{ animation: `floatDot 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* KPI skeleton cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5"
            style={{ animation: `fadeInUp 0.4s ease both`, animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SkeletonPulse className="h-3.5 w-28 rounded-full" />
                <SkeletonPulse className="mt-3 h-8 w-20 rounded-lg" />
                <SkeletonPulse className="mt-2 h-3 w-36 rounded-full" />
              </div>
              <SkeletonPulse className="h-11 w-11 rounded-xl" />
            </div>
          </div>
        ))}
      </section>

      {/* Chart skeleton */}
      <div
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"
        style={{ animation: 'fadeInUp 0.4s ease 0.3s both' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <SkeletonPulse className="h-7 w-40 rounded-xl" />
          <SkeletonPulse className="h-4 w-52 rounded-full" />
        </div>
        <SkeletonPulse className="h-52 w-full rounded-2xl" />
        <div className="mt-3 flex gap-2">
          {[...Array(7)].map((_, i) => (
            <SkeletonPulse key={i} className="h-10 flex-1 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Risk skeleton */}
      <div
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"
        style={{ animation: 'fadeInUp 0.4s ease 0.45s both' }}
      >
        <SkeletonPulse className="mb-4 h-7 w-36 rounded-xl" />
        <div className="grid gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonPulse key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Activities + Quick stats skeleton */}
      <div
        className="mt-5 grid gap-5 xl:grid-cols-2"
        style={{ animation: 'fadeInUp 0.4s ease 0.6s both' }}
      >
        {[0, 1].map((col) => (
          <div key={col} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <SkeletonPulse className="h-7 w-44 rounded-xl" />
              <SkeletonPulse className="h-9 w-20 rounded-xl" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <SkeletonPulse className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <SkeletonPulse className="h-3.5 w-36 rounded-full" />
                    <SkeletonPulse className="mt-2 h-3 w-52 rounded-full" />
                  </div>
                  <SkeletonPulse className="h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}

/* ─── animated number ────────────────────────────────────── */
function AnimatedNumber({ value }: { value: string }) {
  const [displayed, setDisplayed] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value
      setDisplayed(value)
    }
  }, [value])

  return (
    <span
      key={displayed}
      style={{ animation: 'countUp 0.5s ease both' }}
      className="inline-block"
    >
      {displayed}
    </span>
  )
}

/* ─── main component ─────────────────────────────────────── */
export function AdminOverviewPage() {
  usePageTitle('Tổng quan hệ thống')
  const [filter, setFilter] = useState<AdminTimeFilter>('30d')
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activityMode, setActivityMode] = useState<'create' | 'edit'>('create')
  const [editingActivity, setEditingActivity] = useState<AdminActivityItem | null>(null)
  const [activityForm, setActivityForm] = useState<ActivityFormState>(createInitialActivityForm())
  const [activitySaving, setActivitySaving] = useState(false)

  const [quickStatModalOpen, setQuickStatModalOpen] = useState(false)
  const [quickStatMode, setQuickStatMode] = useState<'create' | 'edit'>('create')
  const [editingQuickStat, setEditingQuickStat] = useState<AdminQuickStat | null>(null)
  const [quickStatForm, setQuickStatForm] = useState<QuickStatFormState>(createInitialQuickStatForm())
  const [quickStatSaving, setQuickStatSaving] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchAdminOverview(filter)
        if (!active) return
        setOverview(payload)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu dashboard.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [filter, reloadKey])

  const chartData = overview?.gmvSeries.map((p) => ({ label: p.label, value: p.value })) ?? []

  function triggerReload() { setReloadKey((c) => c + 1) }

  function openCreateActivity() {
    setActivityMode('create'); setEditingActivity(null)
    setActivityForm(createInitialActivityForm()); setActivityModalOpen(true)
  }
  function openEditActivity(item: AdminActivityItem) {
    setActivityMode('edit'); setEditingActivity(item)
    setActivityForm(createInitialActivityForm(item)); setActivityModalOpen(true)
  }
  function closeActivityModal() {
    setActivityModalOpen(false); setEditingActivity(null)
    setActivityForm(createInitialActivityForm())
  }
  async function submitActivityModal() {
    if (!activityForm.title.trim() || !activityForm.description.trim() || !activityForm.time.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề, mô tả và thời gian hoạt động.'); return
    }
    const payload: AdminActivityUpsertRequest = { ...activityForm }
    try {
      setActivitySaving(true); setError('')
      if (activityMode === 'create') await createAdminOverviewActivity(payload)
      else if (editingActivity?.id) await updateAdminOverviewActivity(editingActivity.id, payload)
      closeActivityModal(); triggerReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hoạt động dashboard.')
    } finally { setActivitySaving(false) }
  }
  async function removeActivity(item: AdminActivityItem) {
    if (!item.id) return
    if (!window.confirm(`Xóa hoạt động "${item.title}"?`)) return
    try { setError(''); await deleteAdminOverviewActivity(item.id); triggerReload() }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được hoạt động dashboard.') }
  }

  function openCreateQuickStat() {
    setQuickStatMode('create'); setEditingQuickStat(null)
    setQuickStatForm(createInitialQuickStatForm()); setQuickStatModalOpen(true)
  }
  function openEditQuickStat(item: AdminQuickStat) {
    setQuickStatMode('edit'); setEditingQuickStat(item)
    setQuickStatForm(createInitialQuickStatForm(item)); setQuickStatModalOpen(true)
  }
  function closeQuickStatModal() {
    setQuickStatModalOpen(false); setEditingQuickStat(null)
    setQuickStatForm(createInitialQuickStatForm())
  }
  async function submitQuickStatModal() {
    if (!quickStatForm.label.trim() || !quickStatForm.subLabel.trim() || !quickStatForm.value.trim()) {
      setError('Vui lòng nhập đầy đủ nhãn, mô tả phụ và giá trị cho thống kê nhanh.'); return
    }
    const payload: AdminQuickStatUpsertRequest = { ...quickStatForm }
    try {
      setQuickStatSaving(true); setError('')
      if (quickStatMode === 'create') await createAdminQuickStat(payload)
      else if (editingQuickStat?.id) await updateAdminQuickStat(editingQuickStat.id, payload)
      closeQuickStatModal(); triggerReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được thống kê nhanh.')
    } finally { setQuickStatSaving(false) }
  }
  async function removeQuickStat(item: AdminQuickStat) {
    if (!item.id) return
    if (!window.confirm(`Xóa thống kê "${item.label}"?`)) return
    try { setError(''); await deleteAdminQuickStat(item.id); triggerReload() }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được thống kê nhanh.') }
  }

  /* ── loading state ── */
  if (loading) return <DashboardSkeleton />

  if (!overview) {
    return (
      <AdminShell activeKey="overview" title="Tổng quan hệ thống" subtitle="Không tải được dữ liệu dashboard">
        <section className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6">
          <AlertTriangle className="h-8 w-8 shrink-0 text-red-500" />
          <div>
            <p className="font-bold text-red-700">Không tải được dữ liệu</p>
            <p className="mt-0.5 text-sm text-red-500">{error || 'Không có dữ liệu tổng quan.'}</p>
          </div>
        </section>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      activeKey="overview"
      title="Tổng quan hệ thống"
      subtitle="Theo dõi nhanh tình trạng nền tảng, xu hướng tăng trưởng và rủi ro vận hành"
      actions={
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {adminTimeFilters.map((item) => (
            <button
              key={item.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === item.value
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawLine {
          from { stroke-dashoffset: 600; opacity: 0; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes fillFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dotPop {
          0%  { transform: scale(0); }
          70% { transform: scale(1.2); }
          100%{ transform: scale(1); }
        }
        .kpi-card { animation: fadeInUp 0.5s ease both; }
        .chart-line { stroke-dasharray: 600; animation: drawLine 1.2s ease 0.3s both; }
        .chart-fill { animation: fillFade 1s ease 0.8s both; }
        .chart-dot { animation: dotPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>

      {error && (
        <section className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </section>
      )}

      {/* ── KPI cards ──────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.kpis.map((item, i) => {
          const Icon = statIconByColor[item.color]
          const gradient = statGradientByColor[item.color]
          const bg = statBgByColor[item.color]
          const txt = statTextByColor[item.color]
          const isUp = item.changeTone === 'up'
          const TrendIcon = isUp ? TrendingUp : TrendingDown
          return (
            <article
              key={item.title}
              className={`kpi-card group relative overflow-hidden rounded-2xl border ${bg} p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/70`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* background glow */}
              <div
                className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition-all duration-300 group-hover:scale-125 group-hover:opacity-20`}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.title}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${txt}`}>
                    <AnimatedNumber value={item.value} />
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isUp
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {item.change}
                  </span>
                </div>
                <span
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          )
        })}
      </section>

      {/* ── GMV chart (Recharts) ────────────────────────────── */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5" style={{ animation: 'fadeInUp 0.5s ease 0.35s both' }}>
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Xu hướng GMV</h2>
              <p className="text-xs text-slate-400">Dữ liệu theo bộ lọc thời gian đã chọn</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-700">GMV</span>
          </div>
        </header>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="80%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              dy={6}
            />

            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : String(v)
              }
            />

            <Tooltip content={<GmvTooltip />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#gmvGradient)"
              dot={{ r: 4, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      {/* ── Risk warnings ───────────────────────────────────── */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5" style={{ animation: 'fadeInUp 0.5s ease 0.5s both' }}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
            <Zap className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-extrabold text-slate-900">Cảnh báo rủi ro</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {overview.risks.map((item) => (
            <article
              key={item.key}
              className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                item.critical
                  ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'
                  : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50'
              }`}
            >
              <div
                className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 ${
                  item.critical ? 'bg-red-400' : 'bg-emerald-400'
                }`}
              />
              <p className="relative text-xs font-semibold text-slate-500">{item.label}</p>
              <p
                className={`relative mt-2 text-3xl font-extrabold ${
                  item.critical ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                <AnimatedNumber value={String(item.value)} />
              </p>
              <p className="relative mt-1 text-xs text-slate-400">{item.hint}</p>
              {item.critical && (
                <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                  <AlertTriangle className="h-3 w-3 text-white" />
                </span>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ── Activities + Quick Stats ────────────────────────── */}
      <section className="mt-5 grid gap-5 xl:grid-cols-2" style={{ animation: 'fadeInUp 0.5s ease 0.65s both' }}>
        {/* Activities */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow">
                <Activity className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">Hoạt động gần đây</h2>
            </div>
            <button
              onClick={openCreateActivity}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {overview.activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-10 px-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                  <Activity className="h-5 w-5 text-blue-500" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-700">Chưa có hoạt động nào</p>
                <p className="mt-1 max-w-[220px] text-center text-xs text-slate-400">
                  Nhấn <span className="font-semibold text-emerald-600">+ Thêm</span> để ghi nhận hoạt động nổi bật lên dashboard
                </p>
                <button
                  onClick={openCreateActivity}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm hoạt động
                </button>
              </div>
            ) : (
              overview.activities.map((item, i) => {
                const Icon = activityIconByColor[item.color]
                const gradient = activityGradientByColor[item.color]
                return (
                  <div
                    key={`${item.title}-${item.id ?? item.time}`}
                    className="group flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50/70 hover:shadow-sm"
                    style={{ animation: `fadeInUp 0.4s ease ${0.65 + i * 0.06}s both` }}
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">{item.time}</p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEditActivity(item)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {item.id ? (
                        <button
                          onClick={() => removeActivity(item)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </article>

        {/* Quick stats */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow">
                <Zap className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">Thống kê nhanh</h2>
            </div>
            <button
              onClick={openCreateQuickStat}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {overview.quickStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-10 px-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
                  <Zap className="h-5 w-5 text-violet-500" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-700">Chưa có thống kê nào</p>
                <p className="mt-1 max-w-[220px] text-center text-xs text-slate-400">
                  Nhấn <span className="font-semibold text-emerald-600">+ Thêm</span> để tạo số liệu thống kê tùy chỉnh
                </p>
                <button
                  onClick={openCreateQuickStat}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm thống kê
                </button>
              </div>
            ) : (
              overview.quickStats.map((item, i) => {
                const gradient = quickStatGradientByColor[item.color]
                return (
                  <div
                    key={`${item.label}-${item.id ?? 'default'}`}
                    className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition-all hover:border-slate-200 hover:shadow-sm"
                    style={{ animation: `fadeInUp 0.4s ease ${0.65 + i * 0.06}s both` }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm text-xs font-extrabold`}
                      >
                        {item.value}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.subLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEditQuickStat(item)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {item.id ? (
                        <button
                          onClick={() => removeQuickStat(item)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </article>
      </section>

      {/* ── Activity modal ─────────────────────────────────── */}
      {activityModalOpen ? (
        <OverviewModal
          title={activityMode === 'create' ? 'Thêm hoạt động dashboard' : 'Cập nhật hoạt động'}
          saving={activitySaving}
          onClose={closeActivityModal}
          onSubmit={submitActivityModal}
        >
          <Field label="Tiêu đề">
            <input value={activityForm.title} onChange={(e) => setActivityForm((c) => ({ ...c, title: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Mô tả">
            <textarea value={activityForm.description} onChange={(e) => setActivityForm((c) => ({ ...c, description: e.target.value }))} rows={4} className={`${inputClass} h-auto py-2.5`} />
          </Field>
          <Field label="Thời gian hiển thị">
            <input value={activityForm.time} onChange={(e) => setActivityForm((c) => ({ ...c, time: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Màu sắc">
            <select value={activityForm.color} onChange={(e) => setActivityForm((c) => ({ ...c, color: e.target.value as AdminActivityItem['color'] }))} className={inputClass}>
              <option value="emerald">🟢 Xanh lá</option>
              <option value="blue">🔵 Xanh dương</option>
              <option value="red">🔴 Đỏ</option>
              <option value="violet">🟣 Tím</option>
            </select>
          </Field>
        </OverviewModal>
      ) : null}

      {/* ── Quick stat modal ───────────────────────────────── */}
      {quickStatModalOpen ? (
        <OverviewModal
          title={quickStatMode === 'create' ? 'Thêm thống kê nhanh' : 'Cập nhật thống kê nhanh'}
          saving={quickStatSaving}
          onClose={closeQuickStatModal}
          onSubmit={submitQuickStatModal}
        >
          <Field label="Nhãn">
            <input value={quickStatForm.label} onChange={(e) => setQuickStatForm((c) => ({ ...c, label: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Mô tả phụ">
            <input value={quickStatForm.subLabel} onChange={(e) => setQuickStatForm((c) => ({ ...c, subLabel: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Giá trị">
            <input value={quickStatForm.value} onChange={(e) => setQuickStatForm((c) => ({ ...c, value: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Màu sắc">
            <select value={quickStatForm.color} onChange={(e) => setQuickStatForm((c) => ({ ...c, color: e.target.value as AdminQuickStat['color'] }))} className={inputClass}>
              <option value="emerald">🟢 Xanh lá</option>
              <option value="blue">🔵 Xanh dương</option>
              <option value="violet">🟣 Tím</option>
              <option value="amber">🟠 Cam</option>
            </select>
          </Field>
        </OverviewModal>
      ) : null}
    </AdminShell>
  )
}

/* ─── modal ──────────────────────────────────────────────── */
function OverviewModal({
  title,
  saving,
  onClose,
  onSubmit,
  children,
}: {
  title: string
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl shadow-slate-900/20"
        style={{ animation: 'fadeInUp 0.3s cubic-bezier(.34,1.56,.64,1) both' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">{children}</div>
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Đang lưu...
              </>
            ) : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── field ──────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200'

/* ─── Recharts custom tooltip ────────────────────────── */
function GmvTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  const formatted =
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M đ`
      : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}K đ`
      : `${value} đ`

  return (
    <div className="min-w-[110px] rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-xl shadow-emerald-900/10">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-extrabold text-emerald-700">{formatted}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-semibold text-slate-500">GMV</span>
      </div>
    </div>
  )
}
