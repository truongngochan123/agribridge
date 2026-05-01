import { Check, Eye, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { AdminShell } from '../../components/admin/AdminShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createAdminDispute,
  deleteAdminDispute,
  fetchAdminDisputeById,
  fetchAdminDisputes,
  updateAdminDispute,
  updateAdminDisputeStatus,
} from '../../services/adminService'
import type { AdminDisputeItem, AdminDisputeSeverity, AdminDisputeStatus, AdminDisputeUpsertRequest } from '../../types/admin'

const statusClass: Record<AdminDisputeStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  INVESTIGATING: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const severityClass: Record<AdminDisputeSeverity, string> = {
  HIGH: 'bg-red-100 text-red-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
}

const disputeTabs: Array<{ key: AdminDisputeStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'OPEN', label: 'Chờ xử lý' },
  { key: 'INVESTIGATING', label: 'Đang điều tra' },
  { key: 'RESOLVED', label: 'Đã giải quyết' },
  { key: 'REJECTED', label: 'Đã từ chối' },
]

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

function createInitialFormState(item?: AdminDisputeItem | null): FormState {
  const currentAdminId = getAdminUserId()
  return {
    orderId: item ? String(item.orderId) : '',
    batchId: item?.batchId ? String(item.batchId) : '',
    createdByUserId: item?.createdByUserId ? String(item.createdByUserId) : currentAdminId ? String(currentAdminId) : '',
    assignedToUserId: item?.assignedToUserId ? String(item.assignedToUserId) : currentAdminId ? String(currentAdminId) : '',
    status: item?.status ?? 'OPEN',
    severity: item?.severity ?? 'MEDIUM',
    title: item?.title ?? '',
    description: item?.description ?? '',
    resolution: item?.resolution ?? '',
  }
}

