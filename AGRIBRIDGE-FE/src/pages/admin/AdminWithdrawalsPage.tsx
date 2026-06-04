import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  Loader2,
  RefreshCw,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  approveAdminWithdrawal,
  fetchAdminWithdrawals,
  markAdminWithdrawalPaid,
  rejectAdminWithdrawal,
  type WithdrawalItem,
} from '../../services/walletService'

/* ─── helpers ───────────────────────────────────────────────── */
function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatAccount(value?: string | null) {
  if (!value) return '—'
  return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

type StatusKey = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'

const statusConfig: Record<StatusKey, { label: string; badge: string; dot: string }> = {
  PENDING:  { label: 'Chờ duyệt',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'   },
  APPROVED: { label: 'Đã duyệt',    badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
  PAID:     { label: 'Đã chuyển',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { label: 'Từ chối',     badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
}

function getStatusConfig(status: string) {
  return statusConfig[status as StatusKey] ?? { label: status, badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
}

type FilterKey = 'ALL' | StatusKey
const filterTabs: Array<{ key: FilterKey; label: string }> = [
  { key: 'ALL',      label: 'Tất cả'     },
  { key: 'PENDING',  label: 'Chờ duyệt'  },
  { key: 'APPROVED', label: 'Đã duyệt'   },
  { key: 'PAID',     label: 'Đã chuyển'  },
  { key: 'REJECTED', label: 'Từ chối'    },
]

/* ─── skeleton ───────────────────────────────────────────────── */
function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-100 ${className ?? ''}`} style={style}>
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

function SkeletonRow() {
  return (
    <tr className="border-t border-slate-50">
      {[160, 140, 140, 100, 90, 100, 90, 120, 80].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <Pulse className="h-3.5 rounded-lg" style={{ width: w }} />
          {(i === 0 || i === 1) && (
            <Pulse className="mt-1.5 h-3 rounded-lg" style={{ width: Math.round(w * 0.65) }} />
          )}
        </td>
      ))}
    </tr>
  )
}

/* ─── confirm modal ──────────────────────────────────────────── */
interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  confirmClass: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmModal({ title, description, confirmLabel, confirmClass, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ animation: 'modalIn 0.25s cubic-bezier(.34,1.56,.64,1) both' }}
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── main page ─────────────────────────────────────────────── */
export function AdminWithdrawalsPage() {
  usePageTitle('Yêu cầu rút tiền')
  const [items, setItems]           = useState<WithdrawalItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingId, setActingId]     = useState<number | null>(null)
  const [filter, setFilter]         = useState<FilterKey>('ALL')
  const [confirm, setConfirm]       = useState<{
    item: WithdrawalItem
    type: 'approve' | 'reject' | 'paid'
  } | null>(null)

  const totals = useMemo(() => {
    const pending  = items.filter((i) => i.status === 'PENDING')
    const approved = items.filter((i) => i.status === 'APPROVED')
    const paid     = items.filter((i) => i.status === 'PAID')
    return {
      pendingCount:  pending.length,
      approvedCount: approved.length,
      paidCount:     paid.length,
      rejectedCount: items.filter((i) => i.status === 'REJECTED').length,
      pendingPayout: pending.reduce((s, i) => s + Number(i.payoutAmount ?? i.amount ?? 0), 0),
      feeRevenue:    paid.reduce((s, i) => s + Number(i.feeAmount || 0), 0),
      totalPaid:     paid.reduce((s, i) => s + Number(i.payoutAmount ?? i.amount ?? 0), 0),
    }
  }, [items])

  const filtered = useMemo(
    () => (filter === 'ALL' ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  )

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      setItems(await fetchAdminWithdrawals())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function doAction(item: WithdrawalItem, type: 'approve' | 'reject' | 'paid') {
    setActingId(item.id)
    try {
      if (type === 'approve') await approveAdminWithdrawal(item.id)
      else if (type === 'reject') await rejectAdminWithdrawal(item.id)
      else await markAdminWithdrawalPaid(item.id)
      await load(true)
    } finally {
      setActingId(null)
      setConfirm(null)
    }
  }

  const countFor = (key: FilterKey) =>
    key === 'ALL' ? items.length : items.filter((i) => i.status === key).length

  const statCards = [
    {
      label: 'Chờ duyệt',
      value: totals.pendingCount,
      hint: money(totals.pendingPayout),
      gradient: 'from-amber-500 to-orange-500',
      icon: <Clock3 className="h-5 w-5 text-white" />,
    },
    {
      label: 'Đã duyệt',
      value: totals.approvedCount,
      hint: 'Chờ chuyển khoản',
      gradient: 'from-blue-500 to-indigo-600',
      icon: <FileCheck2 className="h-5 w-5 text-white" />,
    },
    {
      label: 'Đã chuyển',
      value: totals.paidCount,
      hint: money(totals.totalPaid),
      gradient: 'from-emerald-500 to-teal-600',
      icon: <CheckCircle2 className="h-5 w-5 text-white" />,
    },
    {
      label: 'Từ chối',
      value: totals.rejectedCount,
      hint: 'Yêu cầu bị từ chối',
      gradient: 'from-red-500 to-rose-600',
      icon: <XCircle className="h-5 w-5 text-white" />,
    },
    {
      label: 'Phí nền tảng',
      value: money(totals.feeRevenue),
      hint: 'Phí rút 1%',
      gradient: 'from-violet-500 to-purple-600',
      icon: <TrendingDown className="h-5 w-5 text-white" />,
      isMoneyVal: true,
    },
  ]

  return (
    <AdminShell
      activeKey="withdrawals"
      title="Yêu cầu rút tiền"
      subtitle="Duyệt và ghi nhận chuyển khoản cho nhà cung cấp"
    >
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.93) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        {/* ── Stat cards ──────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md"
              style={{ animation: `fadeInUp 0.35s ease ${i * 55}ms both` }}
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow`}
              >
                {card.icon}
              </span>
              <div className="min-w-0">
                <p className={`truncate font-extrabold text-slate-900 ${card.isMoneyVal ? 'text-base' : 'text-xl'}`}>
                  {card.isMoneyVal ? card.value : card.value}
                </p>
                <p className="truncate text-xs text-slate-400">{card.label}</p>
                <p className="truncate text-[10px] text-slate-400">{card.hint}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Main table card ─────────────────────────────────────── */}
        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ animation: 'fadeInUp 0.4s ease 280ms both' }}
        >
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Danh sách yêu cầu</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Kiểm tra thông tin ngân hàng trước khi đánh dấu đã chuyển
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:opacity-60"
            >
              <RefreshCw
                className="h-4 w-4"
                style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined}
              />
              {refreshing ? 'Đang làm mới...' : 'Làm mới'}
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
            {filterTabs.map((tab) => {
              const active = tab.key === filter
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
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
                    {countFor(tab.key)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3.5 whitespace-nowrap">Yêu cầu</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Nhà cung cấp</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Ngân hàng nhận</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Số tiền</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Phí</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Thực chuyển</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Trạng thái</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Ngày tạo</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading */}
                {loading && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                          <Banknote className="h-7 w-7 text-slate-400" />
                        </span>
                        <p className="font-bold text-slate-600">Không có yêu cầu nào</p>
                        <p className="text-xs text-slate-400">Thử thay đổi bộ lọc trạng thái</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Rows */}
                {!loading && filtered.map((item, idx) => {
                  const sc   = getStatusConfig(item.status)
                  const busy = actingId === item.id
                  return (
                    <tr
                      key={item.id}
                      className="group border-t border-slate-50 transition-colors hover:bg-slate-50/50"
                      style={{ animation: `fadeInUp 0.3s ease ${idx * 35}ms both` }}
                    >
                      {/* ID + note */}
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-slate-900">WD-{item.id}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                          {item.note || 'Không có ghi chú'}
                        </p>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-4 max-w-[160px]">
                        <p className="truncate font-semibold text-slate-800" title={item.supplierName ?? ''}>
                          {item.supplierName || `#${item.supplierCompanyId}`}
                        </p>
                        <p className="text-[11px] text-slate-400">ID: {item.supplierCompanyId}</p>
                      </td>

                      {/* Bank */}
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <CreditCard className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800">{item.bankName || '—'}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{formatAccount(item.bankAccountNumber)}</p>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                              {item.bankAccountName || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-700">
                        {money(item.amount)}
                      </td>

                      {/* Fee */}
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-amber-600">
                        {money(item.feeAmount)}
                      </td>

                      {/* Payout */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-base font-extrabold text-emerald-700">
                          {money(item.payoutAmount ?? item.amount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(item.requestedAt).toLocaleString('vi-VN')}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.status === 'PENDING' && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() => setConfirm({ item, type: 'approve' })}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Duyệt
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => setConfirm({ item, type: 'reject' })}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                Từ chối
                              </button>
                            </>
                          )}
                          {item.status === 'APPROVED' && (
                            <button
                              disabled={busy}
                              onClick={() => setConfirm({ item, type: 'paid' })}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                              Đã chuyển khoản
                            </button>
                          )}
                          {(item.status === 'PAID' || item.status === 'REJECTED') && (
                            <span className="text-xs text-slate-300 italic">Hoàn tất</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              <span>
                Hiển thị <span className="font-bold text-slate-700">{filtered.length}</span> /{' '}
                <span className="font-bold text-slate-700">{items.length}</span> yêu cầu
              </span>
              <span>AgriBridge Admin · Thanh toán</span>
            </div>
          )}
        </section>
      </div>

      {/* ── Confirm modal ───────────────────────────────────────── */}
      {confirm && (
        <ConfirmModal
          title={
            confirm.type === 'approve' ? 'Duyệt yêu cầu rút tiền'
            : confirm.type === 'reject' ? 'Từ chối yêu cầu rút tiền'
            : 'Xác nhận đã chuyển khoản'
          }
          description={
            confirm.type === 'approve'
              ? `Duyệt WD-${confirm.item.id} của ${confirm.item.supplierName || `Supplier #${confirm.item.supplierCompanyId}`} — ${money(confirm.item.payoutAmount ?? confirm.item.amount)}`
              : confirm.type === 'reject'
              ? `Từ chối WD-${confirm.item.id}? Hành động này không thể hoàn tác.`
              : `Xác nhận đã chuyển ${money(confirm.item.payoutAmount ?? confirm.item.amount)} đến ${confirm.item.bankAccountName} — ${confirm.item.bankName}?`
          }
          confirmLabel={
            confirm.type === 'approve' ? 'Duyệt ngay'
            : confirm.type === 'reject' ? 'Từ chối'
            : 'Xác nhận đã chuyển'
          }
          confirmClass={
            confirm.type === 'approve'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110'
              : confirm.type === 'reject'
              ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:brightness-110'
              : 'bg-gradient-to-r from-slate-700 to-slate-900 hover:brightness-110'
          }
          loading={actingId === confirm.item.id}
          onConfirm={() => void doAction(confirm.item, confirm.type)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminShell>
  )
}
