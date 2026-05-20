import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CreditCard, Download, FileText, ReceiptText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { FilterTabBar, SearchInput, BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerPaymentInstructionModal } from '../../components/buyer/BuyerPaymentInstructionModal'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'
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
import type { BuyerPaymentMethod } from '../../components/buyer/buyerQuickOrderTypes'

const emptyOverview: BuyerDebtOverview = { kpis: [], suppliers: [] }
const emptyText = 'Chưa có'

type ActiveTab = 'invoices' | 'payments' | 'adjustments' | 'reminders' | 'limit'

type DebtPaymentState = {
  supplier: BuyerDebtSupplier
  invoice: BuyerDebtInvoice
}

function formatMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value?: string | null) {
  if (!value) return emptyText
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function paymentPlanLabel(plan?: string | null, termDays?: number | null, creditLimit?: number | null) {
  if (plan === 'DEPOSIT_50') return 'Cọc 50% - còn lại khi nhận hàng'
  if (plan === 'CREDIT_TERM') return termDays ? `Công nợ ${termDays} ngày` : 'Công nợ'
  if (plan === 'PREPAID') return 'Thanh toán ngay chưa trả'
  if (creditLimit != null && creditLimit <= 0) return 'Không còn nợ'
  return termDays ? `Công nợ ${termDays} ngày` : emptyText
}

function modalPaymentMethod(invoice: BuyerDebtInvoice): BuyerPaymentMethod {
  if (invoice.paymentPlanType === 'DEPOSIT_50') return 'DEPOSIT_50'
  return 'ESCROW_TRANSFER'
}

function canPayInvoice(invoice: BuyerDebtInvoice) {
  const status = (invoice.status || '').toUpperCase()
  return invoice.remainingAmount > 0 && status !== 'PAID' && status !== 'CANCELLED' && status !== 'VOIDED'
}


function isOutstandingDebtInvoice(invoice: BuyerDebtInvoice) {
  const status = (invoice.status || '').toUpperCase()
  if (invoice.remainingAmount <= 0) return false
  return !['PAID', 'CANCELLED', 'VOIDED'].includes(status)
}


function isClosedDebtInvoice(invoice: BuyerDebtInvoice) {
  const status = (invoice.status || '').toUpperCase()
  if (status === 'PAID') return true
  return invoice.remainingAmount <= 0 && ['PAID', 'CANCELLED', 'VOIDED'].includes(status)
}

function dueDateLabel(invoice: BuyerDebtInvoice) {
  if (invoice.paymentPlanType === 'PREPAID') return 'Ngay khi đặt hàng'
  if (invoice.dueLabel) return invoice.dueLabel
  if (invoice.paymentPlanType === 'DEPOSIT_50' && !invoice.dueDate) return 'Khi nhận hàng'
  return formatDate(invoice.dueDate)
}

function buyerStatusLabel(item: BuyerDebtSupplier) {
  if (item.isBlocked || item.status === 'BLOCKED') return 'Tạm khóa'
  if (Number(item.overdueAmount || 0) > 0) return 'Quá hạn'
  if (Number(item.dueSoonAmount || 0) > 0) return 'Sắp đến hạn'
  if (Number(item.remainingAmount || 0) > 0) return 'Còn phải trả'
  return 'Đã tất toán'
}

function debtTypeLabelFromInvoices(invoices: BuyerDebtInvoice[], remainingAmount?: number) {
  const outstanding = invoices.filter(isOutstandingDebtInvoice)
  if (!outstanding.length) return Number(remainingAmount || 0) > 0 ? 'Nhiều loại' : 'Không còn nợ'
  const plans = Array.from(new Set(outstanding.map((item) => String(item.paymentPlanType || '').toUpperCase()).filter(Boolean)))
  if (plans.length > 1) return 'Nhiều loại'
  const only = plans[0]
  if (only === 'PREPAID') return 'Thanh toán ngay chưa trả'
  if (only === 'DEPOSIT_50') return 'Cọc 50% - còn lại khi nhận hàng'
  if (only === 'CREDIT_TERM') {
    const terms = Array.from(new Set(outstanding.map((item) => Number(item.paymentTermDays || 0)).filter((item) => item > 0)))
    if (terms.length === 1) return `Công nợ ${terms[0]} ngày`
    return 'Nhiều loại'
  }
  return 'Nhiều loại'
}

function reminderColumnLabel(reminders: Array<{ status?: string | null; sentAt?: string | null; createdAt?: string | null }>) {
  if (!reminders.length) return 'Chưa nhắc'
  const hasUnread = reminders.some((item) => String(item.status || '').toUpperCase() === 'SENT')
  if (hasUnread) return 'Nhắc nợ mới'
  const latest = [...reminders].sort((a, b) => {
    const aTime = new Date(a.sentAt || a.createdAt || 0).getTime()
    const bTime = new Date(b.sentAt || b.createdAt || 0).getTime()
    return bTime - aTime
  })[0]
  const at = latest?.sentAt || latest?.createdAt
  if (at) {
    const date = new Date(at)
    if (!Number.isNaN(date.getTime())) return `Nhắc lần cuối: ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
  }
  return 'Đã nhắc'
}

export function BuyerDebtPage() {
  usePageTitle('Quản lý Công nợ')
  const { showToast } = useToast()
  const [overview, setOverview] = useState<BuyerDebtOverview>(emptyOverview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<BuyerDebtSupplierDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('invoices')
  const [payment, setPayment] = useState<DebtPaymentState | null>(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [focusInvoiceId, setFocusInvoiceId] = useState<number | null>(null)
  const [supplierDetailMap, setSupplierDetailMap] = useState<Record<number, BuyerDebtSupplierDetail>>({})

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

  useEffect(() => {
    const supplierId = Number(searchParams.get('supplierId') || '')
    const invoiceId = Number(searchParams.get('invoiceId') || '')
    const shouldPay = searchParams.get('pay') === '1'
    if (!Number.isFinite(supplierId) || supplierId <= 0) return
    setFocusInvoiceId(Number.isFinite(invoiceId) && invoiceId > 0 ? invoiceId : null)
    void (async () => {
      const data = await openDetail(supplierId, 'invoices')
      if (!shouldPay || !data) return
      const invoice = data.invoices.find((item) => item.invoiceId === invoiceId)
      if (invoice && canPayInvoice(invoice)) setPayment({ supplier: data.summary, invoice })
    })()
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('supplierId')
      next.delete('invoiceId')
      next.delete('pay')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const openSuppliers = useMemo(() => {
    return overview.suppliers.filter((item) => Number(item.remainingAmount || 0) > 0 || Number(item.unpaidInvoiceCount || 0) > 0)
  }, [overview.suppliers])

  const settledSuppliers = useMemo(() => {
    return overview.suppliers.filter((item) => Number(item.remainingAmount || 0) <= 0 && Number(item.unpaidInvoiceCount || 0) <= 0)
  }, [overview.suppliers])

  const suppliers = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    const base = status === 'SETTLED' ? settledSuppliers : openSuppliers
    return base.filter((item) => {
      const matchesKeyword = !text || item.supplierName.toLowerCase().includes(text)
      const matchesStatus = status === 'all'
        || status === 'SETTLED'
        || (status === 'DUE_SOON' ? Number(item.dueSoonAmount || 0) > 0 : item.status === status)
      return matchesKeyword && matchesStatus
    })
  }, [keyword, openSuppliers, settledSuppliers, status])

  useEffect(() => {
    const missingIds = suppliers.map((item) => item.supplierId).filter((id) => !supplierDetailMap[id])
    if (!missingIds.length) return
    void (async () => {
      const entries = await Promise.all(
        missingIds.map(async (supplierId) => {
          try {
            const data = await fetchBuyerDebtSupplierDetail(supplierId)
            return [supplierId, data] as const
          } catch {
            return null
          }
        }),
      )
      const next = Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, BuyerDebtSupplierDetail]>)
      if (Object.keys(next).length) setSupplierDetailMap((prev) => ({ ...prev, ...next }))
    })()
  }, [suppliers, supplierDetailMap])

  const debtTabs = [
    { key: 'all', label: 'Tất cả', count: openSuppliers.length },
    { key: 'OVERDUE', label: 'Quá hạn', count: openSuppliers.filter((item) => Number(item.overdueAmount || 0) > 0).length },
    { key: 'DUE_SOON', label: 'Sắp đến hạn', count: openSuppliers.filter((item) => Number(item.dueSoonAmount || 0) > 0).length },
    { key: 'BLOCKED', label: 'Tạm khóa', count: openSuppliers.filter((item) => item.status === 'BLOCKED' || item.isBlocked).length },
    { key: 'SETTLED', label: 'Đã tất toán', count: settledSuppliers.length },
      ]

  const openDetail = async (supplierId: number, tab: ActiveTab = 'invoices') => {
    setDetailLoading(true)
    try {
      const data = await fetchBuyerDebtSupplierDetail(supplierId)
      setDetail(data)
      setActiveTab(tab)
      return data
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết công nợ.', 'error')
      return null
    } finally {
      setDetailLoading(false)
    }
  }

  const openPayment = async (supplier: BuyerDebtSupplier, invoice?: BuyerDebtInvoice) => {
    let currentDetail = detail?.summary.supplierId === supplier.supplierId ? detail : null
    if (!currentDetail) currentDetail = await openDetail(supplier.supplierId)
    if (!currentDetail) return

    const payableInvoices = currentDetail.invoices.filter(canPayInvoice)
    if (!invoice && payableInvoices.length !== 1) {
      setDetail(currentDetail)
      setActiveTab('invoices')
      return
    }

    const selectedInvoice = invoice ?? payableInvoices[0]
    if (!selectedInvoice) {
      showToast('Không có hóa đơn còn phải thanh toán.', 'error')
      return
    }
    setPayment({ supplier, invoice: selectedInvoice })
  }

  const submitPayment = async () => {
    if (!payment) return
    if (!canPayInvoice(payment.invoice)) {
      showToast('Hóa đơn đã được thanh toán.', 'error')
      return
    }

    setSubmittingPayment(true)
    try {
      await createBuyerDebtPayment({
        invoiceId: payment.invoice.invoiceId,
        amount: payment.invoice.remainingAmount,
        paymentMethod: 'BANK_TRANSFER_DEMO',
        paymentDate: new Date().toISOString(),
        note: `Demo thanh toán công nợ ${payment.invoice.invoiceNumber}`,
      })
      showToast('Thanh toán thành công', 'success')
      setPayment(null)
      await loadDebts()
      if (detail?.summary.supplierId === payment.supplier.supplierId) {
        setDetail(await fetchBuyerDebtSupplierDetail(payment.supplier.supplierId))
      }
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể thanh toán công nợ.', 'error')
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
      <BuyerShell
        activeKey="debt"
        title="Quản lý Công nợ"
        subtitle="Theo dõi công nợ phải trả theo nhà cung cấp và từng hóa đơn"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm nhà cung cấp..." className="min-w-[220px] max-w-sm" />
            <FilterTabBar tabs={debtTabs} activeKey={status === 'all' ? 'all' : status} onChange={(key) => setStatus(key)} />
            <button onClick={() => void exportCsv()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm">
              <Download className="h-3.5 w-3.5" />
              Xuất báo cáo
            </button>
          </div>
        }
      >
        {loading ? <Notice tone="emerald" text="Đang tải dữ liệu công nợ..." /> : null}
        {error ? <Notice tone="red" text={error} /> : null}

        {!loading && !error && overview.kpis.length > 0 ? (
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {overview.kpis.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">{kpiLabel(item.id, item.label)}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{item.displayValue}</p>
              </div>
            ))}
          </div>
        ) : null}

        <BuyerPanel title="Công nợ theo Nhà cung cấp">
          {!loading && !error && suppliers.length === 0 ? <Empty text={status === 'SETTLED' ? 'Chưa có nhà cung cấp đã tất toán.' : 'Bạn không có công nợ cần thanh toán.'} /> : null}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1320px] text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nhà cung cấp</th>
                  <th className="px-4 py-3">Loại nợ</th>
                  <th className="px-4 py-3">Hóa đơn còn nợ</th>
                  <th className="px-4 py-3">Còn phải trả</th>
                  <th className="px-4 py-3">Sắp đến hạn</th>
                  <th className="px-4 py-3">Quá hạn</th>
                  <th className="px-4 py-3">Nhắc nợ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {suppliers.map((item) => {
                  const detailBySupplier = supplierDetailMap[item.supplierId]
                  const outstandingInvoices = (detailBySupplier?.invoices || []).filter(isOutstandingDebtInvoice)
                  const reminderLabel = reminderColumnLabel(detailBySupplier?.reminders || [])
                  return (
                    <tr key={item.supplierId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <p>{item.supplierName || emptyText}</p>
                        {Number(item.creditLimit || 0) <= 0 ? (
                          <p
                            className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            title="Nhà cung cấp chưa cấp công nợ 7/15/30 ngày. Các khoản còn phải trả nếu có là thanh toán ngay hoặc phần còn lại sau cọc."
                          >
                            Chưa cấp hạn mức
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{debtTypeLabelFromInvoices(outstandingInvoices, item.remainingAmount)}</td>
                      <td className="px-4 py-3">{outstandingInvoices.length || item.unpaidInvoiceCount}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(item.remainingAmount)}</td>
                      <td className="px-4 py-3">{formatMoney(item.dueSoonAmount)}</td>
                      <td className={`px-4 py-3 font-semibold ${Number(item.overdueAmount || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{formatMoney(item.overdueAmount)}</td>
                      <td className="px-4 py-3">{reminderLabel}</td>
                      <td className="px-4 py-3"><StatusBadge label={buyerStatusLabel(item)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton icon={<FileText />} text="Chi tiết" onClick={() => void openDetail(item.supplierId)} />
                          {item.remainingAmount > 0 ? <ActionButton icon={<CreditCard />} text="Thanh toán" onClick={() => void openPayment(item)} /> : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Đã tất toán</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
      </BuyerShell>

      {detailLoading ? <Overlay>Đang tải chi tiết...</Overlay> : null}
      {detail ? <SupplierDetailDrawer detail={detail} activeTab={activeTab} setActiveTab={setActiveTab} onClose={() => { setDetail(null); setFocusInvoiceId(null) }} onPay={(invoice) => void openPayment(detail.summary, invoice)} focusInvoiceId={focusInvoiceId} /> : null}
      <BuyerPaymentInstructionModal
        open={Boolean(payment)}
        mode="debt"
        title="Thanh toán công nợ"
        description="Thanh toán qua tài khoản sàn"
        invoiceCode={payment?.invoice.invoiceNumber}
        orderCode={payment?.invoice.orderRef}
        supplierName={payment?.supplier.supplierName}
        paymentMethod={payment ? modalPaymentMethod(payment.invoice) : 'ESCROW_TRANSFER'}
        totalAmount={payment?.invoice.adjustedAmount}
        paidAmount={payment?.invoice.paidAmount}
        balanceAmount={payment?.invoice.remainingAmount}
        payableAmount={payment?.invoice.remainingAmount}
        transferContent={payment ? `AGRI-DEBT-${payment.invoice.invoiceNumber}` : undefined}
        onClose={() => setPayment(null)}
        onDemoPaid={() => void submitPayment()}
        submitting={submittingPayment}
      />
    </>
  )
}

function SupplierDetailDrawer({ detail, activeTab, setActiveTab, onClose, onPay, focusInvoiceId }: { detail: BuyerDebtSupplierDetail; activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void; onClose: () => void; onPay: (invoice: BuyerDebtInvoice) => void; focusInvoiceId?: number | null }) {
  const outstandingInvoices = detail.invoices.filter(isOutstandingDebtInvoice)
  const closedInvoices = detail.invoices.filter(isClosedDebtInvoice)
  const invoiceMap = new Map(detail.invoices.map((item) => [item.invoiceId, item]))
  const paymentHistoryItems: string[][] = [
    ...closedInvoices.map((invoice) => [
      `${formatMoney(invoice.paidAmount || invoice.adjustedAmount)} - Đã thanh toán`,
      `Hóa đơn ${invoice.invoiceNumber || emptyText} · Đơn ${invoice.orderRef || emptyText} · NCC ${detail.summary.supplierName || emptyText} · ${formatDate(invoice.dueDate || invoice.createdAt)} · Đã xác nhận`,
    ]),
    ...detail.payments.map((item) => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
      return [
        `${formatMoney(item.amount)} - Đã thanh toán`,
        `Hóa đơn ${invoice?.invoiceNumber || item.invoiceId || emptyText} · Đơn ${invoice?.orderRef || emptyText} · NCC ${detail.summary.supplierName || emptyText} · ${item.paymentMethod || emptyText} · ${formatDate(item.paymentDate)} · Đã xác nhận${item.note ? ` · ${item.note}` : ''}`,
      ]
    }),
  ]
  const tabs = [
    ['invoices', 'Hóa đơn phải trả'],
    ['payments', 'Lịch sử thanh toán'],
    ['adjustments', 'Điều chỉnh/giảm trừ'],
    ['reminders', 'Lịch sử nhắc nợ'],
    ['limit', 'Hạn mức công nợ'],
  ] as const

  return (
    <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">{detail.summary.supplierName || emptyText}</h3>
              <p className="text-sm text-slate-500">Còn phải trả {formatMoney(detail.summary.remainingAmount)} · Quá hạn {formatMoney(detail.summary.overdueAmount)}</p>
            </div>
            <button onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Đóng</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeTab === key ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeTab === 'invoices' ? <InvoiceTable invoices={outstandingInvoices} reminders={detail.reminders} onPay={onPay} focusInvoiceId={focusInvoiceId} /> : null}
          {activeTab === 'payments' ? <Timeline empty="Chưa có lịch sử thanh toán." items={paymentHistoryItems} /> : null}
          {activeTab === 'adjustments' ? <Timeline empty="Chưa có điều chỉnh." items={detail.adjustments.map((item) => [`${formatMoney(item.amount)} - ${item.adjustmentType || emptyText}`, `Hóa đơn #${item.invoiceId} · ${formatDate(item.createdAt)}${item.description ? ` · ${item.description}` : ''}`])} /> : null}
          {activeTab === 'reminders' ? <Timeline empty="Chưa có nhắc nợ." items={detail.reminders.map((item) => [`${item.orderCode || emptyText} · ${item.productName || emptyText} ${Number(item.quantity || 0).toLocaleString('vi-VN')}${item.unit || ''} · ${formatMoney(item.amount)} · ${item.status || emptyText}`, `${item.message || emptyText} · ${formatDate(item.sentAt || item.createdAt)} · ${item.senderName || emptyText} · Hạn: ${item.dueLabel || emptyText}`])} /> : null}
          {activeTab === 'limit' ? Number(detail.summary.creditLimit || 0) <= 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Chưa cấp hạn mức công nợ</p>
              <p className="mt-1 text-sm text-slate-600">Nhà cung cấp chưa cấp công nợ 7/15/30 ngày. Các khoản hiện tại là thanh toán ngay hoặc phần còn lại sau cọc.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Hạn mức được cấp" value={detail.summary.creditLimit > 0 ? formatMoney(detail.summary.creditLimit) : 'Chưa cấp công nợ'} />
              <Info label="Đã dùng" value={detail.summary.creditLimit > 0 ? formatMoney(detail.summary.remainingAmount) : '--'} />
              <Info label="Còn lại" value={detail.summary.creditLimit > 0 ? formatMoney(Math.max((detail.summary.creditLimit || 0) - (detail.summary.remainingAmount || 0), 0)) : '--'} />
              <Info label="Kỳ hạn" value={detail.summary.paymentTermDays ? `${detail.summary.paymentTermDays} ngày` : emptyText} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InvoiceTable({ invoices, reminders, onPay, focusInvoiceId }: { invoices: BuyerDebtInvoice[]; reminders: BuyerDebtSupplierDetail['reminders']; onPay: (invoice: BuyerDebtInvoice) => void; focusInvoiceId?: number | null }) {
  if (!invoices.length) return <Empty text="Không có hóa đơn cần thanh toán." />
  const latestReminderByInvoice = new Map<number, BuyerDebtSupplierDetail['reminders'][number]>()
  reminders.forEach((item) => {
    if (!item.invoiceId) return
    if (!latestReminderByInvoice.has(item.invoiceId)) latestReminderByInvoice.set(item.invoiceId, item)
  })
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[1180px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">Hóa đơn</th>
            <th className="px-3 py-2">Đơn hàng</th>
            <th className="px-3 py-2">Ngày tạo</th>
            <th className="px-3 py-2">Loại thanh toán</th>
            <th className="px-3 py-2">Tổng tiền</th>
            <th className="px-3 py-2">Đã thanh toán</th>
            <th className="px-3 py-2">Còn phải trả</th>
            <th className="px-3 py-2">Hạn trả</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr key={invoice.invoiceId} className={focusInvoiceId === invoice.invoiceId ? 'bg-emerald-50' : ''}>
              <td className="px-3 py-2 font-bold">{invoice.invoiceNumber || emptyText}</td>
              <td className="px-3 py-2">{invoice.orderRef || emptyText}</td>
              <td className="px-3 py-2">{formatDate(invoice.createdAt)}</td>
              <td className="px-3 py-2">{paymentPlanLabel(invoice.paymentPlanType, invoice.paymentTermDays)}</td>
              <td className="px-3 py-2">{formatMoney(invoice.adjustedAmount)}</td>
              <td className="px-3 py-2 text-emerald-700">{formatMoney(invoice.paidAmount)}</td>
              <td className="px-3 py-2 font-bold">{formatMoney(invoice.remainingAmount)}</td>
              <td className="px-3 py-2">{dueDateLabel(invoice)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{invoice.statusLabel || emptyText}</span>
                  {latestReminderByInvoice.get(invoice.invoiceId)?.status === 'SENT' ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Nhắc nợ mới</span> : null}
                  {latestReminderByInvoice.get(invoice.invoiceId)?.status === 'READ' ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Đã nhắc nợ</span> : null}
                </div>
              </td>
              <td className="px-3 py-2">
                {canPayInvoice(invoice) ? (
                  <button className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white" onClick={() => onPay(invoice)}>Thanh toán</button>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Đã thanh toán</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ label }: { label: string }) {
  const cls = label === 'Tạm khóa'
    ? 'bg-slate-200 text-slate-700'
    : label === 'Quá hạn'
        ? 'bg-rose-100 text-rose-700'
        : label === 'Sắp đến hạn'
          ? 'bg-amber-100 text-amber-700'
          : label === 'Đã tất toán'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-sky-100 text-sky-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>
}

function kpiLabel(id: string, fallback: string) {
  const labels: Record<string, string> = {
    totalDebt: 'Tổng phải trả',
    paidThisMonth: 'Đã thanh toán tháng này',
    dueSoon: 'Sắp đến hạn',
    overdueDebt: 'Quá hạn',
    unpaidInvoiceCount: 'Hóa đơn còn nợ',
    overdueInvoiceCount: 'Hóa đơn quá hạn',
  }
  return labels[id] || fallback
}

function ActionButton({ icon, text, onClick, disabled }: { icon: React.ReactElement; text: string; onClick: () => void; disabled?: boolean }) {
  return <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={onClick} disabled={disabled}>{icon}{text}</button>
}

function Timeline({ items, empty }: { items: string[][]; empty: string }) {
  if (!items.length) return <Empty text={empty} />
  return <div className="space-y-2">{items.map(([title, body], index) => <div key={`${title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-500">{body}</p></div>)}</div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-extrabold text-slate-900">{value}</p></div>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{text}</p>
}

function Notice({ text, tone }: { text: string; tone: 'emerald' | 'red' }) {
  const cls = tone === 'red' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
  return <div className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${cls}`}>{tone === 'red' ? <AlertTriangle className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}{text}</div>
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[85] bg-black/30 p-4"><div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-4 text-sm font-semibold text-emerald-700">{children}</div></div>
}


