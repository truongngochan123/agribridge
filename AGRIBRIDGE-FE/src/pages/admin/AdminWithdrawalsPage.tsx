import { Banknote, CheckCircle2, Clock3, CreditCard, FileCheck2, RefreshCw, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { approveAdminWithdrawal, fetchAdminWithdrawals, markAdminWithdrawalPaid, rejectAdminWithdrawal, type WithdrawalItem } from '../../services/walletService'

function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatAccount(value?: string | null) {
  if (!value) return '-'
  return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Chờ duyệt'
    case 'APPROVED':
      return 'Đã duyệt'
    case 'PAID':
      return 'Đã chuyển'
    case 'REJECTED':
      return 'Từ chối'
    default:
      return status
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'APPROVED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'REJECTED':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

export function AdminWithdrawalsPage() {
  const [items, setItems] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)

  const totals = useMemo(() => {
    const pending = items.filter((item) => item.status === 'PENDING')
    const approved = items.filter((item) => item.status === 'APPROVED')
    const paid = items.filter((item) => item.status === 'PAID')
    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      paidCount: paid.length,
      pendingPayout: pending.reduce((sum, item) => sum + Number(item.payoutAmount ?? item.amount ?? 0), 0),
      feeRevenue: items.filter((item) => item.status !== 'REJECTED').reduce((sum, item) => sum + Number(item.feeAmount || 0), 0),
    }
  }, [items])

  async function load() {
    setLoading(true)
    try {
      setItems(await fetchAdminWithdrawals())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function act(id: number, action: () => Promise<WithdrawalItem>) {
    setActingId(id)
    try {
      await action()
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <AdminShell activeKey="withdrawals" title="Yêu cầu rút tiền" subtitle="Duyệt và ghi nhận chuyển khoản cho nhà cung cấp">
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Clock3 className="h-4 w-4" />} label="Chờ duyệt" value={`${totals.pendingCount}`} hint={money(totals.pendingPayout)} tone="amber" />
          <Stat icon={<FileCheck2 className="h-4 w-4" />} label="Đã duyệt" value={`${totals.approvedCount}`} hint="Chờ chuyển khoản" tone="blue" />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Đã chuyển" value={`${totals.paidCount}`} hint="Hoàn tất" tone="emerald" />
          <Stat icon={<Banknote className="h-4 w-4" />} label="Phí nền tảng" value={money(totals.feeRevenue)} hint="Từ phí rút 1%" tone="slate" />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Danh sách yêu cầu</h2>
              <p className="mt-1 text-sm text-slate-500">Kiểm tra thông tin ngân hàng trước khi đánh dấu đã chuyển.</p>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </button>
          </div>

          {loading ? <p className="p-5 text-sm font-semibold text-slate-500">Đang tải yêu cầu rút tiền...</p> : null}
          {!loading && items.length === 0 ? <p className="p-5 text-sm font-semibold text-slate-500">Chưa có yêu cầu rút tiền.</p> : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Yêu cầu</th>
                    <th>Nhà cung cấp</th>
                    <th>Ngân hàng nhận</th>
                    <th>Số tiền</th>
                    <th>Phí</th>
                    <th>Thực chuyển</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th className="pr-5 text-right">Xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = actingId === item.id
                    return (
                      <tr key={item.id} className="border-t border-slate-100 align-top">
                        <td className="px-5 py-4">
                          <p className="font-extrabold text-slate-900">WD-{item.id}</p>
                          <p className="text-xs text-slate-500">{item.note || 'Không có ghi chú'}</p>
                        </td>
                        <td className="py-4">
                          <p className="font-bold text-slate-900">{item.supplierName || `#${item.supplierCompanyId}`}</p>
                          <p className="text-xs text-slate-500">Supplier ID: {item.supplierCompanyId}</p>
                        </td>
                        <td className="py-4">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                              <CreditCard className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{item.bankName || '-'}</p>
                              <p className="text-xs text-slate-500">{formatAccount(item.bankAccountNumber)}</p>
                              <p className="text-xs font-bold uppercase text-slate-700">{item.bankAccountName || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 font-semibold">{money(item.amount)}</td>
                        <td className="py-4 font-semibold text-amber-700">{money(item.feeAmount)}</td>
                        <td className="py-4 text-base font-extrabold text-emerald-700">{money(item.payoutAmount ?? item.amount)}</td>
                        <td className="py-4">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-extrabold ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                        </td>
                        <td className="py-4 text-slate-500">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
                        <td className="py-4 pr-5 text-right">
                          <div className="flex justify-end gap-2">
                            {item.status === 'PENDING' ? (
                              <>
                                <button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" onClick={() => void act(item.id, () => approveAdminWithdrawal(item.id))}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Duyệt
                                </button>
                                <button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" onClick={() => void act(item.id, () => rejectAdminWithdrawal(item.id))}>
                                  <XCircle className="h-3.5 w-3.5" />
                                  Từ chối
                                </button>
                              </>
                            ) : null}
                            {item.status === 'APPROVED' ? (
                              <button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" onClick={() => void act(item.id, () => markAdminWithdrawalPaid(item.id))}>
                                <Banknote className="h-3.5 w-3.5" />
                                Đã chuyển
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  )
}

function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'emerald' | 'amber' | 'blue' | 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>
    </div>
  )
}
