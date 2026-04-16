import { AlertTriangle, Boxes, DollarSign, Package, Pencil, Plus, ShoppingCart, Trash2, User, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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

const statIconByColor = {
  emerald: DollarSign,
  blue: ShoppingCart,
  violet: UserPlus,
  amber: AlertTriangle,
}

const statBoxClassByColor = {
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
}

const activityIconByColor = {
  emerald: User,
  blue: Boxes,
  red: AlertTriangle,
  violet: Package,
}

const activityIconClassByColor = {
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-600',
  violet: 'bg-violet-100 text-violet-700',
}

const quickStatClassByColor = {
  emerald: 'bg-emerald-100 text-emerald-900',
  blue: 'bg-blue-100 text-blue-900',
  violet: 'bg-violet-100 text-violet-900',
  amber: 'bg-amber-100 text-amber-900',
}

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

export function AdminOverviewPage() {
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
    return () => {
      active = false
    }
  }, [filter, reloadKey])

  const maxChartValue = useMemo(() => {
    if (!overview?.gmvSeries.length) return 1
    return Math.max(...overview.gmvSeries.map((point) => point.value), 1)
  }, [overview])

  const minChartValue = useMemo(() => {
    if (!overview?.gmvSeries.length) return 0
    return Math.min(...overview.gmvSeries.map((point) => point.value), 0)
  }, [overview])

  const chartPath = useMemo(() => {
    if (!overview?.gmvSeries.length) return ''

    const width = 100
    const height = 48
    const range = Math.max(maxChartValue - minChartValue, 1)

    return overview.gmvSeries
      .map((point, index) => {
        const x = overview.gmvSeries.length === 1 ? width / 2 : (index / (overview.gmvSeries.length - 1)) * width
        const normalized = (point.value - minChartValue) / range
        const y = height - normalized * height
        return `${x},${y}`
      })
      .join(' ')
  }, [maxChartValue, minChartValue, overview])

  function triggerReload() {
    setReloadKey((current) => current + 1)
  }

  function openCreateActivity() {
    setActivityMode('create')
    setEditingActivity(null)
    setActivityForm(createInitialActivityForm())
    setActivityModalOpen(true)
  }

  function openEditActivity(item: AdminActivityItem) {
    setActivityMode('edit')
    setEditingActivity(item)
    setActivityForm(createInitialActivityForm(item))
    setActivityModalOpen(true)
  }

  function closeActivityModal() {
    setActivityModalOpen(false)
    setEditingActivity(null)
    setActivityForm(createInitialActivityForm())
  }

  async function submitActivityModal() {
    if (!activityForm.title.trim() || !activityForm.description.trim() || !activityForm.time.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề, mô tả và thời gian hoạt động.')
      return
    }

    const payload: AdminActivityUpsertRequest = { ...activityForm }
    try {
      setActivitySaving(true)
      setError('')
      if (activityMode === 'create') {
        await createAdminOverviewActivity(payload)
      } else if (editingActivity?.id) {
        await updateAdminOverviewActivity(editingActivity.id, payload)
      }
      closeActivityModal()
      triggerReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hoạt động dashboard.')
    } finally {
      setActivitySaving(false)
    }
  }

  async function removeActivity(item: AdminActivityItem) {
    if (!item.id) return
    if (!window.confirm(`Xóa hoạt động "${item.title}"?`)) return
    try {
      setError('')
      await deleteAdminOverviewActivity(item.id)
      triggerReload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được hoạt động dashboard.')
    }
  }

  function openCreateQuickStat() {
    setQuickStatMode('create')
    setEditingQuickStat(null)
    setQuickStatForm(createInitialQuickStatForm())
    setQuickStatModalOpen(true)
  }

  function openEditQuickStat(item: AdminQuickStat) {
    setQuickStatMode('edit')
    setEditingQuickStat(item)
    setQuickStatForm(createInitialQuickStatForm(item))
    setQuickStatModalOpen(true)
  }

  function closeQuickStatModal() {
    setQuickStatModalOpen(false)
    setEditingQuickStat(null)
    setQuickStatForm(createInitialQuickStatForm())
  }

  async function submitQuickStatModal() {
    if (!quickStatForm.label.trim() || !quickStatForm.subLabel.trim() || !quickStatForm.value.trim()) {
      setError('Vui lòng nhập đầy đủ nhãn, mô tả phụ và giá trị cho thống kê nhanh.')
      return
    }

    const payload: AdminQuickStatUpsertRequest = { ...quickStatForm }
    try {
      setQuickStatSaving(true)
      setError('')
      if (quickStatMode === 'create') {
        await createAdminQuickStat(payload)
      } else if (editingQuickStat?.id) {
        await updateAdminQuickStat(editingQuickStat.id, payload)
      }
      closeQuickStatModal()
      triggerReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được thống kê nhanh.')
    } finally {
      setQuickStatSaving(false)
    }
  }

  async function removeQuickStat(item: AdminQuickStat) {
    if (!item.id) return
    if (!window.confirm(`Xóa thống kê "${item.label}"?`)) return
    try {
      setError('')
      await deleteAdminQuickStat(item.id)
      triggerReload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được thống kê nhanh.')
    }
  }

  if (loading) {
    return (
      <AdminShell activeKey="overview" title="Tổng quan hệ thống" subtitle="Đang tải dữ liệu dashboard">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải dữ liệu...</section>
      </AdminShell>
    )
  }

  if (!overview) {
    return (
      <AdminShell activeKey="overview" title="Tổng quan hệ thống" subtitle="Không tải được dữ liệu dashboard">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error || 'Không có dữ liệu tổng quan.'}</section>
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.value ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</section> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.kpis.map((item) => {
          const Icon = statIconByColor[item.color]
          return (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{item.title}</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{item.value}</p>
                  <p className={`mt-1 text-xs font-semibold ${item.changeTone === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {item.change}
                  </p>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${statBoxClassByColor[item.color]}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          )
        })}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-900">Xu hướng GMV</h2>
          <p className="text-xs text-slate-500">Dữ liệu theo bộ lọc thời gian đã chọn</p>
        </header>

        <div className="rounded-xl bg-slate-50 p-3">
          <svg viewBox="0 0 100 52" className="h-44 w-full" preserveAspectRatio="none" aria-label="Biểu đồ GMV">
            <defs>
              <linearGradient id="gmvFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <polyline points={chartPath} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={`${chartPath} 100,52 0,52`} fill="url(#gmvFill)" stroke="none" />
          </svg>
          <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] font-semibold text-slate-500 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10">
            {overview.gmvSeries.map((point) => (
              <div key={point.label} className="rounded-md bg-white px-2 py-1 text-center">
                <p>{point.label}</p>
                <p className="text-emerald-600">{point.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-2xl font-extrabold text-slate-900">Cảnh báo rủi ro</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {overview.risks.map((item) => (
            <article
              key={item.key}
              className={`rounded-xl border px-4 py-3 ${
                item.critical ? 'border-red-200 bg-red-50/70' : 'border-emerald-200 bg-emerald-50/70'
              }`}
            >
              <p className="text-xs font-semibold text-slate-600">{item.label}</p>
              <p className={`mt-1 text-2xl font-extrabold ${item.critical ? 'text-red-600' : 'text-emerald-700'}`}>{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-slate-900">Hoạt động gần đây</h2>
            <button onClick={openCreateActivity} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
              <Plus className="h-4 w-4" /> Thêm
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {overview.activities.map((item) => {
              const Icon = activityIconByColor[item.color]
              return (
                <div key={`${item.title}-${item.id ?? item.time}`} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${activityIconClassByColor[item.color]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.time}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => openEditActivity(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {item.id ? (
                      <button onClick={() => removeActivity(item)} className="rounded-lg border border-red-200 p-2 text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-slate-900">Thống kê nhanh</h2>
            <button onClick={openCreateQuickStat} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
              <Plus className="h-4 w-4" /> Thêm
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {overview.quickStats.map((item) => (
              <div key={`${item.label}-${item.id ?? 'default'}`} className={`flex items-center justify-between rounded-xl px-4 py-3 ${quickStatClassByColor[item.color]}`}>
                <div>
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="text-xs opacity-80">{item.subLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-extrabold">{item.value}</p>
                  <button onClick={() => openEditQuickStat(item)} className="rounded-lg border border-slate-200/70 bg-white/70 p-2 text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {item.id ? (
                    <button onClick={() => removeQuickStat(item)} className="rounded-lg border border-red-200 bg-white/70 p-2 text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {activityModalOpen ? (
        <OverviewModal
          title={activityMode === 'create' ? 'Thêm hoạt động dashboard' : 'Cập nhật hoạt động'}
          saving={activitySaving}
          onClose={closeActivityModal}
          onSubmit={submitActivityModal}
        >
          <Field label="Tiêu đề">
            <input value={activityForm.title} onChange={(event) => setActivityForm((current) => ({ ...current, title: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Mô tả">
            <textarea value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} rows={4} className={`${inputClass} py-2.5`} />
          </Field>
          <Field label="Thời gian hiển thị">
            <input value={activityForm.time} onChange={(event) => setActivityForm((current) => ({ ...current, time: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Màu sắc">
            <select value={activityForm.color} onChange={(event) => setActivityForm((current) => ({ ...current, color: event.target.value as AdminActivityItem['color'] }))} className={inputClass}>
              <option value="emerald">Xanh lá</option>
              <option value="blue">Xanh dương</option>
              <option value="red">Đỏ</option>
              <option value="violet">Tím</option>
            </select>
          </Field>
        </OverviewModal>
      ) : null}

      {quickStatModalOpen ? (
        <OverviewModal
          title={quickStatMode === 'create' ? 'Thêm thống kê nhanh' : 'Cập nhật thống kê nhanh'}
          saving={quickStatSaving}
          onClose={closeQuickStatModal}
          onSubmit={submitQuickStatModal}
        >
          <Field label="Nhãn">
            <input value={quickStatForm.label} onChange={(event) => setQuickStatForm((current) => ({ ...current, label: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Mô tả phụ">
            <input value={quickStatForm.subLabel} onChange={(event) => setQuickStatForm((current) => ({ ...current, subLabel: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Giá trị">
            <input value={quickStatForm.value} onChange={(event) => setQuickStatForm((current) => ({ ...current, value: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Màu sắc">
            <select value={quickStatForm.color} onChange={(event) => setQuickStatForm((current) => ({ ...current, color: event.target.value as AdminQuickStat['color'] }))} className={inputClass}>
              <option value="emerald">Xanh lá</option>
              <option value="blue">Xanh dương</option>
              <option value="violet">Tím</option>
              <option value="amber">Cam</option>
            </select>
          </Field>
        </OverviewModal>
      ) : null}
    </AdminShell>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Hủy
          </button>
          <button onClick={onSubmit} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-200 focus:ring-2'
