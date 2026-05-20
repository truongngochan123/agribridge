import {
  Activity,
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardList,
  Copy,
  Edit3,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MoreVertical,
  Navigation,
  PackageCheck,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Trash2,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import {
  createBuyerBranch,
  assignBranchEmployee,
  checkBranchEmployeeAvailability,
  createBranchEmployee,
  deleteBuyerBranch,
  fetchBranchEmployeeCandidates,
  fetchBuyerBranch,
  fetchBuyerBranches,
  updateBuyerBranch,
  updateBuyerBranchStatus,
  type BranchStaffMember,
  type BuyerBranchDetail,
  type BuyerBranchPayload,
  type BuyerBranchSummary,
} from '../../services/buyerBranchService'
import {
  fetchVietnamDistrictsByProvinceCode,
  fetchVietnamProvinces,
  fetchVietnamWardsByDistrictCode,
  findDistrictByName,
  findProvinceByName,
  normalizeVietnamText,
  type VietnamDistrictOption,
  type VietnamProvinceOption,
  type VietnamWardOption,
} from '../../services/vietnamAddressService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { buildBranchContextForUrl, buildBranchScopedPath } from '../../utils/branchContext'

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
  const [openEmployeesOnDetail, setOpenEmployeesOnDetail] = useState(false)

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

  useNotificationModuleRefresh(['BRANCH', 'ORDER', 'DELIVERY', 'RFQ'], loadBranches)

  const formTitle = useMemo(() => (editingBranch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh'), [editingBranch])
  const branchStats = useMemo(() => {
    return {
      active: branches.filter((branch) => branch.isActive).length,
      activeOrders: branches.reduce((total, branch) => total + (branch.activeOrderCount || 0), 0),
      openRfqs: branches.reduce((total, branch) => total + (branch.openRfqCount || 0), 0),
      staff: branches.reduce((total, branch) => total + (branch.staffCount || 0), 0),
    }
  }, [branches])

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

  const openDetail = async (branch: BuyerBranchSummary, openEmployees = false) => {
    try {
      setDetailLoading(true)
      setOpenEmployeesOnDetail(openEmployees)
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
      { title: 'Xác nhận trạng thái', confirmText: nextActive ? 'Kích hoạt' : 'Tạm ngưng', cancelText: 'Hủy' },
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
      cancelText: 'Hủy',
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
        actions={
          <div className="flex justify-end">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-700/25 active:scale-95"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Thêm chi nhánh
            </button>
          </div>
        }
      >
        <div className="flex h-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <BranchStatChip icon={<Building2 className="h-3.5 w-3.5" />} value={`${branches.length}`} label="chi nhánh" tone="emerald" />
            <BranchStatChip icon={<Activity className="h-3.5 w-3.5" />} value={`${branchStats.active}`} label="đang hoạt động" tone="emerald" />
            <BranchStatChip icon={<ClipboardList className="h-3.5 w-3.5" />} value={`${branchStats.activeOrders}`} label="đơn xử lý" />
            <BranchStatChip icon={<FileText className="h-3.5 w-3.5" />} value={`${branchStats.openRfqs}`} label="RFQ mở" />
            <BranchStatChip icon={<Users className="h-3.5 w-3.5" />} value={`${branchStats.staff}`} label="nhân viên" />
          </div>

          <BuyerPanel
            title="Mạng lưới chi nhánh"
            right={<p className="hidden text-sm font-medium text-emerald-700/70 sm:block">Theo dõi đơn hàng, RFQ và năng lực vận hành theo địa điểm</p>}
          >
            {loading ? (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
                Đang tải chi nhánh...
              </div>
            ) : null}
            {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
            {!loading && !error && branches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-8 text-center">
                <Store className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
                <p className="text-sm font-bold text-emerald-900">Chưa có chi nhánh nào.</p>
                <p className="mt-1 text-sm text-emerald-700/80">Hãy thêm chi nhánh đầu tiên để quản lý đơn hàng và RFQ theo địa điểm.</p>
              </div>
            ) : null}
            <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {branches.map((branch) => (
                <article key={branch.id} className="group relative flex h-full flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_12px_34px_rgba(16,185,129,0.16)]">
                  <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-4 py-4">
                    <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.9) 0%, transparent 38%)' }} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Logistics node</p>
                          <h3 className="truncate text-base font-black text-white drop-shadow">{branch.name}</h3>
                        </div>
                      </div>
                      <BranchStatusBadge active={branch.isActive} label={branch.isActive ? branch.activeOrders : 'Tạm ngưng'} />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="space-y-2">
                      <BranchInfoLine icon={<MapPin className="h-3.5 w-3.5" />} value={branch.address} />
                      <BranchInfoLine icon={<Navigation className="h-3.5 w-3.5" />} value={[branch.ward, branch.district, branch.province].filter(Boolean).join(', ') || '--'} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <BranchInfoLine icon={<UserRound className="h-3.5 w-3.5" />} value={branch.managerName || 'Chưa có quản lý'} compact />
                        <BranchInfoLine icon={<Phone className="h-3.5 w-3.5" />} value={branch.phone || 'Chưa có SĐT'} compact />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <BranchKpiTile icon={<ClipboardList className="h-3.5 w-3.5" />} label="Đơn xử lý" value={String(branch.activeOrderCount)} highlight />
                      <BranchKpiTile icon={<FileText className="h-3.5 w-3.5" />} label="RFQ mở" value={String(branch.openRfqCount)} />
                      <BranchKpiTile icon={<Users className="h-3.5 w-3.5" />} label="Nhân viên" value={String(branch.staffCount)} />
                      <BranchKpiTile icon={<WalletCards className="h-3.5 w-3.5" />} label="Tháng này" value={branch.monthlyVolume} highlight />
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                          <Truck className="h-3.5 w-3.5" />
                          Trạng thái vận hành
                        </span>
                        <span className="text-xs font-black text-emerald-800">{branch.isActive ? 'Sẵn sàng nhận đơn' : 'Tạm dừng'}</span>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 pt-3">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                        onClick={() => void openDetail(branch)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem chi tiết
                      </button>
                      <button
                        title="Thao tác chi nhánh"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 active:scale-95"
                        onClick={() => setMenuBranchId(menuBranchId === branch.rawId ? null : branch.rawId)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {menuBranchId === branch.rawId ? (
                    <BranchMenu
                      branch={branch}
                      onEdit={() => openEdit(branch)}
                      onToggle={() => void toggleStatus(branch)}
                      onDelete={() => void removeBranch(branch)}
                      onDetail={() => void openDetail(branch, true)}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </BuyerPanel>

        </div>
      </BuyerShell>

      {formOpen ? (
        <BranchFormModal title={formTitle} form={form} setForm={setForm} saving={saving} onClose={closeForm} onSubmit={() => void saveBranch()} />
      ) : null}

      {detail || detailLoading ? (
        <BranchDetailDrawer
          detail={detail}
          loading={detailLoading}
          initialEmployeesOpen={openEmployeesOnDetail}
          onDetailChange={(nextDetail) => {
            setDetail(nextDetail)
            setBranches((current) => current.map((branch) => (branch.rawId === nextDetail.branch.rawId ? nextDetail.branch : branch)))
          }}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </>
  )
}

function BranchStatChip({ icon, value, label, tone = 'slate' }: { icon: React.ReactNode; value: string; label: string; tone?: 'emerald' | 'slate' }) {
  const classes = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-white text-slate-600'
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${classes}`}>
      {icon}
      <span className={tone === 'emerald' ? 'text-emerald-900' : 'text-slate-900'}>{value}</span>
      <span className={tone === 'emerald' ? 'text-emerald-500' : 'text-slate-400'}>{label}</span>
    </div>
  )
}

function BranchStatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black backdrop-blur-sm transition ${active ? 'border-emerald-300/60 bg-white/90 text-emerald-700' : 'border-slate-300/60 bg-white/80 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  )
}

function BranchInfoLine({ icon, value, compact }: { icon: React.ReactNode; value: string; compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 ${compact ? 'py-2' : 'py-2.5'}`}>
      <span className="shrink-0 text-emerald-600">{icon}</span>
      <span className="truncate text-xs font-semibold text-slate-700">{value}</span>
    </div>
  )
}

function BranchKpiTile({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${highlight ? 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50' : 'border-slate-100 bg-slate-50'}`}>
      <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${highlight ? 'text-emerald-600' : 'text-slate-400'}`}>
        {icon}
        {label}
      </div>
      <p className={`truncate text-sm font-black ${highlight ? 'text-emerald-800' : 'text-slate-800'}`}>{value}</p>
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
  const branchContext = buildBranchContextForUrl(branch)
  return (
    <div className="absolute right-4 top-[calc(100%-3.25rem)] z-20 w-56 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1.5 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <BranchMenuButton icon={<Edit3 className="h-4 w-4" />} label="Chỉnh sửa" onClick={onEdit} />
      <BranchMenuButton icon={branch.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />} label={branch.isActive ? 'Tạm ngưng' : 'Kích hoạt'} onClick={onToggle} />
      <BranchMenuButton icon={<Users className="h-4 w-4" />} label="Quản lý nhân viên" onClick={onDetail} />
      <Link className="flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700" to={buildBranchScopedPath('/buyer/orders', branchContext)}>
        <ClipboardList className="h-4 w-4" />
        Xem đơn hàng
      </Link>
      <Link className="flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700" to={buildBranchScopedPath('/buyer/rfq', branchContext)}>
        <FileText className="h-4 w-4" />
        Xem RFQ
      </Link>
      <div className="my-1 border-t border-slate-100" />
      <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold text-red-600 transition hover:bg-red-50 active:scale-95" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        Xóa
      </button>
    </div>
  )
}

function BranchMenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95" onClick={onClick}>
      {icon}
      {label}
    </button>
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
  const [provinces, setProvinces] = useState<VietnamProvinceOption[]>([])
  const [districts, setDistricts] = useState<VietnamDistrictOption[]>([])
  const [wards, setWards] = useState<VietnamWardOption[]>([])
  const [provinceLoading, setProvinceLoading] = useState(false)
  const [districtLoading, setDistrictLoading] = useState(false)
  const [wardLoading, setWardLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [branchType, setBranchType] = useState('distribution')
  const [dockWindow, setDockWindow] = useState('08:00-17:00')
  const [leadTime, setLeadTime] = useState('2')
  const [coldChainReady, setColdChainReady] = useState(false)
  const [priorityReceiving, setPriorityReceiving] = useState(true)

  const update = (key: keyof BranchFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }
  const selectedProvince = useMemo(() => findProvinceByName(provinces, form.province), [form.province, provinces])
  const selectedDistrict = useMemo(() => findDistrictByName(districts, form.district || ''), [districts, form.district])
  const formStatus = useMemo(() => {
    const requiredFields = [form.name, form.province, form.address]
    if (!form.useAddressForDelivery) requiredFields.push(form.deliveryAddress || '')
    const complete = requiredFields.every((value) => value.trim().length > 0)
    const phoneValid = !form.phone?.trim() || /^(0|\+84)[0-9\s.-]{8,13}$/.test(form.phone.trim())
    return { complete, phoneValid, ready: complete && phoneValid }
  }, [form.address, form.deliveryAddress, form.name, form.phone, form.province, form.useAddressForDelivery])

  useEffect(() => {
    let alive = true
    setProvinceLoading(true)
    setLocationError('')
    fetchVietnamProvinces()
      .then((items) => {
        if (alive) setProvinces(items)
      })
      .catch(() => {
        if (alive) setLocationError('Không thể tải danh sách tỉnh/thành. Vẫn có thể nhập thủ công.')
      })
      .finally(() => {
        if (alive) setProvinceLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!selectedProvince) {
      setDistricts([])
      return
    }
    let alive = true
    setDistrictLoading(true)
    fetchVietnamDistrictsByProvinceCode(selectedProvince.code)
      .then((items) => {
        if (alive) setDistricts(items)
      })
      .catch(() => {
        if (alive) setLocationError('Không thể tải quận/huyện cho khu vực này.')
      })
      .finally(() => {
        if (alive) setDistrictLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedProvince])

  useEffect(() => {
    if (!selectedDistrict) {
      setWards([])
      return
    }
    let alive = true
    setWardLoading(true)
    fetchVietnamWardsByDistrictCode(selectedDistrict.code)
      .then((items) => {
        if (alive) setWards(items)
      })
      .catch(() => {
        if (alive) setLocationError('Không thể tải phường/xã cho khu vực này.')
      })
      .finally(() => {
        if (alive) setWardLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedDistrict])

  const chooseProvince = (value: string) => {
    update('province', value)
    update('district', '')
    update('ward', '')
  }

  const chooseDistrict = (value: string) => {
    update('district', value)
    update('ward', '')
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-md">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-[0_30px_90px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-900 to-teal-700 px-5 py-4">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 18px)' }} />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm">
                <Route className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white drop-shadow">{title}</h3>
                <p className="text-xs font-medium text-white/75">Thiết lập node vận hành, vùng giao nhận và năng lực logistics theo thời gian thực</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85 shadow-inner backdrop-blur md:flex">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : formStatus.ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-200" />}
              {saving ? 'Đang đồng bộ' : formStatus.ready ? 'Sẵn sàng lưu' : 'Cần hoàn tất'}
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30 active:scale-95" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/70 p-5">
          {locationError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm">
              {locationError}
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <BranchFormSection title="Branch identity" description="Định danh điểm mua hàng và trạng thái nhận đơn." icon={<Building2 className="h-4 w-4" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <BranchTypeSelector value={branchType} onChange={setBranchType} />
                <BranchInput label="Tên chi nhánh" value={form.name} onChange={(value) => update('name', value)} required placeholder="VD: Kho thu mua Thủ Đức" helper="Tên này hiển thị trên đơn hàng, RFQ và luồng điều phối." icon={<Store className="h-4 w-4" />} />
                <BranchInput label="Quản lý vận hành" value={form.managerName || ''} onChange={(value) => update('managerName', value)} placeholder="VD: Nguyễn Minh Anh" helper="Người phụ trách xử lý điều phối và xác nhận nhận hàng." icon={<UserRound className="h-4 w-4" />} />
                <BranchInput label="Số điện thoại" value={form.phone || ''} onChange={(value) => update('phone', value)} placeholder="VD: 0912 345 678" helper="Dùng để tài xế và nhà cung cấp liên hệ khi giao hàng." icon={<Phone className="h-4 w-4" />} valid={formStatus.phoneValid} error={formStatus.phoneValid ? '' : 'Số điện thoại chưa đúng định dạng.'} />
                <div className="md:col-span-2">
                  <BranchToggle checked={form.isActive} onChange={(checked) => update('isActive', checked)} label="Chi nhánh đang nhận đơn" description="Tắt công tắc khi điểm nhận hàng tạm ngưng vận hành." icon={<ShieldCheck className="h-4 w-4" />} />
                </div>
              </div>
            </BranchFormSection>

            <BranchFormSection title="Cấu hình vận hành" description="Thiết lập khung nhận hàng, SLA và năng lực xử lý tại chi nhánh." icon={<SlidersHorizontal className="h-4 w-4" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <BranchInput label="Khung giờ nhận hàng" value={dockWindow} onChange={setDockWindow} placeholder="VD: 08:00-17:00" helper="Gợi ý để đội vận hành căn lịch giao nhận." icon={<Clock3 className="h-4 w-4" />} />
                <BranchInput label="SLA nhận hàng" value={leadTime} onChange={setLeadTime} placeholder="VD: 2" helper="Số giờ mục tiêu để xác nhận hàng đến." icon={<PackageCheck className="h-4 w-4" />} />
                <BranchToggle checked={priorityReceiving} onChange={setPriorityReceiving} label="Ưu tiên nhận hàng nhanh" description="Đánh dấu node có năng lực xử lý đơn gấp." icon={<Truck className="h-4 w-4" />} />
                <BranchToggle checked={coldChainReady} onChange={setColdChainReady} label="Sẵn sàng chuỗi lạnh" description="Dành cho hàng cần kiểm soát nhiệt độ." icon={<PackageCheck className="h-4 w-4" />} />
              </div>
            </BranchFormSection>

            <BranchFormSection title="Địa chỉ chi nhánh" description="Tìm tỉnh/thành từ API, sau đó chọn quận/huyện và phường/xã phụ thuộc." icon={<MapPin className="h-4 w-4" />} wide>
              <div className="grid gap-3 md:grid-cols-3">
                <BranchComboBox label="Tỉnh/Thành phố" value={form.province} onChange={chooseProvince} options={provinces.map((item) => ({ value: item.name, label: item.name, meta: item.division_type }))} loading={provinceLoading} placeholder="VD: Thành phố Hồ Chí Minh" helper="Có thể tìm nhanh không dấu hoặc nhập thủ công." required icon={<Search className="h-4 w-4" />} />
                <BranchComboBox label="Quận/Huyện" value={form.district || ''} onChange={chooseDistrict} options={districts.map((item) => ({ value: item.name, label: item.name, meta: item.division_type }))} loading={districtLoading} placeholder="VD: Thành phố Thủ Đức" helper={selectedProvince ? 'Danh sách phụ thuộc tỉnh/thành đã chọn.' : 'Chọn tỉnh/thành trước để tải danh sách.'} disabled={!selectedProvince} icon={<Navigation className="h-4 w-4" />} />
                <BranchComboBox label="Phường/Xã" value={form.ward || ''} onChange={(value) => update('ward', value)} options={wards.map((item) => ({ value: item.name, label: item.name, meta: item.division_type }))} loading={wardLoading} placeholder="VD: Phường Linh Trung" helper={selectedDistrict ? 'Danh sách phụ thuộc quận/huyện đã chọn.' : 'Chọn quận/huyện trước để tải danh sách.'} disabled={!selectedDistrict} icon={<MapPin className="h-4 w-4" />} />
                <div className="md:col-span-3">
                  <BranchInput label="Địa chỉ chi tiết" value={form.address} onChange={(value) => update('address', value)} required placeholder="VD: 12 Quốc lộ 1K, khu nhận hàng cổng B" helper="Nên bao gồm số nhà, đường, cổng kho hoặc điểm bốc dỡ." icon={<Route className="h-4 w-4" />} />
                </div>
              </div>
            </BranchFormSection>

            <BranchFormSection title="Điểm nhận hàng" description="Cấu hình điểm giao hàng mặc định cho đơn mua và RFQ." icon={<Truck className="h-4 w-4" />} wide>
              <div className="grid gap-3">
                <BranchToggle checked={form.useAddressForDelivery} onChange={(checked) => update('useAddressForDelivery', checked)} label="Dùng địa chỉ chi nhánh làm địa chỉ nhận hàng" description="Khi bật, hệ thống dùng địa chỉ chi tiết phía trên cho giao nhận." icon={<MapPin className="h-4 w-4" />} />
                {!form.useAddressForDelivery ? (
                  <BranchInput label="Địa chỉ nhận hàng" value={form.deliveryAddress || ''} onChange={(value) => update('deliveryAddress', value)} required placeholder="VD: Dock 03, Kho trung chuyển An Phú, TP. Thủ Đức" helper="Nhập điểm nhận hàng thực tế nếu khác địa chỉ chi nhánh." icon={<Truck className="h-4 w-4" />} />
                ) : null}
              </div>
            </BranchFormSection>
          </div>
        </div>

        <div className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/60 bg-white/85 px-5 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            {formStatus.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
            {formStatus.ready ? 'Dữ liệu vận hành đã sẵn sàng để lưu.' : 'Hoàn tất các trường bắt buộc trước khi lưu.'}
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md active:scale-95" onClick={onClose}>
              Hủy
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-700/25 active:scale-95 disabled:cursor-wait disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none" onClick={onSubmit} disabled={saving || !formStatus.ready}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Đang lưu...' : 'Lưu chi nhánh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BranchFormSection({ title, description, icon, children, wide }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`relative z-0 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-200 hover:z-10 hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-white/90 hover:shadow-[0_22px_55px_rgba(16,185,129,0.12)] focus-within:z-30 ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          {icon}
        </span>
        <div>
          <h4 className="text-sm font-black text-slate-900">{title}</h4>
          <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function BranchTypeSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [
    { value: 'distribution', label: 'Trung tâm phân phối', icon: <Truck className="h-4 w-4" /> },
    { value: 'receiving', label: 'Điểm nhận hàng', icon: <PackageCheck className="h-4 w-4" /> },
    { value: 'office', label: 'Văn phòng thu mua', icon: <Building2 className="h-4 w-4" /> },
  ]
  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Loại chi nhánh</span>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${value === option.value ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-200 bg-white/80 text-slate-600 hover:border-emerald-200 hover:text-emerald-700'}`}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BranchInput({ label, value, onChange, required, placeholder, helper, icon, valid = true, error }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; helper?: string; icon?: React.ReactNode; valid?: boolean; error?: string }) {
  const isComplete = !required || value.trim().length > 0
  return (
    <label className="group relative block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <span>{label}{required ? ' *' : ''}</span>
        {value ? (valid && isComplete ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />) : null}
      </span>
      <span className="relative block">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-emerald-600">{icon}</span> : null}
        <input
          className={`h-11 w-full rounded-xl border bg-white/80 text-sm font-semibold text-slate-800 outline-none shadow-sm transition duration-200 placeholder:text-slate-400 hover:border-emerald-200 hover:bg-white hover:shadow-md focus:-translate-y-0.5 focus:bg-white focus:ring-4 ${icon ? 'pl-10 pr-3' : 'px-3'} ${valid && isComplete ? 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-100' : 'border-amber-300 focus:border-amber-400 focus:ring-amber-100'}`}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {error || helper ? <p className={`mt-1 text-xs font-medium leading-5 ${error ? 'text-amber-600' : 'text-slate-500'}`}>{error || helper}</p> : null}
    </label>
  )
}

type BranchComboOption = { value: string; label: string; meta?: string }

function BranchComboBox({ label, value, onChange, options, loading, placeholder, helper, required, icon, disabled }: { label: string; value: string; onChange: (value: string) => void; options: BranchComboOption[]; loading?: boolean; placeholder?: string; helper?: string; required?: boolean; icon?: React.ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const filteredOptions = useMemo(() => {
    const query = normalizeVietnamText(value)
    if (!query) return options
    return options.filter((option) => normalizeVietnamText(option.label).includes(query))
  }, [options, value])
  const selected = options.some((option) => option.value === value)
  const isComplete = !required || value.trim().length > 0
  return (
    <label className="group relative block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <span>{label}{required ? ' *' : ''}</span>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : value ? <CheckCircle2 className={`h-3.5 w-3.5 ${selected || isComplete ? 'text-emerald-500' : 'text-amber-500'}`} /> : null}
      </span>
      <span className="relative block">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-emerald-600">{icon}</span> : null}
        <input
          autoComplete="off"
          className={`h-11 w-full rounded-xl border border-slate-200 bg-white/80 py-2 pr-10 text-sm font-semibold text-slate-800 outline-none shadow-sm transition duration-200 placeholder:text-slate-400 hover:border-emerald-200 hover:bg-white hover:shadow-md focus:-translate-y-0.5 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${icon ? 'pl-10' : 'pl-3'}`}
          value={value}
          placeholder={loading ? 'Đang tải...' : placeholder}
          disabled={disabled}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition ${open ? 'rotate-180 text-emerald-600' : ''}`} />
      </span>
      {open && !disabled ? (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl">
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={option.value}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.meta ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-400">{option.meta}</span> : null}
            </button>
          )) : (
            <p className="px-3 py-3 text-sm font-semibold text-slate-500">Không có gợi ý phù hợp. Bạn vẫn có thể nhập thủ công.</p>
          )}
        </div>
      ) : null}
      {helper ? <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{helper}</p> : null}
    </label>
  )
}

function BranchToggle({ checked, onChange, label, description, icon }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; icon?: React.ReactNode }) {
  return (
    <label className="flex h-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md">
      <span className="flex min-w-0 items-start gap-2">
        {icon ? <span className="mt-0.5 shrink-0 text-emerald-600">{icon}</span> : null}
        <span className="min-w-0">
          <span className="block">{label}</span>
          {description ? <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">{description}</span> : null}
        </span>
      </span>
      <button
        aria-pressed={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-100 ${checked ? 'bg-emerald-500 shadow-inner' : 'bg-slate-300'}`}
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition duration-200 ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

function BranchDetailDrawer({
  detail,
  loading,
  initialEmployeesOpen,
  onDetailChange,
  onClose,
}: {
  detail: BuyerBranchDetail | null
  loading: boolean
  initialEmployeesOpen?: boolean
  onDetailChange: (detail: BuyerBranchDetail) => void
  onClose: () => void
}) {
  const branchContext = detail ? buildBranchContextForUrl(detail.branch) : null
  const [employeesOpen, setEmployeesOpen] = useState(Boolean(initialEmployeesOpen))
  const [employeeModalMode, setEmployeeModalMode] = useState<'add' | 'invite' | null>(null)
  const { showToast } = useToast()

  const refreshDetail = useCallback(async () => {
    if (!detail) return
    try {
      const nextDetail = await fetchBuyerBranch(detail.branch.rawId)
      onDetailChange(nextDetail)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải lại danh sách nhân viên.', 'error')
    }
  }, [detail, onDetailChange, showToast])

  const appendStaff = useCallback((staff: BranchStaffMember) => {
    if (!detail) return
    const exists = detail.staff.some((item) => item.id === staff.id)
    const nextStaff = exists
      ? detail.staff.map((item) => (item.id === staff.id ? staff : item))
      : [staff, ...detail.staff]
    onDetailChange({
      ...detail,
      branch: {
        ...detail.branch,
        staffCount: nextStaff.length,
      },
      staff: nextStaff,
    })
  }, [detail, onDetailChange])

  useEffect(() => {
    setEmployeesOpen(Boolean(initialEmployeesOpen))
  }, [detail?.branch.rawId, initialEmployeesOpen])
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-[0_24px_60px_rgba(0,0,0,0.28)] transition-transform" onClick={(event) => event.stopPropagation()}>
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 py-4">
          <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.8) 0%, transparent 50%)' }} />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xl font-black text-white drop-shadow">{detail?.branch.name || 'Chi tiết chi nhánh'}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-white/70">
                  <MapPin className="h-3.5 w-3.5" />
                  {detail?.branch.address || (loading ? 'Đang tải...' : '')}
                </p>
                {detail ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <BranchTypeBadge label={detail.branch.monthlyOrderCount > 20 ? 'Điểm mua hàng lớn' : detail.branch.deliveryAddress ? 'Điểm nhận hàng' : 'Văn phòng thu mua'} />
                    <BranchStatusBadge active={detail.branch.isActive} label={detail.branch.isActive ? 'Đang hoạt động' : 'Tạm ngưng'} />
                  </div>
                ) : null}
              </div>
            </div>
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30 active:scale-95" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {detail ? (
          <>
          <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <QuickActionLink icon={<Plus className="h-4 w-4" />} label="Tạo đơn mua" to={buildBranchScopedPath('/buyer/sourcing', branchContext)} />
            <QuickActionLink icon={<FileText className="h-4 w-4" />} label="Tạo RFQ" to={buildBranchScopedPath('/buyer/rfq', branchContext)} />
            <QuickActionButton icon={<Users className="h-4 w-4" />} label="Quản lý nhân sự" onClick={() => setEmployeesOpen(true)} />
            <QuickActionLink icon={<WalletCards className="h-4 w-4" />} label="Xem công nợ" to={buildBranchScopedPath('/buyer/debt', branchContext)} />
            <QuickActionLink icon={<Truck className="h-4 w-4" />} label="Theo dõi giao hàng" to={buildBranchScopedPath('/buyer/delivery', branchContext)} />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile icon={<ClipboardList className="h-4 w-4" />} label="Đơn xử lý" value={String(detail.branch.activeOrderCount)} />
              <InfoTile icon={<CalendarDays className="h-4 w-4" />} label="Đơn tháng này" value={String(detail.branch.monthlyOrderCount)} />
              <InfoTile icon={<WalletCards className="h-4 w-4" />} label="Doanh số tháng" value={detail.branch.monthlyVolume} />
              <InfoTile icon={<FileText className="h-4 w-4" />} label="RFQ mở" value={String(detail.branch.openRfqCount)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-slate-900">Sức khỏe vận hành chi nhánh</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${detail.branch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{detail.branch.isActive ? 'Ổn định' : 'Tạm ngưng'}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <OperationalMetric label="Đơn đang xử lý" value={String(detail.branch.activeOrderCount)} hint="Đang thực hiện" tone="emerald" />
                  <OperationalMetric label="RFQ đang mở" value={String(detail.branch.openRfqCount)} hint="Nhu cầu thu mua" tone="blue" />
                  <OperationalMetric label="Trạng thái nhận hàng" value={detail.branch.isActive ? 'Sẵn sàng' : 'Tạm ngưng'} hint="Năng lực nhận hàng" tone={detail.branch.isActive ? 'emerald' : 'slate'} />
                  <OperationalMetric label="Tổng mua hàng" value={detail.branch.monthlyVolume} hint="Giá trị mua trong tháng" tone="amber" />
                  <OperationalMetric label="Nhân sự phụ trách" value={String(detail.branch.staffCount)} hint="Tài khoản đã phân công" tone="slate" />
                  <OperationalMetric label="Điểm vận hành" value={`${Math.min(98, 70 + detail.branch.staffCount * 4 + detail.branch.monthlyOrderCount)}%`} hint="Đơn hàng, RFQ, nhân sự" tone="emerald" />
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">Năng lực chi nhánh</h4>
                <div className="mt-3 space-y-3">
                  <HealthIndicator label="Năng lực xử lý đơn" value={detail.branch.activeOrderCount > 0 ? 72 : 28} />
                  <HealthIndicator label="Tốc độ phản hồi RFQ" value={detail.branch.openRfqCount > 0 ? 64 : 88} />
                  <HealthIndicator label="Độ phủ nhân sự" value={Math.min(100, detail.branch.staffCount * 18)} />
                </div>
              </section>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-black text-slate-900">Thông tin chi nhánh</h4>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <DetailInfo label="Địa chỉ" value={detail.branch.address} />
                <DetailInfo label="Nhận hàng" value={detail.branch.deliveryAddress || detail.branch.address} />
                <DetailInfo label="Khu vực" value={[detail.branch.ward, detail.branch.district, detail.branch.province].filter(Boolean).join(', ')} />
                <DetailInfo label="Quản lý" value={detail.branch.managerName || 'Chưa có'} />
                <DetailInfo label="SĐT" value={detail.branch.phone || 'Chưa có'} />
                <DetailInfo label="Trạng thái" value={detail.branch.isActive ? 'Đang hoạt động' : 'Tạm ngưng'} />
              </div>
            </section>
            <DetailList title="Đơn hàng gần đây" empty="Chưa có đơn hàng">
              {detail.recentOrders.map((order) => (
                <div key={order.id} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm transition hover:bg-emerald-50/50 sm:grid-cols-[1fr_auto_auto_auto]">
                  <span className="font-bold text-slate-900">{order.id}</span>
                  <span className="font-semibold text-slate-600">{order.status}</span>
                  <span className="font-black text-emerald-700">{formatMoney(order.totalAmount)}</span>
                  <span className="text-xs font-semibold text-slate-500">{formatDate(order.createdAt)}</span>
                </div>
              ))}
            </DetailList>
            <DetailList title="RFQ gần đây" empty="Chưa có RFQ">
              {detail.recentRfqs.map((rfq) => (
                <div key={rfq.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm transition hover:bg-emerald-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{rfq.id} · {rfq.title}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">{rfq.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{rfq.quantity} {rfq.unit} · Giao {formatDate(rfq.deliveryDate)} · Tạo {formatDate(rfq.createdAt)}</p>
                </div>
              ))}
            </DetailList>
            <DetailList title="Nhân viên thuộc chi nhánh" empty="Chưa có nhân viên">
              {detail.staff.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm transition hover:bg-emerald-50/50">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{staff.fullName}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{staff.phone} · {staff.email || 'Chưa có email'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">{staff.role} · {staff.status}</span>
                </div>
              ))}
            </DetailList>
          </div>
          </>
        ) : (
          <p className="p-6 text-center text-sm font-semibold text-emerald-700">{loading ? 'Đang tải chi tiết...' : ''}</p>
        )}
      </aside>
      {detail && employeesOpen ? (
        <BranchEmployeeManagementDrawer
          detail={detail}
          onAdd={() => setEmployeeModalMode('add')}
          onInvite={() => setEmployeeModalMode('invite')}
          onRefresh={() => void refreshDetail()}
          onClose={() => setEmployeesOpen(false)}
        />
      ) : null}
      {detail && employeeModalMode ? (
        <EmployeeUpsertModal
          mode={employeeModalMode}
          detail={detail}
          onClose={() => setEmployeeModalMode(null)}
          onOptimisticStaff={appendStaff}
          onRollback={onDetailChange}
          onDone={(nextDetail) => {
            onDetailChange(nextDetail)
            setEmployeeModalMode(null)
          }}
        />
      ) : null}
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600">{icon}{label}</p>
      <p className="mt-1 text-lg font-black text-emerald-950">{value}</p>
    </div>
  )
}

function QuickActionLink({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
      {icon}
      {label}
    </Link>
  )
}

function QuickActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
      {icon}
      {label}
    </button>
  )
}

type EmployeeRole = 'Branch Manager' | 'Purchaser' | 'QC' | 'Warehouse Staff' | 'Accountant'
type PermissionGroup = 'Orders' | 'RFQ' | 'Delivery' | 'Debt' | 'Employee Management'

const employeeRoles: EmployeeRole[] = ['Branch Manager', 'Purchaser', 'QC', 'Warehouse Staff', 'Accountant']

const employeeRoleLabels: Record<EmployeeRole, string> = {
  'Branch Manager': 'Quản lý chi nhánh',
  Purchaser: 'Nhân viên thu mua',
  QC: 'Kiểm soát chất lượng',
  'Warehouse Staff': 'Nhân viên kho',
  Accountant: 'Kế toán công nợ',
}

const permissionGroupLabels: Record<PermissionGroup, string> = {
  Orders: 'Đơn mua',
  RFQ: 'RFQ',
  Delivery: 'Giao nhận',
  Debt: 'Công nợ',
  'Employee Management': 'Quản lý nhân sự',
}

const roleDetails: Record<EmployeeRole, { icon: React.ReactNode; description: string; summary: string }> = {
  'Branch Manager': { icon: <ShieldCheck className="h-4 w-4" />, description: 'Phụ trách vận hành chi nhánh, phê duyệt và phân công nhân sự.', summary: 'Toàn quyền theo dõi chi nhánh và quản lý nhân sự.' },
  Purchaser: { icon: <ClipboardList className="h-4 w-4" />, description: 'Tạo đơn mua và RFQ theo nhu cầu của chi nhánh.', summary: 'Tạo nguồn hàng và đơn mua.' },
  QC: { icon: <CheckCircle2 className="h-4 w-4" />, description: 'Kiểm tra chất lượng khi nhận hàng và ghi nhận sự cố giao nhận.', summary: 'Kiểm soát chất lượng và ghi nhận sự cố.' },
  'Warehouse Staff': { icon: <PackageCheck className="h-4 w-4" />, description: 'Nhận hàng và cập nhật tiến độ giao nhận.', summary: 'Nhận hàng và cập nhật vận đơn.' },
  Accountant: { icon: <WalletCards className="h-4 w-4" />, description: 'Theo dõi công nợ, hóa đơn, thanh toán và báo cáo chi nhánh.', summary: 'Quản lý công nợ và thanh toán.' },
}

const permissionByRole: Record<EmployeeRole, Record<PermissionGroup, string[]>> = {
  'Branch Manager': {
    Orders: ['Duyệt đơn mua của chi nhánh', 'Xem hàng đợi đơn mua'],
    RFQ: ['Quản lý RFQ của chi nhánh', 'So sánh báo giá nhà cung cấp'],
    Delivery: ['Theo dõi ngoại lệ giao nhận'],
    Debt: ['Xem rủi ro công nợ chi nhánh'],
    'Employee Management': ['Thêm và phân công nhân sự', 'Điều chỉnh quyền chi nhánh'],
  },
  Purchaser: {
    Orders: ['Tạo đơn mua', 'Theo dõi hoạt động nhà cung cấp'],
    RFQ: ['Tạo RFQ', 'So sánh báo giá'],
    Delivery: ['Xem tiến trình giao hàng'],
    Debt: [],
    'Employee Management': [],
  },
  QC: {
    Orders: ['Xem đơn mua của chi nhánh'],
    RFQ: [],
    Delivery: ['Kiểm tra lô hàng', 'Báo cáo sự cố', 'Xác nhận chất lượng nhận hàng'],
    Debt: [],
    'Employee Management': [],
  },
  'Warehouse Staff': {
    Orders: ['Xem đơn mua của chi nhánh'],
    RFQ: [],
    Delivery: ['Nhận hàng', 'Cập nhật trạng thái vận đơn', 'Báo thiếu hàng'],
    Debt: [],
    'Employee Management': [],
  },
  Accountant: {
    Orders: ['Kiểm tra trạng thái thanh toán'],
    RFQ: [],
    Delivery: [],
    Debt: ['Xem công nợ', 'Thanh toán hóa đơn', 'Xuất báo cáo'],
    'Employee Management': [],
  },
}

function normalizeEmployeeRole(role?: string | null): EmployeeRole {
  const value = String(role || '').replace(/_/g, ' ').toLowerCase()
  if (value.includes('manager') || value.includes('order staff')) return 'Branch Manager'
  if (value.includes('purchaser') || value.includes('purchase') || value.includes('sales')) return 'Purchaser'
  if (value === 'qc' || value.includes('quality')) return 'QC'
  if (value.includes('account')) return 'Accountant'
  return 'Warehouse Staff'
}

function permissionCount(role: EmployeeRole) {
  return Object.values(permissionByRole[role]).reduce((total, permissions) => total + permissions.length, 0)
}

function BranchEmployeeManagementDrawer({
  detail,
  onAdd,
  onInvite,
  onRefresh,
  onClose,
}: {
  detail: BuyerBranchDetail
  onAdd: () => void
  onInvite: () => void
  onRefresh: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const filteredStaff = detail.staff.filter((staff) => {
    const text = query.trim().toLowerCase()
    const status = String(staff.status || '').toLowerCase()
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? !status.includes('suspend') : status.includes('suspend'))
    const matchesText = !text || [staff.fullName, staff.email || '', staff.phone, staff.role].join(' ').toLowerCase().includes(text)
    return matchesStatus && matchesText
  })

  const refresh = () => {
    setRefreshing(true)
    setFeedback('Đã cập nhật danh sách nhân sự của chi nhánh.')
    onRefresh()
    window.setTimeout(() => {
      setRefreshing(false)
      setFeedback('')
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-sm" onClick={(event) => { event.stopPropagation(); onClose() }}>
      <aside className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-slate-50 shadow-[0_30px_90px_rgba(15,23,42,0.35)] transition-transform" onClick={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">Nhân sự chi nhánh</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Mã chi nhánh {detail.branch.rawId}</span>
              </div>
              <h3 className="mt-2 truncate text-2xl font-black text-slate-950">{detail.branch.name}</h3>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">{detail.branch.address}</p>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50" onClick={onClose} aria-label="Đóng quản lý nhân sự">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EmployeeTopAction icon={<Plus className="h-4 w-4" />} label="Thêm nhân viên" onClick={onAdd} primary />
            <EmployeeTopAction icon={<UserRound className="h-4 w-4" />} label="Mời nhân viên" onClick={onInvite} />
            <EmployeeTopAction icon={refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} label="Làm mới" onClick={refresh} />
            <EmployeeTopAction icon={<ShieldCheck className="h-4 w-4" />} label="Thiết lập quyền" onClick={() => setFeedback('Phân quyền đang áp dụng theo phạm vi chi nhánh này.')} />
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-white/90 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Tìm nhân viên, vai trò, số điện thoại, email..." />
            </label>
            {(['all', 'active', 'suspended'] as const).map((item) => (
              <button key={item} className={`h-10 rounded-xl px-3 text-xs font-black transition ${statusFilter === item ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setStatusFilter(item)}>
                {item === 'all' ? 'Tất cả nhân sự' : item === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}
              </button>
            ))}
          </div>
          {feedback ? <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{feedback}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <EmployeeMetric label="Tổng nhân sự" value={String(detail.staff.length)} />
            <EmployeeMetric label="Đang hoạt động" value={String(detail.staff.filter((staff) => !String(staff.status || '').toLowerCase().includes('suspend')).length)} />
            <EmployeeMetric label="Tạm ngưng" value={String(detail.staff.filter((staff) => String(staff.status || '').toLowerCase().includes('suspend')).length)} />
            <EmployeeMetric label="Độ phủ vai trò" value={`${new Set(detail.staff.map((staff) => normalizeEmployeeRole(staff.role))).size}/${employeeRoles.length}`} />
          </div>

          {filteredStaff.length ? (
            <div className="grid gap-3">
              {filteredStaff.map((staff) => <EmployeeCard key={staff.id} staff={staff} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center shadow-sm">
              <Users className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-sm font-black text-slate-900">Không có nhân sự phù hợp với bộ lọc.</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Thêm nhân viên mới hoặc mời người dùng hiện có vào chi nhánh.</p>
              <button className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" onClick={onAdd}>Thêm nhân viên đầu tiên</button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function EmployeeTopAction({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black shadow-sm transition hover:-translate-y-0.5 active:scale-95 ${primary ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'}`}>
      {icon}
      {label}
    </button>
  )
}

function EmployeeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function EmployeeCard({ staff }: { staff: BranchStaffMember }) {
  const role = normalizeEmployeeRole(staff.role)
  const suspended = String(staff.status || '').toLowerCase().includes('suspend')
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-base font-black text-white shadow-sm">
            {staff.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{staff.fullName}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{staff.email || 'Chưa có email'} - {staff.phone || 'Chưa có số điện thoại'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <EmployeeRoleBadge role={role} />
              <EmployeeStatusBadge suspended={suspended} />
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <EmployeeInfo label="Ngày tham gia" value={formatDate(staff.createdAt)} />
          <EmployeeInfo label="Quyền truy cập" value={`${permissionCount(role)} quyền`} />
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <SmallAction label="Hồ sơ" />
          <SmallAction label={suspended ? 'Kích hoạt' : 'Tạm ngưng'} />
          <SmallAction label="Phân quyền" />
        </div>
      </div>
    </article>
  )
}

function EmployeeInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-700">{value}</p>
    </div>
  )
}

function SmallAction({ label }: { label: string }) {
  return <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">{label}</button>
}

function EmployeeRoleBadge({ role }: { role: EmployeeRole }) {
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">{employeeRoleLabels[role]}</span>
}

function EmployeeStatusBadge({ suspended }: { suspended: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${suspended ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{suspended ? 'Tạm ngưng' : 'Đang hoạt động'}</span>
}

function EmployeeUpsertModal({
  mode,
  detail,
  onClose,
  onOptimisticStaff,
  onRollback,
  onDone,
}: {
  mode: 'add' | 'invite'
  detail: BuyerBranchDetail
  onClose: () => void
  onOptimisticStaff: (staff: BranchStaffMember) => void
  onRollback: (detail: BuyerBranchDetail) => void
  onDone: (detail: BuyerBranchDetail) => void
}) {
  const { showToast } = useToast()
  const [source, setSource] = useState<'existing' | 'new'>(mode === 'invite' ? 'existing' : 'new')
  const [query, setQuery] = useState('')
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<BranchStaffMember[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [availability, setAvailability] = useState({ emailTaken: false, phoneTaken: false })
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    temporaryPassword: generateTemporaryPassword(),
    role: 'Warehouse Staff' as EmployeeRole,
    status: mode === 'invite' ? 'PENDING_INVITE' : 'ACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const selectedRole = form.role
  const errors = validateEmployeeForm(form, availability)
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedExistingId) ?? null
  const disabledReason = source === 'existing'
    ? selectedExistingId ? '' : 'Chọn người dùng để phân công vào chi nhánh.'
    : Object.values(errors).find(Boolean) || ''
  const canSubmit = !saving && (source === 'existing' ? Boolean(selectedExistingId) : !disabledReason)

  useEffect(() => {
    if (source !== 'existing') return
    let cancelled = false
    setLoadingCandidates(true)
    const timer = window.setTimeout(() => {
      fetchBranchEmployeeCandidates(detail.branch.rawId, query)
        .then((items) => {
          if (!cancelled) {
            setCandidates(items)
            setSelectedExistingId((current) => current && items.some((item) => item.id === current) ? current : null)
          }
        })
        .catch((requestError) => {
          if (!cancelled) showToast(readApiErrorMessage(requestError) || 'Không thể tải danh sách người dùng.', 'error')
        })
        .finally(() => {
          if (!cancelled) setLoadingCandidates(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [detail.branch.rawId, query, source, showToast])

  useEffect(() => {
    if (source !== 'new') return
    const email = form.email.trim()
    const phone = form.phone.trim()
    if (!email && !phone) {
      setAvailability({ emailTaken: false, phoneTaken: false })
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      checkBranchEmployeeAvailability(email, phone)
        .then((result) => {
          if (!cancelled) setAvailability(result)
        })
        .catch(() => {
          if (!cancelled) setAvailability({ emailTaken: false, phoneTaken: false })
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.email, form.phone, source])

  const update = (key: keyof typeof form, value: string) => {
    setSubmitError('')
    setForm((current) => ({ ...current, [key]: value }))
  }

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.temporaryPassword)
      showToast('Đã sao chép mật khẩu tạm thời.', 'success')
    } catch {
      showToast('Không thể sao chép mật khẩu trên trình duyệt này.', 'error')
    }
  }

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setSubmitError('')
    const optimisticId = -Date.now()
    try {
      const optimisticStaff: BranchStaffMember | null = source === 'new'
        ? {
            id: optimisticId,
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: form.role,
            status: form.status,
            createdAt: new Date().toISOString(),
          }
        : selectedCandidate ? { ...selectedCandidate, role: form.role, status: form.status } : null
      if (optimisticStaff) onOptimisticStaff(optimisticStaff)

      const saved = source === 'existing'
        ? await assignBranchEmployee(detail.branch.rawId, { userId: selectedExistingId as number, role: form.role, status: form.status })
        : await createBranchEmployee(detail.branch.rawId, {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            temporaryPassword: form.temporaryPassword,
            role: form.role,
            status: form.status,
            inviteOnly: mode === 'invite' || form.status === 'PENDING_INVITE',
          })
      onOptimisticStaff(saved)
      const nextDetail = await fetchBuyerBranch(detail.branch.rawId)
      showToast(source === 'existing' ? 'Đã gán nhân viên vào chi nhánh.' : 'Đã tạo nhân viên và lưu phân quyền chi nhánh.', 'success')
      onDone(nextDetail)
    } catch (requestError) {
      void fetchBuyerBranch(detail.branch.rawId).then(onRollback).catch(() => undefined)
      setSubmitError(readApiErrorMessage(requestError) || 'Không thể lưu nhân viên chi nhánh.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={(event) => { event.stopPropagation(); onClose() }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-slate-950 via-emerald-800 to-teal-600 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/60">{detail.branch.name}</p>
              <h3 className="text-xl font-black">{mode === 'invite' ? 'Mời nhân viên' : 'Thêm nhân viên'}</h3>
              <p className="mt-0.5 text-xs font-semibold text-white/70">Phân công nhân sự được lưu theo mã chi nhánh {detail.branch.rawId}.</p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white" onClick={onClose} aria-label="Đóng biểu mẫu nhân viên"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {submitError ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{submitError}</p> : null}
          <div className="mb-4 inline-flex rounded-full border border-emerald-100 bg-emerald-50 p-1">
            <button className={`rounded-full px-4 py-2 text-xs font-black ${source === 'existing' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700'}`} onClick={() => setSource('existing')}>Chọn người dùng có sẵn</button>
            <button className={`rounded-full px-4 py-2 text-xs font-black ${source === 'new' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700'}`} onClick={() => setSource('new')}>Tạo nhân viên mới</button>
          </div>

          {source === 'existing' ? (
            <div className="space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Tìm theo tên, email, số điện thoại..." />
              </label>
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {loadingCandidates ? <p className="p-4 text-center text-sm font-semibold text-emerald-700">Đang tải người dùng có thể phân công...</p> : null}
                {!loadingCandidates && candidates.length ? candidates.map((staff) => (
                  <button key={staff.id} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedExistingId === staff.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-100'}`} onClick={() => setSelectedExistingId(staff.id)}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">{staff.fullName.charAt(0)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-900">{staff.fullName}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{staff.email || 'Chưa có email'} - {staff.phone || 'Chưa có số điện thoại'}</span>
                      <span className="mt-1 block text-[11px] font-bold text-emerald-700">{roleDetails[normalizeEmployeeRole(staff.role)].summary}</span>
                    </span>
                    <EmployeeRoleBadge role={normalizeEmployeeRole(staff.role)} />
                  </button>
                )) : null}
                {!loadingCandidates && !candidates.length ? <p className="p-4 text-center text-sm font-semibold text-slate-500">Không có người dùng phù hợp với tìm kiếm.</p> : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <EmployeeFormField label="Họ và tên" value={form.fullName} onChange={(value) => update('fullName', value)} error={errors.fullName} />
              <EmployeeFormField label="Email" value={form.email} onChange={(value) => update('email', value)} error={errors.email} icon={<Mail className="h-4 w-4" />} />
              <EmployeeFormField label="Phone" value={form.phone} onChange={(value) => update('phone', value)} error={errors.phone} />
              <div>
                <EmployeeFormField label="Mật khẩu tạm thời" value={form.temporaryPassword} onChange={(value) => update('temporaryPassword', value)} error={errors.temporaryPassword} icon={<KeyRound className="h-4 w-4" />} />
                <div className="mt-2 flex gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50" type="button" onClick={() => update('temporaryPassword', generateTemporaryPassword())}>
                    <KeyRound className="h-3.5 w-3.5" />
                    Tạo lại
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100" type="button" onClick={() => void copyPassword()}>
                    <Copy className="h-3.5 w-3.5" />
                    Sao chép
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Vai trò</span>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {employeeRoles.map((role) => (
                  <button type="button" key={role} onClick={() => update('role', role)} className={`rounded-2xl border p-3 text-left transition ${selectedRole === role ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                    <span className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="text-emerald-600">{roleDetails[role].icon}</span>{employeeRoleLabels[role]}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{roleDetails[role].description}</span>
                    <span className="mt-2 block text-[11px] font-black uppercase text-emerald-700">{permissionCount(role)} quyền</span>
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Trạng thái</span>
              <select value={form.status} onChange={(event) => update('status', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-300">
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="PENDING_INVITE">Chờ nhận lời mời</option>
                <option value="SUSPENDED">Tạm ngưng</option>
              </select>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{form.status === 'PENDING_INVITE' ? 'Tài khoản sẽ hoạt động sau khi nhân viên đăng nhập bằng mật khẩu tạm thời.' : 'Trạng thái này được lưu cùng phân công chi nhánh.'}</span>
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Xem trước phân quyền</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {(Object.keys(permissionByRole[form.role]) as PermissionGroup[]).map((group) => (
                <div key={group} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-black uppercase text-slate-500">{permissionGroupLabels[group]}</p>
                  {permissionByRole[form.role][group].length ? (
                    permissionByRole[form.role][group].map((permission) => <p key={permission} className="mt-1 text-xs font-bold text-emerald-800">{permission}</p>)
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-slate-400">Không có quyền</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3">
          <p className="text-xs font-bold text-slate-500">{disabledReason || `Phân công vào ${detail.branch.name}`}</p>
          <div className="flex gap-2">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600" onClick={onClose}>Hủy</button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:bg-slate-300" disabled={!canSubmit || saving} onClick={() => void submit()} title={disabledReason || undefined}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Đang lưu...' : source === 'existing' ? 'Phân công nhân viên' : 'Tạo nhân viên'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeFormField({
  label,
  value,
  onChange,
  type = 'text',
  error,
  icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  error?: string
  icon?: React.ReactNode
}) {
  return (
    <label>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative mt-1 block">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span> : null}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 ${icon ? 'pl-9' : ''} ${error ? 'border-red-200 focus:ring-red-100' : 'border-slate-200'}`} />
      </span>
      {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : null}
    </label>
  )
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const symbols = '!@#$'
  const bytes = new Uint32Array(12)
  window.crypto.getRandomValues(bytes)
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${body}${symbols[bytes[0] % symbols.length]}7`
}

function validateEmployeeForm(form: { fullName: string; email: string; phone: string; temporaryPassword: string }, availability: { emailTaken: boolean; phoneTaken: boolean }) {
  const email = form.email.trim()
  const phone = form.phone.trim()
  return {
    fullName: form.fullName.trim().length >= 2 ? '' : 'Họ và tên cần có ít nhất 2 ký tự.',
    email: !email
      ? 'Email is required.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Enter a valid email address.'
        : availability.emailTaken
          ? 'This email is already used by another account.'
          : '',
    phone: !phone
      ? 'Phone is required.'
      : !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(phone.replace(/[^\d+]/g, ''))
        ? 'Enter a valid Vietnamese phone number.'
        : availability.phoneTaken
          ? 'This phone is already used by another account.'
          : '',
    temporaryPassword: form.temporaryPassword.trim().length >= 8 ? '' : 'Mật khẩu tạm thời cần có ít nhất 8 ký tự.',
  }
}

function BranchTypeBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">{label}</span>
}

function OperationalMetric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'emerald' | 'blue' | 'amber' | 'slate' }) {
  const classes = tone === 'emerald'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-800'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50 text-amber-800'
        : 'border-slate-100 bg-slate-50 text-slate-700'
  return (
    <div className={`rounded-xl border p-3 ${classes}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold opacity-70">{hint}</p>
    </div>
  )
}

function HealthIndicator({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}


function DetailInfo({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700">
      <span className="text-slate-400">{label}:</span> {value || '--'}
    </p>
  )
}

function DetailList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-black text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">
        {hasChildren ? children : <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">{empty}</p>}
      </div>
    </section>
  )
}