export function AdminDisputesPage() {
  usePageTitle('Quản lý tranh chấp')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminDisputeStatus | 'ALL'>('ALL')
  const [disputes, setDisputes] = useState<AdminDisputeItem[]>([])
  const [selected, setSelected] = useState<AdminDisputeItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formState, setFormState] = useState<FormState>(createInitialFormState())
  const [saving, setSaving] = useState(false)
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchAdminDisputes(search, statusFilter === 'ALL' ? undefined : statusFilter)
        if (!active) return
        setDisputes(payload)
        setSelected((current) => payload.find((item) => item.id === current?.id) ?? payload[0] ?? null)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách tranh chấp.')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [search, statusFilter, reloadKey])

  const selectedId = useMemo(() => selected?.id ?? null, [selected])

  function triggerReload() {
    setReloadKey((current) => current + 1)
  }

  async function openDetail(item: AdminDisputeItem) {
    try {
      setDetailLoading(true)
      setError('')
      const payload = await fetchAdminDisputeById(item.id)
      setSelected(payload)
      return payload
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Không tải được chi tiết tranh chấp.')
      return null
    } finally {
      setDetailLoading(false)
    }
  }

  function openCreateModal() {
    setFormMode('create')
    setFormState(createInitialFormState())
    setFormOpen(true)
  }

  async function openEditModal(item: AdminDisputeItem) {
    const detail = await openDetail(item)
    setFormMode('edit')
    setFormState(createInitialFormState(detail ?? item))
    setFormOpen(true)
  }

  function closeFormModal() {
    setFormOpen(false)
    setFormState(createInitialFormState(selected))
  }

  async function handleSubmitForm() {
    if (!formState.orderId.trim() || !formState.title.trim() || !formState.description.trim()) {
      setError('Vui lòng nhập orderId, tiêu đề và mô tả tranh chấp.')
      return
    }

    const payload: AdminDisputeUpsertRequest = {
      orderId: Number(formState.orderId),
      batchId: formState.batchId.trim() ? Number(formState.batchId) : undefined,
      createdByUserId: formState.createdByUserId.trim() ? Number(formState.createdByUserId) : undefined,
      assignedToUserId: formState.assignedToUserId.trim() ? Number(formState.assignedToUserId) : undefined,
      status: formState.status,
      severity: formState.severity,
      title: formState.title,
      description: formState.description,
      resolution: formState.resolution,
    }

    try {
      setSaving(true)
      setError('')
      const saved =
        formMode === 'create'
          ? await createAdminDispute(payload)
          : await updateAdminDispute(selectedId ?? 0, payload)
      setSelected(saved)
      closeFormModal()
      triggerReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được tranh chấp.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusAction(item: AdminDisputeItem) {
    const adminUserId = getAdminUserId()
    try {
      setStatusLoadingId(item.id)
      setError('')
      if (item.status === 'OPEN') {
        const updated = await updateAdminDisputeStatus(item.id, {
          assignedToUserId: adminUserId,
          status: 'INVESTIGATING',
        })
        setSelected(updated)
      } else if (item.status === 'INVESTIGATING') {
        const resolution = window.prompt('Nhập kết quả xử lý tranh chấp:', item.resolution ?? '')
        if (resolution === null) return
        const updated = await updateAdminDisputeStatus(item.id, {
          assignedToUserId: adminUserId,
          status: 'RESOLVED',
          resolution,
        })
        setSelected(updated)
      } else {
        await openDetail(item)
      }
      triggerReload()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không cập nhật được trạng thái tranh chấp.')
    } finally {
      setStatusLoadingId(null)
    }
  }

  async function handleDelete(item: AdminDisputeItem) {
    const confirmed = window.confirm(`Xóa tranh chấp "${item.title}"?`)
    if (!confirmed) return
    try {
      setDeleteLoadingId(item.id)
      setError('')
      await deleteAdminDispute(item.id)
      if (selected?.id === item.id) {
        setSelected(null)
      }
      triggerReload()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được tranh chấp.')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  return (
    <AdminShell activeKey="disputes" title="Quản lý tranh chấp" subtitle="Xử lý khiếu nại và tranh chấp">
      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Quản lý tranh chấp</h2>
              <p className="text-sm text-slate-500">Danh sách khiếu nại và tranh chấp đang cần admin xử lý</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block w-full min-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo mã đơn, tiêu đề, buyer, supplier"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none ring-emerald-200 focus:ring-2"
                />
              </label>
              <button
                onClick={openCreateModal}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Tạo tranh chấp
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {disputeTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  tab.key === statusFilter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {error ? <div className="border-b border-slate-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Đang tải tranh chấp...</div>
        ) : disputes.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Không có tranh chấp nào khớp bộ lọc hiện tại.</div>
        ) : (
          <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="divide-y divide-slate-200">
              {disputes.map((item) => {
                const action =
                  item.status === 'OPEN'
                    ? { label: 'Điều tra', className: 'bg-blue-600 text-white', icon: Search }
                    : item.status === 'INVESTIGATING'
                      ? { label: 'Giải quyết', className: 'bg-emerald-600 text-white', icon: Check }
                      : { label: 'Chi tiết', className: 'border border-slate-200 bg-white text-slate-700', icon: Eye }
                const ActionIcon = action.icon
                const active = item.id === selected?.id

                return (
                  <article key={item.id} className={`px-4 py-5 transition ${active ? 'bg-emerald-50/50' : 'bg-white'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-extrabold text-slate-900">{item.disputeCode}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass[item.status]}`}>{item.statusLabel}</span>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${severityClass[item.severity]}`}>{item.severityLabel}</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-900">{item.title}</h3>
                        <p className="text-sm text-slate-600">{item.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openDetail(item)}
                          disabled={detailLoading}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          <Eye className="h-4 w-4" /> Chi tiết
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          <Pencil className="h-4 w-4" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={deleteLoadingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" /> {deleteLoadingId === item.id ? 'Đang xóa...' : 'Xóa'}
                        </button>
                        <button
                          onClick={() => handleStatusAction(item)}
                          disabled={statusLoadingId === item.id}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${action.className}`}
                        >
                          <ActionIcon className="h-4 w-4" /> {statusLoadingId === item.id ? 'Đang xử lý...' : action.label}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <Meta label="Người mua" value={item.buyerName} />
                      <Meta label="Nhà cung cấp" value={item.supplierName} />
                      <Meta label="Sản phẩm" value={item.product} />
                      <Meta label="Giá trị" value={item.amount} valueClassName="text-red-500" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <p>Tạo ngày: {item.createdAt}</p>
                      <p>Phụ trách: {item.assignedToName}</p>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="border-l border-slate-200 bg-slate-50/50 p-4">
              {detailLoading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải chi tiết...</div>
              ) : selected ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-extrabold text-slate-900">{selected.title}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass[selected.status]}`}>{selected.statusLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{selected.disputeCode} • Order #{selected.orderId}</p>
                  </div>

                  <Meta label="Mức độ" value={selected.severityLabel} />
                  <Meta label="Người tạo" value={selected.createdByName} />
                  <Meta label="Người xử lý" value={selected.assignedToName} />
                  <Meta label="Người mua" value={selected.buyerName} />
                  <Meta label="Nhà cung cấp" value={selected.supplierName} />
                  <Meta label="Sản phẩm" value={selected.product} />
                  <Meta label="Giá trị" value={selected.amount} valueClassName="text-red-500" />
                  <Meta label="Ngày tạo" value={selected.createdAt} />
                  <Meta label="Ngày xử lý" value={selected.resolvedAt || 'Chưa có'} />

                  <section>
                    <p className="text-xs font-semibold text-slate-500">Mô tả</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{selected.description}</p>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-slate-500">Kết quả xử lý</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{selected.resolution || 'Chưa có kết quả xử lý.'}</p>
                  </section>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  Chọn một tranh chấp để xem chi tiết.
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      {formOpen ? (
        <DisputeFormModal
          mode={formMode}
          form={formState}
          saving={saving}
          onClose={closeFormModal}
          onSubmit={handleSubmitForm}
          onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
        />
      ) : null}
    </AdminShell>
  )
}

function DisputeFormModal({
  mode,
  form,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  mode: 'create' | 'edit'
  form: FormState
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onChange: (patch: Partial<FormState>) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{mode === 'create' ? 'Tạo tranh chấp mới' : 'Cập nhật tranh chấp'}</h3>
            <p className="mt-1 text-sm text-slate-500">Nhập thông tin để lưu hồ sơ tranh chấp</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <Field label="Order ID">
            <input value={form.orderId} onChange={(event) => onChange({ orderId: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Batch ID">
            <input value={form.batchId} onChange={(event) => onChange({ batchId: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Created By User ID">
            <input value={form.createdByUserId} onChange={(event) => onChange({ createdByUserId: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Assigned To User ID">
            <input value={form.assignedToUserId} onChange={(event) => onChange({ assignedToUserId: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Trạng thái">
            <select value={form.status} onChange={(event) => onChange({ status: event.target.value as AdminDisputeStatus })} className={inputClass}>
              <option value="OPEN">Chờ xử lý</option>
              <option value="INVESTIGATING">Đang điều tra</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="REJECTED">Đã từ chối</option>
            </select>
          </Field>
          <Field label="Mức độ">
            <select value={form.severity} onChange={(event) => onChange({ severity: event.target.value as AdminDisputeSeverity })} className={inputClass}>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Cao</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Tiêu đề">
              <input value={form.title} onChange={(event) => onChange({ title: event.target.value })} className={inputClass} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Mô tả">
              <textarea value={form.description} onChange={(event) => onChange({ description: event.target.value })} rows={5} className={`${inputClass} py-2.5`} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Kết quả xử lý">
              <textarea value={form.resolution} onChange={(event) => onChange({ resolution: event.target.value })} rows={4} className={`${inputClass} py-2.5`} />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Hủy
          </button>
          <button onClick={onSubmit} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Đang lưu...' : mode === 'create' ? 'Tạo tranh chấp' : 'Lưu thay đổi'}
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

function Meta({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${valueClassName ?? 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function getAdminUserId(): number | undefined {
  const raw = sessionStorage.getItem('agribridge.auth.userId')
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : undefined
}
