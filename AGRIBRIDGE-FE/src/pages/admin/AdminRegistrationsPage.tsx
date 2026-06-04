import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Hourglass,
  Info,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  approveRegistrationProfile,
  fetchRegistrationProfiles,
  reopenRegistrationProfile,
  rejectRegistrationProfile,
  requestMoreInfoForRegistration,
} from '../../services/adminService'
import { canOpenUploadedFile, resolveUploadedFileUrl } from '../../services/uploadService'
import type {
  AdminRegistrationActionRequest,
  AdminRegistrationProfile,
  AdminRegistrationStatus,
} from '../../types/admin'

/* ─── types / consts ────────────────────────────────────────── */
type ActionMode = 'need-more-info' | 'reject' | null
type ActionFormState = { reasonCodes: string[]; note: string; sendEmail: boolean; sendNotification: boolean }
type RegistrationTabKey = 'PENDING' | 'NEED_MORE_INFO' | 'REJECTED' | 'APPROVED'

const registrationTabs: Array<{ key: RegistrationTabKey; label: string }> = [
  { key: 'PENDING',        label: 'Chờ duyệt'       },
  { key: 'NEED_MORE_INFO', label: 'Yêu cầu bổ sung' },
  { key: 'REJECTED',       label: 'Đã từ chối'       },
  { key: 'APPROVED',       label: 'Đã duyệt'         },
]

const needMoreInfoReasons = [
  { code: 'missing_documents',              label: 'Thiếu giấy tờ bắt buộc'            },
  { code: 'blurred_documents',              label: 'Giấy tờ không rõ nét'              },
  { code: 'incorrect_company_information',  label: 'Sai thông tin doanh nghiệp'         },
  { code: 'missing_company_images',         label: 'Thiếu ảnh doanh nghiệp'            },
  { code: 'missing_contact_information',    label: 'Cần bổ sung thông tin liên hệ'     },
  { code: 'missing_verification_description', label: 'Cần bổ sung mô tả / thông tin xác minh' },
  { code: 'other',                          label: 'Khác'                               },
]

const rejectionReasons = [
  { code: 'fraudulent_documents',    label: 'Giấy tờ giả / không hợp lệ'            },
  { code: 'dishonest_information',   label: 'Thông tin không trung thực'             },
  { code: 'duplicate_company',       label: 'Doanh nghiệp đã tồn tại trong hệ thống' },
  { code: 'duplicate_registration',  label: 'Hồ sơ đăng ký trùng lặp'               },
  { code: 'not_qualified',           label: 'Không đủ điều kiện tham gia'            },
  { code: 'policy_violation',        label: 'Vi phạm chính sách nền tảng'            },
  { code: 'other',                   label: 'Khác'                                   },
]

