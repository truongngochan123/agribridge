import {
  AlertTriangle,
  Check,
  ClipboardList,
  Eye,
  FileSearch,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createAdminDispute,
  deleteAdminDispute,
  fetchAdminDisputeById,
  fetchAdminDisputes,
  refundAdminDispute,
  updateAdminDispute,
  updateAdminDisputeStatus,
} from '../../services/adminService'
import type {
  AdminDisputeItem,
  AdminDisputeSeverity,
  AdminDisputeStatus,
  AdminDisputeUpsertRequest,
} from '../../types/admin'

/* ─── style maps ─────────────────────────────────────────────── */
const statusConfig: Record<
  AdminDisputeStatus,
  { label: string; badge: string; dot: string; card: string }
> = {
  OPEN:          { label: 'Chờ xử lý',    badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   card: 'border-amber-200 bg-amber-50/40' },
  INVESTIGATING: { label: 'Điều tra',     badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    card: 'border-blue-200 bg-blue-50/40'  },
  RESOLVED:      { label: 'Đã giải quyết', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50/40' },
  REJECTED:      { label: 'Từ chối',      badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     card: 'border-red-200 bg-red-50/40'   },
}

const severityConfig: Record<AdminDisputeSeverity, { badge: string; icon: string }> = {
  HIGH:   { badge: 'bg-red-100 text-red-600',    icon: '🔴' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700', icon: '🟡' },
}

const disputeTabs: Array<{ key: AdminDisputeStatus | 'ALL'; label: string }> = [
  { key: 'ALL',          label: 'Tất cả'        },
  { key: 'OPEN',         label: 'Chờ xử lý'     },
  { key: 'INVESTIGATING', label: 'Đang điều tra' },
  { key: 'RESOLVED',     label: 'Đã giải quyết' },
  { key: 'REJECTED',     label: 'Đã từ chối'    },
]

function getDisputeSourceLabel(item: AdminDisputeItem) {
  if (item.sourceType === 'SHIPMENT_INCIDENT') return 'Sự cố giao hàng'
  if (item.sourceType === 'ADMIN_MANUAL') return 'Admin tạo'
  return item.sourceLabel || 'Khiếu nại đơn hàng'
}

function splitEvidenceUrls(value?: string | null) {
  if (!value) return []
  return value
    .split(/[,\n;]/)
    .map((url) => url.trim())
    .filter(Boolean)
}

type FormState = {
  orderId: string
  batchId: string
  createdByUserId: string
  assignedToUserId: string
  status: AdminDisputeStatus
  severity: AdminDisputeSeverity
  title: string
  description: string
  resolution: string
}

type RefundState = {
  dispute: AdminDisputeItem
  refundType: 'FULL' | 'PARTIAL'
  missingQuantity: string
  reason?: string
}

function createInitialFormState(item?: AdminDisputeItem | null): FormState {
  const adminId = getAdminUserId()
  return {
    orderId:           item ? String(item.orderId) : '',
    batchId:           item?.batchId ? String(item.batchId) : '',
    createdByUserId:   item?.createdByUserId ? String(item.createdByUserId) : adminId ? String(adminId) : '',
    assignedToUserId:  item?.assignedToUserId ? String(item.assignedToUserId) : adminId ? String(adminId) : '',
    status:            item?.status   ?? 'OPEN',
    severity:          item?.severity ?? 'MEDIUM',
    title:             item?.title       ?? '',
    description:       item?.description ?? '',
    resolution:        item?.resolution  ?? '',
  }
}

function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' VNĐ'
}

/* ─── skeleton ───────────────────────────────────────────────── */
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Pulse className="h-3.5 w-20 rounded-full" />
            <Pulse className="h-3.5 w-16 rounded-full" />
            <Pulse className="h-3.5 w-14 rounded-full" />
          </div>
          <Pulse className="h-4 w-2/3 rounded-lg" />
          <Pulse className="h-3.5 w-full rounded-lg" />
          <Pulse className="h-3.5 w-4/5 rounded-lg" />
        </div>
        <Pulse className="h-8 w-24 rounded-xl" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Pulse key={i} className="h-10 rounded-xl" />)}
      </div>
    </div>
  )
}

