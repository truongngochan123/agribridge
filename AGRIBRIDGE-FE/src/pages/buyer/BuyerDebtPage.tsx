import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { FilterTabBar, SearchInput, BuyerPanel } from '../../components/buyer/BuyerCommon'
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
import { usePageTitle } from '../../hooks/usePageTitle'

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

  const debtTabs = [
    { key: 'all', label: 'Tất cả', count: overview.suppliers.length },
    { key: 'OVERDUE', label: 'Quá hạn', count: overview.suppliers.filter((s) => s.status === 'OVERDUE').length },
    { key: 'WARNING', label: 'Cảnh báo', count: overview.suppliers.filter((s) => s.status === 'WARNING').length },
    { key: 'NORMAL', label: 'Bình thường', count: overview.suppliers.filter((s) => s.status === 'NORMAL').length },
  ]

  usePageTitle('Quản lý Công nợ')
  return (
    <>
      <BuyerShell
        activeKey="debt"
        title="Quản lý Công nợ"
        subtitle="Theo dõi công nợ phải trả theo nhà cung cấp"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="Tìm nhà cung cấp..."
              className="min-w-[220px] max-w-sm"
            />
            <FilterTabBar tabs={debtTabs} activeKey={status === 'all' ? 'all' : status} onChange={(k) => setStatus(k)} />
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value)}
            >
              <option value="all">Tất cả hạn TT</option>
              <option value="dueSoon">Sắp đến hạn</option>
              <option value="overdue">Quá hạn</option>
            </select>
            <button
              onClick={() => void exportCsv()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất báo cáo
            </button>
          </div>
        }
      >
        {/* Loading / Error */}
        {loading && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Đang tải dữ liệu công nợ...
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* KPI Summary bar - gradient left-bar style */}
        {!loading && !error && overview.kpis.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {overview.kpis.map((item, i) => {
              const accents = [
                { bar: 'from-emerald-400 to-teal-500' },
                { bar: 'from-blue-400 to-indigo-500' },
                { bar: 'from-amber-400 to-orange-500' },
                { bar: 'from-violet-400 to-purple-500' },
                { bar: 'from-rose-400 to-red-500' },
                { bar: 'from-cyan-400 to-sky-500' },
              ]
              const accent = accents[i % accents.length]
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <span className={`absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b ${accent.bar}`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kpiLabel(item.id, item.label)}</p>
                  <p className="mt-0.5 text-lg font-extrabold text-slate-900">{item.displayValue}</p>
                </div>
              )
            })}
          </div>
        )}

        <BuyerPanel title="Công nợ theo Nhà cung cấp">
          {!loading && !error && suppliers.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Chưa có công nợ phải trả phù hợp.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
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
              <tbody className="divide-y divide-slate-50">
                {suppliers.map((item) => (
                  <tr key={item.supplierId} className="bg-white text-sm transition-colors hover:bg-emerald-50/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{item.supplierName}</p>
                      <p className="text-xs text-slate-400">{item.unpaidInvoiceCount}/{item.invoiceCount} hóa đơn chưa tất toán</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(item.totalAmount)}</td>
                    <td className="px-4 py-3 text-emerald-700">{formatMoney(item.paidAmount)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(item.remainingAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-rose-600">{formatMoney(item.overdueAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                          style={{ width: `${Math.min(Number(item.limitUsage || 0), 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">{Number(item.limitUsage || 0).toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge supplier={item} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => void openDetail(item.supplierId)}
                        >
                          Chi tiết
                        </button>
                        <button
                          className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                          onClick={() => void openPayment(item)}
                          disabled={item.remainingAmount <= 0}
                        >
                          Thanh toán
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {/* Dark gradient header - supplier style */}
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-white">{detail.summary.supplierName}</h3>
            <p className="mt-0.5 text-sm text-slate-300">
              Hạn mức: {formatMoney(detail.summary.creditLimit)} · Còn lại: {formatMoney(detail.summary.remainingAmount)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-5">
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
        </div>{/* end overflow-y-auto body */}
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
  const map: Record<string, { badge: string; dot: string }> = {
    BLOCKED: { badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
    OVERDUE: { badge: 'bg-rose-100 text-rose-700',   dot: 'bg-rose-400' },
    WARNING: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
    NORMAL:  { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  }
  const cls = map[supplier.status] ?? { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {statusLabel(supplier.status, supplier.statusLabel)}
    </span>
  )
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