const statusConfig: Record<AdminRegistrationStatus, {
  label: string; badge: string; dot: string; cardRing: string; strip: string
}> = {
  PENDING:        { label: 'Chờ duyệt',        badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   cardRing: 'ring-amber-300',   strip: 'from-amber-400 to-orange-400'  },
  PENDING_REVIEW: { label: 'Chờ duyệt',        badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   cardRing: 'ring-amber-300',   strip: 'from-amber-400 to-orange-400'  },
  DRAFT:          { label: 'Nháp',             badge: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-500',   cardRing: 'ring-slate-300',   strip: 'from-slate-400 to-slate-500'   },
  NEED_MORE_INFO: { label: 'Yêu cầu bổ sung',  badge: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500',     cardRing: 'ring-sky-300',     strip: 'from-sky-400 to-blue-500'      },
  NEEDS_MORE_INFO:{ label: 'Yêu cầu bổ sung',  badge: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500',     cardRing: 'ring-sky-300',     strip: 'from-sky-400 to-blue-500'      },
  REJECTED:       { label: 'Đã từ chối',        badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     cardRing: 'ring-red-300',     strip: 'from-red-400 to-rose-500'      },
  APPROVED:       { label: 'Đã duyệt',          badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', cardRing: 'ring-emerald-300', strip: 'from-emerald-400 to-teal-500' },
  AUTO_APPROVED:  { label: 'Tự động duyệt',     badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', cardRing: 'ring-emerald-300', strip: 'from-emerald-400 to-teal-500' },
  MANUAL_APPROVED:{ label: 'Admin duyệt',       badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', cardRing: 'ring-emerald-300', strip: 'from-emerald-400 to-teal-500' },
}

const companyTypeLabel: Record<string, string> = { supplier: 'Nhà cung cấp', buyer: 'Nhà buôn' }
const businessTypeLabel: Record<string, string> = { business: 'Doanh nghiệp', individual: 'Cá nhân' }

function createInitialActionState(sel?: AdminRegistrationProfile | null): ActionFormState {
  return { reasonCodes: sel?.reasonCodes ?? [], note: sel?.verificationNote ?? '', sendEmail: false, sendNotification: true }
}

function humanizeReasonCode(code: string): string {
  return code.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function getAdminUserId(): number | undefined {
  const raw = localStorage.getItem('agribridge.auth.userId')
  if (!raw) return undefined
  const v = Number(raw)
  return Number.isFinite(v) && v > 0 ? v : undefined
}

function statusInGroup(status: AdminRegistrationStatus, group: AdminRegistrationStatus): boolean {
  if (group === 'PENDING') return status === 'PENDING' || status === 'PENDING_REVIEW' || status === 'DRAFT'
  if (group === 'NEED_MORE_INFO') return status === 'NEED_MORE_INFO' || status === 'NEEDS_MORE_INFO'
  if (group === 'APPROVED') return status === 'APPROVED' || status === 'AUTO_APPROVED' || status === 'MANUAL_APPROVED'
  return status === group
}

function buildPreviewMessage(mode: ActionMode, sel: AdminRegistrationProfile | null, form: ActionFormState) {
  const name = sel?.companyName || 'Doanh nghiệp của bạn'
  const title = mode === 'reject' ? 'Thông báo từ chối hồ sơ' : 'Yêu cầu bổ sung hồ sơ'
  const reasons = form.reasonCodes.map(humanizeReasonCode)
  const reasonText = reasons.length > 0 ? `Lý do: ${reasons.join(', ')}.` : ''
  const noteText = form.note.trim() ? `\nChi tiết: ${form.note.trim()}` : ''
  return `${title}\n${name}\n${reasonText}${noteText}`.trim()
}

/* ─── skeleton ───────────────────────────────────────────────── */
function Pulse({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className ?? ''}`}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',
          animation: 'shimmer 1.6s infinite',
        }}
      />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-slate-100 bg-white p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
          <Pulse className="h-3 w-24" />
          <Pulse className="h-3 w-40" />
          <Pulse className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/* ─── main page ─────────────────────────────────────────────── */
export function AdminRegistrationsPage() {
  usePageTitle('Duyệt hồ sơ đăng ký')
  const [activeStatus, setActiveStatus] = useState<AdminRegistrationStatus>('PENDING')
  const [query, setQuery]               = useState('')
  const [profiles, setProfiles]         = useState<AdminRegistrationProfile[]>([])
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  const [reloadKey, setReloadKey]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [actionLoading, setActionLoading] = useState<'approve' | 'need-more-info' | 'reject' | 'reopen' | null>(null)
  const [actionMode, setActionMode]     = useState<ActionMode>(null)
  const [actionForm, setActionForm]     = useState<ActionFormState>(createInitialActionState())
  const [approveTarget, setApproveTarget] = useState<AdminRegistrationProfile | null>(null)

  /* load */
  useEffect(() => {
    let active = true
    const tid = window.setTimeout(async () => {
      try {
        setLoading(true); setError('')
        const payload = await fetchRegistrationProfiles(activeStatus, query)
        if (!active) return
        setProfiles(payload)
        setSelectedId((cur) => {
          if (cur && payload.some((p) => p.companyId === cur)) return cur
          return payload[0]?.companyId ?? null
        })
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Không tải được danh sách hồ sơ.')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => { active = false; window.clearTimeout(tid) }
  }, [activeStatus, query, reloadKey])

  const selected = useMemo(
    () => profiles.find((p) => p.companyId === selectedId) ?? profiles[0] ?? null,
    [profiles, selectedId]
  )

  function openActionModal(mode: Exclude<ActionMode, null>) {
    setActionMode(mode); setActionForm(createInitialActionState(selected))
  }
  function closeActionModal() { setActionMode(null); setActionForm(createInitialActionState(selected)) }

  function syncAfterMutation(updated: AdminRegistrationProfile) {
    setProfiles((cur) => {
      if (!statusInGroup(updated.verificationStatus, activeStatus)) return cur.filter((p) => p.companyId !== updated.companyId)
      const exists = cur.some((p) => p.companyId === updated.companyId)
      return exists ? cur.map((p) => (p.companyId === updated.companyId ? updated : p)) : [updated, ...cur]
    })
    setSelectedId(statusInGroup(updated.verificationStatus, activeStatus) ? updated.companyId : null)
  }

  async function handleApprove(profile: AdminRegistrationProfile) {
    try {
      setActionLoading('approve'); setError('')
      const updated = await approveRegistrationProfile(profile.companyId, {
        adminUserId: getAdminUserId(), sendEmail: false, sendNotification: true,
      })
      syncAfterMutation(updated)
      setReloadKey((c) => c + 1)
      setApproveTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không phê duyệt được hồ sơ.')
    } finally { setActionLoading(null) }
  }

  async function handleReopen() {
    if (!selected) return
    try {
      setActionLoading('reopen'); setError('')
      const updated = await reopenRegistrationProfile(selected.companyId, {
        adminUserId: getAdminUserId(), note: 'Admin mở lại hồ sơ để xét duyệt lại.', sendEmail: false, sendNotification: true,
      })
      syncAfterMutation(updated); setReloadKey((c) => c + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không mở lại được hồ sơ.')
    } finally { setActionLoading(null) }
  }

  async function submitActionModal() {
    if (!selected || !actionMode) return
    if (actionForm.reasonCodes.length === 0 && !actionForm.note.trim()) {
      setError('Vui lòng chọn ít nhất một lý do hoặc nhập ghi chú.'); return
    }
    const payload: AdminRegistrationActionRequest = {
      adminUserId: getAdminUserId(),
      reasonCodes: actionForm.reasonCodes,
      note: actionForm.note,
      sendEmail: actionForm.sendEmail,
      sendNotification: actionForm.sendNotification,
    }
    try {
      setActionLoading(actionMode); setError('')
      const updated = actionMode === 'need-more-info'
        ? await requestMoreInfoForRegistration(selected.companyId, payload)
        : await rejectRegistrationProfile(selected.companyId, payload)
      syncAfterMutation(updated); setReloadKey((c) => c + 1); closeActionModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xử lý được hồ sơ.')
    } finally { setActionLoading(null) }
  }

  /* counts per tab */
  const tabCounts: Record<RegistrationTabKey, number> = useMemo(() => ({
    PENDING:        profiles.filter((p) => statusInGroup(p.verificationStatus, 'PENDING')).length,
    NEED_MORE_INFO: profiles.filter((p) => statusInGroup(p.verificationStatus, 'NEED_MORE_INFO')).length,
    REJECTED:       profiles.filter((p) => p.verificationStatus === 'REJECTED').length,
    APPROVED:       profiles.filter((p) => statusInGroup(p.verificationStatus, 'APPROVED')).length,
  }), [profiles])

  const statCards = [
    { label: 'Chờ duyệt',        gradient: 'from-amber-500 to-orange-500', icon: <Hourglass className="h-5 w-5 text-white" />,     key: 'PENDING'        as RegistrationTabKey },
    { label: 'Cần bổ sung',      gradient: 'from-sky-500 to-blue-600',     icon: <Info className="h-5 w-5 text-white" />,           key: 'NEED_MORE_INFO' as RegistrationTabKey },
    { label: 'Đã duyệt',         gradient: 'from-emerald-500 to-teal-600', icon: <CheckCircle2 className="h-5 w-5 text-white" />,   key: 'APPROVED'       as RegistrationTabKey },
    { label: 'Đã từ chối',       gradient: 'from-red-500 to-rose-600',     icon: <ShieldOff className="h-5 w-5 text-white" />,      key: 'REJECTED'       as RegistrationTabKey },
  ]

  const reasonOptions = actionMode === 'reject' ? rejectionReasons : needMoreInfoReasons
  const modalTitle    = actionMode === 'reject' ? 'Từ chối hồ sơ' : 'Yêu cầu bổ sung hồ sơ'
  const modalSubmit   = actionMode === 'reject' ? 'Xác nhận từ chối' : 'Gửi yêu cầu bổ sung'
  const modalPreview  = buildPreviewMessage(actionMode, selected, actionForm)

  return (
    <AdminShell
      activeKey="registrations"
      title="Duyệt hồ sơ đăng ký"
      subtitle="Xử lý toàn bộ hồ sơ doanh nghiệp trước khi hoàn tất onboarding"
    >
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.93) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        {/* ── Stat cards ─────────────────────────────────────────── */}
        {!loading && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card, i) => (
              <button
                key={card.key}
                onClick={() => setActiveStatus(card.key)}
                className={`flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 shadow-sm transition-all hover:shadow-md text-left ${
                  activeStatus === card.key
                    ? 'border-transparent ring-2 ring-emerald-400/50 shadow-md'
                    : 'border-slate-200 bg-white'
                }`}
                style={{ animation: `fadeInUp 0.35s ease ${i * 55}ms both` }}
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow`}>
                  {card.icon}
                </span>
                <div>
                  <p className="text-xl font-extrabold text-slate-900">{tabCounts[card.key]}</p>
                  <p className="text-xs text-slate-400">{card.label}</p>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* ── Main panel ─────────────────────────────────────────── */}
        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ animation: 'fadeInUp 0.4s ease 220ms both' }}
        >
          {/* Header */}
          <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Hồ sơ đăng ký doanh nghiệp</h2>
                <p className="mt-0.5 text-xs text-slate-400">Theo dõi các hồ sơ đang chờ duyệt, cần bổ sung hoặc đã xử lý.</p>
              </div>
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm doanh nghiệp, email, SĐT..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            {/* Filter tabs */}
            <div className="mt-3.5 flex flex-wrap gap-2">
              {registrationTabs.map((tab) => {
                const active = tab.key === activeStatus
                const sc = statusConfig[tab.key]
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveStatus(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/70' : sc.dot}`} />
                    {tab.label}
                    <span className={`min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-white text-slate-600 shadow-sm'
                    }`}>
                      {tabCounts[tab.key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </header>

          {/* Error */}
          {error && !actionMode && (
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Body: 2 columns */}
          <div className="grid min-h-[560px] xl:grid-cols-[320px_1fr]">
            {/* Left: list */}
            <aside className="border-r border-slate-100 bg-slate-50/50">
              <div className="max-h-[680px] overflow-y-auto">
                {loading && <ListSkeleton />}

                {!loading && profiles.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                      <ClipboardCheck className="h-7 w-7 text-slate-400" />
                    </span>
                    <p className="mt-4 text-sm font-bold text-slate-500">Không có hồ sơ nào</p>
                    <p className="mt-1 text-xs text-slate-400">Thử chuyển sang tab khác</p>
                  </div>
                )}

                {!loading && profiles.length > 0 && (
                  <div className="space-y-2 p-3">
                    {profiles.map((profile, idx) => {
                      const isActive = selected?.companyId === profile.companyId
                      const sc = statusConfig[profile.verificationStatus]
                      return (
                        <button
                          key={profile.companyId}
                          onClick={() => setSelectedId(profile.companyId)}
                          className={`w-full rounded-xl border-2 p-3.5 text-left transition-all duration-200 hover:shadow-sm ${
                            isActive
                              ? `${sc.cardRing} ring-2 bg-white shadow-md border-transparent`
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                          style={{ animation: `fadeInUp 0.3s ease ${idx * 40}ms both` }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-extrabold text-slate-900" title={profile.companyName}>
                                {profile.companyName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {companyTypeLabel[profile.companyType]} · {businessTypeLabel[profile.businessType]}
                              </p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <div className="mt-2.5 space-y-1">
                            <p className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-semibold">{profile.ownerName}</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Mail className="h-3 w-3" /> {profile.email || 'Chưa có email'}
                            </p>
                            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Phone className="h-3 w-3" /> {profile.phone}
                            </p>
                          </div>
                          <p className="mt-2 text-[10px] text-slate-300">Đăng ký: {profile.createdAt || 'N/A'}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Right: detail */}
            <section className="overflow-y-auto">
              {!selected ? (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200">
                    <Eye className="h-8 w-8 text-slate-400" />
                  </span>
                  <p className="font-bold text-slate-500">Chọn một hồ sơ để xem chi tiết</p>
                  <p className="text-xs text-slate-400">Nhấn vào một hồ sơ ở danh sách bên trái</p>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Status strip + title */}
                  <div className={`overflow-hidden rounded-2xl border-2 ${statusConfig[selected.verificationStatus].cardRing} ring-2`}>
                    <div className={`h-1.5 w-full bg-gradient-to-r ${statusConfig[selected.verificationStatus].strip}`} />
                    <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-slate-50 to-white p-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusConfig[selected.verificationStatus].badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[selected.verificationStatus].dot}`} />
                            {statusConfig[selected.verificationStatus].label}
                          </span>
                          <span className="text-xs text-slate-400">Hồ sơ #{selected.id}</span>
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900">{selected.companyName}</h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {companyTypeLabel[selected.companyType]} · {businessTypeLabel[selected.businessType]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InfoCard title="Thông tin doanh nghiệp" icon={<Building2 className="h-4 w-4 text-white" />} gradient="from-emerald-500 to-teal-600">
                      <InfoRow label="Tên doanh nghiệp" value={selected.companyName} />
                      <InfoRow label="Người đại diện"   value={selected.ownerName} />
                      <InfoRow label="Loại doanh nghiệp" value={companyTypeLabel[selected.companyType]} />
                      <InfoRow label="Hình thức"         value={businessTypeLabel[selected.businessType]} />
                      <InfoRow label="Mã số thuế"        value={selected.taxCode || 'Chưa cung cấp'} />
                      <InfoRow label="Số đăng ký"        value={selected.registrationNumber || 'Chưa cung cấp'} />
                      <InfoRow label="CCCD / CMND"       value={selected.citizenId || 'Chưa cung cấp'} />
                      <InfoRow label="Địa chỉ"           value={selected.address} />
                      <InfoRow label="Tỉnh / Thành"      value={selected.province} />
                      <InfoRow label="Quận / Huyện"      value={selected.district || 'Chưa cung cấp'} />
                      {selected.description && <InfoRow label="Mô tả" value={selected.description} />}
                    </InfoCard>

                    <InfoCard title="Thông tin liên hệ & xử lý" icon={<Mail className="h-4 w-4 text-white" />} gradient="from-violet-500 to-purple-600">
                      <InfoRow label="Họ tên tài khoản" value={selected.fullName} />
                      <InfoRow label="Vai trò"          value={selected.role} />
                      <InfoRow label="Email"             value={selected.email || 'Chưa cung cấp'} />
                      <InfoRow label="Số điện thoại"    value={selected.phone} />
                      <InfoRow label="Ngày đăng ký"     value={selected.createdAt || 'N/A'} />
                      <InfoRow label="Người xử lý"      value={selected.lastProcessedByName || 'Chưa có'} />
                      <InfoRow label="Thời gian xử lý"  value={selected.lastProcessedAt || 'Chưa có'} />
                      {typeof selected.verificationScore === 'number' && <InfoRow label="Điểm xác minh" value={`${selected.verificationScore}/100`} />}
                      {selected.verificationReason && <InfoRow label="Lý do scoring" value={selected.verificationReason} />}
                      {selected.verificationNote && <InfoRow label="Ghi chú" value={selected.verificationNote} />}
                    </InfoCard>
                  </div>

                  {/* Documents + Images */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Documents */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-800">Giấy tờ đã upload</h4>
                      </div>
                      <div className="p-4">
                        {selected.documents.length > 0 ? (
                          <div className="space-y-2.5">
                            {selected.documents.map((doc) => (
                              <div key={doc.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-slate-800">{doc.fileName}</p>
                                  <p className="mt-0.5 text-[10px] text-slate-400">Upload lúc {doc.uploadedAt || 'N/A'}</p>
                                  {canOpenUploadedFile(doc.fileUrl) ? (
                                    <a
                                      href={resolveUploadedFileUrl(doc.fileUrl) ?? undefined}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline"
                                    >
                                      <Eye className="h-3 w-3" /> Xem tệp
                                    </a>
                                  ) : (
                                    <p className="mt-1.5 text-[11px] font-medium text-amber-600">Tệp cũ không khả dụng.</p>
                                  )}
                                </div>
                                <FileText className="h-4 w-4 shrink-0 text-slate-300" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Chưa có giấy tờ nào.</p>
                        )}
                      </div>
                    </div>

                    {/* Images */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
                          <Building2 className="h-3.5 w-3.5 text-white" />
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-800">Ảnh doanh nghiệp / Logo</h4>
                      </div>
                      <div className="p-4">
                        {selected.companyImages.length > 0 ? (
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {selected.companyImages.map((imgUrl) => {
                              const resolved = resolveUploadedFileUrl(imgUrl)
                              return resolved ? (
                                <img
                                  key={imgUrl}
                                  src={resolved}
                                  alt="Ảnh doanh nghiệp"
                                  className="h-32 w-full rounded-xl border border-slate-200 object-cover transition hover:opacity-90"
                                />
                              ) : (
                                <div
                                  key={imgUrl}
                                  className="flex h-32 items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 text-center text-[11px] font-medium text-amber-700"
                                >
                                  Ảnh không khả dụng. Upload lại.
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Chưa có ảnh doanh nghiệp.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reason codes */}
                  {selected.reasonCodes.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Lý do gần nhất</p>
                      <div className="flex flex-wrap gap-2">
                        {selected.reasonCodes.map((code) => (
                          <span key={code} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm border border-amber-200">
                            {humanizeReasonCode(code)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex flex-wrap justify-end gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                    {(statusInGroup(selected.verificationStatus, 'PENDING') || statusInGroup(selected.verificationStatus, 'NEED_MORE_INFO')) && (
                      <>
                        <ActionBtn
                          icon={Check}
                          gradient="from-emerald-500 to-teal-600"
                          onClick={() => setApproveTarget(selected)}
                          disabled={actionLoading !== null}
                          loading={actionLoading === 'approve'}
                        >
                          Phê duyệt
                        </ActionBtn>
                        <ActionBtn
                          icon={Mail}
                          outline="sky"
                          onClick={() => openActionModal('need-more-info')}
                          disabled={actionLoading !== null}
                        >
                          {statusInGroup(selected.verificationStatus, 'NEED_MORE_INFO') ? 'Cập nhật yêu cầu' : 'Yêu cầu bổ sung'}
                        </ActionBtn>
                        <ActionBtn
                          icon={X}
                          outline="red"
                          onClick={() => openActionModal('reject')}
                          disabled={actionLoading !== null}
                        >
                          Từ chối
                        </ActionBtn>
                      </>
                    )}

                    {selected.verificationStatus === 'REJECTED' && (
                      <>
                        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Hồ sơ đã bị từ chối. Có thể mở lại nếu muốn xét duyệt lại.
                        </div>
                        <ActionBtn
                          icon={RotateCcw}
                          outline="amber"
                          onClick={handleReopen}
                          disabled={actionLoading !== null}
                          loading={actionLoading === 'reopen'}
                        >
                          Mở lại hồ sơ
                        </ActionBtn>
                      </>
                    )}

                    {statusInGroup(selected.verificationStatus, 'APPROVED') && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Hồ sơ đã được phê duyệt thành công.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>

      {/* ── Approve confirm modal ────────────────────────────────── */}
      {approveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setApproveTarget(null) }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ animation: 'modalIn 0.25s cubic-bezier(.34,1.56,.64,1) both' }}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                  <Check className="h-5 w-5 text-emerald-600" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Phê duyệt hồ sơ?</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Phê duyệt hồ sơ <span className="font-bold text-slate-800">"{approveTarget.companyName}"</span>?
                    Doanh nghiệp sẽ được kích hoạt và truy cập đầy đủ vào nền tảng.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setApproveTarget(null)}
                  disabled={actionLoading === 'approve'}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={() => void handleApprove(approveTarget)}
                  disabled={actionLoading === 'approve'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {actionLoading === 'approve' ? 'Đang duyệt...' : 'Xác nhận duyệt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Action modal (reject / need-more-info) ───────────────── */}
      {actionMode && (
        <ActionModal
          title={modalTitle}
          submitLabel={modalSubmit}
          danger={actionMode === 'reject'}
          options={reasonOptions}
          form={actionForm}
          preview={modalPreview}
          loading={actionLoading === actionMode}
          warning={
            actionMode === 'reject'
              ? 'Hành động này sẽ buộc người dùng đăng ký lại bằng hồ sơ mới.'
              : 'Hồ sơ sẽ chuyển sang trạng thái cần bổ sung để người dùng cập nhật.'
          }
          onClose={closeActionModal}
          onSubmit={submitActionModal}
          onToggleReason={(code) =>
            setActionForm((c) => ({
              ...c,
              reasonCodes: c.reasonCodes.includes(code)
                ? c.reasonCodes.filter((r) => r !== code)
                : [...c.reasonCodes, code],
            }))
          }
          onChangeNote={(note) => setActionForm((c) => ({ ...c, note }))}
          onToggleSendEmail={() => setActionForm((c) => ({ ...c, sendEmail: !c.sendEmail }))}
          onToggleSendNotification={() => setActionForm((c) => ({ ...c, sendNotification: !c.sendNotification }))}
        />
      )}
    </AdminShell>
  )
}

/* ─── ActionBtn ──────────────────────────────────────────────── */
function ActionBtn({
  icon: Icon, children, onClick, gradient, outline, disabled, loading = false,
}: {
  icon: LucideIcon; children: ReactNode; onClick: () => void
  gradient?: string; outline?: 'sky' | 'red' | 'amber'; disabled?: boolean; loading?: boolean
}) {
  const cls = gradient
    ? `bg-gradient-to-r ${gradient} text-white shadow-sm hover:brightness-110`
    : outline === 'sky'   ? 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
    : outline === 'red'   ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : outline === 'amber' ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
    : ''
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${cls}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}

/* ─── ActionModal ────────────────────────────────────────────── */
function ActionModal({
  title, submitLabel, warning, options, form, preview, danger, loading,
  onClose, onSubmit, onToggleReason, onChangeNote, onToggleSendEmail, onToggleSendNotification,
}: {
  title: string; submitLabel: string; warning: string
  options: Array<{ code: string; label: string }>
  form: ActionFormState; preview: string; danger: boolean; loading: boolean
  onClose: () => void; onSubmit: () => void
  onToggleReason: (code: string) => void
  onChangeNote: (v: string) => void
  onToggleSendEmail: () => void
  onToggleSendNotification: () => void
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn); return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20"
        style={{ animation: 'modalIn 0.28s cubic-bezier(.34,1.56,.64,1) both' }}
      >
        {/* Strip */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${danger ? 'from-red-400 to-rose-500' : 'from-sky-400 to-blue-500'}`} />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${danger ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-sky-500 to-blue-600'}`}>
              {danger ? <X className="h-4 w-4 text-white" /> : <Mail className="h-4 w-4 text-white" />}
            </span>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Warning */}
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${danger ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {warning}
          </div>

          {/* Reason checkboxes */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Lý do mẫu</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((opt) => {
                const checked = form.reasonCodes.includes(opt.code)
                return (
                  <label
                    key={opt.code}
                    className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 text-sm transition ${
                      checked ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleReason(opt.code)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="font-medium text-slate-700">{opt.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Ghi chú chi tiết</label>
            <textarea
              value={form.note}
              onChange={(e) => onChangeNote(e.target.value)}
              rows={4}
              placeholder="Nhập hướng dẫn chi tiết hoặc lý do xử lý..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* Send options */}
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Gửi email thông báo', checked: form.sendEmail, toggle: onToggleSendEmail },
              { label: 'Gửi thông báo app', checked: form.sendNotification, toggle: onToggleSendNotification },
            ].map((opt) => (
              <label
                key={opt.label}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-medium transition ${
                  opt.checked ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input type="checkbox" checked={opt.checked} onChange={opt.toggle} className="h-4 w-4 accent-emerald-600" />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Nội dung preview</p>
            <p className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed">{preview}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 ${
              danger ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-sky-500 to-blue-600'
            }`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Đang gửi...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── InfoCard / InfoRow ─────────────────────────────────────── */
function InfoCard({
  title, icon, gradient, children,
}: {
  title: string; icon: ReactNode; gradient: string; children: ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
          {icon}
        </span>
        <h4 className="text-sm font-extrabold text-slate-800">{title}</h4>
      </div>
      <div className="divide-y divide-slate-50 px-4 py-2">{children}</div>
    </article>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <p className="w-36 shrink-0 text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-800 break-words">{value}</p>
    </div>
  )
}
