import { MoreVertical, Store, X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import {
  createBuyerBranch,
  deleteBuyerBranch,
  fetchBuyerBranch,
  fetchBuyerBranches,
  updateBuyerBranch,
  updateBuyerBranchStatus,
  type BuyerBranchDetail,
  type BuyerBranchPayload,
  type BuyerBranchSummary,
} from '../../services/buyerBranchService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type BranchFormState = BuyerBranchPayload & { useAddressForDelivery: boolean }

const emptyForm: BranchFormState = {
  name: '',
  province: '',
  district: '',
  ward: '',
  address: '',
  deliveryAddress: '',
  managerName: '',
  phone: '',
  isActive: true,
  useAddressForDelivery: true,
}

function toForm(branch?: BuyerBranchSummary | null): BranchFormState {
  if (!branch) return emptyForm
  const deliveryAddress = branch.deliveryAddress || ''
  return {
    name: branch.name,
    province: branch.province,
    district: branch.district || '',
    ward: branch.ward || '',
    address: branch.address,
    deliveryAddress,
    managerName: branch.managerName || '',
    phone: branch.phone || '',
    isActive: branch.isActive,
    useAddressForDelivery: !deliveryAddress || deliveryAddress === branch.address,
  }
}

function buildPayload(form: BranchFormState): BuyerBranchPayload {
  return {
    name: form.name.trim(),
    province: form.province.trim(),
    district: form.district?.trim(),
    ward: form.ward?.trim(),
    address: form.address.trim(),
    deliveryAddress: (form.useAddressForDelivery ? form.address : (form.deliveryAddress || '')).trim(),
    managerName: form.managerName?.trim(),
    phone: form.phone?.trim(),
    isActive: form.isActive,
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function formatMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

export function BuyerBranchesPage() {
  const { showToast, showConfirm } = useToast()
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuBranchId, setMenuBranchId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BuyerBranchSummary | null>(null)
  const [form, setForm] = useState<BranchFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<BuyerBranchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setBranches(await fetchBuyerBranches())
    } catch (requestError) {
      setBranches([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải danh sách chi nhánh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  const formTitle = useMemo(() => (editingBranch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh'), [editingBranch])

  const openCreate = () => {
    setEditingBranch(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (branch: BuyerBranchSummary) => {
    setEditingBranch(branch)
    setForm(toForm(branch))
    setFormOpen(true)
    setMenuBranchId(null)
  }

  const closeForm = () => {
    setEditingBranch(null)
    setForm(emptyForm)
    setFormOpen(false)
  }

  const saveBranch = async () => {
    try {
      setSaving(true)
      const payload = buildPayload(form)
      const saved = editingBranch
        ? await updateBuyerBranch(editingBranch.rawId, payload)
        : await createBuyerBranch(payload)
      setBranches((current) => {
        if (!editingBranch) return [saved, ...current]
        return current.map((item) => (item.rawId === saved.rawId ? saved : item))
      })
      showToast(editingBranch ? 'Đã cập nhật chi nhánh.' : 'Đã thêm chi nhánh.', 'success')
      closeForm()
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể lưu chi nhánh.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (branch: BuyerBranchSummary) => {
    try {
      setDetailLoading(true)
      setMenuBranchId(null)
      setDetail(await fetchBuyerBranch(branch.rawId))
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết chi nhánh.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleStatus = async (branch: BuyerBranchSummary) => {
    setMenuBranchId(null)
    const nextActive = !branch.isActive
    const confirmed = await showConfirm(
      `${nextActive ? 'Kích hoạt' : 'Tạm ngưng'} chi nhánh ${branch.name}?`,
      { title: 'Xác nhận trạng thái', confirmText: nextActive ? 'Kích hoạt' : 'Tạm ngưng', cancelText: 'Đóng' },
    )
    if (!confirmed) return
    try {
      const updated = await updateBuyerBranchStatus(branch.rawId, nextActive)
      setBranches((current) => current.map((item) => (item.rawId === updated.rawId ? updated : item)))
      showToast('Đã cập nhật trạng thái chi nhánh.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể cập nhật trạng thái.', 'error')
    }
  }

  const removeBranch = async (branch: BuyerBranchSummary) => {
    setMenuBranchId(null)
    const confirmed = await showConfirm(`Xóa chi nhánh ${branch.name}?`, {
      title: 'Xóa chi nhánh',
      confirmText: 'Xóa',
      cancelText: 'Đóng',
    })
    if (!confirmed) return
    try {
      await deleteBuyerBranch(branch.rawId)
      setBranches((current) => current.filter((item) => item.rawId !== branch.rawId))
      showToast('Đã xóa chi nhánh.', 'success')
    } catch (requestError) {
      await loadBranches()
      showToast(readApiErrorMessage(requestError) || 'Chi nhánh đã có dữ liệu, hệ thống đã tạm ngưng thay vì xóa.', 'info')
    }
  }

  usePageTitle('Quản lý Chi nhánh')
  return (
    <>
      <BuyerShell
        activeKey="branches"
        title="Quản lý Chi nhánh"
        subtitle="Quản lý nhiều chi nhánh"
        actions={<div className="flex justify-end"><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={openCreate}>+ Thêm chi nhánh</button></div>}
      >
        <BuyerPanel title="Quản lý Chi nhánh" right={<p className="text-sm text-emerald-700/70">Theo dõi và quản lý các chi nhánh của bạn</p>}>
          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải chi nhánh...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && branches.length === 0 ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">
              Chưa có chi nhánh nào. Hãy thêm chi nhánh đầu tiên để quản lý đơn hàng và RFQ theo địa điểm.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => (
              <article key={branch.id} className="relative rounded-xl border border-emerald-100 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Store className="h-5 w-5" /></div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${branch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {branch.isActive ? branch.activeOrders : 'Tạm ngưng'}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-emerald-950">{branch.name}</h3>
                <p className="mt-1 text-sm text-emerald-700/80">{branch.address}</p>
                <p className="text-sm text-emerald-700/80">{[branch.ward, branch.district, branch.province].filter(Boolean).join(', ')}</p>
                <p className="text-sm text-emerald-700/80">{branch.managerName || 'Chưa có quản lý'}</p>
                <p className="text-sm text-emerald-700/80">{branch.phone || 'Chưa có số điện thoại'}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-emerald-100 pt-3">
                  <Metric label="Tháng này" value={branch.monthlyVolume} />
                  <Metric label="RFQ mở" value={String(branch.openRfqCount)} />
                  <Metric label="Nhân viên" value={String(branch.staffCount)} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="flex-1 rounded-lg bg-emerald-100 py-2 text-sm font-semibold text-emerald-700" onClick={() => void openDetail(branch)}>
                    Xem chi tiết
                  </button>
                  <button className="rounded-lg border border-emerald-200 p-2 text-emerald-700" onClick={() => setMenuBranchId(menuBranchId === branch.rawId ? null : branch.rawId)}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
                {menuBranchId === branch.rawId ? (
                  <BranchMenu
                    branch={branch}
                    onEdit={() => openEdit(branch)}
                    onToggle={() => void toggleStatus(branch)}
                    onDelete={() => void removeBranch(branch)}
                    onDetail={() => void openDetail(branch)}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </BuyerPanel>
      </BuyerShell>

      {formOpen ? (
        <BranchFormModal title={formTitle} form={form} setForm={setForm} saving={saving} onClose={closeForm} onSubmit={() => void saveBranch()} />
      ) : null}

      {detail || detailLoading ? (
        <BranchDetailDrawer detail={detail} loading={detailLoading} onClose={() => setDetail(null)} />
      ) : null}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-emerald-700/70">{label}</p>
      <p className="text-sm font-extrabold text-emerald-900">{value}</p>
    </div>
  )
}

function BranchMenu({
  branch,
  onEdit,
  onToggle,
  onDelete,
  onDetail,
}: {
  branch: BuyerBranchSummary
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onDetail: () => void
}) {
  return (
    <div className="absolute right-4 top-44 z-10 w-48 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">
      <button className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={onEdit}>Chỉnh sửa</button>
      <button className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={onToggle}>{branch.isActive ? 'Tạm ngưng' : 'Kích hoạt'}</button>
      <button className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={onDetail}>Quản lý nhân viên</button>
      <Link className="block px-3 py-2 hover:bg-slate-50" to="/buyer/orders">Xem đơn hàng</Link>
      <Link className="block px-3 py-2 hover:bg-slate-50" to="/buyer/rfq">Xem RFQ</Link>
      <button className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={onDelete}>Xóa</button>
    </div>
  )
}

function BranchFormModal({
  title,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  title: string
  form: BranchFormState
  setForm: React.Dispatch<React.SetStateAction<BranchFormState>>
  saving: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const update = (key: keyof BranchFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4">
      <div className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
          <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <BranchInput label="Tên chi nhánh" value={form.name} onChange={(value) => update('name', value)} required />
          <BranchInput label="Tỉnh/Thành phố" value={form.province} onChange={(value) => update('province', value)} required />
          <BranchInput label="Quận/Huyện" value={form.district || ''} onChange={(value) => update('district', value)} />
          <BranchInput label="Phường/Xã" value={form.ward || ''} onChange={(value) => update('ward', value)} />
          <BranchInput label="Địa chỉ" value={form.address} onChange={(value) => update('address', value)} required />
          <BranchInput label="Quản lý" value={form.managerName || ''} onChange={(value) => update('managerName', value)} />
          <BranchInput label="Số điện thoại" value={form.phone || ''} onChange={(value) => update('phone', value)} placeholder="0912345678" />
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />
            Đang hoạt động
          </label>
          <label className="md:col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.useAddressForDelivery} onChange={(event) => update('useAddressForDelivery', event.target.checked)} />
            Dùng địa chỉ chi nhánh làm địa chỉ nhận hàng
          </label>
          {!form.useAddressForDelivery ? (
            <div className="md:col-span-2">
              <BranchInput label="Địa chỉ nhận hàng" value={form.deliveryAddress || ''} onChange={(value) => update('deliveryAddress', value)} required />
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose} disabled={saving}>Đóng</button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={onSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu chi nhánh'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BranchInput({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-600">{label}{required ? ' *' : ''}</span>
      <input className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function BranchDetailDrawer({ detail, loading, onClose }: { detail: BuyerBranchDetail | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/35" onClick={onClose}>
      <aside className="ml-auto h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{detail?.branch.name || 'Chi tiết chi nhánh'}</h3>
            <p className="text-sm text-slate-500">{detail?.branch.address || (loading ? 'Đang tải...' : '')}</p>
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {detail ? (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <InfoTile label="Đơn xử lý" value={String(detail.branch.activeOrderCount)} />
              <InfoTile label="Đơn tháng này" value={String(detail.branch.monthlyOrderCount)} />
              <InfoTile label="Doanh số tháng" value={detail.branch.monthlyVolume} />
              <InfoTile label="RFQ mở" value={String(detail.branch.openRfqCount)} />
            </div>
            <section className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-bold text-slate-900">Thông tin chi nhánh</h4>
              <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p><span className="text-slate-500">Địa chỉ:</span> {detail.branch.address}</p>
                <p><span className="text-slate-500">Nhận hàng:</span> {detail.branch.deliveryAddress || detail.branch.address}</p>
                <p><span className="text-slate-500">Khu vực:</span> {[detail.branch.ward, detail.branch.district, detail.branch.province].filter(Boolean).join(', ')}</p>
                <p><span className="text-slate-500">Quản lý:</span> {detail.branch.managerName || 'Chưa có'}</p>
                <p><span className="text-slate-500">SĐT:</span> {detail.branch.phone || 'Chưa có'}</p>
                <p><span className="text-slate-500">Trạng thái:</span> {detail.branch.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}</p>
              </div>
            </section>
            <DetailList title="Đơn hàng gần đây" empty="Chưa có đơn hàng">
              {detail.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                  <span className="font-semibold">{order.id}</span>
                  <span>{order.status}</span>
                  <span className="font-bold">{formatMoney(order.totalAmount)}</span>
                  <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                </div>
              ))}
            </DetailList>
            <DetailList title="RFQ gần đây" empty="Chưa có RFQ">
              {detail.recentRfqs.map((rfq) => (
                <div key={rfq.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{rfq.id} · {rfq.title}</span>
                    <span className="text-xs font-semibold text-emerald-700">{rfq.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">{rfq.quantity} {rfq.unit} · Giao {formatDate(rfq.deliveryDate)} · Tạo {formatDate(rfq.createdAt)}</p>
                </div>
              ))}
            </DetailList>
            <DetailList title="Nhân viên thuộc chi nhánh" empty="Chưa có nhân viên">
              {detail.staff.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                  <div>
                    <p className="font-semibold">{staff.fullName}</p>
                    <p className="text-xs text-slate-500">{staff.phone} · {staff.email || 'Chưa có email'}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{staff.role} · {staff.status}</span>
                </div>
              ))}
            </DetailList>
          </div>
        ) : (
          <p className="p-6 text-center text-sm font-semibold text-emerald-700">{loading ? 'Đang tải chi tiết...' : ''}</p>
        )}
      </aside>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

function DetailList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <div className="mt-2 space-y-2">
        {hasChildren ? children : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  )
}
