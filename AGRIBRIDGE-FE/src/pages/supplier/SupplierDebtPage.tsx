import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CreditCard, Download, FileText, ReceiptText, Settings } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { FilterTabBar, SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import {
  createSupplierDebtAdjustment,
  createSupplierDebtPayment,
  createSupplierDebtReminder,
  fetchSupplierDebtBuyerDetail,
  fetchSupplierDebts,
  saveSupplierCreditLimit,
  type DebtStatus,
  type SupplierDebtBuyer,
  type SupplierDebtBuyerDetail,
  type SupplierDebtInvoice,
  type SupplierDebtOverview,
} from '../../services/supplierDebtApi'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

const emptyOverview: SupplierDebtOverview = { kpis: [], buyers: [] }
const emptyText = 'Chưa có'

function todayInput() {
  return new Date().toISOString().slice(0, 10)
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
  if (plan === 'DEPOSIT_50') return 'Cọc 50%'
  if (plan === 'CREDIT_TERM') return termDays ? `Công nợ ${termDays} ngày` : 'Công nợ'
  if (plan === 'PREPAID') return 'Thanh toán ngay'
  if (creditLimit != null && creditLimit <= 0) return 'Chưa cấp công nợ'
  return termDays ? `Công nợ ${termDays} ngày` : emptyText
}

function displayInvoiceCode(invoice: SupplierDebtInvoice) {
  const explicit = invoice.displayInvoiceCode?.trim()
  if (explicit) return explicit
  const orderNumber = (invoice.orderCode || invoice.orderRef || '').match(/(\d+)$/)?.[1] || (invoice.orderId ? String(invoice.orderId) : '')
  if (orderNumber) return `INV-${orderNumber}`
  return invoice.invoiceCode || invoice.invoiceNumber || emptyText
}

function invoiceOutstandingAmount(invoice: SupplierDebtInvoice) {
  const totalAmount = Number(invoice.totalAmount ?? 0)
  const paidAmount = Number(invoice.paidAmount ?? 0)
  const adjustmentAmount = Number(invoice.adjustmentAmount ?? (totalAmount - Number(invoice.adjustedAmount ?? totalAmount)))
  return Math.max(totalAmount - paidAmount - adjustmentAmount, 0)
}

function isOutstandingDebtInvoice(invoice: SupplierDebtInvoice) {
  const status = (invoice.status || '').toUpperCase()
  const outstandingAmount = invoiceOutstandingAmount(invoice)
  if (outstandingAmount <= 0) return false
  return ['UNPAID', 'PARTIAL', 'PARTIALLY_PAID', 'DUE_NOW', 'OVERDUE'].includes(status)
}

function debtTypeLabelFromInvoices(invoices: SupplierDebtInvoice[], remainingAmount?: number) {
  const outstanding = invoices.filter(isOutstandingDebtInvoice)
  if (!outstanding.length) return Number(remainingAmount || 0) > 0 ? 'Nhiều loại' : 'Không còn nợ'
  const plans = Array.from(new Set(outstanding.map((item) => String(item.paymentPlanType || '').toUpperCase()).filter(Boolean)))
  if (plans.length > 1) return 'Nhiều loại'
  const only = plans[0]
  if (only === 'PREPAID') return 'Thanh toán ngay chưa trả'
  if (only === 'DEPOSIT_50') return 'Cọc 50%'
  if (only === 'CREDIT_TERM') {
    const terms = Array.from(new Set(outstanding.map((item) => Number(item.paymentTermDays || 0)).filter((item) => item > 0)))
    if (terms.length === 1) return `Công nợ ${terms[0]} ngày`
    return 'Nhiều loại'
  }
  return 'Nhiều loại'
}


function dueDateLabel(invoice: SupplierDebtInvoice) {
  if (invoice.paymentPlanType === 'PREPAID') return 'Ngay khi đặt hàng'
  if (invoice.dueLabel) return invoice.dueLabel
  if (invoice.paymentPlanType === 'DEPOSIT_50' && !invoice.confirmedReceivedAt) return 'Khi nhận hàng'
  if (invoice.paymentPlanType === 'DEPOSIT_50' && invoice.confirmedReceivedAt) return formatDate(invoice.confirmedReceivedAt)
  if (invoice.paymentPlanType === 'CREDIT_TERM' && invoice.dueDate) return formatDate(invoice.dueDate)
  if (!invoice.dueDate) return 'Chưa xác định'
  return formatDate(invoice.dueDate)
}

function reminderDueLabel(invoice: SupplierDebtInvoice) {
  if (invoice.expectedDueDate) return formatDate(invoice.expectedDueDate)
  return dueDateLabel(invoice)
}

function invoiceStatusLabel(invoice: SupplierDebtInvoice) {
  const status = (invoice.status || '').toUpperCase()
  const paidAmount = Number(invoice.paidAmount || 0)
  const outstandingAmount = invoiceOutstandingAmount(invoice)
  if (status === 'OVERDUE' || Number(invoice.overdueDays || 0) > 0) return 'Quá hạn'
  if (outstandingAmount <= 0) return 'Đã thanh toán'
  if (status === 'DUE_NOW') return 'Đến hạn thanh toán'
  if (invoice.paymentPlanType === 'DEPOSIT_50' && paidAmount > 0 && outstandingAmount > 0) return 'Đã cọc 50%'
  if (status === 'UNPAID') return 'Chưa thanh toán'
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') return 'Thanh toán một phần'
  if (status === 'PAID') return 'Đã thanh toán'
  return invoice.statusLabel || emptyText
}

function productLabel(invoice: SupplierDebtInvoice) {
  const quantity = quantityLabel(invoice.quantity, invoice.unit)
  return invoice.productName ? `${invoice.productName}${quantity ? ` ${quantity}` : ''}` : emptyText
}

function productSummary(invoice: SupplierDebtInvoice) {
  const value = productLabel(invoice)
  return value === emptyText ? 'Sản phẩm chưa xác định' : value
}

function quantityLabel(quantity?: number | null, unit?: string | null) {
  if (quantity == null) return ''
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0) return ''
  const text = q.toLocaleString('vi-VN')
  return `${text}${unit || ''}`
}

