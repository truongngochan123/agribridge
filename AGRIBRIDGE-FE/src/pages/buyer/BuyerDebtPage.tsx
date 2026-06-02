import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, ChevronRight, Clock3, CreditCard, Download, FileText, ReceiptText, TimerReset, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { FilterTabBar, SearchInput, BuyerPanel } from '../../components/buyer/BuyerCommon'
import { DebtReminderList, type DebtReminderCardItem } from '../../components/debt/DebtReminderCard'
import { PaymentTimelineGroup, type PaymentHistoryItem } from '../../components/debt/PaymentHistory'
import { BuyerPaymentInstructionModal } from '../../components/buyer/BuyerPaymentInstructionModal'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
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
import { getBranchContextFromSearchParams, matchesBranchContext } from '../../utils/branchContext'
import { DebtSkeletonLoader } from '../../components/buyer/BuyerSkeletons'

const emptyOverview: BuyerDebtOverview = { kpis: [], suppliers: [] }
const emptyText = 'Chưa có'

type ActiveTab = 'invoices' | 'payments' | 'adjustments' | 'reminders' | 'limit'
type DebtLedgerTab = 'credit' | 'deposit'
type DebtStatCard = { id: string; label: string; value: string }

type DebtPaymentState = {
  supplier: BuyerDebtSupplier
  invoice: BuyerDebtInvoice
}

function formatMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString('vi-VN')
}