function Pulse({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className ?? ''}`}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent)',
          animation: 'shimmer 1.6s infinite',
        }}
      />
    </div>
  )
}

/* ─── main page ─────────────────────────────────────────────── */
export function AdminDisputesPage() {
  usePageTitle('Quản lý tranh chấp')

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminDisputeStatus | 'ALL'>('ALL')
  const [disputes, setDisputes]       = useState<AdminDisputeItem[]>([])
  const [selected, setSelected]       = useState<AdminDisputeItem | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [reloadKey, setReloadKey]     = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [formOpen, setFormOpen]       = useState(false)
  const [formMode, setFormMode]       = useState<'create' | 'edit'>('create')
  const [formState, setFormState]     = useState<FormState>(createInitialFormState())
  const [saving, setSaving]           = useState(false)
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null)
  const [refundState, setRefundState] = useState<RefundState | null>(null)
  const [refundSaving, setRefundSaving] = useState(false)

  useEffect(() => {
    let active = true
    const tid = window.setTimeout(async () => {
      try {
        setLoading(true); setError('')
        const payload = await fetchAdminDisputes(search, statusFilter === 'ALL' ? undefined : statusFilter)
        if (!active) return
        setDisputes(payload)
        setSelected((cur) => payload.find((d) => d.id === cur?.id) ?? payload[0] ?? null)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Không tải được danh sách tranh chấp.')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => { active = false; window.clearTimeout(tid) }
  }, [search, statusFilter, reloadKey])

  const selectedId = useMemo(() => selected?.id ?? null, [selected])

  function triggerReload() { setReloadKey((c) => c + 1) }

  async function openDetail(item: AdminDisputeItem) {
    try {
      setDetailLoading(true); setError('')
      const payload = await fetchAdminDisputeById(item.id)
      setSelected(payload)
      return payload
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chi tiết tranh chấp.')
      return null
    } finally { setDetailLoading(false) }
  }

  function openCreateModal() {
    setFormMode('create'); setFormState(createInitialFormState()); setFormOpen(true)
  }

  async function openEditModal(item: AdminDisputeItem) {
    const detail = await openDetail(item)
    setFormMode('edit'); setFormState(createInitialFormState(detail ?? item)); setFormOpen(true)
  }

  function closeFormModal() { setFormOpen(false); setFormState(createInitialFormState(selected)) }

  function openRefundModal(item: AdminDisputeItem) {
    setRefundState({
      dispute: item,
      refundType: 'PARTIAL',
      missingQuantity: '10',
      reason: 'Thiếu hàng khi giao',
    })
  }

  async function handleRefundSubmit() {
    if (!refundState) return
    const missingQuantity = Number(refundState.missingQuantity)
    const orderQuantity = Number(refundState.dispute.orderQuantity || 0)
    const unitPrice = Number(refundState.dispute.unitPrice || 0)
    const shippingFee = Number(refundState.dispute.shippingFee || 0)
    const productRefund = Math.round(Math.max(missingQuantity, 0) * Math.max(unitPrice, 0))
    const shippingRefund = Math.round(Math.max(shippingFee, 0) * 0.1)
    const totalPaid = Number(refundState.dispute.totalPaid || 0)
    const amount = refundState.refundType === 'FULL' ? totalPaid : productRefund + shippingRefund
    if (refundState.refundType === 'PARTIAL' && (!Number.isFinite(missingQuantity) || missingQuantity <= 0)) {
      setError('Số kg thiếu phải lớn hơn 0.')
      return
    }
    if (refundState.refundType === 'PARTIAL' && orderQuantity > 0 && missingQuantity > orderQuantity) {
      setError('Số kg thiếu không được vượt quá số lượng đơn hàng.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Không tính được số tiền hoàn. Vui lòng kiểm tra đơn giá và phí vận chuyển.')
      return
    }
    if (amount > totalPaid) {
      setError('Số tiền hoàn không được vượt quá số tiền đã thanh toán.')
      return
    }
    if (false) {
      setError('Vui lòng nhập lý do hoàn tiền.')
      return
    }

    try {
      setRefundSaving(true); setError('')
      const unit = refundState.dispute.orderItemUnit || 'kg'
      const reason = refundState.refundType === 'FULL' ? 'Hoan toan bo theo quyet dinh tranh chap' : `Thieu hang khi giao: thieu ${missingQuantity} ${unit}`
        || `Hoàn tiền do thiếu ${missingQuantity} ${refundState.dispute.orderItemUnit || 'kg'}`
      await refundAdminDispute(refundState.dispute.id, { refundAmount: amount, reason })
      const updated = await fetchAdminDisputeById(refundState.dispute.id)
      setSelected(updated)
      setRefundState(null)
      triggerReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không hoàn tiền được tranh chấp.')
    } finally {
      setRefundSaving(false)
    }
  }

  async function handleSubmitForm() {
    if (!formState.orderId.trim() || !formState.title.trim() || !formState.description.trim()) {
      setError('Vui lòng nhập Order ID, tiêu đề và mô tả tranh chấp.'); return
    }
    const payload: AdminDisputeUpsertRequest = {
      orderId:          Number(formState.orderId),
      batchId:          formState.batchId.trim()          ? Number(formState.batchId)          : undefined,
      createdByUserId:  formState.createdByUserId.trim()  ? Number(formState.createdByUserId)  : undefined,
      assignedToUserId: formState.assignedToUserId.trim() ? Number(formState.assignedToUserId) : undefined,
      status:      formState.status,
      severity:    formState.severity,
      title:       formState.title,
      description: formState.description,
      resolution:  formState.resolution,
    }
    try {
      setSaving(true); setError('')
      const saved = formMode === 'create'
        ? await createAdminDispute(payload)
        : await updateAdminDispute(selectedId ?? 0, payload)
      setSelected(saved); closeFormModal(); triggerReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được tranh chấp.')
    } finally { setSaving(false) }
  }

  async function handleStatusAction(item: AdminDisputeItem) {
    const adminUserId = getAdminUserId()
    try {
      setStatusLoadingId(item.id); setError('')
      if (item.status === 'OPEN') {
        const updated = await updateAdminDisputeStatus(item.id, { assignedToUserId: adminUserId, status: 'INVESTIGATING' })
        setSelected(updated)
      } else if (item.status === 'INVESTIGATING') {
        const resolution = window.prompt('Nhập kết quả xử lý tranh chấp:', item.resolution ?? '')
        if (resolution === null) return
        const updated = await updateAdminDisputeStatus(item.id, { assignedToUserId: adminUserId, status: 'RESOLVED', resolution })
        setSelected(updated)
      } else {
        await openDetail(item)
      }
      triggerReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái tranh chấp.')
    } finally { setStatusLoadingId(null) }
  }

  async function handleRejectAction(item: AdminDisputeItem) {
    const resolution = window.prompt('Nhập lý do từ chối tranh chấp:', item.resolution ?? '')
    if (resolution === null) return
    if (!resolution.trim()) {
      setError('Vui lòng nhập lý do từ chối.')
      return
    }
    const adminUserId = getAdminUserId()
    try {
      setStatusLoadingId(item.id); setError('')
      const updated = await updateAdminDisputeStatus(item.id, {
        assignedToUserId: adminUserId,
        status: 'REJECTED',
        resolution,
      })
      setSelected(updated)
      triggerReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể từ chối tranh chấp.')
    } finally { setStatusLoadingId(null) }
  }

  async function handleDelete(item: AdminDisputeItem) {
    if (!window.confirm(`Xóa tranh chấp "${item.title}"?`)) return
    try {
      setDeleteLoadingId(item.id); setError('')
      await deleteAdminDispute(item.id)
      if (selected?.id === item.id) setSelected(null)
      triggerReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xóa được tranh chấp.')
    } finally { setDeleteLoadingId(null) }
  }

  /* stat counts */
  const counts = useMemo(() => ({
    ALL:          disputes.length,
    OPEN:         disputes.filter(d => d.status === 'OPEN').length,
    INVESTIGATING:disputes.filter(d => d.status === 'INVESTIGATING').length,
    RESOLVED:     disputes.filter(d => d.status === 'RESOLVED').length,
    REJECTED:     disputes.filter(d => d.status === 'REJECTED').length,
    HIGH:         disputes.filter(d => d.severity === 'HIGH').length,
  }), [disputes])

  const statCards = [
    { label: 'Tổng tranh chấp', value: counts.ALL,          gradient: 'from-slate-600 to-slate-700', icon: <ClipboardList className="h-5 w-5 text-white" /> },
    { label: 'Chờ xử lý',       value: counts.OPEN,         gradient: 'from-amber-500 to-orange-500', icon: <AlertTriangle className="h-5 w-5 text-white" /> },
    { label: 'Đang điều tra',   value: counts.INVESTIGATING, gradient: 'from-blue-500 to-indigo-600', icon: <FileSearch className="h-5 w-5 text-white" /> },
    { label: 'Đã giải quyết',   value: counts.RESOLVED,     gradient: 'from-emerald-500 to-teal-600', icon: <ShieldCheck className="h-5 w-5 text-white" /> },
    { label: 'Mức độ cao',      value: counts.HIGH,          gradient: 'from-red-500 to-rose-600',   icon: <ShieldAlert className="h-5 w-5 text-white" /> },
  ]

  return (
    <AdminShell
      activeKey="disputes"
      title="Quản lý tranh chấp"
      subtitle="Xử lý khiếu nại và tranh chấp giữa các bên trong hệ thống"
    >
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.93) translateY(14px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .card-enter { animation: fadeInUp 0.35s ease both; }
      `}</style>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      {!loading && !error && (
        <section className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md"
              style={{ animation: `fadeInUp 0.35s ease ${i * 55}ms both` }}
            >
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow`}>
                {card.icon}
              </span>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-400">{card.label}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Main panel ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        {/* Left: list */}
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <label className="relative block flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm mã đơn, tiêu đề, buyer..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md hover:brightness-110 active:scale-95"
              >
                <Plus className="h-4 w-4" /> Tạo tranh chấp
              </button>
            </div>

            {/* Filter tabs */}
            <div className="mt-3.5 flex flex-wrap gap-2">
              {disputeTabs.map((tab) => {
                const active = tab.key === statusFilter
                const cnt = tab.key === 'ALL' ? counts.ALL
                  : tab.key === 'OPEN' ? counts.OPEN
                  : tab.key === 'INVESTIGATING' ? counts.INVESTIGATING
                  : tab.key === 'RESOLVED' ? counts.RESOLVED
                  : counts.REJECTED
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                    <span className={`min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-white text-slate-600 shadow-sm'
                    }`}>
                      {cnt}
                    </span>
                  </button>
                )
              })}
            </div>
          </header>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Content */}
          <div className="divide-y divide-slate-50 p-4 space-y-3">
            {/* Loading skeletons */}
            {loading && [0,1,2].map((i) => (
              <div key={i} style={{ animation: `fadeInUp 0.3s ease ${i*80}ms both` }}>
                <CardSkeleton />
              </div>
            ))}

            {/* Empty */}
            {!loading && disputes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200">
                  <Gavel className="h-8 w-8 text-slate-400" />
                </span>
                <p className="mt-4 font-bold text-slate-600">Không có tranh chấp nào</p>
                <p className="mt-1 text-xs text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                <button
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Tạo tranh chấp mới
                </button>
              </div>
            )}

            {/* Cards */}
            {!loading && disputes.map((item, idx) => {
              const sc = statusConfig[item.status]
              const sev = severityConfig[item.severity]
              const isActive   = item.id === selectedId
              const isDeleting = deleteLoadingId === item.id
              const isActioning= statusLoadingId === item.id

              const actionBtn =
                item.status === 'OPEN'          ? { label: 'Bắt đầu điều tra', cls: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:brightness-110', icon: <FileSearch className="h-3.5 w-3.5" /> }
                : item.status === 'INVESTIGATING' ? { label: 'Đánh dấu giải quyết', cls: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:brightness-110', icon: <Check className="h-3.5 w-3.5" /> }
                : { label: 'Xem chi tiết', cls: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50', icon: <Eye className="h-3.5 w-3.5" /> }

              return (
                <article
                  key={item.id}
                  className={`card-enter group cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
                    isActive
                      ? `${sc.card} ring-2 ring-emerald-400/40 shadow-md`
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  onClick={() => openDetail(item)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400">{item.disputeCode}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sc.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {item.statusLabel}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sev.badge}`}>
                          {sev.icon} {item.severityLabel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                          {getDisputeSourceLabel(item)}
                        </span>
                      </div>
                      <h3 className="truncate text-sm font-extrabold text-slate-900" title={item.title}>{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex shrink-0 flex-wrap items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditModal(item)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {isDeleting ? 'Xóa...' : 'Xóa'}
                      </button>
                      <button
                        onClick={() => handleStatusAction(item)}
                        disabled={isActioning}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-60 ${actionBtn.cls}`}
                      >
                        {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionBtn.icon}
                        {isActioning ? 'Xử lý...' : actionBtn.label}
                      </button>
                      {item.canRefund ? (
                        <button
                          onClick={() => openRefundModal(item)}
                          disabled={isActioning}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Hoàn tiền
                        </button>
                      ) : null}
                      {item.status !== 'RESOLVED' && item.status !== 'REJECTED' ? (
                        <button
                          onClick={() => handleRejectAction(item)}
                          disabled={isActioning}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" /> Từ chối
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Meta grid */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetaCell label="Người mua"   value={item.buyerName}    />
                    <MetaCell label="Nhà cung cấp" value={item.supplierName} />
                    <MetaCell label="Sản phẩm"    value={item.product}      />
                    <MetaCell label="Giá trị"     value={item.amount} valueClass="font-bold text-red-600" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Tạo: {item.createdAt}</span>
                    <span>Phụ trách: <span className="font-semibold text-slate-600">{item.assignedToName}</span></span>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Footer */}
          {!loading && disputes.length > 0 && (
            <footer className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Hiển thị <span className="font-bold text-slate-700">{disputes.length}</span> tranh chấp
            </footer>
          )}
        </section>

        {/* Right: detail sidebar */}
        <aside className="w-full xl:w-[340px] xl:shrink-0">
          <div className="sticky top-4">
            {detailLoading ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <Pulse className="h-5 w-48 rounded-xl" />
                {[...Array(8)].map((_, i) => <Pulse key={i} className="h-10 rounded-xl" />)}
              </div>
            ) : selected ? (
              <DetailPanel dispute={selected} onRefund={openRefundModal} />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 px-6 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                  <Eye className="h-7 w-7 text-slate-400" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-500">Chọn tranh chấp để xem chi tiết</p>
                <p className="mt-1 text-xs text-slate-400">Nhấn vào một card bên trái</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Form modal ──────────────────────────────────────────── */}
      {formOpen && (
        <DisputeFormModal
          mode={formMode}
          form={formState}
          saving={saving}
          onClose={closeFormModal}
          onSubmit={handleSubmitForm}
          onChange={(patch) => setFormState((c) => ({ ...c, ...patch }))}
        />
      )}

      {refundState && (
        <RefundModalV2
          state={refundState}
          saving={refundSaving}
          onClose={() => setRefundState(null)}
          onSubmit={handleRefundSubmit}
          onChange={(patch) => setRefundState((current) => current ? { ...current, ...patch } : current)}
        />
      )}
    </AdminShell>
  )
}

/* ─── Detail panel ───────────────────────────────────────────── */
function DetailPanel({ dispute, onRefund }: { dispute: AdminDisputeItem; onRefund: (item: AdminDisputeItem) => void }) {
  const sc  = statusConfig[dispute.status]
  const sev = severityConfig[dispute.severity]
  const buyerEvidence = splitEvidenceUrls(dispute.buyerEvidenceUrls)
  const supplierEvidence = splitEvidenceUrls(dispute.supplierEvidenceUrls)
  const isShipmentIncident = dispute.sourceType === 'SHIPMENT_INCIDENT'

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ animation: 'fadeInUp 0.3s ease both' }}
    >
      {/* Color strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${
        dispute.status === 'OPEN'          ? 'from-amber-400 to-orange-400'
        : dispute.status === 'INVESTIGATING' ? 'from-blue-400 to-indigo-500'
        : dispute.status === 'RESOLVED'      ? 'from-emerald-400 to-teal-500'
        : 'from-red-400 to-rose-500'
      }`} />

      <div className="p-5 space-y-4">
        {/* Title & badges */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sc.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} /> {dispute.statusLabel}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sev.badge}`}>
              {sev.icon} {dispute.severityLabel}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 leading-snug">{dispute.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{dispute.disputeCode} · Đơn #{dispute.orderId}</p>
          {dispute.canRefund ? (
            <button
              type="button"
              onClick={() => onRefund(dispute)}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Hoàn tiền
            </button>
          ) : null}
        </div>

        <hr className="border-slate-100" />

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <DetailField label="Loại" value={getDisputeSourceLabel(dispute)} />
          <DetailField label="Shipment" value={dispute.shipmentId ? `#${dispute.shipmentId}` : '—'} />
          <DetailField label="Người mua"   value={dispute.buyerName}     />
          <DetailField label="Nhà cung cấp" value={dispute.supplierName} />
          <DetailField label="Sản phẩm"    value={dispute.product}       />
          <DetailField label="Giá trị"     value={dispute.amount} valueClass="text-red-600 font-bold" />
          <DetailField label="Người tạo"   value={dispute.createdByName}  />
          <DetailField label="Phụ trách"   value={dispute.assignedToName} />
          <DetailField label="Ngày tạo"    value={dispute.createdAt}      />
          <DetailField label="Ngày xử lý"  value={dispute.resolvedAt || '—'} />
        </div>

        {isShipmentIncident ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-orange-500">Ngữ cảnh sự cố giao hàng</p>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailField label="Incident" value={dispute.incidentType || '—'} />
              <DetailField label="Trạng thái" value={dispute.incidentStatusLabel || dispute.incidentStatus || '—'} />
              <DetailField label="Phương án" value={dispute.proposedResolution || '—'} />
              <DetailField label="Loại xử lý" value={dispute.resolutionType || '—'} />
            </div>
            {dispute.supplierResponse ? (
              <div className="mt-3 rounded-lg bg-white/80 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Phản hồi nhà cung cấp</p>
                <p className="mt-1 whitespace-pre-wrap text-xs font-medium text-slate-700">{dispute.supplierResponse}</p>
              </div>
            ) : null}
            {(buyerEvidence.length > 0 || supplierEvidence.length > 0) ? (
              <div className="mt-3 grid gap-3">
                <EvidenceLinks title="Bằng chứng buyer" urls={buyerEvidence} />
                <EvidenceLinks title="Bằng chứng supplier" urls={supplierEvidence} />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Description */}
        <div className="rounded-xl bg-slate-50 p-3.5">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Mô tả</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{dispute.description}</p>
        </div>

        {/* Resolution */}
        <div className={`rounded-xl p-3.5 ${dispute.resolution ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50'}`}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Kết quả xử lý</p>
          {dispute.resolution ? (
            <p className="text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">{dispute.resolution}</p>
          ) : (
            <p className="text-xs text-slate-400 italic">Chưa có kết quả xử lý.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Form modal ─────────────────────────────────────────────── */
function RefundModalV2({
  state, saving, onClose, onSubmit, onChange,
}: {
  state: RefundState
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (patch: Partial<RefundState>) => void
}) {
  const totalPaid = Number(state.dispute.totalPaid || 0)
  const missingQuantity = Number(state.missingQuantity || 0)
  const orderQuantity = Number(state.dispute.orderQuantity || 0)
  const unitPrice = Number(state.dispute.unitPrice || 0)
  const shippingFee = Number(state.dispute.shippingFee || 0)
  const productRefund = Math.round(Math.max(missingQuantity, 0) * Math.max(unitPrice, 0))
  const shippingRefund = Math.round(Math.max(shippingFee, 0) * 0.1)
  const isFullRefund = state.refundType === 'FULL'
  const totalRefund = isFullRefund ? totalPaid : productRefund + shippingRefund
  const unit = state.dispute.orderItemUnit || 'kg'
  const disputeReason = 'Thiếu hàng khi giao'

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'modalIn 0.22s ease both' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Hoàn tiền</h3>
            <p className="mt-1 text-xs text-slate-400">Refund trực tiếp vào ví Buyer</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
            <DetailField label="Order" value={`#${state.dispute.orderId}`} />
            <DetailField label="Buyer" value={state.dispute.buyerName} />
            <DetailField label="Đã thanh toán" value={money(totalPaid)} valueClass="font-bold text-emerald-700" />
            <DetailField label="Order Status" value={state.dispute.orderStatus || '-'} />
            <DetailField label="Shipment Status" value={state.dispute.shipmentStatus || '-'} />
            <DetailField label="Payment Status" value={state.dispute.paymentStatus || '-'} />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Dispute Reason</p>
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
              {disputeReason}
            </span>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Loại hoàn tiền</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {[
                { key: 'PARTIAL' as const, label: 'Hoàn một phần' },
                { key: 'FULL' as const, label: 'Hoàn toàn bộ' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onChange({ refundType: option.key })}
                  className={`rounded-lg px-3 py-2 text-sm font-extrabold transition ${
                    state.refundType === option.key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isFullRefund ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              Hệ thống sẽ hoàn toàn bộ số tiền đã thanh toán: {money(totalPaid)}.
            </div>
          ) : (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Số lượng thiếu (kg)</span>
              <input
                type="number"
                min={0.01}
                max={orderQuantity || undefined}
                step="0.01"
                value={state.missingQuantity}
                onChange={(e) => onChange({ missingQuantity: e.target.value })}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Không vượt quá {orderQuantity || 0} {unit}. Refund Amount được hệ thống tự tính.
              </span>
            </label>
          )}

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-sm">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700">Chi tiết tính toán</p>
            <CalcRow label="Sản phẩm" value={state.dispute.product} />
            <CalcRow label="Đơn giá" value={`${money(unitPrice)} / ${unit}`} />
            {isFullRefund ? (
              <CalcRow label="Hoàn toàn bộ đơn" value={money(totalPaid)} />
            ) : (
              <>
                <CalcRow label="Tiền sản phẩm thiếu" value={`${missingQuantity || 0} ${unit} x ${money(unitPrice)} = ${money(productRefund)}`} />
                <CalcRow label="Hoàn phí vận chuyển" value={`10% x ${money(shippingFee)} = ${money(shippingRefund)}`} />
              </>
            )}
            <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2 text-base font-extrabold text-emerald-800">
              <span>Tổng hoàn</span>
              <span>{money(totalRefund)}</span>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {saving ? 'Đang hoàn tiền...' : 'Xác nhận hoàn tiền'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function RefundModal({
  state, saving, onClose, onSubmit, onChange,
}: {
  state: RefundState
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (patch: Partial<RefundState>) => void
}) {
  const totalPaid = Number(state.dispute.totalPaid || 0)
  const missingQuantity = Number(state.missingQuantity || 0)
  const orderQuantity = Number(state.dispute.orderQuantity || 0)
  const unitPrice = Number(state.dispute.unitPrice || 0)
  const shippingFee = Number(state.dispute.shippingFee || 0)
  const productRefund = Math.round(Math.max(missingQuantity, 0) * Math.max(unitPrice, 0))
  const shippingRefund = Math.round(Math.max(shippingFee, 0) * 0.1)
  const totalRefund = productRefund + shippingRefund
  const unit = state.dispute.orderItemUnit || 'kg'

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'modalIn 0.22s ease both' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Hoàn tiền</h3>
            <p className="mt-1 text-xs text-slate-400">Refund trực tiếp vào ví Buyer</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
            <DetailField label="Order" value={`#${state.dispute.orderId}`} />
            <DetailField label="Buyer" value={state.dispute.buyerName} />
            <DetailField label="Đã thanh toán" value={money(totalPaid)} valueClass="font-bold text-emerald-700" />
            <DetailField label="Order status" value={state.dispute.orderStatus || '—'} />
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Số tiền hoàn</span>
            <input
              type="number"
              min={0.01}
              max={orderQuantity || undefined}
              step="0.01"
              value={state.missingQuantity}
              onChange={(e) => onChange({ missingQuantity: e.target.value })}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="mt-1 block text-[11px] text-slate-400">Không vượt quá {orderQuantity || 0} {unit}. Tổng đã thanh toán tối đa {money(totalPaid)}.</span>
          </label>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-sm">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700">Chi tiết tính toán</p>
            <CalcRow label="Sản phẩm" value={state.dispute.product} />
            <CalcRow label="Đơn giá" value={`${money(unitPrice)} / ${unit}`} />
            <CalcRow label={`Tiền sản phẩm thiếu (${missingQuantity || 0} ${unit})`} value={money(productRefund)} />
            <CalcRow label="Phí vận chuyển" value={money(shippingFee)} />
            <CalcRow label="Hoàn 10% phí vận chuyển" value={money(shippingRefund)} />
            <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2 text-base font-extrabold text-emerald-800">
              <span>Tổng tiền cần hoàn</span>
              <span>{money(totalRefund)}</span>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Lý do hoàn tiền</span>
            <textarea
              value={state.reason}
              onChange={(e) => onChange({ reason: e.target.value })}
              rows={4}
              placeholder="Supplier không giao hàng đúng cam kết"
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {saving ? 'Đang hoàn tiền...' : 'Xác nhận hoàn tiền'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-slate-700">
      <span>{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
    </div>
  )
}

void RefundModal

function EvidenceLinks({ title, urls }: { title: string; urls: string[] }) {
  if (urls.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url, index) => (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50"
          >
            File {index + 1}
          </a>
        ))}
      </div>
    </div>
  )
}

function DisputeFormModal({
  mode, form, saving, onClose, onSubmit, onChange,
}: {
  mode: 'create' | 'edit'
  form: FormState
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (patch: Partial<FormState>) => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20"
        style={{ animation: 'modalIn 0.28s cubic-bezier(.34,1.56,.64,1) both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
              {mode === 'create' ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {mode === 'create' ? 'Tạo tranh chấp mới' : 'Cập nhật tranh chấp'}
              </h3>
              <p className="text-xs text-slate-400">Nhập thông tin hồ sơ tranh chấp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Order ID *">
              <input value={form.orderId}          onChange={(e) => onChange({ orderId: e.target.value })}          className={inputClass} placeholder="Nhập ID đơn hàng" />
            </Field>
            <Field label="Batch ID">
              <input value={form.batchId}           onChange={(e) => onChange({ batchId: e.target.value })}           className={inputClass} placeholder="Tuỳ chọn" />
            </Field>
            <Field label="User ID người tạo">
              <input value={form.createdByUserId}   onChange={(e) => onChange({ createdByUserId: e.target.value })}   className={inputClass} placeholder="ID admin" />
            </Field>
            <Field label="User ID phụ trách">
              <input value={form.assignedToUserId}  onChange={(e) => onChange({ assignedToUserId: e.target.value })}  className={inputClass} placeholder="ID admin" />
            </Field>
            <Field label="Trạng thái">
              <select value={form.status}   onChange={(e) => onChange({ status: e.target.value as AdminDisputeStatus })}   className={inputClass}>
                <option value="OPEN">Chờ xử lý</option>
                <option value="INVESTIGATING">Đang điều tra</option>
                <option value="RESOLVED">Đã giải quyết</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>
            </Field>
            <Field label="Mức độ">
              <select value={form.severity} onChange={(e) => onChange({ severity: e.target.value as AdminDisputeSeverity })} className={inputClass}>
                <option value="MEDIUM">🟡 Trung bình</option>
                <option value="HIGH">🔴 Cao</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Tiêu đề *">
                <input value={form.title}       onChange={(e) => onChange({ title: e.target.value })}       className={inputClass} placeholder="Mô tả ngắn gọn vấn đề" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Mô tả *">
                <textarea value={form.description} onChange={(e) => onChange({ description: e.target.value })} rows={4} className={`${inputClass} h-auto py-2.5`} placeholder="Chi tiết về tranh chấp..." />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Kết quả xử lý">
                <textarea value={form.resolution}  onChange={(e) => onChange({ resolution: e.target.value })}  rows={3} className={`${inputClass} h-auto py-2.5`} placeholder="Nhập kết quả sau khi xử lý..." />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : mode === 'create' ? 'Tạo tranh chấp' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── sub-components ─────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function MetaCell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-semibold text-slate-700 ${valueClass ?? ''}`} title={value}>{value}</p>
    </div>
  )
}

function DetailField({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 break-words text-xs font-semibold text-slate-700 ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200'

function getAdminUserId(): number | undefined {
  const raw = localStorage.getItem('agribridge.auth.userId')
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : undefined
}
