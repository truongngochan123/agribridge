import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuyerKpiCards, BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  createBuyerDebtPayment,
  exportBuyerDebts,
  fetchBuyerDebtSupplierDetail,
  fetchBuyerDebts,
  type BuyerDebtInvoice,
  type BuyerDebtOverview,
  type BuyerDebtSupplier,
  type BuyerDebtSupplierDetail,
} from '../../services/buyerDebtApi'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

const emptyOverview: BuyerDebtOverview = { kpis: [], suppliers: [] }

type PaymentDraft = {
  supplierId: number
  invoiceId: string
  amount: string
  paymentMethod: string
  paymentDate: string
  note: string
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

export function BuyerDebtPage() {
  const { showToast } = useToast()
  const [overview, setOverview] = useState<BuyerDebtOverview>(emptyOverview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [detail, setDetail] = useState<BuyerDebtSupplierDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const loadDebts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setOverview(await fetchBuyerDebts())
    } catch (requestError) {
      setOverview(emptyOverview)
      setError(readApiErrorMessage(requestError) || 'Không thể tải dữ liệu công nợ.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDebts()
  }, [loadDebts])

  const suppliers = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return overview.suppliers.filter((item) => {
      const matchesKeyword = !text || item.supplierName.toLowerCase().includes(text)
      const matchesStatus = status === 'all' || item.status === status
      const matchesDue =
        dueFilter === 'all' ||
        (dueFilter === 'dueSoon' && item.dueSoonInvoiceCount > 0) ||
        (dueFilter === 'overdue' && item.overdueInvoiceCount > 0)
      return matchesKeyword && matchesStatus && matchesDue
    })
  }, [dueFilter, keyword, overview.suppliers, status])

  const openDetail = async (supplierId: number) => {
    setDetailLoading(true)
    try {
      const data = await fetchBuyerDebtSupplierDetail(supplierId)
      setDetail(data)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết công nợ.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const openPayment = async (supplier: BuyerDebtSupplier, invoice?: BuyerDebtInvoice) => {
    let currentDetail = detail
    if (!currentDetail || currentDetail.summary.supplierId !== supplier.supplierId) {
      setDetailLoading(true)
      try {
        currentDetail = await fetchBuyerDebtSupplierDetail(supplier.supplierId)
        setDetail(currentDetail)
      } catch (requestError) {
        showToast(readApiErrorMessage(requestError) || 'Không thể tải hóa đơn để thanh toán.', 'error')
        setDetailLoading(false)
        return
      } finally {
        setDetailLoading(false)
      }
    }
    const targetInvoice = invoice ?? currentDetail.invoices.find((item) => item.remainingAmount > 0)
    setPaymentDraft({
      supplierId: supplier.supplierId,
      invoiceId: targetInvoice ? String(targetInvoice.invoiceId) : '',
      amount: targetInvoice ? String(targetInvoice.remainingAmount) : '',
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: todayInput(),
      note: '',
    })
  }

  const submitPayment = async () => {
    if (!paymentDraft) return
    const invoice = detail?.invoices.find((item) => String(item.invoiceId) === paymentDraft.invoiceId)
    const amount = Number(paymentDraft.amount)
    if (!invoice) {
      showToast('Vui lòng chọn hóa đơn.', 'error')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Số tiền thanh toán phải lớn hơn 0.', 'error')
      return
    }
    if (amount > invoice.remainingAmount) {
      showToast('Số tiền thanh toán không được lớn hơn số còn lại.', 'error')
      return
    }
    if (!paymentDraft.paymentMethod.trim()) {
      showToast('Vui lòng chọn phương thức thanh toán.', 'error')
      return
    }
    const parsedPaymentDate = new Date(paymentDraft.paymentDate)
    if (Number.isNaN(parsedPaymentDate.getTime())) {
      showToast('Vui lòng chọn ngày thanh toán hợp lệ.', 'error')
      return
    }

    setSubmittingPayment(true)
    try {
      await createBuyerDebtPayment({
        invoiceId: invoice.invoiceId,
        amount,
        paymentMethod: paymentDraft.paymentMethod,
        paymentDate: parsedPaymentDate.toISOString(),
        note: paymentDraft.note.trim() || undefined,
      })
      showToast('Đã ghi nhận thanh toán.', 'success')
      setPaymentDraft(null)
      await loadDebts()
      setDetail(await fetchBuyerDebtSupplierDetail(paymentDraft.supplierId))
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể ghi nhận thanh toán.', 'error')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const exportCsv = async () => {
    try {
      const blob = await exportBuyerDebts({ status })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'buyer-debts.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể xuất báo cáo công nợ.', 'error')
    }
  }

  return (
    <>
      <BuyerShell activeKey="debt" title="Quản lý Công nợ" subtitle="Theo dõi công nợ phải trả theo nhà cung cấp">
        <BuyerKpiCards items={overview.kpis.map((item) => ({ id: item.id, label: kpiLabel(item.id, item.label), value: item.displayValue }))} />

        <div className="mt-5">
          <BuyerPanel
            title="Công nợ theo Nhà cung cấp"
            right={<button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700" onClick={() => void exportCsv()}>Xuất báo cáo</button>}
          >
            <div className="mb-3 grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <input className="rounded-lg border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-400" placeholder="Tìm nhà cung cấp..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <select className="rounded-lg border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="NORMAL">Bình thường</option>
                <option value="WARNING">Cảnh báo</option>
                <option value="OVERDUE">Quá hạn</option>
                <option value="BLOCKED">Bị chặn</option>
              </select>
              <select className="rounded-lg border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}>
                <option value="all">Tất cả hạn thanh toán</option>
                <option value="dueSoon">Sắp đến hạn</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>

            {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải công nợ...</p> : null}
            {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
            {!loading && !error && suppliers.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Chưa có công nợ phải trả</p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-emerald-100">
              <table className="min-w-[1120px] text-left text-sm">
                <thead className="bg-emerald-50 text-emerald-800">
                  <tr>
                    <th className="px-4 py-3">Nhà cung cấp</th>
                    <th className="px-4 py-3">Tổng nợ</th>
                    <th className="px-4 py-3">Đã thanh toán</th>
                    <th className="px-4 py-3">Còn phải trả</th>
                    <th className="px-4 py-3">Quá hạn</th>
                    <th className="px-4 py-3">Hạn mức</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((item) => (
                    <tr key={item.supplierId} className="border-t border-emerald-100">
                      <td className="px-4 py-3 font-semibold text-emerald-900">
                        {item.supplierName}
                        <div className="text-xs text-emerald-700/70">{item.unpaidInvoiceCount}/{item.invoiceCount} hóa đơn chưa tất toán</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatMoney(item.totalAmount)}</td>
                      <td className="px-4 py-3 text-emerald-700">{formatMoney(item.paidAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-900">{formatMoney(item.remainingAmount)}</td>
                      <td className="px-4 py-3 text-red-500">{formatMoney(item.overdueAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-28 rounded-full bg-emerald-100">
                          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(Number(item.limitUsage || 0), 100)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-emerald-700">{Number(item.limitUsage || 0).toFixed(1)}% / {formatMoney(item.creditLimit)}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge supplier={item} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700" onClick={() => void openDetail(item.supplierId)}>Chi tiết</button>
                          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" onClick={() => void openPayment(item)} disabled={item.remainingAmount <= 0}>Thanh toán</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BuyerPanel>
        </div>
      </BuyerShell>

      {detailLoading ? <Overlay><p className="text-sm font-semibold text-emerald-700">Đang tải chi tiết...</p></Overlay> : null}
      {detail ? <SupplierDetailModal detail={detail} onClose={() => setDetail(null)} onPay={(invoice) => void openPayment(detail.summary, invoice)} /> : null}
      {paymentDraft && detail ? (
        <PaymentModal
          detail={detail}
          draft={paymentDraft}
          submitting={submittingPayment}
          onChange={setPaymentDraft}
          onClose={() => setPaymentDraft(null)}
          onSubmit={submitPayment}
        />
      ) : null}
    </>
  )
}

function SupplierDetailModal({ detail, onClose, onPay }: { detail: BuyerDebtSupplierDetail; onClose: () => void; onPay: (invoice: BuyerDebtInvoice) => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-6 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{detail.summary.supplierName}</h3>
            <p className="text-xs text-slate-500">Hạn mức: {formatMoney(detail.summary.creditLimit)} - Công nợ còn lại: {formatMoney(detail.summary.remainingAmount)}</p>
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Info label="Tổng nợ" value={formatMoney(detail.summary.totalAmount)} />
          <Info label="Đã thanh toán" value={formatMoney(detail.summary.paidAmount)} />
          <Info label="Còn lại" value={formatMoney(detail.summary.remainingAmount)} />
          <Info label="Quá hạn" value={formatMoney(detail.summary.overdueAmount)} />
          <Info label="Hạn mức" value={formatMoney(detail.summary.creditLimit)} />
        </div>

        <SectionTitle text="Hóa đơn" />
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Hóa đơn</th><th className="px-3 py-2">Đơn hàng</th><th className="px-3 py-2">Ngày tạo</th><th className="px-3 py-2">Hạn trả</th><th className="px-3 py-2">Tổng</th><th className="px-3 py-2">Đã trả</th><th className="px-3 py-2">Còn lại</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Hành động</th></tr></thead>
            <tbody>
              {detail.invoices.map((invoice) => (
                <tr key={invoice.invoiceId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-2">{invoice.orderRef}</td>
                  <td className="px-3 py-2">{formatDate(invoice.createdAt)}</td>
                  <td className="px-3 py-2">{formatDate(invoice.dueDate)}</td>
                  <td className="px-3 py-2">{formatMoney(invoice.adjustedAmount)}</td>
                  <td className="px-3 py-2 text-emerald-700">{formatMoney(invoice.paidAmount)}</td>
                  <td className="px-3 py-2 font-semibold">{formatMoney(invoice.remainingAmount)}</td>
                  <td className="px-3 py-2">{invoice.statusLabel}{invoice.overdueDays > 0 ? ` (${invoice.overdueDays} ngày)` : ''}</td>
                  <td className="px-3 py-2"><button className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60" disabled={invoice.remainingAmount <= 0} onClick={() => onPay(invoice)}>Thanh toán</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SectionTitle text="Lịch sử thanh toán" />
        <div className="space-y-2">
          {detail.payments.length ? detail.payments.map((payment) => (
            <div key={payment.paymentId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <span className="font-bold text-emerald-700">{formatMoney(payment.amount)}</span> - {payment.paymentMethod || 'N/A'} - {formatDate(payment.paymentDate)}
              <p className="text-xs text-slate-500">Hóa đơn #{payment.invoiceId} {payment.confirmedBy ? `- xác nhận bởi ${payment.confirmedBy}` : ''}</p>
              {payment.note ? <p className="mt-1 text-xs text-slate-600">{payment.note}</p> : null}
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có thanh toán.</p>}
        </div>

        <SectionTitle text="Điều chỉnh công nợ" />
        <div className="space-y-2">
          {detail.adjustments.length ? detail.adjustments.map((item) => (
            <div key={item.adjustmentId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <span className="font-bold">{formatMoney(item.amount)}</span> - {item.adjustmentType || 'N/A'} - {formatDate(item.createdAt)}
              <p className="text-xs text-slate-500">Hóa đơn #{item.invoiceId}</p>
              {item.description ? <p className="mt-1 text-xs text-slate-600">{item.description}</p> : null}
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có điều chỉnh.</p>}
        </div>
      </div>
    </div>
  )
}

function PaymentModal({ detail, draft, submitting, onChange, onClose, onSubmit }: { detail: BuyerDebtSupplierDetail; draft: PaymentDraft; submitting: boolean; onChange: (draft: PaymentDraft) => void; onClose: () => void; onSubmit: () => void }) {
  const invoice = detail.invoices.find((item) => String(item.invoiceId) === draft.invoiceId)
  return (
    <div className="fixed inset-0 z-[90] bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto mt-10 w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xl font-extrabold text-slate-900">Ghi nhận thanh toán</h3>
          <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Hóa đơn</span>
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.invoiceId} onChange={(event) => {
              const nextInvoice = detail.invoices.find((item) => String(item.invoiceId) === event.target.value)
              onChange({ ...draft, invoiceId: event.target.value, amount: nextInvoice ? String(nextInvoice.remainingAmount) : '' })
            }}>
              <option value="">Chọn hóa đơn</option>
              {detail.invoices.filter((item) => item.remainingAmount > 0).map((item) => <option key={item.invoiceId} value={item.invoiceId}>{item.invoiceNumber} - còn {formatMoney(item.remainingAmount)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Số tiền thanh toán</span>
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0" max={invoice?.remainingAmount} value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Phương thức thanh toán</span>
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.paymentMethod} onChange={(event) => onChange({ ...draft, paymentMethod: event.target.value })}>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH">Tiền mặt</option>
              <option value="ESCROW">Escrow</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Ngày thanh toán</span>
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={draft.paymentDate} onChange={(event) => onChange({ ...draft, paymentDate: event.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Ghi chú</span>
            <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700" onClick={onClose} disabled={submitting}>Đóng</button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60" onClick={onSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Ghi nhận'}</button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ supplier }: { supplier: BuyerDebtSupplier }) {
  const cls = supplier.status === 'BLOCKED' ? 'bg-red-700 text-white' : supplier.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : supplier.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{statusLabel(supplier.status, supplier.statusLabel)}</span>
}

function statusLabel(status: string, fallback?: string) {
  if (status === 'BLOCKED') return 'Bị chặn'
  if (status === 'OVERDUE') return 'Quá hạn'
  if (status === 'WARNING') return 'Cảnh báo'
  if (status === 'NORMAL') return 'Bình thường'
  return fallback || status
}

function kpiLabel(id: string, fallback: string) {
  const labels: Record<string, string> = {
    totalDebt: 'Tổng phải trả',
    overdueDebt: 'Quá hạn',
    paidThisMonth: 'Đã thanh toán tháng',
    dueSoon: 'Sắp đến hạn',
    unpaidInvoiceCount: 'Hóa đơn chưa tất toán',
    overdueInvoiceCount: 'Hóa đơn quá hạn',
  }
  return labels[id] || fallback
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-900">{value}</p></div>
}

function SectionTitle({ text }: { text: string }) {
  return <h4 className="mb-2 mt-5 text-sm font-extrabold text-slate-900">{text}</h4>
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[85] bg-black/30 p-4"><div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-4">{children}</div></div>
}