function supplierStatusLabel(item: SupplierDebtBuyer) {
  if ((item.creditStatus || '').toUpperCase() === 'SUSPENDED' || item.status === 'BLOCKED') return 'Tạm khóa'
  if (Number(item.overdueAmount || 0) > 0) return 'Quá hạn'
  if (Number(item.dueSoonAmount || 0) > 0) return 'Sắp đến hạn'
  if (Number(item.remainingAmount || 0) > 0) return 'Còn phải thu'
  return 'Đã tất toán'
}

function supplierStatusTone(label: string): DebtStatus {
  if (label === 'Tạm khóa') return 'BLOCKED'
  if (label === 'Quá hạn') return 'OVERDUE'
  if (label === 'Sắp đến hạn') return 'DUE_SOON'
  return 'NORMAL'
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

type ModalState =
  | { type: 'payment'; buyer: SupplierDebtBuyer; invoice?: SupplierDebtInvoice }
  | { type: 'reminder'; buyer: SupplierDebtBuyer; invoice?: SupplierDebtInvoice }
  | { type: 'limit'; buyer: SupplierDebtBuyer }
  | { type: 'adjustment'; buyer: SupplierDebtBuyer; invoice?: SupplierDebtInvoice }
  | null

export function SupplierDebtPage() {
  usePageTitle('Quản lý Công nợ')
  const { showToast } = useToast()
  const [overview, setOverview] = useState<SupplierDebtOverview>(emptyOverview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<SupplierDebtBuyerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'adjustments' | 'reminders' | 'limit'>('invoices')
  const [modal, setModal] = useState<ModalState>(null)
  const [saving, setSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [focusInvoiceId, setFocusInvoiceId] = useState<number | null>(null)
  const [buyerDetailMap, setBuyerDetailMap] = useState<Record<number, SupplierDebtBuyerDetail>>({})

  const loadDebts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setOverview(await fetchSupplierDebts())
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
    const buyerId = Number(searchParams.get('buyerId') || '')
    const invoiceId = Number(searchParams.get('invoiceId') || '')
    if (!Number.isFinite(buyerId) || buyerId <= 0) return
    setFocusInvoiceId(Number.isFinite(invoiceId) && invoiceId > 0 ? invoiceId : null)
    void openDetail(buyerId, 'invoices')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('buyerId')
      next.delete('invoiceId')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const buyers = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return overview.buyers.filter((item) => {
      const matchesText = !text || item.buyerName.toLowerCase().includes(text)
      const matchesStatus = status === 'all'
        ? Number(item.remainingAmount || 0) > 0
        : (status === 'REMINDER' ? Number(item.overdueAmount || 0) > 0 || Number(item.dueSoonAmount || 0) > 0 : item.status === status)
      return matchesText && matchesStatus
    })
  }, [keyword, overview.buyers, status])

  useEffect(() => {
    const missingIds = buyers.map((item) => item.buyerId).filter((id) => !buyerDetailMap[id])
    if (!missingIds.length) return
    void (async () => {
      const entries = await Promise.all(
        missingIds.map(async (buyerId) => {
          try {
            const data = await fetchSupplierDebtBuyerDetail(buyerId)
            return [buyerId, data] as const
          } catch {
            return null
          }
        }),
      )
      const next = Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, SupplierDebtBuyerDetail]>)
      if (Object.keys(next).length) setBuyerDetailMap((prev) => ({ ...prev, ...next }))
    })()
  }, [buyers, buyerDetailMap])

  const customerNeedReminderCount = useMemo(
    () => buyers.filter((item) => Number(item.overdueAmount || 0) > 0 || Number(item.dueSoonAmount || 0) > 0).length,
    [buyers],
  )

  const tabs = [
    { key: 'all', label: 'Tất cả', count: overview.buyers.length },
    { key: 'OVERDUE', label: 'Quá hạn', count: overview.buyers.filter((item) => item.status === 'OVERDUE').length },
    { key: 'DUE_SOON', label: 'Sắp đến hạn', count: overview.buyers.filter((item) => item.status === 'DUE_SOON').length },
    { key: 'REMINDER', label: 'Khách cần nhắc', count: customerNeedReminderCount },
    { key: 'BLOCKED', label: 'Tạm khóa', count: overview.buyers.filter((item) => item.status === 'BLOCKED').length },
  ]

  const openDetail = async (buyerId: number, tab = activeTab) => {
    try {
      setDetailLoading(true)
      const data = await fetchSupplierDebtBuyerDetail(buyerId)
      setDetail(data)
      setActiveTab(tab)
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải chi tiết công nợ.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshAfterAction = async (buyerId: number, nextDetail?: SupplierDebtBuyerDetail) => {
    setModal(null)
    await loadDebts()
    setDetail(nextDetail ?? (await fetchSupplierDebtBuyerDetail(buyerId)))
  }

  return (
    <>
      <SupplierShell
        activeKey="debt"
        title="Quản lý Công nợ"
        subtitle="Theo dõi phải thu, hạn mức, thanh toán từng phần và nhắc nợ khách hàng"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm khách hàng..." className="min-w-[220px] max-w-xs" />
            <FilterTabBar tabs={tabs} activeKey={status} onChange={setStatus} />
            <button className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm">
              <Download className="h-3.5 w-3.5" />
              Xuất báo cáo
            </button>
          </div>
        }
      >
        {loading ? <Notice tone="emerald" text="Đang tải dữ liệu công nợ..." /> : null}
        {error ? <Notice tone="red" text={error} /> : null}

        {!loading && !error ? (
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {overview.kpis.map((item) => {
              const label = item.id === 'totalReceivable' ? 'Tổng phát sinh phải thu' : item.id === 'overLimitCustomers' ? 'Khách cần nhắc' : item.label
              const displayValue = item.id === 'overLimitCustomers' ? String(customerNeedReminderCount) : item.displayValue
              return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{displayValue}</p>
              </div>
            )
            })}
          </div>
        ) : null}

        <SupplierPanel>
          {!loading && !error && buyers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có khách hàng còn công nợ.</p>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1360px] w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Loại nợ</th>
                  <th className="px-4 py-3">Hóa đơn còn nợ</th>
                  <th className="px-4 py-3">Còn phải thu</th>
                  <th className="px-4 py-3">Sắp đến hạn</th>
                  <th className="px-4 py-3">Quá hạn</th>
                  <th className="px-4 py-3">Nhắc nợ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {buyers.map((item) => {
                  const detailByBuyer = buyerDetailMap[item.buyerId]
                  const outstandingInvoices = (detailByBuyer?.invoices || []).filter(isOutstandingDebtInvoice)
                  const reminderLabel = reminderColumnLabel(detailByBuyer?.reminders || [])
                  return (
                    <tr key={item.buyerId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <p>{item.buyerName || emptyText}</p>
                        {Number(item.creditLimit || 0) <= 0 ? (
                          <p
                            className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            title="Buyer chưa được cấp công nợ 7/15/30 ngày. Các khoản còn phải thu nếu có là thanh toán ngay hoặc phần còn lại sau cọc."
                          >
                            Chưa cấp hạn mức
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{debtTypeLabelFromInvoices(outstandingInvoices, item.remainingAmount)}</td>
                      <td className="px-4 py-3">{outstandingInvoices.length || item.unpaidInvoiceCount}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(item.remainingAmount)}</td>
                      <td className="px-4 py-3">{formatMoney(item.dueSoonAmount)}</td>
                      <td className={`px-4 py-3 font-semibold ${Number(item.overdueAmount || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{formatMoney(item.overdueAmount)}</td>
                      <td className="px-4 py-3">{reminderLabel}</td>
                      <td className="px-4 py-3"><StatusBadge status={supplierStatusTone(supplierStatusLabel(item))} label={supplierStatusLabel(item)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton icon={<FileText />} text="Chi tiết" onClick={() => void openDetail(item.buyerId)} />
                          {item.remainingAmount > 0 ? <ActionButton icon={<CreditCard />} text="Ghi nhận thủ công" onClick={() => setModal({ type: 'payment', buyer: item })} /> : null}
                          {item.remainingAmount > 0 ? <ActionButton icon={<Bell />} text="Nhắc nợ" onClick={() => setModal({ type: 'reminder', buyer: item })} /> : null}
                          <ActionButton icon={<Settings />} text="Thiết lập hạn mức" onClick={() => setModal({ type: 'limit', buyer: item })} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SupplierPanel>
      </SupplierShell>

      {detailLoading ? <Overlay>Đang tải chi tiết...</Overlay> : null}
      {detail ? (
        <DetailDrawer
          detail={detail}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={() => {
            setDetail(null)
            setFocusInvoiceId(null)
          }}
          onPayment={(invoice) => setModal({ type: 'payment', buyer: detail.summary, invoice })}
          onReminder={(invoice) => setModal({ type: 'reminder', buyer: detail.summary, invoice })}
          onLimit={() => setModal({ type: 'limit', buyer: detail.summary })}
          onAdjustment={(invoice) => setModal({ type: 'adjustment', buyer: detail.summary, invoice })}
          focusInvoiceId={focusInvoiceId}
        />
      ) : null}

      {modal ? (
        <DebtActionModal
          modal={modal}
          detail={detail}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setModal(null)}
          onDone={refreshAfterAction}
        />
      ) : null}
    </>
  )
}

function DetailDrawer({
  detail,
  activeTab,
  setActiveTab,
  onClose,
  onPayment,
  onReminder,
  onLimit,
  onAdjustment,
  focusInvoiceId,
}: {
  detail: SupplierDebtBuyerDetail
  activeTab: string
  setActiveTab: (tab: 'invoices' | 'payments' | 'adjustments' | 'reminders' | 'limit') => void
  onClose: () => void
  onPayment: (invoice?: SupplierDebtInvoice) => void
  onReminder: (invoice?: SupplierDebtInvoice) => void
  onLimit: () => void
  onAdjustment: (invoice?: SupplierDebtInvoice) => void
  focusInvoiceId?: number | null
}) {
  const outstandingInvoices = detail.invoices.filter(isOutstandingDebtInvoice)
  const paidInvoices = detail.invoices.filter((invoice) => (invoice.status || '').toUpperCase() === 'PAID')
  const invoiceMap = new Map(detail.invoices.map((item) => [item.invoiceId, item]))
  const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueAmount = outstandingInvoices
    .filter((invoice) => (invoice.status || '').toUpperCase() === 'OVERDUE')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const paymentHistoryItems: string[][] = [
    ...paidInvoices.map((invoice) => [
      `${formatMoney(invoice.paidAmount || invoice.totalAmount)} - Đã thanh toán`,
      `Đơn ${invoice.orderCode || invoice.orderRef || emptyText} · ${productLabel(invoice)} · Hóa đơn ${displayInvoiceCode(invoice)} · ${formatDate(invoice.dueDate || invoice.createdAt)} · Đã thanh toán`,
    ]),
    ...detail.payments.map((item) => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
      return [
        `${formatMoney(item.amount)} - Đã thanh toán`,
        `Đơn ${invoice?.orderCode || invoice?.orderRef || emptyText} · ${invoice ? productLabel(invoice) : emptyText} · Hóa đơn ${invoice ? displayInvoiceCode(invoice) : item.invoiceId || emptyText} · ${item.paymentMethod || emptyText} · ${formatDate(item.paymentDate)} · Đã thanh toán${item.note ? ` · ${item.note}` : ''}`,
      ]
    }),
  ]
  const tabs = [
    ['invoices', 'Hóa đơn'],
    ['payments', 'Lịch sử thanh toán'],
    ['adjustments', 'Điều chỉnh'],
    ['reminders', 'Nhắc nợ'],
    ['limit', 'Hạn mức'],
  ] as const

  return (
    <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">{detail.summary.buyerName || emptyText}</h3>
              <p className="text-sm text-slate-500">
                {outstandingAmount > 0 ? `Còn phải thu ${formatMoney(outstandingAmount)} · Quá hạn ${formatMoney(overdueAmount)}` : 'Đã tất toán'}
              </p>
            </div>
            <button className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>Đóng</button>
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
          {activeTab === 'invoices' ? <InvoiceTab invoices={outstandingInvoices} onPayment={onPayment} onReminder={onReminder} onAdjustment={onAdjustment} focusInvoiceId={focusInvoiceId} /> : null}
          {activeTab === 'payments' ? <Timeline items={paymentHistoryItems} empty="Chưa có lịch sử thanh toán." /> : null}
          {activeTab === 'adjustments' ? <Timeline items={detail.adjustments.map((item) => [`${formatMoney(item.amount)} - ${item.adjustmentType || emptyText}`, `Hóa đơn #${item.invoiceId} · ${formatDate(item.createdAt)}${item.description ? ` · ${item.description}` : ''}`])} empty="Chưa có điều chỉnh." /> : null}
          {activeTab === 'reminders' ? <Timeline items={detail.reminders.map((item) => [`${item.orderCode || emptyText} · ${item.productName || emptyText} ${quantityLabel(item.quantity, item.unit)} · ${formatMoney(item.amount)} · ${item.status || emptyText}`, `${item.message || emptyText} · ${formatDate(item.sentAt || item.createdAt)} · ${item.senderName || emptyText} · Hạn: ${item.dueLabel || emptyText}`])} empty="Chưa có nhắc nợ." /> : null}
          {activeTab === 'limit' ? Number(detail.creditLimit?.creditLimit || 0) <= 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Chưa cấp hạn mức công nợ</p>
              <p className="mt-1 text-sm text-slate-600">Khách hàng này chưa được cấp công nợ 7/15/30 ngày. Các khoản hiện tại là thanh toán ngay hoặc phần còn lại sau cọc.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-5">
              <Info label="Hạn mức" value={formatMoney(detail.creditLimit?.creditLimit)} />
              <Info label="Đã dùng" value={formatMoney(detail.summary.usedCredit)} />
              <Info label="Còn lại" value={formatMoney(detail.summary.remainingCredit)} />
              <Info label="Kỳ hạn" value={detail.creditLimit?.paymentTermDays ? `${detail.creditLimit.paymentTermDays} ngày` : emptyText} />
              <Info label="Trạng thái" value={detail.creditLimit?.status || emptyText} />
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white md:col-span-5" onClick={onLimit}>Thiết lập hạn mức</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InvoiceTab({ invoices, onPayment, onReminder, onAdjustment, focusInvoiceId }: { invoices: SupplierDebtInvoice[]; onPayment: (invoice: SupplierDebtInvoice) => void; onReminder: (invoice: SupplierDebtInvoice) => void; onAdjustment: (invoice: SupplierDebtInvoice) => void; focusInvoiceId?: number | null }) {
  if (!invoices.length) return <Empty text="Khách hàng này không còn hóa đơn cần thu." />
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[1550px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">Hóa đơn</th><th className="px-3 py-2">Đơn hàng</th><th className="px-3 py-2">Sản phẩm</th><th className="px-3 py-2">Ngày tạo</th><th className="px-3 py-2">Loại thanh toán</th><th className="px-3 py-2">Hạn trả</th><th className="px-3 py-2">Tổng hóa đơn</th><th className="px-3 py-2">Đã thu</th><th className="px-3 py-2">Còn phải thu</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Hành động</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr key={invoice.invoiceId} className={focusInvoiceId === invoice.invoiceId ? 'bg-emerald-50' : ''}>
              <td className="px-3 py-2 font-bold" title={invoice.invoiceCode || invoice.invoiceNumber || emptyText}>{displayInvoiceCode(invoice)}</td>
              <td className="px-3 py-2">{invoice.orderCode || invoice.orderRef || emptyText}</td>
              <td className="px-3 py-2">{productLabel(invoice)}</td>
              <td className="px-3 py-2">{formatDate(invoice.createdAt)}</td>
              <td className="px-3 py-2">{paymentPlanLabel(invoice.paymentPlanType, invoice.paymentTermDays)}</td>
              <td className="px-3 py-2">
                <p>{dueDateLabel(invoice)}</p>
                {invoice.paymentPlanType === 'DEPOSIT_50' && !invoice.confirmedReceivedAt && invoice.expectedDueDate ? (
                  <p className="mt-0.5 text-xs text-slate-500">Dự kiến: {formatDate(invoice.expectedDueDate)}</p>
                ) : null}
              </td>
              <td className="px-3 py-2">{formatMoney(invoice.totalAmount)}</td>
              <td className="px-3 py-2 text-emerald-700">{formatMoney(invoice.paidAmount)}</td>
              <td className="px-3 py-2 font-bold">{formatMoney(invoiceOutstandingAmount(invoice))}</td>
              <td className="px-3 py-2">{invoiceStatusLabel(invoice)}</td>
              <td className="px-3 py-2"><div className="flex gap-1.5">{invoiceOutstandingAmount(invoice) > 0 ? <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50"  onClick={() => onPayment(invoice)}>Ghi nhận thu</button> : null}{invoiceOutstandingAmount(invoice) > 0 ? <button className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700" onClick={() => onReminder(invoice)}>Nhắc</button> : null}{!['PAID', 'CANCELLED', 'VOIDED'].includes((invoice.status || '').toUpperCase()) ? <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700" onClick={() => onAdjustment(invoice)}>Điều chỉnh</button> : null}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DebtActionModal({ modal, detail, saving, setSaving, onClose, onDone }: { modal: NonNullable<ModalState>; detail: SupplierDebtBuyerDetail | null; saving: boolean; setSaving: (value: boolean) => void; onClose: () => void; onDone: (buyerId: number, detail?: SupplierDebtBuyerDetail) => Promise<void> }) {
  const { showToast } = useToast()
  const [buyerInvoices, setBuyerInvoices] = useState<SupplierDebtInvoice[]>(detail?.summary.buyerId === modal.buyer.buyerId ? detail.invoices : [])
  const invoices = buyerInvoices.filter(isOutstandingDebtInvoice)
  const firstInvoice = 'invoice' in modal ? modal.invoice ?? invoices[0] : invoices[0]
  const [invoiceId, setInvoiceId] = useState(firstInvoice ? String(firstInvoice.invoiceId) : '')
  const selectedInvoice = invoices.find((item) => String(item.invoiceId) === invoiceId) ?? firstInvoice
  const [amount, setAmount] = useState(String(selectedInvoice ? invoiceOutstandingAmount(selectedInvoice) : (modal.buyer.remainingAmount ?? 0)))
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [date, setDate] = useState(todayInput())
  const [term, setTerm] = useState(String(modal.buyer.paymentTermDays ?? 15))
  const [limit, setLimit] = useState(String(modal.buyer.creditLimit ?? 0))
  const [status, setStatus] = useState(modal.buyer.creditStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE')
  const [type, setType] = useState('SHORT_DELIVERY')
  const [note, setNote] = useState('')
  const [sendSystemNotification, setSendSystemNotification] = useState(true)
  const [markOnBuyerDebtPage, setMarkOnBuyerDebtPage] = useState(true)
  const selectedOutstandingAmount = selectedInvoice ? invoiceOutstandingAmount(selectedInvoice) : 0
  const isReminderAmountInvalid = modal.type === 'reminder' && selectedOutstandingAmount <= 0

  useEffect(() => {
    let cancelled = false
    const loadInvoices = async () => {
      if (detail?.summary.buyerId === modal.buyer.buyerId) {
        setBuyerInvoices(detail.invoices)
        return
      }
      try {
        const buyerDetail = await fetchSupplierDebtBuyerDetail(modal.buyer.buyerId)
        if (!cancelled) setBuyerInvoices(buyerDetail.invoices || [])
      } catch {
        if (!cancelled) setBuyerInvoices([])
      }
    }
    void loadInvoices()
    return () => {
      cancelled = true
    }
  }, [detail?.summary.buyerId, modal.buyer.buyerId])

  useEffect(() => {
    if (modal.type !== 'reminder') return
    if (!selectedInvoice) return
    const orderCode = selectedInvoice.orderRef || `ORD-${selectedInvoice.orderId}`
    const selectedProductLabel = productSummary(selectedInvoice)
    const nextMessage = `Nhà cung cấp nhắc bạn thanh toán phần còn lại của đơn ${orderCode}: ${selectedProductLabel}, số tiền ${formatMoney(invoiceOutstandingAmount(selectedInvoice))}. Hạn thanh toán: ${reminderDueLabel(selectedInvoice)}.`
    setNote(nextMessage)
    setAmount(String(invoiceOutstandingAmount(selectedInvoice)))
  }, [modal.type, selectedInvoice?.invoiceId])

  useEffect(() => {
    if (invoiceId) return
    if (!invoices.length) return
    const first = invoices[0]
    setInvoiceId(String(first.invoiceId))
    setAmount(String(invoiceOutstandingAmount(first)))
  }, [invoiceId, invoices])

  const submit = async () => {
    try {
      setSaving(true)
      if (modal.type === 'payment') {
        const parsed = Number(amount)
        if (!selectedInvoice || parsed <= 0) throw new Error('Vui lòng chọn hóa đơn và số tiền hợp lệ.')
        const next = await createSupplierDebtPayment({ buyerId: modal.buyer.buyerId, amount: parsed, paymentMethod: method, paymentDate: new Date(date).toISOString(), note: note || undefined, allocations: [{ invoiceId: selectedInvoice.invoiceId, amount: parsed }] })
        await onDone(modal.buyer.buyerId, next)
      } else if (modal.type === 'limit') {
        await saveSupplierCreditLimit({ buyerId: modal.buyer.buyerId, creditLimit: Number(limit), paymentTermDays: Number(term), status, note: note || undefined })
        await onDone(modal.buyer.buyerId)
      } else if (modal.type === 'adjustment') {
        if (!selectedInvoice) throw new Error('Vui lòng chọn hóa đơn.')
        const next = await createSupplierDebtAdjustment({ invoiceId: selectedInvoice.invoiceId, amount: Number(amount), adjustmentType: type, description: note || undefined })
        await onDone(modal.buyer.buyerId, next)
      } else {
        if (!selectedInvoice) throw new Error('Vui lòng chọn hóa đơn cần nhắc nợ.')
        if (isReminderAmountInvalid) throw new Error('Khoản này không còn số tiền cần nhắc.')
        const next = await createSupplierDebtReminder({
          buyerId: modal.buyer.buyerId,
          invoiceId: selectedInvoice.invoiceId,
          amount: selectedOutstandingAmount,
          message: note || undefined,
          channel: 'NOTIFICATION',
          sendSystemNotification,
          markOnBuyerDebtPage,
        })
        await onDone(modal.buyer.buyerId, next)
      }
      showToast(modal.type === 'reminder' ? 'Đã gửi nhắc nợ cho buyer' : 'Đã cập nhật công nợ.', 'success')
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || (requestError instanceof Error ? requestError.message : 'Không thể cập nhật công nợ.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex-shrink-0 border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-extrabold text-slate-900">{modalTitle(modal.type)}</h3>
        </div>
        <div className="max-h-[calc(80vh-140px)] space-y-3 overflow-y-auto px-5 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {modal.type !== 'limit' ? <InvoiceSelect invoices={invoices} value={invoiceId} onChange={(value) => { setInvoiceId(value); const invoice = invoices.find((item) => String(item.invoiceId) === value); if (invoice) setAmount(String(invoiceOutstandingAmount(invoice))) }} /> : null}
          {modal.type === 'reminder' && selectedInvoice ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{modal.buyer.buyerName || emptyText}</p>
                <p className="mt-0.5 truncate text-sm text-slate-600">{selectedInvoice.orderCode || selectedInvoice.orderRef || `ORD-${selectedInvoice.orderId}`} · {productSummary(selectedInvoice)}</p>
                <p className="mt-0.5 text-xs text-slate-400">Hóa đơn {displayInvoiceCode(selectedInvoice)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <p className="text-xs text-slate-500">Đã thu</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-700">{formatMoney(selectedInvoice.paidAmount)}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Còn phải thu</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-800">{formatMoney(selectedOutstandingAmount)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">{paymentPlanLabel(selectedInvoice.paymentPlanType, selectedInvoice.paymentTermDays)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">Hạn trả: {reminderDueLabel(selectedInvoice)}</span>
              </div>
            </div>
          ) : null}
          {modal.type === 'limit' ? (
            <>
              <Field label="Hạn mức" value={limit} onChange={setLimit} type="number" />
              <label className="block text-xs font-bold text-slate-600">Kỳ hạn<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={term} onChange={(event) => setTerm(event.target.value)}><option value="7">7 ngày</option><option value="15">15 ngày</option><option value="30">30 ngày</option></select></label>
              <label className="block text-xs font-bold text-slate-600">Trạng thái<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option></select></label>
            </>
          ) : modal.type === 'reminder' ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-bold text-slate-600">Số tiền cần thanh toán</p>
              <p className="mt-1 text-base font-extrabold text-emerald-700">{formatMoney(selectedOutstandingAmount)}</p>
            </div>
          ) : (
            <Field label="Số tiền" value={amount} onChange={setAmount} type="number" />
          )}
          {modal.type === 'payment' ? <><label className="block text-xs font-bold text-slate-600">Phương thức<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={method} onChange={(event) => setMethod(event.target.value)}><option value="BANK_TRANSFER">Chuyển khoản</option><option value="CASH">Tiền mặt</option><option value="OTHER">Khác</option></select></label><Field label="Ngày thanh toán" value={date} onChange={setDate} type="date" /></> : null}
          {modal.type === 'adjustment' ? <label className="block text-xs font-bold text-slate-600">Loại điều chỉnh<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={type} onChange={(event) => setType(event.target.value)}><option value="SHORT_DELIVERY">Giao thiếu</option><option value="DAMAGED_GOODS">Hàng lỗi</option><option value="DISCOUNT">Chiết khấu</option><option value="SURCHARGE">Phụ thu</option><option value="OTHER">Khác</option></select></label> : null}
          <label className="block text-xs font-bold text-slate-600">{modal.type === 'reminder' ? 'Nội dung gửi buyer' : 'Ghi chú'}<textarea className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {modal.type === 'reminder' ? (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={sendSystemNotification} onChange={(event) => setSendSystemNotification(event.target.checked)} />Gửi thông báo cho buyer</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={markOnBuyerDebtPage} onChange={(event) => setMarkOnBuyerDebtPage(event.target.checked)} />Đánh dấu hóa đơn đã nhắc</label>
              <p className="text-xs text-slate-500">Buyer sẽ nhận thông báo công nợ và khoản này được cập nhật trạng thái đã nhắc.</p>
            </>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600" onClick={onClose} disabled={saving}>Đóng</button>
          <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" onClick={() => void submit()} disabled={saving || isReminderAmountInvalid}>{saving ? 'Đang gửi...' : modal.type === 'reminder' ? 'Gửi nhắc nợ' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

function InvoiceSelect({ invoices, value, onChange }: { invoices: SupplierDebtInvoice[]; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-slate-600">Khoản cần nhắc<select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Chọn khoản cần nhắc</option>{invoices.map((item) => <option key={item.invoiceId} value={item.invoiceId}>{`${item.orderCode || item.orderRef || `ORD-${item.orderId}`} · ${productSummary(item)} · còn ${formatMoney(invoiceOutstandingAmount(item))}`}</option>)}</select></label>
}

function modalTitle(type: NonNullable<ModalState>['type']) {
  if (type === 'payment') return 'Ghi nhận thanh toán'
  if (type === 'limit') return 'Thiết lập hạn mức'
  if (type === 'adjustment') return 'Điều chỉnh công nợ'
  return 'Nhắc nợ khách hàng'
}

function StatusBadge({ status, label }: { status: DebtStatus; label?: string }) {
  const cls: Record<string, string> = {
    NORMAL: 'bg-emerald-100 text-emerald-700',
    DUE_SOON: 'bg-amber-100 text-amber-700',
    OVERDUE: 'bg-rose-100 text-rose-700',
    OVER_LIMIT: 'bg-red-100 text-red-700',
    BLOCKED: 'bg-slate-200 text-slate-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls[status] || cls.NORMAL}`}>{label || status}</span>
}

function ActionButton({ icon, text, onClick, disabled }: { icon: React.ReactElement; text: string; onClick: () => void; disabled?: boolean }) {
  return <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={onClick} disabled={disabled}>{icon}{text}</button>
}

function Timeline({ items, empty }: { items: string[][]; empty: string }) {
  if (!items.length) return <Empty text={empty} />
  return <div className="space-y-2">{items.map(([title, body], index) => <div key={`${title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-500">{body}</p></div>)}</div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-bold text-slate-600">{label}<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
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