function formatDate(value?: string | null) {
  if (!value) return emptyText
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function paymentPlanLabel(plan?: string | null, termDays?: number | null, creditLimit?: number | null) {
  if (plan === 'DEPOSIT_50') return 'Cọc 50% + thanh toán khi nhận hàng'
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

function isDebtPaymentPlan(invoice?: BuyerDebtInvoice) {
  const plan = String(invoice?.paymentPlanType || '').toUpperCase()
  return plan === 'DEPOSIT_50' || plan === 'CREDIT_TERM'
}

function isCreditTermInvoice(invoice?: BuyerDebtInvoice) {
  const plan = String(invoice?.paymentPlanType || '').toUpperCase()
  return plan === 'CREDIT_TERM'
}

function isDepositInvoice(invoice?: BuyerDebtInvoice) {
  const plan = String(invoice?.paymentPlanType || '').toUpperCase()
  return plan === 'DEPOSIT_50' || plan === 'PARTIAL_PAYMENT'
}

function invoicesForLedger(invoices: BuyerDebtInvoice[], ledger: DebtLedgerTab) {
  return invoices.filter((invoice) => ledger === 'credit' ? isCreditTermInvoice(invoice) : isDepositInvoice(invoice))
}

function invoiceOutstandingAmount(invoice: BuyerDebtInvoice) {
  return Math.max(Number(invoice.remainingAmount || 0), 0)
}

function isThisMonth(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
}

function dueDateLabel(invoice: BuyerDebtInvoice) {
  if (invoice.paymentPlanType === 'PREPAID') return 'Ngay khi đặt hàng'
  if (invoice.dueLabel) return invoice.dueLabel
  if (invoice.paymentPlanType === 'DEPOSIT_50' && !invoice.dueDate) return 'Khi nhận hàng'
  return formatDate(invoice.dueDate)
}

function buyerCreditStatusLabel(item: BuyerDebtSupplier) {
  const status = String(item.creditStatus || '').toUpperCase()
  if (status === 'ACTIVE' && Number(item.creditLimit || 0) > 0 && item.paymentTermDays) return `Công nợ ${item.paymentTermDays} ngày`
  if (status === 'SUSPENDED' || item.isBlocked) return 'Công nợ tạm khóa'
  return 'Không được cấp công nợ'
}

function buyerCreditStatusHint(item: BuyerDebtSupplier) {
  const status = String(item.creditStatus || '').toUpperCase()
  if (status === 'ACTIVE' && Number(item.creditLimit || 0) > 0) return 'Đang áp dụng'
  if (status === 'SUSPENDED' || item.isBlocked) return 'Thanh toán công nợ hiện đang bị tạm khóa bởi nhà cung cấp.'
  return 'Nhà cung cấp hiện không hỗ trợ thanh toán công nợ.'
}

function buyerCreditPolicyLabel(item: BuyerDebtSupplier) {
  return item.paymentTermDays ? `Công nợ ${item.paymentTermDays} ngày` : 'Công nợ'
}

function buyerCreditRelationshipStatusLabel(item: BuyerDebtSupplier) {
  const status = String(item.creditStatus || '').toUpperCase()
  if (status === 'CLOSED') return 'Ngưng cấp'
  if (status === 'SUSPENDED' || item.isBlocked || item.status === 'BLOCKED') return 'Tạm khóa'
  return 'Đang áp dụng'
}

function hasBuyerCreditRelationship(item: BuyerDebtSupplier) {
  return ['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(String(item.creditStatus || '').toUpperCase())
}

function buyerCreditRelationshipBadgeLabel(item: BuyerDebtSupplier) {
  const status = String(item.creditStatus || '').toUpperCase()
  if (status === 'SUSPENDED' || item.isBlocked || item.status === 'BLOCKED') return 'Tạm khóa công nợ'
  if (status === 'CLOSED') return 'Ngưng cấp công nợ'
  return buyerCreditPolicyLabel(item)
}

function buyerCreditRelationshipHint(item: BuyerDebtSupplier) {
  const status = String(item.creditStatus || '').toUpperCase()
  if (status === 'SUSPENDED' || item.isBlocked || item.status === 'BLOCKED') return 'Nhà cung cấp đang tạm khóa thanh toán công nợ.'
  if (status === 'CLOSED') return 'Nhà cung cấp hiện không hỗ trợ thanh toán công nợ.'
  return 'Đang áp dụng'
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
  const [ledgerTab, setLedgerTab] = useState<DebtLedgerTab>('credit')
  const branchContext = getBranchContextFromSearchParams(searchParams)
  const branchLabel = branchContext?.branchName || (branchContext?.branchId ? `Chi nhánh #${branchContext.branchId}` : '')

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

  const refreshDebtState = useCallback(async () => {
    setSupplierDetailMap({})
    await loadDebts()
    if (detail?.summary.supplierId) {
      try {
        setDetail(await fetchBuyerDebtSupplierDetail(detail.summary.supplierId))
      } catch {
        setDetail(null)
      }
    }
  }, [detail?.summary.supplierId, loadDebts])

  useNotificationModuleRefresh(['DEBT', 'PAYMENT', 'CREDIT', 'REMINDER'], refreshDebtState)

  useEffect(() => {
    const supplierId = Number(searchParams.get('supplierId') || '')
    const invoiceId = Number(searchParams.get('invoiceId') || '')
    const shouldPay = searchParams.get('pay') === '1'
    const targetModal = searchParams.get('targetModal')
    const shouldOpenPaymentInstruction = shouldPay || targetModal === 'BuyerPaymentInstructionModal'
    if (!Number.isFinite(supplierId) || supplierId <= 0) return
    setFocusInvoiceId(Number.isFinite(invoiceId) && invoiceId > 0 ? invoiceId : null)
    void (async () => {
      const data = await openDetail(supplierId, 'invoices')
      if (!shouldOpenPaymentInstruction || !data) return
      const invoice = data.invoices.find((item) => item.invoiceId === invoiceId)
      if (invoice && canPayInvoice(invoice)) setPayment({ supplier: data.summary, invoice })
    })()
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('supplierId')
      next.delete('invoiceId')
      next.delete('pay')
      next.delete('targetModal')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const openSuppliers = useMemo(() => {
    return overview.suppliers.filter((item) => Number(item.remainingAmount || 0) > 0 || Number(item.unpaidInvoiceCount || 0) > 0)
  }, [overview.suppliers])

  const settledSuppliers = useMemo(() => {
    return overview.suppliers.filter((item) => Number(item.remainingAmount || 0) <= 0 && Number(item.unpaidInvoiceCount || 0) <= 0)
  }, [overview.suppliers])

  const ledgerSuppliers = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    const base = ledgerTab === 'credit'
      ? overview.suppliers
      : status === 'SETTLED'
        ? settledSuppliers
        : openSuppliers
    return base.filter((item) => {
      const detailBySupplier = supplierDetailMap[item.supplierId]
      const ledgerInvoices = invoicesForLedger(detailBySupplier?.invoices || [], ledgerTab)
      const branchInvoices = ledgerInvoices.filter((invoice) => matchesBranchContext(invoice, branchContext))
      const outstandingLedgerInvoices = ledgerInvoices.filter(isOutstandingDebtInvoice)
      const hasLedgerDebt = ledgerTab === 'credit'
        ? hasBuyerCreditRelationship(item)
        : detailBySupplier
          ? outstandingLedgerInvoices.filter((invoice) => matchesBranchContext(invoice, branchContext)).length > 0
          : false
      const matchesKeyword = !text || item.supplierName.toLowerCase().includes(text)
      const matchesBranch = !branchContext || !detailBySupplier || branchInvoices.length > 0
      return hasLedgerDebt && matchesKeyword && matchesBranch
    })
  }, [branchContext, keyword, ledgerTab, openSuppliers, overview.suppliers, settledSuppliers, status, supplierDetailMap])

  const suppliers = useMemo(() => {
    return ledgerSuppliers.filter((item) => {
      const ledgerInvoices = invoicesForLedger(supplierDetailMap[item.supplierId]?.invoices || [], ledgerTab)
      const matchesStatus = status === 'all'
        || (status === 'SETTLED'
          ? ledgerTab === 'credit'
            ? ledgerInvoices.filter(isOutstandingDebtInvoice).length === 0
            : true
          : false)
        || (status === 'DUE_SOON'
          ? ledgerInvoices.some((invoice) => getDebtSeverity(invoice) === 'dueSoon') || (ledgerTab === 'deposit' && Number(item.dueSoonAmount || 0) > 0)
          : status === 'OVERDUE'
            ? ledgerInvoices.some((invoice) => getDebtSeverity(invoice) === 'overdue') || (ledgerTab === 'deposit' && Number(item.overdueAmount || 0) > 0)
            : status === 'BLOCKED'
              ? item.status === 'BLOCKED' || item.isBlocked || String(item.creditStatus || '').toUpperCase() === 'SUSPENDED'
              : item.status === status)
      return matchesStatus
    })
  }, [ledgerSuppliers, ledgerTab, status, supplierDetailMap])

  const depositSuppliers = useMemo(() => {
    return suppliers.map((supplier) => {
      const detailBySupplier = supplierDetailMap[supplier.supplierId]
      const invoices = invoicesForLedger(detailBySupplier?.invoices || [], 'deposit').filter(isOutstandingDebtInvoice)
      return { supplier, invoices }
    }).filter((item) => item.invoices.length > 0)
  }, [suppliers, supplierDetailMap])

  const ledgerStats = useMemo(() => {
    const details = Object.values(supplierDetailMap)
    return ledgerTab === 'credit'
      ? buildBuyerCreditStats(details)
      : buildBuyerDepositStats(details)
  }, [ledgerTab, supplierDetailMap])

  useEffect(() => {
    const candidates = overview.suppliers.filter((item) => {
      const text = keyword.trim().toLowerCase()
      return !text || item.supplierName.toLowerCase().includes(text)
    })
    const missingIds = candidates.map((item) => item.supplierId).filter((id) => !supplierDetailMap[id])
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
  }, [keyword, overview.suppliers, supplierDetailMap])

  const debtTabs = [
    { key: 'all', label: 'Tất cả', count: ledgerSuppliers.length },
    { key: 'OVERDUE', label: 'Quá hạn', count: ledgerSuppliers.filter((item) => invoicesForLedger(supplierDetailMap[item.supplierId]?.invoices || [], ledgerTab).some((invoice) => getDebtSeverity(invoice) === 'overdue')).length },
    { key: 'DUE_SOON', label: 'Sắp đến hạn', count: ledgerSuppliers.filter((item) => invoicesForLedger(supplierDetailMap[item.supplierId]?.invoices || [], ledgerTab).some((invoice) => getDebtSeverity(invoice) === 'dueSoon')).length },
    { key: 'BLOCKED', label: ledgerTab === 'credit' ? 'Tạm khóa công nợ' : 'Tạm khóa', count: ledgerSuppliers.filter((item) => item.status === 'BLOCKED' || item.isBlocked || String(item.creditStatus || '').toUpperCase() === 'SUSPENDED').length },
    { key: 'SETTLED', label: 'Đã tất toán', count: ledgerTab === 'credit' ? ledgerSuppliers.filter((item) => invoicesForLedger(supplierDetailMap[item.supplierId]?.invoices || [], 'credit').filter(isOutstandingDebtInvoice).length === 0).length : settledSuppliers.length },
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

    const payableInvoices = invoicesForLedger(currentDetail.invoices, ledgerTab).filter(canPayInvoice)
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
        note: `Demo thanh toán ${payment.invoice.paymentPlanType === 'DEPOSIT_50' ? 'phần còn lại' : 'công nợ'} ${payment.invoice.invoiceNumber}`,
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

  const exportReport = async () => {
    try {
      const blob = await exportBuyerDebts({ status })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'buyer-debts.xlsx'
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
        title={branchLabel ? `Quản lý Công nợ - ${branchLabel}` : 'Quản lý Công nợ'}
        subtitle={branchLabel ? 'Đang xem công nợ trong phạm vi chi nhánh' : 'Theo dõi công nợ phải trả theo nhà cung cấp và từng hóa đơn'}
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            {branchLabel ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-white"
                onClick={() => setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('branchId')
                  next.delete('branchName')
                  return next
                }, { replace: true })}
              >
                Chi nhánh: {branchLabel}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm nhà cung cấp..." className="min-w-[220px] max-w-sm" />
            <DebtLedgerSegmentedToggle value={ledgerTab} onChange={(value) => { setLedgerTab(value); setStatus('all'); setActiveTab('invoices') }} />
            <FilterTabBar tabs={debtTabs} activeKey={status === 'all' ? 'all' : status} onChange={(key) => setStatus(key)} />
            <button onClick={() => void exportReport()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm">
              <Download className="h-3.5 w-3.5" />
              Xuất báo cáo
            </button>
          </div>
        }
      >
        {loading ? <DebtSkeletonLoader /> : null}
        {!loading && error ? <Notice tone="red" text={error} /> : null}

        {!loading && !error && ledgerStats.length > 0 ? (
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {ledgerStats.map((item) => <DebtStatCardView key={item.id} stat={item} />)}
          </div>
        ) : null}

        <BuyerPanel title={ledgerTab === 'credit' ? 'Công nợ theo Nhà cung cấp' : 'Cọc 50% theo Nhà cung cấp'}>
          {ledgerTab === 'credit' ? (
            <>
              {!loading && !error && suppliers.length === 0 ? <Empty text={status === 'SETTLED' ? 'Chưa có nhà cung cấp đã tất toán.' : 'Bạn không có công nợ cần thanh toán.'} /> : null}
              <div className="grid gap-3">
                {suppliers.map((item) => {
                  const detailBySupplier = supplierDetailMap[item.supplierId]
                  const outstandingInvoices = invoicesForLedger(detailBySupplier?.invoices || [], 'credit').filter(isOutstandingDebtInvoice)
                  return (
                    <BuyerDebtSupplierCard
                      key={item.supplierId}
                      supplier={item}
                      invoices={outstandingInvoices}
                      onOpen={() => void openDetail(item.supplierId)}
                    />
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {!loading && !error && depositSuppliers.length === 0 ? <Empty text="Bạn không có khoản cọc 50% cần thanh toán." /> : null}
              <div className="grid gap-3">
                {depositSuppliers.map(({ supplier, invoices }) => (
                  <BuyerDepositSupplierCard
                    key={supplier.supplierId}
                    supplier={supplier}
                    invoices={invoices}
                    onOpen={() => void openDetail(supplier.supplierId)}
                    onPay={() => void openPayment(supplier)}
                  />
                ))}
              </div>
            </>
          )}
        </BuyerPanel>
      </BuyerShell>

      {detailLoading ? <Overlay>Đang tải chi tiết...</Overlay> : null}
      {detail ? <SupplierDetailDrawer detail={detail} ledgerTab={ledgerTab} activeTab={activeTab} setActiveTab={setActiveTab} onClose={() => { setDetail(null); setFocusInvoiceId(null) }} onPay={(invoice) => void openPayment(detail.summary, invoice)} focusInvoiceId={focusInvoiceId} setFocusInvoiceId={setFocusInvoiceId} /> : null}
      <BuyerPaymentInstructionModal
        open={Boolean(payment)}
        mode="debt"
        title={payment?.invoice.paymentPlanType === 'DEPOSIT_50' ? 'Thanh toán phần còn lại' : 'Thanh toán công nợ'}
        description="Thanh toán qua tài khoản sàn"
        invoiceCode={payment?.invoice.invoiceNumber}
        orderCode={payment?.invoice.orderRef}
        supplierName={payment?.supplier.supplierName}
        paymentMethod={payment ? modalPaymentMethod(payment.invoice) : 'ESCROW_TRANSFER'}
        totalAmount={payment?.invoice.adjustedAmount}
        paidAmount={payment?.invoice.paidAmount}
        balanceAmount={payment?.invoice.remainingAmount}
        payableAmount={payment?.invoice.remainingAmount}
        transferContent={payment ? `${payment.invoice.paymentPlanType === 'DEPOSIT_50' ? 'AGRI-DEPOSIT' : 'AGRI-DEBT'}-${payment.invoice.invoiceNumber}` : undefined}
        onClose={() => setPayment(null)}
        onDemoPaid={() => void submitPayment()}
        submitting={submittingPayment}
      />
    </>
  )
}

function DebtLedgerSegmentedToggle({ value, onChange }: { value: DebtLedgerTab; onChange: (value: DebtLedgerTab) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 p-1 shadow-sm">
      {([
        ['credit', 'Công nợ'],
        ['deposit', 'Cọc 50%'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`min-h-9 min-w-[88px] rounded-full px-4 text-sm font-extrabold transition ${value === key ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-emerald-700 hover:bg-white/70'}`}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function BuyerDebtSupplierCard({ supplier, invoices, onOpen }: { supplier: BuyerDebtSupplier; invoices: BuyerDebtInvoice[]; onOpen: () => void }) {
  const outstandingAmount = invoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueAmount = invoices
    .filter((invoice) => getDebtSeverity(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const statusLabel = buyerCreditRelationshipStatusLabel(supplier)
  const badgeLabel = buyerCreditRelationshipBadgeLabel(supplier)
  const statusHint = buyerCreditRelationshipHint(supplier)
  const statusTone = statusLabel === 'Đang áp dụng'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : statusLabel === 'Tạm khóa'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  const severity: DebtSeverity = overdueAmount > 0 ? 'overdue' : outstandingAmount > 0 ? 'partial' : statusLabel === 'Tạm khóa' ? 'dueSoon' : 'paid'
  const accent = debtSeverityAccent(severity)
  return (
    <article className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent.card}`} onClick={onOpen}>
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,1.25fr)_minmax(360px,1.35fr)_auto] xl:items-center">
        <div className="min-w-0 border-b border-slate-100 pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone}`}>{badgeLabel}</span>
          </div>
          <h3 className="mt-3 truncate text-xl font-extrabold text-slate-950">{supplier.supplierName || emptyText}</h3>
          <p className="mt-1 text-sm font-extrabold text-emerald-700">{buyerCreditPolicyLabel(supplier)}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{statusHint}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DebtMetric label="Hạn mức" value={formatMoney(supplier.creditLimit)} tone="slate" />
          <DebtMetric label="Đang nợ" value={formatMoney(outstandingAmount)} tone={outstandingAmount > 0 ? 'amber' : 'slate'} />
          <DebtMetric label="Quá hạn" value={formatMoney(overdueAmount)} tone={overdueAmount > 0 ? 'rose' : 'slate'} />
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[260px] xl:items-end">
          <div className="text-left xl:text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái công nợ</p>
            <p className={`mt-1 text-2xl font-black ${statusLabel === 'Đang áp dụng' ? 'text-emerald-700' : statusLabel === 'Tạm khóa' ? 'text-amber-700' : 'text-slate-600'}`}>{statusLabel}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{outstandingAmount > 0 ? `Đang nợ ${formatMoney(outstandingAmount)}` : 'Chưa phát sinh công nợ'}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:justify-end">
            <ActionButton icon={<FileText />} text="Chi tiết" onClick={onOpen} />
          </div>
        </div>
      </div>
    </article>
  )
}

function BuyerDepositSupplierCard({ supplier, invoices, onOpen, onPay }: { supplier: BuyerDebtSupplier; invoices: BuyerDebtInvoice[]; onOpen: () => void; onPay: () => void }) {
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.adjustedAmount ?? invoice.totalAmount ?? 0), 0)
  const paidAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? 0), 0)
  const remainingAmount = invoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const dueSoonAmount = invoices
    .filter((invoice) => getDebtSeverity(invoice) === 'dueSoon')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueAmount = invoices
    .filter((invoice) => getDebtSeverity(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const severity: DebtSeverity = overdueAmount > 0 ? 'overdue' : dueSoonAmount > 0 ? 'dueSoon' : remainingAmount > 0 ? 'partial' : 'paid'
  const accent = debtSeverityAccent(severity)
  return (
    <article className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent.card}`} onClick={onOpen}>
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,1.25fr)_minmax(360px,1.35fr)_auto] xl:items-center">
        <div className="min-w-0 border-b border-slate-100 pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">Cọc 50%</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{invoices.length} hóa đơn cọc</span>
          </div>
          <h3 className="mt-3 truncate text-xl font-extrabold text-slate-950">{supplier.supplierName || emptyText}</h3>
          <p className="mt-1 text-sm font-extrabold text-emerald-700">Cọc 50% + thanh toán khi nhận hàng</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">
            {overdueAmount > 0 ? 'Quá hạn' : remainingAmount > 0 ? 'Còn thanh toán' : 'Đã thanh toán'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DebtMetric label="Đã cọc" value={formatMoney(paidAmount)} tone="emerald" />
          <DebtMetric label="Còn thanh toán" value={formatMoney(remainingAmount)} tone={remainingAmount > 0 ? 'amber' : 'slate'} />
          <DebtMetric label="Hóa đơn cọc" value={`${invoices.length}`} tone="slate" />
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[260px] xl:items-end">
          <div className="text-left xl:text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Còn thanh toán</p>
            <p className={`mt-1 text-2xl font-black ${overdueAmount > 0 ? 'text-rose-700' : remainingAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatMoney(remainingAmount)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Hạn: Khi nhận hàng</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:justify-end">
            <ActionButton icon={<FileText />} text="Chi tiết" onClick={onOpen} />
            {remainingAmount > 0 ? <ActionButton icon={<CreditCard />} text="Thanh toán" onClick={onPay} /> : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Đã thanh toán</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 xl:hidden">
        <DebtMetric label="Tổng đơn" value={formatMoney(totalAmount)} tone="slate" />
        <DebtMetric label="Sắp đến hạn" value={formatMoney(dueSoonAmount)} tone={dueSoonAmount > 0 ? 'amber' : 'slate'} />
        <DebtMetric label="Quá hạn" value={formatMoney(overdueAmount)} tone={overdueAmount > 0 ? 'rose' : 'slate'} />
      </div>
    </article>
  )
}

function DebtMetric({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'amber' | 'rose' | 'emerald' }) {
  const cls = tone === 'rose'
    ? 'border-rose-100 bg-rose-50 text-rose-700'
    : tone === 'amber'
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : 'border-slate-100 bg-slate-50 text-slate-700'
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  )
}

function SupplierDetailDrawer({ detail, ledgerTab, activeTab, setActiveTab, onClose, onPay, focusInvoiceId, setFocusInvoiceId }: { detail: BuyerDebtSupplierDetail; ledgerTab: DebtLedgerTab; activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void; onClose: () => void; onPay: (invoice: BuyerDebtInvoice) => void; focusInvoiceId?: number | null; setFocusInvoiceId: (invoiceId: number | null) => void }) {
  const ledgerInvoices = invoicesForLedger(detail.invoices, ledgerTab)
  const outstandingInvoices = ledgerInvoices.filter(isOutstandingDebtInvoice)
  const closedDebtInvoices = ledgerInvoices.filter((invoice) => isDebtPaymentPlan(invoice) && isClosedDebtInvoice(invoice))
  const invoiceMap = new Map(ledgerInvoices.map((item) => [item.invoiceId, item]))
  const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueAmount = outstandingInvoices
    .filter((invoice) => getDebtSeverity(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const creditUsedAmount = invoicesForLedger(detail.invoices, 'credit')
    .filter(isOutstandingDebtInvoice)
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const creditRemainingLimit = Math.max(Number(detail.summary.creditLimit || 0) - creditUsedAmount, 0)
  const reminderItems = detail.reminders.filter((item) => item.invoiceId ? invoiceMap.has(item.invoiceId) : ledgerTab === 'credit').map((item): DebtReminderCardItem => {
    const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
    return {
      ...item,
      invoiceNumber: item.invoiceNumber || invoice?.invoiceNumber,
      orderId: item.orderId || invoice?.orderId,
      orderCode: item.orderCode || invoice?.orderRef,
      productName: item.productName || invoice?.productName,
      quantity: item.quantity ?? invoice?.quantity,
      unit: item.unit || invoice?.unit,
      dueDate: invoice?.dueDate,
      dueLabel: item.dueLabel || invoice?.dueLabel,
      amount: item.amount ?? invoice?.remainingAmount,
      invoiceStatus: invoice?.status,
      overdueDays: invoice?.overdueDays,
      outstandingAmount: invoice?.remainingAmount ?? item.amount,
    }
  })
  const paymentHistoryItems: PaymentHistoryItem[] = [
    ...closedDebtInvoices.map((invoice) => ({
      id: `settled-${invoice.invoiceId}`,
      role: 'buyer' as const,
      amount: Number(invoice.paidAmount || invoice.adjustedAmount || 0),
      status: Number(invoice.paidAmount || invoice.adjustedAmount || 0) > 0 ? 'paid' as const : 'settled' as const,
      paymentDate: invoice.dueDate || invoice.createdAt,
      invoiceCode: invoice.invoiceNumber,
      orderCode: invoice.orderRef,
      counterpartyName: detail.summary.supplierName,
      counterpartyLabel: 'Nhà cung cấp',
      description: Number(invoice.paidAmount || invoice.adjustedAmount || 0) > 0 ? 'Hóa đơn đã được xác nhận thanh toán.' : 'Đã thanh toán đầy đủ.',
      invoiceId: invoice.invoiceId,
      paymentPlanType: invoice.paymentPlanType,
    })),
    ...detail.payments.filter((item) => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
      return invoice ? isDebtPaymentPlan(invoice) : false
    }).map((item) => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
      const isDeposit = invoice?.paymentPlanType === 'DEPOSIT_50' && Number(item.amount || 0) > 0 && Number(item.amount || 0) <= Number(invoice.adjustedAmount || 0) / 2
      return {
        id: `payment-${item.paymentId}`,
        role: 'buyer' as const,
        amount: item.amount,
        status: isDeposit ? 'deposit' as const : Number(item.amount || 0) > 0 ? 'paid' as const : 'settled' as const,
        paymentMethod: item.paymentMethod,
        paymentDate: item.paymentDate,
        note: item.note,
        invoiceCode: invoice?.invoiceNumber || (item.invoiceId ? `INV-${item.invoiceId}` : emptyText),
        orderCode: invoice?.orderRef,
        counterpartyName: detail.summary.supplierName,
        counterpartyLabel: 'Nhà cung cấp',
        invoiceId: item.invoiceId,
        paymentId: item.paymentId,
        paymentPlanType: invoice?.paymentPlanType,
      }
    }),
  ]
  const tabs = [
    ['invoices', 'Hóa đơn phải trả'],
    ['payments', 'Lịch sử thanh toán'],
    ['adjustments', 'Điều chỉnh/giảm trừ'],
    ['reminders', 'Lịch sử nhắc nợ'],
    ...(ledgerTab === 'credit' ? [['limit', 'Hạn mức công nợ'] as const] : []),
  ] as Array<readonly [ActiveTab, string]>

  return (
    <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">{detail.summary.supplierName || emptyText}</h3>
              <p className="text-sm text-slate-500">
                {ledgerTab === 'credit' ? 'Công nợ' : 'Cọc 50%'} · Còn phải trả {formatMoney(outstandingAmount)} · Quá hạn {formatMoney(overdueAmount)}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
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
          {activeTab === 'payments' ? (
            <PaymentTimelineGroup
              empty="Hiện chưa có lịch sử thanh toán."
              items={paymentHistoryItems}
              onOpen={(item) => {
                setFocusInvoiceId(item.invoiceId || null)
                setActiveTab('invoices')
              }}
            />
          ) : null}
          {activeTab === 'adjustments' ? <Timeline empty="Chưa có điều chỉnh." items={detail.adjustments.filter((item) => invoiceMap.has(item.invoiceId)).map((item) => [`${formatMoney(item.amount)} - ${item.adjustmentType || emptyText}`, `Hóa đơn #${item.invoiceId} · ${formatDate(item.createdAt)}${item.description ? ` · ${item.description}` : ''}`])} /> : null}
          {activeTab === 'reminders' ? (
            <DebtReminderList
              items={reminderItems}
              role="buyer"
              counterpartyName={detail.summary.supplierName}
              empty="Hiện chưa có lịch sử nhắc nợ."
              onOpen={(item) => {
                setFocusInvoiceId(item.invoiceId || null)
                setActiveTab('invoices')
              }}
            />
          ) : null}
          {ledgerTab === 'credit' && activeTab === 'limit' ? String(detail.summary.creditStatus || '').toUpperCase() === 'CLOSED' || Number(detail.summary.creditLimit || 0) <= 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">{buyerCreditStatusLabel(detail.summary)}</p>
              <p className="mt-1 text-sm text-slate-600">{buyerCreditStatusHint(detail.summary)} Các khoản công nợ cũ vẫn cần thanh toán bình thường.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Hạn mức được cấp" value={detail.summary.creditLimit > 0 ? formatMoney(detail.summary.creditLimit) : 'Chưa cấp công nợ'} />
              <Info label="Đã dùng" value={detail.summary.creditLimit > 0 ? formatMoney(creditUsedAmount) : '--'} />
              <Info label="Còn lại" value={detail.summary.creditLimit > 0 ? formatMoney(creditRemainingLimit) : '--'} />
              <Info label="Trạng thái" value={buyerCreditStatusLabel(detail.summary)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InvoiceTable({ invoices, reminders, onPay, focusInvoiceId }: { invoices: BuyerDebtInvoice[]; reminders: BuyerDebtSupplierDetail['reminders']; onPay: (invoice: BuyerDebtInvoice) => void; focusInvoiceId?: number | null }) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(focusInvoiceId ?? null)

  useEffect(() => {
    if (!focusInvoiceId) return
    document.getElementById(`buyer-debt-invoice-${focusInvoiceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusInvoiceId])
  if (!invoices.length) return <Empty text="Hiện chưa có hóa đơn cần thanh toán." />

  const latestReminderByInvoice = new Map<number, BuyerDebtSupplierDetail['reminders'][number]>()
  const sortedReminders = [...reminders].sort((a, b) => new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime())
  sortedReminders.forEach((item) => {
    if (!item.invoiceId) return
    if (!latestReminderByInvoice.has(item.invoiceId)) latestReminderByInvoice.set(item.invoiceId, item)
  })

  return (
    <div className="grid gap-3">
      {invoices.map((invoice) => (
        <DebtInvoiceCard
          key={invoice.invoiceId}
          invoice={invoice}
          reminder={latestReminderByInvoice.get(invoice.invoiceId)}
          focused={focusInvoiceId === invoice.invoiceId}
          expanded={expandedInvoiceId === invoice.invoiceId || focusInvoiceId === invoice.invoiceId}
          onToggle={() => setExpandedInvoiceId((current) => current === invoice.invoiceId ? null : invoice.invoiceId)}
          onPay={() => onPay(invoice)}
        />
      ))}
    </div>
  )
}

type DebtSeverity = 'overdue' | 'dueSoon' | 'paid' | 'partial' | 'unpaid'

function DebtInvoiceCard({
  invoice,
  reminder,
  focused,
  expanded,
  onToggle,
  onPay,
}: {
  invoice: BuyerDebtInvoice
  reminder?: BuyerDebtSupplierDetail['reminders'][number]
  focused?: boolean
  expanded?: boolean
  onToggle: () => void
  onPay: () => void
}) {
  const severity = getDebtSeverity(invoice)
  const orderCode = invoice.orderRef || (invoice.orderId ? `ORD-${invoice.orderId}` : emptyText)
  const reminderStatus = String(reminder?.status || '').toUpperCase()
  const isNewReminder = reminderStatus === 'SENT' || reminderStatus === 'UNREAD' || reminderStatus === 'NEW'
  const isReadReminder = reminderStatus === 'READ' || reminderStatus === 'SEEN'
  const accent = debtSeverityAccent(severity)
  const totalAmount = Number(invoice.adjustedAmount ?? invoice.totalAmount ?? 0)
  const paidAmount = Number(invoice.paidAmount ?? 0)

  return (
    <article
      id={`buyer-debt-invoice-${invoice.invoiceId}`}
      className={`group relative cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent.card} ${focused ? 'ring-2 ring-emerald-200' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onToggle()
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DebtStatusBadge invoice={invoice} />
            {isNewReminder ? <DebtReminderBadge tone="new" /> : null}
            {isReadReminder ? <DebtReminderBadge tone="read" /> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-extrabold text-slate-950">{orderCode}</h3>
            <span className="text-sm font-semibold text-slate-400">-</span>
            <DebtAmount value={invoice.remainingAmount} severity={severity} />
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={invoice.invoiceNumber || undefined}>
            Hóa đơn: <span className="font-bold text-slate-700">{invoice.invoiceNumber || emptyText}</span>
          </p>
        </div>

        <DebtActionButton disabled={!canPayInvoice(invoice)} onClick={onPay} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DebtDueDate invoice={invoice} />
        <PaymentProgressBar paid={paidAmount} total={totalAmount} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">
        <span>{expanded ? 'Thu gọn chi tiết' : 'Xem chi tiết hóa đơn'}</span>
        <ChevronRight className={`h-4 w-4 transition ${expanded ? 'rotate-90 text-slate-500' : 'text-slate-300'}`} />
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <DetailLine label="Sản phẩm" value={productSummary(invoice)} />
          <DetailLine label="Chính sách thanh toán" value={paymentPlanLabel(invoice.paymentPlanType, invoice.paymentTermDays)} />
          <DetailLine label="Tổng hóa đơn" value={formatCurrency(totalAmount)} />
          <DetailLine label="Ngày tạo" value={formatDate(invoice.createdAt)} />
        </div>
      ) : null}
    </article>
  )
}

function DebtStatusBadge({ invoice }: { invoice: BuyerDebtInvoice }) {
  const severity = getDebtSeverity(invoice)
  const config = debtSeverityAccent(severity)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${config.badge}`}>
      {config.icon}
      {formatDebtStatus(invoice)}
    </span>
  )
}

function DebtAmount({ value, severity }: { value?: number | null; severity: DebtSeverity }) {
  const cls = severity === 'overdue'
    ? 'text-rose-700'
    : severity === 'dueSoon'
      ? 'text-amber-700'
      : severity === 'paid'
        ? 'text-emerald-700'
        : severity === 'partial'
          ? 'text-sky-700'
          : 'text-slate-950'
  return <p className={`text-lg font-extrabold ${cls}`}>Còn nợ {formatCurrency(value)}</p>
}

function DebtDueDate({ invoice }: { invoice: BuyerDebtInvoice }) {
  const severity = getDebtSeverity(invoice)
  const due = formatDueDate(invoice)
  const cls = severity === 'overdue'
    ? 'border-rose-100 bg-rose-50 text-rose-800'
    : severity === 'dueSoon'
      ? 'border-amber-100 bg-amber-50 text-amber-800'
      : 'border-slate-100 bg-slate-50 text-slate-700'
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">Hạn thanh toán</p>
      <p className="mt-1 text-sm font-extrabold">{due.label}</p>
      {due.hint ? <p className="mt-0.5 text-xs font-semibold opacity-80">{due.hint}</p> : null}
    </div>
  )
}

function PaymentProgressBar({ paid, total }: { paid: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((paid / total) * 100))) : 0
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Đã thanh toán</p>
        <p className="text-xs font-extrabold text-slate-700">{percent}%</p>
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(paid)} / {formatCurrency(total)}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function DebtActionButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  if (disabled) {
    return (
      <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Đã thanh toán
      </span>
    )
  }

  return (
    <button
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <CreditCard className="h-4 w-4" />
      Thanh toán
    </button>
  )
}

function DebtReminderBadge({ tone }: { tone: 'new' | 'read' }) {
  const cls = tone === 'new' ? 'bg-rose-100 text-rose-700 ring-rose-200' : 'bg-amber-100 text-amber-700 ring-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${cls}`}>
      <BellRing className="h-3.5 w-3.5" />
      {tone === 'new' ? 'Cảnh báo nhắc nợ mới' : 'Đã nhắc nợ'}
    </span>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold text-slate-800">{value || emptyText}</p>
    </div>
  )
}

function formatCurrency(value?: number | null) {
  return formatMoney(value)
}

function formatDebtStatus(invoice: BuyerDebtInvoice) {
  const severity = getDebtSeverity(invoice)
  if (severity === 'overdue') return 'Quá hạn'
  if (severity === 'dueSoon') return 'Sắp tới hạn'
  if (severity === 'paid') return 'Đã thanh toán'
  if (severity === 'partial') return 'Thanh toán một phần'
  return 'Chưa thanh toán'
}

function formatDueDate(invoice: BuyerDebtInvoice) {
  const baseLabel = dueDateLabel(invoice)
  const due = parseDebtDate(invoice.dueDate)
  if (invoice.paymentPlanType === 'PREPAID' || !due) return { label: baseLabel, hint: '' }

  const today = startOfToday()
  const target = new Date(due)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return { label: baseLabel, hint: `Quá hạn ${Math.abs(diffDays)} ngày` }
  if (diffDays === 0) return { label: baseLabel, hint: 'Đến hạn hôm nay' }
  if (diffDays <= 3) return { label: baseLabel, hint: `Còn ${diffDays} ngày` }
  return { label: baseLabel, hint: '' }
}

function getDebtSeverity(invoice: BuyerDebtInvoice): DebtSeverity {
  const status = String(invoice.status || '').toUpperCase()
  const remaining = Number(invoice.remainingAmount || 0)
  const paid = Number(invoice.paidAmount || 0)
  if (status === 'PAID' || remaining <= 0) return 'paid'
  if (status === 'OVERDUE' || Number(invoice.overdueDays || 0) > 0 || isDebtOverdue(invoice.dueDate)) return 'overdue'
  if (isDebtDueSoon(invoice.dueDate)) return 'dueSoon'
  if (status === 'PARTIAL' || paid > 0) return 'partial'
  return 'unpaid'
}

function debtSeverityAccent(severity: DebtSeverity) {
  if (severity === 'overdue') {
    return {
      card: 'border-l-4 border-l-rose-500 border-y-rose-100 border-r-rose-100',
      badge: 'bg-rose-50 text-rose-700 ring-rose-100',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    }
  }
  if (severity === 'dueSoon') {
    return {
      card: 'border-l-4 border-l-amber-400 border-y-amber-100 border-r-amber-100',
      badge: 'bg-amber-50 text-amber-700 ring-amber-100',
      icon: <TimerReset className="h-3.5 w-3.5" />,
    }
  }
  if (severity === 'paid') {
    return {
      card: 'border-l-4 border-l-emerald-500 border-y-emerald-100 border-r-emerald-100',
      badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    }
  }
  if (severity === 'partial') {
    return {
      card: 'border-l-4 border-l-sky-500 border-y-sky-100 border-r-sky-100',
      badge: 'bg-sky-50 text-sky-700 ring-sky-100',
      icon: <Clock3 className="h-3.5 w-3.5" />,
    }
  }
  return {
    card: 'border-slate-200',
    badge: 'bg-slate-50 text-slate-700 ring-slate-100',
    icon: <Clock3 className="h-3.5 w-3.5" />,
  }
}

function productSummary(invoice: BuyerDebtInvoice) {
  const product = invoice.productName || emptyText
  if (invoice.quantity == null) return product
  return `${product} · ${Number(invoice.quantity).toLocaleString('vi-VN')}${invoice.unit || ''}`
}

function isDebtOverdue(value?: string | null) {
  const date = parseDebtDate(value)
  if (!date) return false
  date.setHours(0, 0, 0, 0)
  return date.getTime() < startOfToday().getTime()
}

function isDebtDueSoon(value?: string | null) {
  const date = parseDebtDate(value)
  if (!date) return false
  date.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000)
  return diffDays >= 0 && diffDays <= 3
}

function parseDebtDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function buildBuyerCreditStats(details: BuyerDebtSupplierDetail[]): DebtStatCard[] {
  const creditInvoices = details.flatMap((detail) => invoicesForLedger(detail.invoices, 'credit'))
  const outstandingInvoices = creditInvoices.filter(isOutstandingDebtInvoice)
  const overdueInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'overdue')
  const dueSoonInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'dueSoon')
  const creditInvoiceIds = new Set(creditInvoices.map((invoice) => invoice.invoiceId))
  const paidThisMonth = details.flatMap((detail) => detail.payments)
    .filter((payment) => creditInvoiceIds.has(payment.invoiceId) && isThisMonth(payment.paymentDate))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const blockedSuppliers = details.filter((detail) => {
    const summary = detail.summary
    return summary.status === 'BLOCKED' || summary.isBlocked || String(summary.creditStatus || '').toUpperCase() === 'SUSPENDED'
  }).length

  return [
    { id: 'credit-total', label: 'Tổng công nợ', value: formatMoney(outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-overdue', label: 'Quá hạn', value: formatMoney(overdueInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-paid-month', label: 'Đã thanh toán tháng này', value: formatMoney(paidThisMonth) },
    { id: 'credit-due-soon', label: 'Sắp đến hạn', value: formatMoney(dueSoonInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-invoices', label: 'Hóa đơn công nợ', value: formatNumber(outstandingInvoices.length) },
    { id: 'credit-blocked', label: 'Tạm khóa công nợ', value: formatNumber(blockedSuppliers) },
  ]
}

function buildBuyerDepositStats(details: BuyerDebtSupplierDetail[]): DebtStatCard[] {
  const depositInvoices = details.flatMap((detail) => invoicesForLedger(detail.invoices, 'deposit'))
  const outstandingInvoices = depositInvoices.filter(isOutstandingDebtInvoice)
  const overdueInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'overdue')
  const upcomingDeliveryInvoices = outstandingInvoices.filter((invoice) => !invoice.confirmedReceivedAt)

  return [
    { id: 'deposit-paid', label: 'Tổng đã cọc', value: formatMoney(depositInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0)) },
    { id: 'deposit-remaining', label: 'Tổng còn phải thanh toán', value: formatMoney(outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'deposit-pending', label: 'Đơn chờ thanh toán phần còn lại', value: formatNumber(countOrders(outstandingInvoices)) },
    { id: 'deposit-delivery', label: 'Đơn sắp giao', value: formatNumber(countOrders(upcomingDeliveryInvoices)) },
    { id: 'deposit-overdue', label: 'Đơn quá hạn thanh toán', value: formatNumber(countOrders(overdueInvoices)) },
  ]
}

function countOrders(invoices: BuyerDebtInvoice[]) {
  const keys = new Set(invoices.map((invoice) => invoice.orderId ? `order-${invoice.orderId}` : `invoice-${invoice.invoiceId}`))
  return keys.size
}

function DebtStatCardView({ stat }: { stat: DebtStatCard }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{stat.label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{stat.value}</p>
    </div>
  )
}

function ActionButton({ icon, text, onClick, disabled }: { icon: React.ReactElement; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      disabled={disabled}
    >
      {icon}{text}
    </button>
  )
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


